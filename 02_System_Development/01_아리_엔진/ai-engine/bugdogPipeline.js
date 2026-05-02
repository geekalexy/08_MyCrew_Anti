/**
 * 🐕 bugdogPipeline.js — Phase 32 Dogfooding 자동화 파이프라인
 *
 * [Phase 32 | Prime 27th Review 승인]
 * 트리거: `@bugdog 기록` 한마디
 * 파이프라인: 컨텍스트 수집 → gemini-2.5-flash 초안 생성 → CASE_NNN.md 저장 → 칸반 카드 생성
 *
 * [Prime 설계 원칙]
 * - server.js와 완전 분리된 독립 모듈 (Phase 27 원칙 계승)
 * - server.js는 트리거 감지만, 실행은 이 모듈이 전담
 * - gemini-2.5-flash 직접 API (3~5초, 초안 품질 충분)
 * - CASE ID: 파일 카운팅 + while 충돌 방어
 * - 로그: engine.log + fs.readFile (pm2 의존 제거)
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import geminiAdapter from './adapters/geminiAdapter.js';
import { MODEL } from './modelRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── 경로 상수 ────────────────────────────────────────────────────────────────
// bugdogPipeline.js 위치: ai-engine/ → 루트는 ../
const ENGINE_ROOT = path.resolve(__dirname, '..');
const CASE_DIR = path.resolve(
  ENGINE_ROOT,
  '../../01_Company_Operations/05_PR_마케팅/03_Dogfooding_케이스'
);
const CASE_INDEX_PATH = path.join(CASE_DIR, 'CASE_INDEX.md');
const ENGINE_LOG_PATH = path.join(ENGINE_ROOT, 'engine.log');

// ─── 트리거 감지 정규식 ────────────────────────────────────────────────────────
export const BUGDOG_TRIGGER = /^@bugdog\s+기록\s*(.*)/i;

/**
 * 트리거 감지 함수 — server.js에서 호출
 * @param {string} messageContent
 * @returns {{ description: string } | null}
 */
export function detectBugdogTrigger(messageContent) {
  const match = messageContent?.trim().match(BUGDOG_TRIGGER);
  if (!match) return null;
  return {
    description: match[1]?.trim() || '',
  };
}

// ─── 컨텍스트 수집 ────────────────────────────────────────────────────────────

/**
 * engine.log 마지막 N줄 수집 (Prime #5: pm2 의존 제거, fs.readFile 직접)
 */
