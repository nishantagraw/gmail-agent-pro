import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { analyzeEmail, generateReply, refineText, testGemini } from './services/openai.js';
import { loadTokens, saveTokens } from './tokenStorage.js';

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load environment variables from correct path
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

console.log('🔧 Environment Check:');
console.log('📁 Current Directory:', __dirname);
console.log('📄 .env Path:', envPath);
console.log('🔑 GEMINI_API_KEY Present:', !!process.env.GEMINI_API_KEY);
console.log('📧 GMAIL_CLIENT_ID Present:', !!process.env.GMAIL_CLIENT_ID);
console.log('🔒 GMAIL_CLIENT_SECRET Present:', !!process.env.GMAIL_CLIENT_SECRET);

// Check if all required environment variables are present
const validateEnvironment = () => {
    const required = ['GEMINI_API_KEY', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error('❌ Missing environment variables:', missing);
        return false;
    }

    console.log('✅ All environment variables loaded successfully');
    return true;
};

validateEnvironment();

const app = express();
const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.FRONTEND_URL
].filter(Boolean);

// Middleware
app.use(cors({
    origin: true, // Allow all origins for cloud deployment
    credentials: true
}));
app.use(express.json());
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
);

// In-memory storage (replace with Firestore in production)
const emailCache = new Map();
const tokenStore = loadTokens(); // Load tokens from file
console.log(`📦 Loaded ${tokenStore.size} user sessions from storage`);

// Global State
const activityLog = [];
const autoReplyConfig = new Map(); // Store per-user config
const rateLimits = new Map(); // Store per-user rate limits
const repliedEmails = new Set(); // Track replied emails to prevent duplicates
const processingUsers = new Set(); // Prevent concurrent processing
const lastCheckedHistory = new Map(); // Track last history ID for each user
let globalAutoReplyEnabled = false; // Global auto-reply ON/OFF switch

// File path for persisting auto-reply history
const AUTO_REPLY_HISTORY_FILE = path.join(__dirname, 'auto-reply-history.json');

// Load auto-reply history from file on startup
const loadAutoReplyHistory = () => {
    try {
        if (fs.existsSync(AUTO_REPLY_HISTORY_FILE)) {
            const data = fs.readFileSync(AUTO_REPLY_HISTORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('⚠️ Could not load auto-reply history:', error.message);
    }
    return [];
};

// Save auto-reply history to file
const saveAutoReplyHistory = () => {
    try {
        fs.writeFileSync(AUTO_REPLY_HISTORY_FILE, JSON.stringify(autoReplyHistory, null, 2));
    } catch (error) {
        console.error('⚠️ Could not save auto-reply history:', error.message);
    }
};

// Initialize auto-reply history from file
const autoReplyHistory = loadAutoReplyHistory();
console.log(`📊 Loaded ${autoReplyHistory.length} auto-reply records from history file`);

// Helper: Add auto-reply record for analytics (with persistence)
const addAutoReplyRecord = (email, from, subject) => {
    autoReplyHistory.push({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        email,
        from,
        subject
    });
    // Keep last 1000 records
    if (autoReplyHistory.length > 1000) {
        autoReplyHistory.shift();
    }
    // Save to file
    saveAutoReplyHistory();
};

// Helper: Add to Activity Log
const addToActivityLog = (message, type = 'info', details = null) => {
    const activity = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        message,
        type,
        details
    };
    activityLog.unshift(activity);
    if (activityLog.length > 100) activityLog.pop(); // Keep last 100
    return activity;
};


// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            gmail: !!process.env.GMAIL_CLIENT_ID,
            gemini: !!process.env.GEMINI_API_KEY,
            aiActive: true
        }
    });
});

// ===== AUTHENTICATION ROUTES =====

// Get OAuth URL
app.get('/auth/url', (req, res) => {
    const scopes = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/userinfo.email'
    ];

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
    });

    res.json({ url });
});

