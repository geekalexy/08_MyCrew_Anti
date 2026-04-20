import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/alex/Documents/08_MyCrew_Anti/02_System_Development/01_아리_엔진/.env' });

const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);
async function list() {
  try {
    const response = await ai.models.list();
    const models = [];
    for await (const model of response) {
      if (model.name.includes('flash') || model.name.includes('pro')) {
        models.push(model.name);
      }
    }
    console.log("=== 지원되는 모델 목록 ===");
    console.log(models.join('\n'));
  } catch (e) {
    console.error(e);
  }
}
list();
