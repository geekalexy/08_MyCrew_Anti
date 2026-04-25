import { GoogleGenAI } from '@google/genai';
try {
  const ai = new GoogleGenAI({ apiKey: undefined });
  console.log("Success with undefined");
} catch(e) {
  console.log("Error with undefined:", e.message);
}