// OAuth Callback
app.get('/auth/callback', async (req, res) => {
    const { code, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (error) {
        return res.redirect(`${frontendUrl}?auth=error&message=${encodeURIComponent(error)}`);
    }

    if (!code) {
        return res.redirect(`${frontendUrl}?auth=error&message=no_code`);
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Get user email
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const userEmail = userInfo.data.email;

        // Store tokens
        tokenStore.set(userEmail, {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: new Date(Date.now() + (tokens.expires_in * 1000))
        });
        saveTokens(tokenStore); // Persist to file

        console.log(`✅ User authenticated: ${userEmail}`);

        // Send both access and refresh token to frontend
        res.redirect(`${frontendUrl}?token=${tokens.access_token}&refresh_token=${tokens.refresh_token}&email=${userEmail}`);
    } catch (error) {
        console.error('❌ Auth error:', error.message);
        res.redirect(`${frontendUrl}?auth=error&message=${encodeURIComponent(error.message)}`);
    }
});

// Refresh access token
app.post('/auth/refresh', async (req, res) => {
    try {
        const { refreshToken, email } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'No refresh token provided' });
        }

        console.log(`🔄 Refreshing token for: ${email}`);

        oauth2Client.setCredentials({
            refresh_token: refreshToken
        });

        const { credentials } = await oauth2Client.refreshAccessToken();

        // Update stored tokens
        if (email) {
            tokenStore.set(email, {
                accessToken: credentials.access_token,
                refreshToken: credentials.refresh_token || refreshToken,
                expiresAt: new Date(Date.now() + (credentials.expires_in * 1000))
            });
            saveTokens(tokenStore); // Persist to file
        }

        console.log(`✅ Token refreshed successfully for: ${email}`);

        res.json({
            success: true,
            accessToken: credentials.access_token,
            expiresIn: credentials.expires_in
        });

    } catch (error) {
        console.error('❌ Token refresh failed:', error.message);
        res.status(401).json({
            error: 'Failed to refresh token',
            message: error.message
        });
    }
});

// ===== FEATURE #3: SELECTIVE ANALYSIS ROUTES =====

