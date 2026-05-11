import { GoogleGenAI } from '@google/genai';

(async () => {
  const ai = new GoogleGenAI({ 
    apiKey: 'fake',
    httpOptions: { 
      baseUrl: 'http://localhost:9999' 
    } 
  });
  console.log("baseUrl supported");
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
