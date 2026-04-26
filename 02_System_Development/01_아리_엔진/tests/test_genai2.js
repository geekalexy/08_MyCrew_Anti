import { GoogleGenAI } from '@google/genai';
import { getGoogleOAuthToken } from './server.js';
(async () => {
  const token = await getGoogleOAuthToken();
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
    console.log("Err:", e.message, e);
  }
  process.exit(0);
})();
