import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const key = process.env.GEMINI_API_KEY;
// Try v1beta first
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

console.log('Fetching models from:', url);

fetch(url)
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            console.error('Error fetching models:', data.error);
        } else {
            console.log('Available Models:');
            data.models?.forEach(m => console.log(`- ${m.name}`));
        }
    })
    .catch(err => console.error('Fetch error:', err));