// Get all emails WITHOUT auto-analysis (10x faster!)
app.get('/api/emails', async (req, res) => {
    try {
        const accessToken = req.headers.authorization?.replace('Bearer ', '');

        if (!accessToken) {
            return res.status(401).json({ error: 'No access token' });
        }

        oauth2Client.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const label = req.query.label || 'INBOX';

        const response = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 50,
            labelIds: [label]
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
                    const to = headers.find(h => h.name === 'To')?.value || '';

                    // Extract body - prefer HTML for proper rendering like Gmail
                    let htmlBody = '';
                    let textBody = '';

                    // Helper to find parts recursively
                    const findParts = (payload) => {
                        if (payload.parts) {
                            for (const part of payload.parts) {
                                if (part.mimeType === 'text/html' && part.body?.data) {
                                    htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
                                }
                                if (part.mimeType === 'text/plain' && part.body?.data) {
                                    textBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
                                }
                                // Recursively check nested parts (for multipart/alternative)
                                if (part.parts) {
                                    findParts(part);
                                }
                            }
                        } else if (payload.body?.data) {
                            if (payload.mimeType === 'text/html') {
                                htmlBody = Buffer.from(payload.body.data, 'base64').toString('utf-8');
                            } else {
                                textBody = Buffer.from(payload.body.data, 'base64').toString('utf-8');
                            }
                        }
                    };

                    findParts(email.data.payload);

                    // Use HTML if available (for images/links), otherwise plain text
                    const body = htmlBody || textBody;

                    // Return email WITHOUT AI analysis (much faster!)
                    return {
                        id: msg.id,
                        threadId: email.data.threadId,
                        subject,
                        from,
                        to,
                        date,
                        body: textBody.substring(0, 500), // Plain text preview
                        fullBody: body, // HTML or full text for detail view
                        snippet: email.data.snippet,
                        createdAt: new Date(date || Date.now()).toISOString(),
                        // NO aiAnalysis - user can request it manually
                        hasAnalysis: false,
                        labelIds: email.data.labelIds || [],
                        isRead: !email.data.labelIds?.includes('UNREAD'),
                        isStarred: email.data.labelIds?.includes('STARRED')
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
        if (error.message.includes('Invalid Credentials')) {
            return res.status(401).json({ error: 'Invalid Credentials' });
        }
        res.status(500).json({ error: error.message });
    }
});

// ===== ANALYTICS ROUTE =====

app.get('/api/analytics', async (req, res) => {
    try {
        const accessToken = req.headers.authorization?.replace('Bearer ', '');

        if (!accessToken) {
            return res.status(401).json({ error: 'No access token' });
        }

        const emails = Array.from(emailCache.values());

        const analytics = {
            total: emails.length,
            business: emails.filter(e => e.aiAnalysis?.isBusiness).length,
            personal: emails.filter(e => !e.aiAnalysis?.isBusiness).length,
            categories: {
                'Business Inquiry': emails.filter(e => e.aiAnalysis?.category === 'Business Inquiry').length,
                'Pricing Question': emails.filter(e => e.aiAnalysis?.category === 'Pricing Question').length,
                'Support Request': emails.filter(e => e.aiAnalysis?.category === 'Support Request').length,
                'Partnership': emails.filter(e => e.aiAnalysis?.category === 'Partnership').length
            },
            urgent: emails.filter(e => e.aiAnalysis?.urgency).length,
            highPriority: emails.filter(e => e.aiAnalysis?.priority === 'high').length
        };

        res.json({ success: true, analytics });
    } catch (error) {
        console.error('❌ Analytics error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get Label Counts
app.get('/api/labels/counts', async (req, res) => {
    try {
        const accessToken = req.headers.authorization?.replace('Bearer ', '');
        if (!accessToken) {
            return res.status(401).json({ error: 'No access token' });
        }

        oauth2Client.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Get INBOX unread count
        const inboxLabel = await gmail.users.labels.get({
            userId: 'me',
            id: 'INBOX'
        });

        // Get Business unread count from cache (approximation)
        const emails = Array.from(emailCache.values());

        const counts = {
            INBOX: inboxLabel.data.messagesUnread,
            'Business Inquiry': 0,
            'Pricing Question': 0,
            'Partnership': 0,
            'Support Request': 0
        };

        emails.forEach(email => {
            if (!email.isRead && email.aiAnalysis?.category) {
                if (counts[email.aiAnalysis.category] !== undefined) {
                    counts[email.aiAnalysis.category]++;
                }
            }
        });

        res.json(counts);

    } catch (error) {
        console.error('❌ Label counts error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Background Polling Function

// Star an email
app.post('/api/emails/:id/star', async (req, res) => {
    try {
        const accessToken = req.headers.authorization?.replace('Bearer ', '');
        if (!accessToken) return res.status(401).json({ error: 'No access token' });

        oauth2Client.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        await gmail.users.messages.modify({
            userId: 'me',
            id: req.params.id,
            requestBody: { addLabelIds: ['STARRED'] }
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Unstar an email
app.post('/api/emails/:id/unstar', async (req, res) => {
    try {
        const accessToken = req.headers.authorization?.replace('Bearer ', '');
        if (!accessToken) return res.status(401).json({ error: 'No access token' });

        oauth2Client.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        await gmail.users.messages.modify({
            userId: 'me',
            id: req.params.id,
            requestBody: { removeLabelIds: ['STARRED'] }
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Analyze single email on-demand
app.post('/api/emails/analyze', async (req, res) => {
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
        if (error.message.includes('Invalid Credentials')) {
            return res.status(401).json({ error: 'Invalid Credentials' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Generate AI reply
app.post('/api/emails/generate-reply', async (req, res) => {
    try {
        const { emailId } = req.body;
        const accessToken = req.headers.authorization?.replace('Bearer ', '');

        if (!accessToken) {
            return res.status(401).json({ error: 'No access token' });
        }

        oauth2Client.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });

        const email = await gmail.users.messages.get({
            userId: 'me',
            id: emailId,
            format: 'full'
        });

        const headers = email.data.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const from = headers.find(h => h.name === 'From')?.value || '';

        addToActivityLog(`👤 ${timestamp} - Manual AI request started`, 'manual', {
            emailId,
            subject,
            from,
            type: 'manual-request'
        });

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

        const analysis = await analyzeEmail(subject, body, from);

        addToActivityLog(`🤖 ${timestamp} - Generating professional reply...`, 'manual', {
            emailId,
            subject,
            from
        });

        const emailContent = `Subject: ${subject}\nFrom: ${from}\n\n${body}`;
        const reply = await generateReply(emailContent, analysis);

        const completedTime = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
        addToActivityLog(`✅ ${completedTime} - AI reply ready for editing`, 'success', {
            emailId,
            subject,
            from,
            type: 'manual-complete'
        });

        res.json({ success: true, reply });
    } catch (error) {
        console.error('❌ Generate reply error:', error.message);

        // Don't log auth errors to activity log - let frontend retry silently
        if (error.message.includes('Invalid Credentials') || error.response?.status === 401) {
            return res.status(401).json({ error: 'Invalid Credentials' });
        }

        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
        addToActivityLog(`❌ ${timestamp} - Failed to generate reply: ${error.message}`, 'error');
        res.status(500).json({ error: error.message });
    }
});

// Send email
app.post('/api/emails/send', async (req, res) => {
    try {
        const { to, subject, body, threadId } = req.body;
        const accessToken = req.headers.authorization?.replace('Bearer ', '');

        if (!accessToken) {
            return res.status(401).json({ error: 'No access token' });
        }

        addToActivityLog(`📤 Sending manual reply to ${to}...`, 'process');

        oauth2Client.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const message = [
            `To: ${to}`,
            `Subject: ${subject}`,
            '',
            body
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
                threadId: threadId
            }
        });

        console.log(`✅ Email sent to: ${to}`);
        addToActivityLog(`✅ Manual reply sent to ${to}!`, 'success');
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Send email error:', error.message);

        if (error.message.includes('Invalid Credentials')) {
            return res.status(401).json({ error: 'Invalid Credentials' });
        }

        addToActivityLog(`❌ Failed to send email: ${error.message}`, 'error');
        res.status(500).json({ error: error.message });
    }
});

// Delete email
app.post('/api/emails/delete', async (req, res) => {
    try {
        const { emailId } = req.body;
        const accessToken = req.headers.authorization?.replace('Bearer ', '');

        if (!accessToken) {
            return res.status(401).json({ error: 'No access token' });
        }

        oauth2Client.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        await gmail.users.messages.trash({
            userId: 'me',
            id: emailId
        });

        console.log(`🗑️ Email deleted: ${emailId}`);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Delete email error:', error.message);
        if (error.message.includes('Invalid Credentials')) {
            return res.status(401).json({ error: 'Invalid Credentials' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Archive email
app.post('/api/emails/archive', async (req, res) => {
    try {
        const { emailId } = req.body;
        const accessToken = req.headers.authorization?.replace('Bearer ', '');

        if (!accessToken) {
            return res.status(401).json({ error: 'No access token' });
        }

        oauth2Client.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        await gmail.users.messages.modify({
            userId: 'me',
            id: emailId,
            requestBody: {
                removeLabelIds: ['INBOX']
            }
        });

        console.log(`📦 Email archived: ${emailId}`);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Archive email error:', error.message);
        if (error.message.includes('Invalid Credentials')) {
            return res.status(401).json({ error: 'Invalid Credentials' });
        }
        res.status(500).json({ error: error.message });
    }
});

// ===== AI IMPROVEMENT ROUTE =====

app.post('/api/ai/improve', async (req, res) => {
    try {
        const { currentReply, instruction, emailContext } = req.body;

        console.log(`🔄 Improving reply with instruction: "${instruction}"`);

        const enhancedInstruction = instruction +
            `\n\nIMPORTANT: When relevant, include:
      
Contact Details:
📞 WhatsApp: +91 7467845015
📧 Email: infiniteclub14@gmail.com
📷 Instagram: @infiniteclub14

Service Pricing:
- Website Builder: $99-$199
- Auto Gmail Agent: $99 one-time
- Chatbot Text: $99 one-time
- Chatbot Voice: $129 one-time
- Branding Studio: $49 one-time`;

        const improvedReply = await refineText(currentReply, enhancedInstruction);

        console.log('✅ Reply improved successfully');

        res.json({
            success: true,
            improvedReply
        });

    } catch (error) {
        console.error('❌ AI improvement error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ===== FEATURE #4: AUTO-REPLY ROUTES =====

// Get auto-reply configuration
app.get('/api/auto-reply/config', async (req, res) => {
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
});

// Update auto-reply configuration
app.post('/api/auto-reply/config', async (req, res) => {
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
});

// Send auto-reply
app.post('/api/auto-reply/send', async (req, res) => {
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
        const config = autoReplyConfig.get(userEmail);
        if (!config || !config.enabled) {
            return res.json({ success: true, sent: false, reason: 'Auto-reply disabled' });
        }

        // Rate limit check
        const now = Date.now();
        const userLimit = rateLimits.get(userEmail) || { count: 0, resetTime: now + 3600000 };
        if (now > userLimit.resetTime) {
            userLimit.count = 0;
            userLimit.resetTime = now + 3600000;
        }
        if (userLimit.count >= config.maxRepliesPerHour) {
            return res.json({ success: true, sent: false, reason: 'Rate limit reached' });
        }

        // Business check
        if (!analysis.isBusiness) {
            return res.json({ success: true, sent: false, reason: 'Not a business email' });
        }

        // Category check
        if (!config.categories.includes(analysis.category)) {
            return res.json({ success: true, sent: false, reason: `Category "${analysis.category}" not enabled` });
        }

        // Confidence check
        if (analysis.confidence < config.minConfidence) {
            return res.json({ success: true, sent: false, reason: 'Confidence too low' });
        }

        // Duplicate check
        if (repliedEmails.has(emailId)) {
            return res.json({ success: true, sent: false, reason: 'Already replied' });
        }

        // Keyword check
        const infiniteClubKeywords = [
            'infinite club', 'website', 'chatbot', 'gmail agent',
            'pricing', 'service', 'quote', 'build', 'development',
            'infiniteclub14', 'project', 'consultation'
        ];
        const emailText = (subject + ' ' + body).toLowerCase();
        const hasRelevantKeywords = infiniteClubKeywords.some(keyword =>
            emailText.includes(keyword)
        );
        if (!hasRelevantKeywords) {
            return res.json({ success: true, sent: false, reason: 'Not about Infinite Club services' });
        }

        // Generate and send reply
        const emailContent = `Subject: ${subject}\nFrom: ${from}\n\n${body}`;
        const replyText = await generateReply(emailContent, analysis, 'Auto-reply mode');

        const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

        const message = [
            `To: ${from}`,
            `Subject: ${replySubject}`,
            `In-Reply-To: ${messageId}`,
            `References: ${messageId}`,
            `X-Auto-Reply: true`,
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
});

// Get auto-reply statistics
app.get('/api/auto-reply/stats', async (req, res) => {
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
});

// Get activity log
app.get('/api/activity', (req, res) => {
    res.json({ success: true, activity: activityLog });
});

// Delete activity log item
app.delete('/api/activity/:id', (req, res) => {
    const id = parseFloat(req.params.id);
    const index = activityLog.findIndex(a => a.id === id);
    if (index !== -1) {
        activityLog.splice(index, 1);
        console.log(`🗑️ Deleted activity log item: ${id}`);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Activity not found' });
    }
});

// Clear all activity logs
app.delete('/api/activity', (req, res) => {
    activityLog.length = 0;
    console.log('🗑️ Cleared all activity logs');
    res.json({ success: true });
});

// ===== GMAIL WATCH WEBHOOK (Real-Time Email Notifications) =====

// Test Gemini API
app.get('/api/test-gemini', async (req, res) => {
    try {
        console.log('🧪 Testing Gemini API...');
        const response = await testGemini();
        console.log('✅ Gemini Test Response:', response);
        res.json({ success: true, response });
    } catch (error) {
        console.error('❌ Gemini Test Failed:', error.message);
        res.json({ success: false, error: error.message });
    }
});

// Get User Profile
app.get('/api/user/profile', async (req, res) => {
    try {
        const accessToken = req.headers.authorization?.replace('Bearer ', '');
        if (!accessToken) return res.status(401).json({ error: 'No access token' });

        oauth2Client.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const profile = await gmail.users.getProfile({ userId: 'me' });

        res.json({
            success: true,
            profile: {
                email: profile.data.emailAddress,
                messagesTotal: profile.data.messagesTotal,
                threadsTotal: profile.data.threadsTotal,
                historyId: profile.data.historyId
            }
        });
    } catch (error) {
        console.error('❌ Get profile error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Toggle Auto-Reply ON/OFF
app.post('/api/auto-reply/toggle', (req, res) => {
    try {
        const { enabled } = req.body;
        globalAutoReplyEnabled = enabled;

        console.log(`🔘 Auto-reply ${enabled ? 'ENABLED' : 'DISABLED'} globally`);

        res.json({
            success: true,
            enabled: globalAutoReplyEnabled,
            message: `Auto-reply is now ${enabled ? 'ON' : 'OFF'}`
        });
    } catch (error) {
        console.error('❌ Toggle auto-reply error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get Auto-Reply Status
app.get('/api/auto-reply/status', (req, res) => {
    res.json({
        success: true,
        enabled: globalAutoReplyEnabled
    });
});

// --- AUTO-REPLY BACKGROUND WORKER (NEW INCOMING EMAILS ONLY) ---
const AUTO_REPLY_CHECK_INTERVAL = 15000; // 15 seconds
let lastCheckedHistoryId = null;
const processedEmailIds = new Map(); // Map to track ID + Timestamp

// Cleanup processed IDs every hour to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [id, timestamp] of processedEmailIds.entries()) {
        if (now - timestamp > 3600000) { // 1 hour expiration
            processedEmailIds.delete(id);
        }
    }
}, 3600000);

const runAutoReplyWorker = async () => {
    console.log('🔄 Auto-reply worker started - monitoring NEW incoming emails only...');

    setInterval(async () => {
        try {
            // Diagnostic Logging (10% sample rate to avoid noise)
            if (globalAutoReplyEnabled && Math.random() < 0.1) {
                console.log('🔍 AUTO-REPLY DIAGNOSTICS:', {
                    status: 'active',
                    lastHistoryId: lastCheckedHistoryId,
                    processedCacheSize: processedEmailIds.size
                });
            }

            // Check if auto-reply is globally enabled
            if (!globalAutoReplyEnabled) {
                // Log occasionally to confirm worker is alive but disabled
                if (Math.random() < 0.05) {
                    console.log('💤 Auto-reply worker is sleeping (Global Auto-Reply is DISABLED)');
                }
                return; // Skip processing if auto-reply is disabled
            }
            if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) return;

            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            // Get current profile to check for new emails using historyId
            const profile = await gmail.users.getProfile({ userId: 'me' });
            const currentHistoryId = profile.data.historyId;

            // Initialize on first run
            if (!lastCheckedHistoryId) {
                lastCheckedHistoryId = currentHistoryId;
                console.log(`📍 Initialized history tracking at: ${currentHistoryId}`);
                return;
            }

            // Check if there are new changes
            if (currentHistoryId === lastCheckedHistoryId) {
                // No new emails
                return;
            }

            // Get history of NEW messages only
            const history = await gmail.users.history.list({
                userId: 'me',
                startHistoryId: lastCheckedHistoryId,
                historyTypes: ['messageAdded']
            });

            if (!history.data.history) {
                lastCheckedHistoryId = currentHistoryId;
                return;
            }

            console.log(`📨 Found ${history.data.history.length} new email event(s)`);

            // Process NEW incoming messages
            for (const record of history.data.history) {
                if (!record.messagesAdded) continue;

                for (const { message } of record.messagesAdded) {
                    // Skip if already processed
                    if (processedEmailIds.has(message.id)) {
                        console.log(`⏩ Skipping duplicate email: ${message.id}`);
                        continue;
                    }
                    processedEmailIds.set(message.id, Date.now());

                    try {
                        // Fetch full message details
                        const email = await gmail.users.messages.get({
                            userId: 'me',
                            id: message.id,
                            format: 'full'
                        });

                        const headers = email.data.payload.headers;
                        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
                        const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
                        const to = headers.find(h => h.name === 'To')?.value || '';

                        // Check for X-Auto-Reply header
                        const isAutoReply = headers.some(h => h.name === 'X-Auto-Reply' && h.value === 'true');
                        if (isAutoReply) {
                            console.log(`⏩ Skipping own auto-reply: ${subject}`);
                            continue;
                        }

                        // Sender Cooldown Check
                        const senderEmail = from.match(/<(.+)>/)?.[1] || from;
                        const lastReplyTime = rateLimits.get(senderEmail)?.lastReplyTime || 0;
                        const COOLDOWN_PERIOD = 10000; // 10 seconds for testing (was 1 hour)
                        if (Date.now() - lastReplyTime < COOLDOWN_PERIOD) {
                            console.log(`⏩ Skipping sender (cooldown): ${senderEmail}`);
                            continue;
                        }

                        // ONLY process INCOMING emails (not sent by us)
                        const userEmail = profile.data.emailAddress;
                        if (from.includes(userEmail) || (subject.startsWith('Re:') && from.includes(userEmail))) {
                            console.log(`⏩ Skipping outgoing email: ${subject}`);
                            continue;
                        }

                        // Skip drafts and sent items
                        const labels = email.data.labelIds || [];
                        if (labels.includes('DRAFT') || labels.includes('SENT')) {
                            console.log(`⏩ Skipping draft/sent: ${subject}`);
                            continue;
                        }

                        // Log NEW incoming email
                        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
                        addToActivityLog(`📨 ${timestamp} - New email received: "${subject}"`, 'auto-reply', {
                            emailId: message.id,
                            subject,
                            from,
                            type: 'incoming'
                        });

                        // Extract body
                        let body = '';
                        if (email.data.payload.parts) {
                            const textPart = email.data.payload.parts.find(part => part.mimeType === 'text/plain');
                            if (textPart?.body?.data) {
                                body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
                            }
                        } else if (email.data.payload.body?.data) {
                            body = Buffer.from(email.data.payload.body.data, 'base64').toString('utf-8');
                        }

                        // Analyze for business content
                        addToActivityLog(`🔍 ${timestamp} - Analyzing for business content...`, 'auto-reply', {
                            emailId: message.id,
                            subject,
                            from
                        });

                        const analysis = await analyzeEmail(subject, body, from);

                        // Check business keywords
                        const businessKeywords = [
                            'price', 'pricing', 'cost', 'how much', 'quote',
                            'gmail agent', 'website', 'chatbot', 'automation',
                            'partnership', 'collaboration', 'service', 'inquiry'
                        ];
                        const emailText = (subject + ' ' + body).toLowerCase();
                        const hasBusinessKeywords = businessKeywords.some(kw => emailText.includes(kw));

                        if (analysis.isBusiness && hasBusinessKeywords) {
                            addToActivityLog(`✅ ${timestamp} - Business detected: ${analysis.category}`, 'auto-reply', {
                                emailId: message.id,
                                subject,
                                from,
                                category: analysis.category
                            });

                            addToActivityLog(`🤖 ${timestamp} - Generating auto-reply...`, 'auto-reply', {
                                emailId: message.id,
                                subject,
                                from
                            });

                            const emailContent = `Subject: ${subject}\nFrom: ${from}\n\n${body}`;
                            const replyText = await generateReply(emailContent, analysis);

                            addToActivityLog(`📤 ${timestamp} - Sending auto-reply...`, 'auto-reply', {
                                emailId: message.id,
                                subject,
                                from
                            });

                            // Send the auto-reply
                            const rawMessage = [
                                `To: ${from}`,
                                `Subject: Re: ${subject}`,
                                `X-Auto-Reply: true`,
                                '',
                                replyText
                            ].join('\n');

                            const encodedMessage = Buffer.from(rawMessage)
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

                            const sentTime = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
                            addToActivityLog(`✅ ${sentTime} - Auto-reply sent successfully!`, 'success', {
                                emailId: message.id,
                                subject,
                                from,
                                type: 'auto-reply-sent'
                            });

                            console.log(`✅ Auto-reply sent to: ${from}`);

                            // Track auto-reply for analytics
                            addAutoReplyRecord(profile.data.emailAddress, from, subject);

                            // Update sender cooldown
                            rateLimits.set(senderEmail, {
                                ...rateLimits.get(senderEmail),
                                lastReplyTime: Date.now()
                            });
                        } else {
                            addToActivityLog(`⏩ ${timestamp} - Skipped: ${!analysis.isBusiness ? 'Personal email' : 'No business keywords'}`, 'info', {
                                emailId: message.id,
                                subject,
                                from
                            });
                        }

                    } catch (err) {
                        console.error(`❌ Error processing email ${message.id}:`, err.message);
                    }
                }
            }

            // Update last checked history ID
            lastCheckedHistoryId = currentHistoryId;

        } catch (error) {
            console.error('Auto-reply worker error:', error.message);
        }
    }, AUTO_REPLY_CHECK_INTERVAL);
};

// ===== REAL-TIME ANALYTICS (CONNECTED TO GMAIL) =====

// Real-time analytics from Gmail
app.get('/api/analytics/realtime', async (req, res) => {
    try {
        const accessToken = req.headers.authorization?.replace('Bearer ', '');

        if (!accessToken) {
            return res.status(401).json({ error: 'No access token' });
        }

        oauth2Client.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Get real inbox count
        const inboxLabel = await gmail.users.labels.get({
            userId: 'me',
            id: 'INBOX'
        });

        // Get recent emails for classification
        const recentEmails = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 50,
            labelIds: ['INBOX']
        });

        let businessCount = 0;
        let urgentCount = 0;
        let totalFetched = recentEmails.data.messages?.length || 0;

        // Quick analysis of recent emails (check subject lines for business keywords)
        if (recentEmails.data.messages) {
            for (const msg of recentEmails.data.messages.slice(0, 20)) {
                try {
                    const email = await gmail.users.messages.get({
                        userId: 'me',
                        id: msg.id,
                        format: 'metadata',
                        metadataHeaders: ['Subject', 'From']
                    });

                    const headers = email.data.payload.headers;
                    const subject = (headers.find(h => h.name === 'Subject')?.value || '').toLowerCase();
                    const from = (headers.find(h => h.name === 'From')?.value || '').toLowerCase();

                    // Check for business keywords
                    const businessKeywords = ['price', 'pricing', 'quote', 'inquiry', 'service', 'website', 'project', 'business', 'partnership', 'collaboration'];
                    const urgentKeywords = ['urgent', 'asap', 'immediately', 'emergency', 'critical'];

                    if (businessKeywords.some(kw => subject.includes(kw) || from.includes('company') || from.includes('business'))) {
                        businessCount++;
                    }

                    if (urgentKeywords.some(kw => subject.includes(kw))) {
                        urgentCount++;
                    }
                } catch (err) {
                    // Skip failed emails
                }
            }
        }

        const analytics = {
            total: inboxLabel.data.messagesTotal || totalFetched,
            unread: inboxLabel.data.messagesUnread || 0,
            business: businessCount,
            urgent: urgentCount,
            autoReplies: autoReplyHistory.length
        };

        res.json({ success: true, analytics });

    } catch (error) {
        console.error('❌ Real-time analytics error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Auto-Reply Analytics with time filters
app.get('/api/auto-reply/analytics', (req, res) => {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 86400000);
        const weekAgo = new Date(today.getTime() - 7 * 86400000);
        const monthAgo = new Date(today.getTime() - 30 * 86400000);

        // Count replies for different time periods - ONLY from autoReplyHistory
        let todayCount = 0;
        let yesterdayCount = 0;
        let weekCount = 0;
        let monthCount = 0;

        // Single source of truth: autoReplyHistory
        autoReplyHistory.forEach(reply => {
            const replyDate = new Date(reply.timestamp);

            if (replyDate >= today) {
                todayCount++;
            } else if (replyDate >= yesterday && replyDate < today) {
                yesterdayCount++;
            }

            if (replyDate >= weekAgo) {
                weekCount++;
            }

            if (replyDate >= monthAgo) {
                monthCount++;
            }
        });

        const stats = {
            today: todayCount,
            yesterday: yesterdayCount,
            thisWeek: weekCount,
            thisMonth: monthCount,
            total: autoReplyHistory.length
        };

        res.json({ success: true, stats });

    } catch (error) {
        console.error('❌ Auto-reply analytics error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get Auto Reply History (for Auto Replies category)
app.get('/api/auto-replies/history', async (req, res) => {
    try {
        // Return auto reply history sorted by newest first
        const history = [...autoReplyHistory].reverse().map(item => ({
            id: item.id || `auto_${Date.now()}_${Math.random()}`,
            from: item.from || 'Unknown Sender',
            subject: item.subject || 'Auto Reply',
            preview: `Auto-replied on ${new Date(item.timestamp).toLocaleString()}`,
            date: item.timestamp,
            isAutoReply: true,
            email: item.email
        }));

        res.json({
            success: true,
            emails: history,
            count: history.length
        });
    } catch (error) {
        console.error('❌ Auto-reply history error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Reset Auto Reply History
app.post('/api/auto-replies/reset', (req, res) => {
    try {
        // Clear the array
        autoReplyHistory.length = 0;
        // Save empty array to file
        saveAutoReplyHistory();
        console.log('🗑️ Auto-reply history reset');
        res.json({ success: true, message: 'Auto-reply history cleared' });
    } catch (error) {
        console.error('❌ Reset error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Bulk Delete Emails (deletes from Gmail)
app.post('/api/emails/bulk-delete', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No auth token' });

        const accessToken = authHeader.split(' ')[1];
        const { emailIds } = req.body;

        if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
            return res.status(400).json({ error: 'No email IDs provided' });
        }

        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        let deleted = 0;
        let failed = 0;
        let skipped = 0;

        for (const emailId of emailIds) {
            // Skip auto-reply records (they have generated IDs, not real Gmail IDs)
            if (String(emailId).startsWith('auto_') || /^\d+$/.test(String(emailId))) {
                skipped++;
                continue;
            }

            try {
                await gmail.users.messages.trash({
                    userId: 'me',
                    id: emailId
                });
                deleted++;
            } catch (err) {
                console.error(`Failed to delete ${emailId}:`, err.message);
                failed++;
            }
        }

        console.log(`🗑️ Bulk delete: ${deleted} deleted, ${failed} failed, ${skipped} skipped (auto-reply records)`);

        let message = '';
        if (deleted > 0) message += `Deleted ${deleted} emails from Gmail. `;
        if (skipped > 0) message += `${skipped} auto-reply records cannot be deleted (use Reset button). `;
        if (failed > 0) message += `${failed} failed. `;

        res.json({
            success: true,
            deleted,
            failed,
            skipped,
            message: message.trim() || 'No emails processed'
        });
    } catch (error) {
        console.error('❌ Bulk delete error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Start the worker
runAutoReplyWorker();
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 Gmail Agent Pro Backend - GEMINI AI POWERED
📡 Server: http://localhost:${PORT}
🤖 AI: Gemini 2.0 Flash Ready
📧 Gmail API: Configured
🌐 Frontend: ${process.env.FRONTEND_URL}

✨ Features:
   ✅ Auto Token Refresh
   ✅ Pure English AI Replies
   ✅ Selective Analysis
   ✅ Auto-Reply (NEW Incoming Emails Only)
   ✅ Real-Time History Tracking
   ✅ NO Fake Progress Bars!

🔄 Monitoring NEW incoming emails every 15 seconds...
📍 Using historyId to track only new messages
    `);
});

