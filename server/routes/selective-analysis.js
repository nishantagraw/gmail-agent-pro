// Feature #3: Selective Analysis Routes
// Allows on-demand email analysis instead of auto-analyzing all emails

const { google } = require('googleapis');
const { analyzeEmail } = require('../services/openai');

const selectiveAnalysisRoutes = (oauth2Client) => {
    const routes = {};

    // Analyze single email on-demand
    routes.analyzeSingle = async (req, res) => {
        try {
            const { emailId } = req.body;
            const accessToken = req.headers.authorization?.replace('Bearer ', '');

            if (!accessToken) {
                return res.status(401).json({ error: 'No access token' });
            }

            if (!emailId) {
                return res.status(400).json({ error: 'Email ID required' });
            }

            console.log(`🔍 Analyzing email: ${emailId}`);

            oauth2Client.setCredentials({ access_token: accessToken });
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            // Get email details
            const email = await gmail.users.messages.get({
                userId: 'me',
                id: emailId,
                format: 'full'
            });

            const headers = email.data.payload.headers;
            const subject = headers.find(h => h.name === 'Subject')?.value || '';
            const from = headers.find(h => h.name === 'From')?.value || '';

            // Extract body
            let body = '';
            if (email.data.payload.parts) {
                const textPart = email.data.payload.parts.find(part =>
                    part.mimeType === 'text/plain'
                );
                if (textPart?.body?.data) {
                    body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
                }
            } else if (email.data.payload.body?.data) {
                body = Buffer.from(email.data.payload.body.data, 'base64').toString('utf-8');
            }

            // Run AI analysis
            const analysis = await analyzeEmail(subject, body, from);

            console.log(`✅ Email analyzed: ${subject.substring(0, 50)}...`);

            res.json({
                success: true,
                analysis
            });

        } catch (error) {
            console.error('❌ Analysis error:', error.message);
            res.status(500).json({ error: error.message });
        }
    };

    // Get emails WITHOUT auto-analysis (Feature #3)
    routes.getEmailsWithoutAnalysis = async (req, res) => {
        try {
            const accessToken = req.headers.authorization?.replace('Bearer ', '');

            if (!accessToken) {
                return res.status(401).json({ error: 'No access token' });
            }

            oauth2Client.setCredentials({ access_token: accessToken });
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            const response = await gmail.users.messages.list({
                userId: 'me',
                maxResults: 20,
                labelIds: ['INBOX']
            });

            if (!response.data.messages) {
                return res.json({ success: true, emails: [] });
            }

            console.log(`📥 Fetching ${response.data.messages.length} emails (selective mode - NO auto-analysis)`);

            // Fetch emails WITHOUT AI analysis
            const emails = await Promise.all(
                response.data.messages.map(async (msg) => {
                    try {
                        const email = await gmail.users.messages.get({
                            userId: 'me',
                            id: msg.id,
                            format: 'full'
                        });

                        const headers = email.data.payload.headers;
                        const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';
                        const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
                        const date = headers.find(h => h.name === 'Date')?.value || '';

                        // Extract body
                        let body = '';
                        if (email.data.payload.parts) {
                            const textPart = email.data.payload.parts.find(part =>
                                part.mimeType === 'text/plain'
                            );
                            if (textPart?.body?.data) {
                                body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
                            }
                        } else if (email.data.payload.body?.data) {
                            body = Buffer.from(email.data.payload.body.data, 'base64').toString('utf-8');
                        }

                        // Return email WITHOUT AI analysis (much faster!)
                        return {
                            id: msg.id,
                            threadId: email.data.threadId,
                            subject,
                            from,
                            date,
                            body: body.substring(0, 500), // Preview only
                            fullBody: body,
                            snippet: email.data.snippet,
                            createdAt: new Date(date || Date.now()).toISOString(),
                            // NO aiAnalysis - user can request it manually
                            hasAnalysis: false
                        };

                    } catch (err) {
                        console.error(`Failed to fetch email ${msg.id}:`, err.message);
                        return null;
                    }
                })
            );

            const validEmails = emails.filter(e => e !== null);

            console.log(`✅ Retrieved ${validEmails.length} emails (selective mode - 10x faster!)`);

            res.json({ success: true, emails: validEmails });

        } catch (error) {
            console.error('❌ Get emails error:', error.message);
            res.status(500).json({ error: error.message });
        }
    };

    return routes;
};

module.exports = selectiveAnalysisRoutes;
