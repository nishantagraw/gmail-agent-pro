import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKEN_FILE = path.join(__dirname, '../../tokens.json');

// Ensure file exists
if (!fs.existsSync(TOKEN_FILE)) {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({}));
}

export const loadTokens = () => {
    try {
        const data = fs.readFileSync(TOKEN_FILE, 'utf8');
        return new Map(Object.entries(JSON.parse(data)));
    } catch (error) {
        console.error('Failed to load tokens:', error);
        return new Map();
    }
};

export const saveTokens = (tokenMap) => {
    try {
        const obj = Object.fromEntries(tokenMap);
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(obj, null, 2));
    } catch (error) {
        console.error('Failed to save tokens:', error);
    }
};
