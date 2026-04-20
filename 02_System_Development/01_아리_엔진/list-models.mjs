/**
 * 🔍 Gemini ListModels v4 — DB에서 실제 키 읽기
 * 실행: node list-models.mjs
 */
import Database from 'better-sqlite3';
import fs from 'fs';

// DB에서 실제 GEMINI_API_KEY 꺼내기
const db  = new Database('./database.sqlite', { readonly: true });
const row = db.prepare("SELECT value FROM settings WHERE key = 'GEMINI_API_KEY'").get();
db.close();

const KEY = row?.value;
console.log('🔑 DB 키:', KEY ? KEY.slice(0, 8) + '...(있음)' : '❌ DB에 없음');

if (!KEY) {
  // .env fallback
  const env = fs.existsSync('.env')
    ? Object.fromEntries(
        fs.readFileSync('.env','utf-8').split('\n')
          .filter(l=>l.includes('=')).map(l=>{const[k,...v]=l.split('=');return[k.trim(),v.join('=').trim()];})
      )
    : {};
  console.log('⚠️  .env fallback 사용:', env.GEMINI_API_KEY?.slice(0,8) || '없음');
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}&pageSize=100`;
console.log('\n📡 REST 요청 중...');

const res  = await fetch(url);
const data = await res.json();

if (data.error) {
  console.error('\n❌ API 에러:', JSON.stringify(data.error, null, 2));
  process.exit(1);
}

const models = (data.models || []).map(m => m.name);
console.log(`\n✅ 총 ${models.length}개 모델\n`);

const flash = models.filter(n => n.includes('flash')).sort().reverse();
const pro   = models.filter(n => n.includes('pro')).sort().reverse();

console.log('─── Flash ───────────────────────────────');
flash.forEach(n => console.log('  ', n));
console.log('\n─── Pro ─────────────────────────────────');
pro.forEach(n => console.log('  ', n));

if (flash.length || pro.length) {
  console.log('\n📋 modelRegistry.js 권장:');
  if (flash[0]) console.log(`  FLASH: '${flash[0].replace('models/', '')}'`);
  if (pro[0])   console.log(`  PRO:   '${pro[0].replace('models/', '')}'`);
}
