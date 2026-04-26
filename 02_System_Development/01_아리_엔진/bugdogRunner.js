/**
 * 🐕 bugdogRunner.js — Phase 27 Bugdog v0 (감시만 하는 파수견)
 *
 * 독립 프로세스로 실행 (PM2 또는 node 직접 실행)
 * ariDaemon과 분리되어 감시 대상이 죽어도 감시자는 살아있음
 *
 * 실행: node bugdogRunner.js           ← cron 스케줄 (AM 03:00)
 *       node bugdogRunner.js --now     ← 즉시 수동 실행
 */

// P2 수정(Prime): Node v24 네이티브 fetch 사용 — node-fetch 제거
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const OUTPUT_DIR = path.resolve(__dirname, 'outputs/bugdog');
const DB_PATH    = path.resolve(__dirname, 'database.sqlite');

// ── 출력 디렉토리 보장 ────────────────────────────────────────────────────
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ── 결과 축적 ─────────────────────────────────────────────────────────────
const results = [];

function log(emoji, label, status, detail = '') {
  const line = `${emoji} [${label}] ${status}${detail ? ' — ' + detail : ''}`;
  console.log(line);
  return line;
}

// ── 헬스체크 유틸 ─────────────────────────────────────────────────────────
async function httpGet(url, timeoutMs = 5000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, method: 'GET' });
    const latency = Date.now() - start;
    return { ok: res.ok, status: res.status, latency };
  } catch (e) {
    return { ok: false, status: 0, latency: Date.now() - start, error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

// ── 7개 헬스체크 함수 ─────────────────────────────────────────────────────

/** [1] 소켓 서버 — /health 또는 루트 GET 으로 생존 확인 */
async function checkSocketServer() {
  const r = await httpGet(`${SERVER_URL}/health`, 4000).catch(() => httpGet(SERVER_URL, 4000));
  if (!r.ok && r.status === 0) return { service: '소켓 서버', severity: 'CRITICAL', errorCode: 'SRV_DOWN', errorMsg: r.error || '응답 없음' };
  return { service: '소켓 서버', severity: 'OK', latency: r.latency };
}

/** [2] DB (SQLite) — 간단한 SELECT */
async function checkDatabase() {
  return new Promise((resolve) => {
    if (!fs.existsSync(DB_PATH)) {
      return resolve({ service: 'DB (SQLite)', severity: 'CRITICAL', errorCode: 'DB_FILE_MISSING', errorMsg: 'database.sqlite 파일 없음' });
    }
    const Db = sqlite3.Database;
    const db = new Db(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) return resolve({ service: 'DB (SQLite)', severity: 'CRITICAL', errorCode: 'DB_OPEN_FAIL', errorMsg: err.message });
      db.get('SELECT COUNT(*) as cnt FROM Task', (e) => {
        db.close();
        if (e) return resolve({ service: 'DB (SQLite)', severity: 'CRITICAL', errorCode: 'DB_QUERY_FAIL', errorMsg: e.message });
        resolve({ service: 'DB (SQLite)', severity: 'OK' });
      });
    });
  });
}

/** [3] Gemini API — 간접 검증 (API 키 유효성 + DB 마지막 성공 호출) */
async function checkGeminiApi() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey.length < 10) {
    return { service: 'Gemini API', severity: 'CRITICAL', errorCode: 'GEMINI_KEY_MISSING', errorMsg: 'API 키 미등록 또는 유효하지 않음' };
  }
  // DB에서 마지막 성공 호출 확인 (Task 생성 기록으로 간접 추정)
  return new Promise((resolve) => {
    if (!fs.existsSync(DB_PATH)) return resolve({ service: 'Gemini API', severity: 'WARNING', errorMsg: 'DB 없어 검증 불가' });
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) return resolve({ service: 'Gemini API', severity: 'WARNING', errorMsg: 'DB 접근 불가' });
      db.get(`SELECT MAX(created_at) as last FROM Task WHERE LOWER(model) LIKE '%gemini%'`, (e, row) => {
        db.close();
        if (e || !row?.last) return resolve({ service: 'Gemini API', severity: 'WARNING', errorCode: 'GEMINI_NO_RECENT', errorMsg: '최근 Gemini 호출 기록 없음' });
        const hoursSince = (Date.now() - new Date(row.last).getTime()) / 3_600_000;
        if (hoursSince > 24) return resolve({ service: 'Gemini API', severity: 'WARNING', errorCode: 'GEMINI_STALE', errorMsg: `최근 ${Math.round(hoursSince)}시간 동안 성공 호출 없음` });
        resolve({ service: 'Gemini API', severity: 'OK' });
      });
    });
  });
}

/** [4] Anti-Bridge 소켓 — 폴링 디렉토리 존재 확인 */
async function checkAntiBridge() {
  const pollDir = path.resolve(__dirname, '.agents/tasks/pending');
  const resDir  = path.resolve(__dirname, '.agents/tasks/completed');
  if (!fs.existsSync(pollDir)) {
    return { service: 'Anti-Bridge 소켓', severity: 'WARNING', errorCode: 'ANTIBRIDGE_DIR_MISSING', errorMsg: `.agents/tasks/pending 디렉토리 없음` };
  }
  return { service: 'Anti-Bridge 소켓', severity: 'OK' };
}

/** [5] 이미지 렌더링 서버 — HTTP GET /health */
async function checkImageRenderer() {
  const RENDERER_URL = process.env.RENDERER_URL || 'http://localhost:3001';
  const r = await httpGet(`${RENDERER_URL}/health`, 6000);
  if (!r.ok && r.status === 0) return { service: '이미지 렌더링 서버', severity: 'CRITICAL', errorCode: 'RENDERER_DOWN', errorMsg: r.error || '응답 없음' };
  if (r.status >= 500)         return { service: '이미지 렌더링 서버', severity: 'CRITICAL', errorCode: `HTTP_${r.status}`, errorMsg: `HTTP ${r.status}` };
  if (r.latency > 5000)        return { service: '이미지 렌더링 서버', severity: 'WARNING', errorCode: 'RENDERER_SLOW', errorMsg: `응답 지연 ${r.latency}ms` };
  return { service: '이미지 렌더링 서버', severity: 'OK', latency: r.latency };
}

