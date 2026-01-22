import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

async function testOpenAI() {
    console.log('\n🧪 Testing OpenAI API Connection...\n');

    // Check if API key exists
    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY not found in .env file');
        return;
    }

    console.log('✅ API Key found:', process.env.OPENAI_API_KEY.substring(0, 10) + '...');

    try {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        console.log('\n📡 Sending test request to OpenAI...\n');

        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'user', content: 'Say "Hello! OpenAI is working!"' }
            ],
            max_tokens: 50
        });

        console.log('✅ SUCCESS! OpenAI is working!\n');
        console.log('Response:', response.choices[0].message.content);
        console.log('\nModel used:', response.model);
        console.log('Tokens used:', response.usage.total_tokens);

    } catch (error) {
        console.error('\n❌ OpenAI API Error:\n');

        if (error.status === 401) {
            console.error('🔑 AUTHENTICATION ERROR - Invalid API key');
        } else if (error.status === 429) {
            console.error('💳 QUOTA EXCEEDED - You have run out of credits');
            console.error('   Go to: https://platform.openai.com/account/billing');
        } else if (error.status === 403) {
            console.error('🚫 FORBIDDEN - API key may not have access to GPT-4');
        } else {
            console.error('Error Code:', error.status);
            console.error('Error Message:', error.message);
        }

        console.error('\nFull error:', error);
    }
}

testOpenAI();
