import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

(async () => {
  const tokenPath = path.resolve(process.cwd(), 'token.json');
  const data = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  const token = data.access_token;
  
  const customFetch = async (url, init) => {
    console.log("CUSTOM FETCH CALLED!");
    process.exit(0);
  };

  const ai = new GoogleGenAI({ 
    apiKey: 'fake',
    fetch: customFetch 
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
