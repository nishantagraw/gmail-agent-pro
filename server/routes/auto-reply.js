// Feature #4: Auto-Reply Logic Routes
// Automatically reply to business emails with smart filtering

const { google } = require('googleapis');
const { analyzeEmail, generateReply } = require('../services/openai');

// Auto-reply configuration storage (in-memory - can move to Firestore)
const autoReplyConfig = new Map();

// Track replied emails to avoid duplicates
const repliedEmails = new Set();

// Rate limiting (max 20 auto-replies per hour per user)
const rateLimits = new Map();

const autoReplyRoutes = (oauth2Client) => {
    const routes = {};

    // Get auto-reply configuration
    routes.getConfig = async (req, res) => {
        try {
            const email = req.query.email || req.headers['x-user-email'];

            const config = autoReplyConfig.get(email) || {
                enabled: false,
                categories: ['Business Inquiry', 'Pricing Question', 'Partnership'],
                minConfidence: 0.7,
                maxRepliesPerHour: 20
            };

            res.json({ success: true, config });
        } catch (error) {
            console.error('❌ Get config error:', error.message);
            res.status(500).json({ error: error.message });
        }
    };

    // Update auto-reply configuration
    routes.updateConfig = async (req, res) => {
        try {
            const { email, enabled, categories, minConfidence, maxRepliesPerHour } = req.body;

            if (!email) {
                return res.status(400).json({ error: 'Email required' });
            }

            const config = {
                enabled: enabled !== undefined ? enabled : false,
                categories: categories || ['Business Inquiry', 'Pricing Question', 'Partnership'],
                minConfidence: minConfidence || 0.7,
                maxRepliesPerHour: maxRepliesPerHour || 20,
                updatedAt: new Date().toISOString()
            };

            autoReplyConfig.set(email, config);

            console.log(`✅ Auto-reply config updated for: ${email}`, config);

            res.json({ success: true, config });
        } catch (error) {
            console.error('❌ Update config error:', error.message);
            res.status(500).json({ error: error.message });
        }
    };

    // Check if should auto-reply to an email
    const shouldAutoReply = async (email, analysis, userEmail) => {
        const config = autoReplyConfig.get(userEmail);

        // Check if auto-reply is enabled
        if (!config || !config.enabled) {
            return { should: false, reason: 'Auto-reply disabled' };
        }

        // Check rate limit
        const now = Date.now();
        const userLimit = rateLimits.get(userEmail) || { count: 0, resetTime: now + 3600000 };

        if (now > userLimit.resetTime) {
            userLimit.count = 0;
            userLimit.resetTime = now + 3600000;
        }

        if (userLimit.count >= config.maxRepliesPerHour) {
            return { should: false, reason: 'Rate limit reached' };
        }

        // Must be business email
        if (!analysis.isBusiness) {
            return { should: false, reason: 'Not a business email' };
        }

        // Check if category is enabled for auto-reply
        if (!config.categories.includes(analysis.category)) {
            return { should: false, reason: `Category "${analysis.category}" not enabled` };
        }

        // Check confidence level
        if (analysis.confidence < config.minConfidence) {
            return { should: false, reason: 'Confidence too low' };
        }

        // Check if already replied
        if (repliedEmails.has(email.id)) {
            return { should: false, reason: 'Already replied' };
        }

        // Check for Infinite Club keywords
        const infiniteClubKeywords = [
            'infinite club', 'website', 'chatbot', 'gmail agent',
            'pricing', 'service', 'quote', 'build', 'development',
            'infiniteclub14', 'project', 'consultation'
        ];

        const emailText = (email.subject + ' ' + email.body).toLowerCase();
        const hasRelevantKeywords = infiniteClubKeywords.some(keyword =>
            emailText.includes(keyword)
        );

        if (!hasRelevantKeywords) {
            return { should: false, reason: 'Not about Infinite Club services' };
        }

        return { should: true, reason: 'All checks passed' };
    };

    // Send auto-reply
    routes.sendAutoReply = async (req, res) => {
        try {
            const { emailId, userEmail } = req.body;
            const accessToken = req.headers.authorization?.replace('Bearer ', '');

            if (!accessToken) {
                return res.status(401).json({ error: 'No access token' });
            }

            console.log(`🤖 Processing auto-reply for email: ${emailId}`);

            oauth2Client.setCredentials({ access_token: accessToken });
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            // Get email
            const email = await gmail.users.messages.get({
                userId: 'me',
                id: emailId,
                format: 'full'
            });

            const headers = email.data.payload.headers;
            const subject = headers.find(h => h.name === 'Subject')?.value || '';
            const from = headers.find(h => h.name === 'From')?.value || '';
            const messageId = headers.find(h => h.name === 'Message-ID')?.value;

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

            // Analyze email
            const analysis = await analyzeEmail(subject, body, from);

            // Check if should auto-reply
            const { should, reason } = await shouldAutoReply(
                { id: emailId, subject, body },
                analysis,
                userEmail
            );

            if (!should) {
                console.log(`⏭️  Skipping auto-reply: ${reason}`);
                return res.json({ success: true, sent: false, reason });
            }

            // Generate reply
            const emailContent = `Subject: ${subject}\nFrom: ${from}\n\n${body}`;
            const replyText = await generateReply(emailContent, analysis, 'Auto-reply mode');

            // Send reply
            const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

            const message = [
                `To: ${from}`,
                `Subject: ${replySubject}`,
                `In-Reply-To: ${messageId}`,
                `References: ${messageId}`,
                '',
                replyText
            ].join('\n');

            const encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedMessage,
                    threadId: email.data.threadId
                }
            });

            // Update tracking
            repliedEmails.add(emailId);
            const userLimit = rateLimits.get(userEmail) || { count: 0, resetTime: Date.now() + 3600000 };
            userLimit.count++;
            rateLimits.set(userEmail, userLimit);

            console.log(`✅ Auto-reply sent to: ${from}`);

            res.json({
                success: true,
                sent: true,
                to: from,
                category: analysis.category
            });

        } catch (error) {
            console.error('❌ Auto-reply error:', error.message);
            res.status(500).json({ error: error.message });
        }
    };

    // Get auto-reply statistics
    routes.getStats = async (req, res) => {
        try {
            const email = req.query.email;
            const userLimit = rateLimits.get(email) || { count: 0, resetTime: Date.now() + 3600000 };

            const stats = {
                repliedToday: userLimit.count,
                maxPerHour: autoReplyConfig.get(email)?.maxRepliesPerHour || 20,
                resetTime: new Date(userLimit.resetTime).toISOString(),
                totalReplied: repliedEmails.size
            };

            res.json({ success: true, stats });
        } catch (error) {
            console.error('❌ Get stats error:', error.message);
            res.status(500).json({ error: error.message });
        }
    };

    return routes;
};

module.exports = autoReplyRoutes;