/** [6] YouTube API — 간접 검증 (API 키 존재 여부만 확인) */
async function checkYoutubeApi() {
  const key = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return { service: 'YouTube API', severity: 'WARNING', errorCode: 'YT_KEY_MISSING', errorMsg: 'YouTube API 키 미등록' };
  // P4 수정(Prime): mine=true는 OAuth 필수라 API키만으론 항상 403 오진 → 키 유효성만 확인
  // quota 실시간 조회는 v1에서 OAuth 기반으로 전환
  if (key.length < 10) return { service: 'YouTube API', severity: 'WARNING', errorCode: 'YT_KEY_INVALID', errorMsg: '키 길이 비정상' };
  return { service: 'YouTube API', severity: 'OK' };
}

/** [7] 외부 TTS 엔드포인트 — HEAD 요청 */
async function checkTtsEndpoint() {
  const TTS_URL = process.env.TTS_URL || 'https://texttospeech.googleapis.com';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(TTS_URL, { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(timer);
    if (res.status >= 500) return { service: '외부 TTS 엔드포인트', severity: 'WARNING', errorCode: `HTTP_${res.status}`, errorMsg: `HTTP ${res.status}` };
    return { service: '외부 TTS 엔드포인트', severity: 'OK' };
  } catch (e) {
    clearTimeout(timer);
    return { service: '외부 TTS 엔드포인트', severity: 'WARNING', errorCode: 'TTS_UNREACHABLE', errorMsg: e.message };
  }
}

// ── 메인 실행 ─────────────────────────────────────────────────────────────
async function runBugdog() {
  const startedAt = new Date().toISOString();
  console.log(`\n🐕 Bugdog 헬스체크 시작 — ${startedAt}`);
  console.log('─'.repeat(55));

  const checks = [
    checkSocketServer,
    checkDatabase,
    checkGeminiApi,
    checkAntiBridge,
    checkImageRenderer,
    checkYoutubeApi,
    checkTtsEndpoint,
  ];

  const checkResults = [];
  for (const fn of checks) {
    try {
      const r = await fn();
      const emoji = r.severity === 'OK' ? '🟢' : r.severity === 'WARNING' ? '🟡' : '🔴';
      log(emoji, r.service, r.severity, r.errorMsg || (r.latency ? `${r.latency}ms` : ''));
      checkResults.push(r);
    } catch (e) {
      checkResults.push({ service: fn.name, severity: 'CRITICAL', errorCode: 'CHECK_EXCEPTION', errorMsg: e.message });
    }
  }

  // ── ErrorLog JSON 저장 ──────────────────────────────────────────────────
  const issues = checkResults.filter(r => r.severity !== 'OK');
  const logFile = path.join(OUTPUT_DIR, `bugdog_${startedAt.replace(/[:.]/g, '-')}.json`);
  const logData = { startedAt, totalChecks: checkResults.length, issues: issues.length, results: checkResults };
  fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
  console.log(`\n📄 ErrorLog 저장: ${logFile}`);

  // ── Critical 항목은 /api/cs-reports에 직접 POST ─────────────────────────
  const criticals = checkResults.filter(r => r.severity === 'CRITICAL');
  if (criticals.length > 0) {
    console.log(`\n🚨 Critical ${criticals.length}건 발견 — CS 리포트 자동 접수 중...`);
    for (const c of criticals) {
      try {
        const res = await fetch(`${SERVER_URL}/api/cs-reports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            severity: 'CRITICAL',
            service: c.service,
            errorCode: c.errorCode,
            errorMsg: c.errorMsg,
            reporter: 'bugdog',
          }),
        });
        const json = await res.json();
        console.log(`  ✅ CS 리포트 접수: #${json.reportNo} (${c.service})`);
      } catch (e) {
        // 서버 자체가 죽었을 경우 — JSON 파일만 남김 (폴백)
        console.warn(`  ⚠️  서버 미응답 — 로컬 JSON 파일에만 기록됨 (${c.service})`);
      }
    }
  }

  const warnings = checkResults.filter(r => r.severity === 'WARNING');
  console.log(`\n✅ 완료 — Critical: ${criticals.length}건 / Warning: ${warnings.length}건 / OK: ${checkResults.length - criticals.length - warnings.length}건`);
  return logData;
}

// ── 스케줄러 / 수동 트리거 ────────────────────────────────────────────────
const isNow = process.argv.includes('--now');

if (isNow) {
  // 즉시 실행 모드
  runBugdog().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else {
  // cron 스케줄 모드 (node-cron이 없으면 setInterval 폴백)
  try {
    const { default: cron } = await import('node-cron');
    // AM 03:00 매일 실행
    cron.schedule('0 3 * * *', () => runBugdog().catch(console.error));
    console.log('🐕 Bugdog 대기 중 — 매일 AM 03:00 실행. 수동: node bugdogRunner.js --now');
  } catch {
    // node-cron 미설치 시 24시간 인터벌 폴백
    const MS_24H = 24 * 60 * 60 * 1000;
    console.log('🐕 Bugdog 대기 중 — 24h 인터벌 (node-cron 미설치). 수동: node bugdogRunner.js --now');
    runBugdog().catch(console.error); // 시작 즉시 1회 실행
    setInterval(() => runBugdog().catch(console.error), MS_24H);
  }
}
