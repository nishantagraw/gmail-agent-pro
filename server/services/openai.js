import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Gemini API Configuration
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('❌ CRITICAL: GEMINI_API_KEY not found in environment variables');
    console.error('📁 Check .env file location and content');
} else {
    console.log('✅ Gemini API Key loaded successfully');
}

const GEMINI_SYSTEM_PROMPT = `
You are Infinite Club's professional email AI assistant. 
Provide accurate information about our services and generate professional responses.

SERVICES & PRICING:
• Auto Gmail Agent: $99 one-time
• Website Builder: $99-$199  
• Chatbot Text: $99 one-time
• Chatbot Voice: $129 one-time
• Branding Studio: $49 one-time

CONTACT INFORMATION:
📞 WhatsApp: +91 7467845015
📧 Email: infiniteclub14@gmail.com
📷 Instagram: @infiniteclub14

Always respond in professional, human-like English without markdown or code formatting.
`;

/**
 * Generate content using Google Gemini API
 */
const generateWithGemini = async (prompt) => {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is missing in environment variables');
    }

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API Error: ${errorData.error?.message || response.statusText} `);
        }

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No candidates returned from Gemini API');
        }

        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('❌ Gemini API Error:', error.message);
        // Fallback or re-throw depending on severity
        throw new Error('Gemini AI service temporarily unavailable');
    }
};

/**
 * Analyze email content with Gemini
 */
export async function analyzeEmail(subject, body, from) {
    try {
        console.log('--- STARTING GEMINI ANALYSIS ---');

        const emailContent = `
Subject: ${subject}
From: ${from}
Body: ${body.substring(0, 2000)}
`.trim();

        const prompt = `${GEMINI_SYSTEM_PROMPT}

Analyze the following email and respond with a JSON object containing:
- category: (Business Inquiry, Pricing Question, Support Request, Partnership, Personal, Spam)
- isBusiness: boolean
    - priority: (high, medium, low)
        - urgency: boolean
            - summary: (short summary of the email)
- suggestedReply: (a brief suggested reply)
- confidence: (number between 0 and 1)

Email to analyze:
${emailContent}

Respond ONLY with valid JSON.Do not include markdown formatting like \`\`\`json.`;

        const startTime = Date.now();
        let content = await generateWithGemini(prompt);
        const duration = Date.now() - startTime;
        console.log(`⏱️ Gemini Response Time: ${duration}ms`);

        // Clean up potential markdown
        content = content.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();

        let analysis;
        try {
            analysis = JSON.parse(content);
        } catch (e) {
            console.warn('⚠️ Failed to parse JSON analysis from Gemini, using fallback');
            analysis = {
                category: 'Personal',
                isBusiness: false,
                priority: 'medium',
                urgency: false,
                summary: content.substring(0, 100),
                suggestedReply: null,
                confidence: 0.5
            };
        }

        console.log(`✅ Analysis complete: ${analysis.category}`);

        return {
            ...analysis,
            analyzedAt: new Date().toISOString(),
            model: 'gemini-pro',
            provider: 'gemini'
        };

    } catch (error) {
        console.error('❌ Gemini Analysis failed:', error.message);
        return {
            category: 'Personal',
            isBusiness: false,
            priority: 'low',
            urgency: false,
            summary: 'Unable to analyze email',
            suggestedReply: null,
            confidence: 0,
            analyzedAt: new Date().toISOString(),
            error: error.message
        };
    }
}

/**
 * Generate PURE ENGLISH email reply using Gemini
 */
export async function generateReply(emailContent, analysis, customContext = '') {
    try {
        console.log('--- STARTING GEMINI REPLY GENERATION ---');

        const prompt = `${GEMINI_SYSTEM_PROMPT}

You are writing an email reply as "Team Infinite Club".

CRITICAL RULES:
1. Write ONLY in pure, natural English - like a real human email.
2. NO code blocks, NO markdown, NO technical formatting.
3. Write as if typing an email in Gmail.
4. Be professional, friendly, and helpful.
5. Highlight specific benefits of our services (e.g., "saves 10+ hours weekly", "24/7 automation").

Email to reply to:
${emailContent}

${customContext ? `Additional context: ${customContext}` : ''}

Include in your reply:
- Acknowledge their inquiry warmly.
- Provide helpful information about Infinite Club services, mentioning key benefits.
- Mention relevant pricing if asked.
- Sign off exactly like this:

Best regards,
Team Infinite Club

📞 WhatsApp: +91 7467845015
📧 Email: infiniteclub14@gmail.com
📷 Instagram: @infiniteclub14

Write the complete email reply now (150 words max):`;

        const startTime = Date.now();
        let reply = await generateWithGemini(prompt);
        const duration = Date.now() - startTime;
        console.log(`⏱️ Gemini Response Time: ${duration}ms`);

        // Cleanup
        reply = reply
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`/g, '')
            .replace(/\*\*/g, '')
            .replace(/#{1,6}\s/g, '')
            .trim();

        console.log(`✅ Reply generated (${reply.length} chars)`);
        return reply;

    } catch (error) {
        console.error('❌ Reply generation failed:', error.message);
        throw error;
    }
}

/**
 * Refine existing text using Gemini
 */
export async function refineText(text, instruction) {
    try {
        const prompt = `${GEMINI_SYSTEM_PROMPT}

You are a professional email editor. Output ONLY pure English text. NO code blocks, NO markdown.

Rewrite this email based on: "${instruction}"

Original:
${text}`;

        let refined = await generateWithGemini(prompt);
        refined = refined.replace(/```[\s\S]*?```/g, '').replace(/\*\*/g, '').trim();

        return refined;
    } catch (error) {
        console.error('❌ Text refinement failed:', error.message);
        return text;
    }
}

/**
 * Test Gemini API connection
 */
export async function testGemini() {
    try {
        const response = await generateWithGemini("Hello, respond with 'Gemini is working'");
        return response;
    } catch (error) {
        throw error;
    }
}

export default {
    analyzeEmail,
    generateReply,
    refineText,
    testGemini
};
