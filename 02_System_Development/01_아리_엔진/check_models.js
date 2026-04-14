import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

async function getModels() {
    try {
        const key = process.env.GEMINI_API_KEY;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await res.json();
        fs.writeFileSync('api_models.json', JSON.stringify(data, null, 2));
        console.log("Success");
    } catch (e) {
        fs.writeFileSync('api_models.json', JSON.stringify({error: e.message}));
    }
}
getModels();
