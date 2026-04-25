/**
 * [test_list_models.js] 현재 GEMINI_API_KEY로 사용 가능한 모델 목록 조회
 * 실행: node test_list_models.js
 */
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import fetch from 'node-fetch';

const key = process.env.GEMINI_API_KEY;
const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
const json = await res.json();

if (!res.ok) {
    console.error('❌ API 오류:', JSON.stringify(json, null, 2));
    process.exit(1);
}

console.log(`\n✅ 사용 가능한 모델 (${json.models?.length || 0}개):\n`);
(json.models || [])
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .forEach(m => console.log(`  - ${m.name}  (${m.displayName})`));