async function getRecentLogs(lineCount = 100) {
  try {
    const content = await fs.readFile(ENGINE_LOG_PATH, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    return lines.slice(-lineCount).join('\n');
  } catch (err) {
    console.warn('[BugdogPipeline] engine.log 읽기 실패:', err.message);
    return '[로그 수집 실패 — engine.log 없음]';
  }
}

/**
 * CASE_INDEX 파일에서 기존 케이스 포맷 샘플 추출 (LLM 일관성 향상)
 */
async function getCaseFormatSample() {
  try {
    const idx = await fs.readFile(CASE_INDEX_PATH, 'utf-8');
    // 첫 번째 케이스 제목 줄만 추출
    const match = idx.match(/\| \*\*\[CASE_\d+\].*?\| (.*?) \| /);
    return match ? `(참고 예시 제목: "${match[1]}")` : '';
  } catch {
    return '';
  }
}

// ─── CASE ID 채번 ─────────────────────────────────────────────────────────────

/**
 * Prime #3 판정: 파일 카운팅 허용 + while 충돌 방어
 */
async function getNextCaseId() {
  await fs.mkdir(CASE_DIR, { recursive: true });
  const files = await fs.readdir(CASE_DIR);
  const caseFiles = files.filter(f => f.startsWith('CASE_') && f.endsWith('.md') && f !== 'CASE_INDEX.md');
  let counter = caseFiles.length + 1;

  // 충돌 방어: 해당 번호의 파일이 이미 존재하면 +1씩 올림
  while (files.some(f => f.startsWith(`CASE_${String(counter).padStart(3, '0')}_`))) {
    counter++;
  }

  return String(counter).padStart(3, '0');
}

// ─── LLM 초안 생성 ────────────────────────────────────────────────────────────

/**
 * gemini-2.5-flash로 CASE 초안 생성 (Prime #2: Flash 직접 API, 3~5초)
 */
async function generateCaseDraft({ description, recentLogs, formatSample }) {
  const systemPrompt = `당신은 MyCrew의 Dogfooding 케이스 기록 담당자입니다.
발생한 이슈를 분석하여 아래 CASE 포맷의 마크다운 문서를 작성하세요.
작성 목적: 기술적 개선 + 마케팅 소재 동시 활용.
${formatSample}

[CASE 작성 형식 — 8개 섹션]
## 1. 발견 일시 및 발견자
## 2. 증상 (사용자 관점에서 무슨 일이 일어났나)
## 3. 원인 (기술적 추정, 불명확하면 "분석 필요")
## 4. AI 자가 진단 (대화/로그에서 AI의 발언/판단 인용)
## 5. 해결 방안 (미정이면 "TBD")
## 6. 마케팅 앵글 (1줄 — "AI가 스스로 ~했다" 형식)
## 7. 파생된 기능/Phase (없으면 "TBD")
## 8. 관련 파일/자료

규칙:
- 전문 용어는 괄호로 한국어 병기
- 마케팅 앵글은 반드시 세일즈 관점에서 작성
- 원인 불명확 시 억측 금지, "추정: ~" 형식 사용`;

  const userPrompt = `다음 이슈를 CASE 포맷으로 작성해주세요.

[이슈 설명]
${description || '(설명 없음 — 로그에서 추론)'}

[최근 engine.log (마지막 100줄)]
\`\`\`
${recentLogs}
\`\`\`

위 정보를 바탕으로 CASE 문서 초안을 작성하세요.
원인이 불분명하면 로그에서 추론 가능한 내용만 "추정:" 형식으로 기재하세요.`;

  const result = await geminiAdapter.generateResponse(userPrompt, systemPrompt, MODEL.FLASH);
  return result.text || '[초안 생성 실패]';
}

// ─── 파일 저장 ────────────────────────────────────────────────────────────────

function slugify(text) {
  return (text || 'untitled')
    .replace(/[^\w가-힣]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 30);
}

async function saveCaseFile(caseId, description, draftContent) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const slug = slugify(description || `자동기록_${dateStr}`);
  const filename = `CASE_${caseId}_${slug}.md`;
  const filePath = path.join(CASE_DIR, filename);

  const header = `# CASE_${caseId} — ${description || '자동 기록된 이슈'}

> 📅 기록 일시: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}  
> 🐕 기록 방식: @bugdog 기록 자동 파이프라인 (Phase 32)  
> ✏️ 상태: **초안** (소넷 검토 필요)

---

`;

  await fs.writeFile(filePath, header + draftContent, 'utf-8');
  console.log(`[BugdogPipeline] ✅ CASE 파일 저장: ${filename}`);
  return { filePath, filename, caseId };
}

// ─── 칸반 카드 생성 ────────────────────────────────────────────────────────────

/**
 * Prime #4: category TEXT 컬럼, ENUM 없음 → 'DOGFOODING' 직접 삽입
 * dbManager는 server.js에서 주입받음 (순환 참조 방지)
 */
