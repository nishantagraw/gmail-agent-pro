import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

console.log('----------------------------------------');
console.log('🧪 TESTING DEEPSEEK API CONNECTION');
console.log('----------------------------------------');
console.log('🔑 API Key:', DEEPSEEK_API_KEY ? `${DEEPSEEK_API_KEY.substring(0, 5)}...` : 'MISSING');

if (!DEEPSEEK_API_KEY) {
    console.error('❌ Error: DEEPSEEK_API_KEY is missing in .env file');
    process.exit(1);
}

const client = new OpenAI({
    apiKey: DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com'
});

async function testConnection() {
    try {
        console.log('📡 Sending request to DeepSeek...');
        const response = await client.chat.completions.create({
            model: 'deepseek-chat',
            messages: [
                { role: 'user', content: 'Reply with exactly one word: "Success"' }
            ],
            max_tokens: 5
        });

        console.log('✅ Response received:', response.choices[0].message.content);
        console.log('🎉 DEEPSEEK API IS WORKING CORRECTLY!');
    } catch (error) {
        console.error('❌ API TEST FAILED');
        console.error('Error Type:', error.constructor.name);
        console.error('Message:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testConnection();
