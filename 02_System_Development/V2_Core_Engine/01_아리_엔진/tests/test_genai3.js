import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

(async () => {
  const tokenPath = path.resolve(process.cwd(), 'token.json');
  const data = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  const token = data.access_token;
  
  const ai = new GoogleGenAI({ 
    apiKey: undefined,
    httpOptions: { headers: { Authorization: `Bearer ${token}` } } 
  });
  console.log("Success with undefined");
  try {
    const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{role: 'user', parts: [{text: 'Hello'}]}]
    });
    console.log("Res:", res);
  } catch (e) {
    console.log("Err:", e.message);
  }
  process.exit(0);
})();