async function createKanbanCard(dbManager, caseId, description, filePath) {
  const shortDesc = (description || '이슈').slice(0, 40);
  const taskTitle = `[Dogfooding] CASE_${caseId}: ${shortDesc}`;
  const taskContent = `🐕 Bugdog이 자동으로 기록한 Dogfooding 케이스입니다.\n\n**케이스 파일:** \`${path.basename(filePath)}\`\n\n초안 검토 및 마케팅 앵글 보완 후, 노바에게 소재화 요청 필요.`;

  const taskId = await dbManager.createTask(
    taskTitle,
    taskContent,
    'bugdog',          // requester
    MODEL.FLASH,       // model
    'sonnet',          // assignedAgent — 소넷이 초안 검토
    'DOGFOODING'       // category (Prime: TEXT 컬럼, ENUM 없음)
  );

  console.log(`[BugdogPipeline] ✅ 칸반 카드 생성: Task #${taskId} — ${taskTitle}`);
  return taskId;
}

// ─── 메인 파이프라인 ──────────────────────────────────────────────────────────

/**
 * Bugdog 자동화 파이프라인 실행
 * server.js에서 Fire-and-forget으로 호출: executeBugdogPipeline(data).catch(...)
 *
 * @param {{ description: string, taskId?: string|null, channel?: string }} triggerData
 * @param {object} dbManager — server.js의 dbManager 인스턴스
 * @param {function} broadcastLog — server.js의 broadcastLog 함수
 * @param {function} ioEmit — io.emit 래퍼 (소켓 브로드캐스트)
 */
export async function executeBugdogPipeline(triggerData, dbManager, broadcastLog, ioEmit) {
  const { description = '', taskId = null, channel = 'dashboard' } = triggerData;

  console.log(`[BugdogPipeline] 🐕 파이프라인 시작 — "${description}" (channel: ${channel})`);
  broadcastLog?.('info', `🐕 [Bugdog] 기록 시작: "${description || '이슈 자동 수집'}"`, 'bugdog', taskId);

  try {
    // Step 1: 컨텍스트 수집
    broadcastLog?.('info', '🐕 [Bugdog] Step 1/4 — 컨텍스트 수집 중...', 'bugdog', taskId);
    const [recentLogs, formatSample] = await Promise.all([
      getRecentLogs(100),
      getCaseFormatSample(),
    ]);

    // Step 2: LLM 초안 생성 (gemini-2.5-flash, ~3~5초)
    broadcastLog?.('info', '🐕 [Bugdog] Step 2/4 — Flash로 초안 생성 중...', 'bugdog', taskId);
    const draftContent = await generateCaseDraft({ description, recentLogs, formatSample });

    // Step 3: CASE ID 채번 + 파일 저장
    broadcastLog?.('info', '🐕 [Bugdog] Step 3/4 — CASE 파일 저장 중...', 'bugdog', taskId);
    const caseId = await getNextCaseId();
    const { filePath, filename } = await saveCaseFile(caseId, description, draftContent);

    // Step 4: 칸반 카드 자동 생성
    broadcastLog?.('info', '🐕 [Bugdog] Step 4/4 — 칸반 카드 생성 중...', 'bugdog', taskId);
    const newTaskId = await createKanbanCard(dbManager, caseId, description, filePath);

    // 완료 브로드캐스트
    const summary = `✅ CASE_${caseId} 기록 완료! 파일: ${filename} | 칸반 #${newTaskId} 생성됨`;
    broadcastLog?.('info', `🐕 [Bugdog] ${summary}`, 'bugdog', newTaskId);
    ioEmit?.('bugdog:case_created', {
      caseId,
      filename,
      taskId: newTaskId,
      description,
      timestamp: new Date().toISOString(),
    });

    console.log(`[BugdogPipeline] 🎉 파이프라인 완료 — CASE_${caseId}`);
    return { success: true, caseId, filename, taskId: newTaskId };

  } catch (err) {
    const errMsg = `❌ [Bugdog] 파이프라인 실패: ${err.message}`;
    console.error('[BugdogPipeline]', errMsg);
    broadcastLog?.('error', errMsg, 'bugdog', taskId);
    ioEmit?.('bugdog:pipeline_error', { error: err.message });
    throw err;
  }
}
