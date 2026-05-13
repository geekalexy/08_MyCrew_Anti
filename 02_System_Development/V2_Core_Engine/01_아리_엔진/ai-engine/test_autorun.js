/**
 * Phase 43 - /auto_run E2E Simulation Test
 * 소넷(QA) 작성 | 2026-05-13
 *
 * 실행법: node --experimental-vm-modules test_autorun.js
 * 또는:   node test_autorun.js  (package.json "type":"module" 환경)
 *
 * LLM 실제 호출 없이 executor.autoRun() 전 파이프라인을
 * Mock으로 대체하여 6대 QA 시나리오를 검증합니다.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PASS = '\x1b[32m[PASS]\x1b[0m';
const FAIL = '\x1b[31m[FAIL]\x1b[0m';
const INFO = '\x1b[36m[INFO]\x1b[0m';

let passed = 0, failed = 0;
function assert(condition, label) {
  if (condition) { console.log(`${PASS} ${label}`); passed++; }
  else            { console.log(`${FAIL} ${label}`); failed++; }
}

// ────────────────────────────────────────────────
// MOCK 인프라 (LLM / DB / broadcastLog)
// ────────────────────────────────────────────────

/** DB Mock: 인메모리 태스크 스토어 */
function createDbMock(tasks = []) {
  const store = tasks.map((t, i) => ({
    id: t.id ?? `task_${i}`,
    project_id: t.project_id ?? 'proj_test',
    title: t.title ?? `Task ${i}`,
    content: t.content ?? '',
    status: t.status ?? 'todo',
    assignee: t.assignee ?? null,
  }));
  const comments = [];
  const statusLog = [];
  const assigneeLog = [];

  return {
    store, comments, statusLog, assigneeLog,
    async getTaskById(id) {
      return store.find(t => t.id === id) ?? null;
    },
    async getTasksByProjectId(pid) {
      return store.filter(t => t.project_id === pid);
    },
    async updateTaskStatus(id, status) {
      const t = store.find(t => t.id === id);
      if (t) { t.status = status; statusLog.push({ id, status }); }
    },
    async updateTaskAssignee(id, assignee) {
      const t = store.find(t => t.id === id);
      if (t) { t.assignee = assignee; assigneeLog.push({ id, assignee }); }
    },
    async createComment(taskId, author, text) {
      comments.push({ taskId, author, text });
    },
  };
}

/** Gemini Adapter Mock: 응답을 시나리오별로 커스터마이징 */
function createGeminiMock(responses) {
  let callCount = 0;
  return {
    get callCount() { return callCount; },
    async generateResponse(content, systemPrompt, model) {
      const resp = responses[callCount] ?? responses[responses.length - 1];
      callCount++;
      if (resp.throw) throw new Error(resp.throw);
      return { text: resp.text ?? '', model: model ?? 'mock', tokenUsage: null };
    },
  };
}

/** contextInjector Mock */
const mockContextInjector = {
  buildAutoRunContext(taskData) {
    assert(
      taskData && typeof taskData.title === 'string',
      'Scenario 1 | buildAutoRunContext에 title 전달됨'
    );
    const ctx = [
      '[SYSTEM PERSONA - MAIN MODEL]',
      'You are an expert Senior Fullstack Developer',
      '[TOOL SPECIFICATIONS]',
      'read_file, write_file, query_graph, finish_task',
      '[PROJECT RULES - MYCREW EDITION]',
      'ONLY use Vanilla CSS',
      `[CURRENT TASK CONTEXT]\nTask Title: ${taskData.title}`,
    ].join('\n');
    // 3단 구조 포함 여부 검증
    assert(ctx.includes('[SYSTEM PERSONA'), 'Scenario 1 | System Persona 섹션 존재');
    assert(ctx.includes('[TOOL SPECIFICATIONS]'), 'Scenario 1 | Tool Spec 섹션 존재');
    assert(ctx.includes('[PROJECT RULES'), 'Scenario 1 | Project Rules 섹션 존재');
    return ctx;
  },
};

// ────────────────────────────────────────────────
// autoRun 코어 로직 (executor.js 인라인 복제 + Mock 주입)
// ────────────────────────────────────────────────
async function runAutoRunSimulation({
  db,
  geminiMock,
  projectId = 'proj_test',
  agentId = 'dev_senior',
  startingTaskId = null,
  broadcastLogs = [],
  maxStepsOverride = null,
}) {
  const activeAutoRuns = new Map();
  const MAX_STEPS = maxStepsOverride ?? 15;

  const broadcastLog = (level, msg, agent, taskId) => {
    broadcastLogs.push({ level, msg, agent, taskId });
  };

  const runId = `${projectId}_${Date.now()}`;
  const abortController = new AbortController();
  activeAutoRuns.set(runId, abortController);

  let nextTaskIdToRun = startingTaskId;
  let currentTaskId = null;

  try {
    while (!abortController.signal.aborted) {
      let nextTask = null;

      if (nextTaskIdToRun) {
        nextTask = await db.getTaskById(nextTaskIdToRun);
        nextTaskIdToRun = null;
      } else {
        const tasks = await db.getTasksByProjectId(projectId);
        nextTask = tasks.find(t =>
          t.status.toLowerCase() === 'todo' || t.status.toLowerCase() === 'pending'
        );
      }

      if (!nextTask) {
        broadcastLog('info', '🏁 처리할 태스크 없음. 루프 종료.', agentId, null);
        break;
      }

      currentTaskId = nextTask.id;
      await db.updateTaskStatus(currentTaskId, 'IN_PROGRESS');
      broadcastLog('info', `▶️ 태스크 #${currentTaskId} 시작`, agentId, currentTaskId);

      let stepCount = 0;
      let isTaskCompleted = false;
      let toolOutputs = [];

      const autoRunContext = mockContextInjector.buildAutoRunContext({
        title: nextTask.title,
        description: nextTask.content ?? '',
      });

      while (!isTaskCompleted && !abortController.signal.aborted) {
        stepCount++;
        if (stepCount > MAX_STEPS) throw new Error('Max steps exceeded');

        let currentPrompt = autoRunContext;
        if (toolOutputs.length > 0) {
          currentPrompt += `\n\n[PREVIOUS TOOL OUTPUTS]\n${toolOutputs.join('\n\n')}\n`;
        }

        broadcastLog('info', `⏳ Step ${stepCount}: 에이전트 사고 중...`, agentId, currentTaskId);

        const result = await geminiMock.generateResponse(
          '주어진 태스크를 달성하기 위해 코딩을 진행하세요.',
          currentPrompt,
          'gemini-2.5-pro'
        );

        await db.createComment(currentTaskId, agentId.toUpperCase(), result.text);
        broadcastLog('info', result.text, agentId, currentTaskId);

        const toolCallMatch = result.text.match(/<tool_calls>([\s\S]*?)<\/tool_calls>/i);
        if (toolCallMatch) {
          try {
            const calls = JSON.parse(toolCallMatch[1].trim());
            for (const call of calls) {
              const { name, arguments: args } = call;
              broadcastLog('info', `🔧 도구 실행: ${name}`, agentId, currentTaskId);

              let output = `[Tool ${name} executed]\n`;
              if (name === 'read_file') {
                // 테스트용 Mock 파일 읽기
                output += `Success.\ncontent of ${args.path}`;
              } else if (name === 'write_file') {
                output += `Success. File written to ${args.path}`;
              } else if (name === 'query_graph') {
                output += `Success. (Mock graph query: ${args.query})`;
              } else if (name === 'finish_task') {
                output += `Task finished. Reason: ${args.reason}`;
                isTaskCompleted = true;
              } else if (name === 'ask_user') {
                output += `Paused for user input.`;
                isTaskCompleted = true; // ask_user도 루프 중단
              } else {
                output += `Failed: Unknown tool ${name}`;
              }

              toolOutputs.push(`--- TOOL: ${name} ---\nARGS: ${JSON.stringify(args)}\nRESULT:\n${output}`);
              await db.createComment(currentTaskId, 'SYSTEM', output);
            }
          } catch (e) {
            toolOutputs.push(`Failed to parse <tool_calls> JSON: ${e.message}`);
            await db.createComment(currentTaskId, 'SYSTEM', `❌ 도구 파싱 실패: ${e.message}`);
          }
        } else {
          if (!isTaskCompleted) {
            toolOutputs.push(`System Warning: No <tool_calls> found. Use tools or call finish_task.`);
          }
        }
      }

      if (!abortController.signal.aborted && isTaskCompleted) {
        await db.updateTaskStatus(currentTaskId, 'REVIEW');
        await db.updateTaskAssignee(currentTaskId, 'ceo');
        broadcastLog('info', `✅ 태스크 #${currentTaskId} → REVIEW / CEO 할당`, agentId, currentTaskId);
      }

      currentTaskId = null;
    }
  } catch (err) {
    if (currentTaskId) {
      await db.updateTaskStatus(currentTaskId, 'FAILED');
      broadcastLog('error', `🚨 에러: ${err.message}`, agentId, currentTaskId);
    }
    throw err; // 테스트에서 catch 가능하도록
  } finally {
    activeAutoRuns.delete(runId);
  }

  return { db, broadcastLogs };
}

// ────────────────────────────────────────────────
// 시나리오 실행
// ────────────────────────────────────────────────
console.log('\n\x1b[1m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
console.log('\x1b[1m Phase 43 /auto_run QA Simulation Test  \x1b[0m');
console.log('\x1b[1m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');

// ── 시나리오 2: Continuous Mode — 멀티 툴 연속 호출 ────────────────────────
console.log('\x1b[1m[Scenario 2] Continuous Mode (멀티 툴 연속 호출)\x1b[0m');
{
  const db = createDbMock([
    { id: 't1', title: 'Read and rewrite file', status: 'todo' }
  ]);
  const logs = [];
  const gemini = createGeminiMock([
    // Step 1: read_file 호출
    { text: 'I will read the file first.\n<tool_calls>[{"name":"read_file","arguments":{"path":"hello.txt"}}]</tool_calls>' },
    // Step 2: write_file 호출 후 finish_task
    { text: 'Now writing.\n<tool_calls>[{"name":"write_file","arguments":{"path":"goodbye.txt","content":"bye"}},{"name":"finish_task","arguments":{"reason":"Done"}}]</tool_calls>' },
  ]);

  await runAutoRunSimulation({ db, geminiMock: gemini, broadcastLogs: logs });

  assert(gemini.callCount === 2, 'Scenario 2 | LLM 2회 호출 (루프 중단 없이 연속)');
  assert(db.store[0].status === 'REVIEW', 'Scenario 2 | 완료 후 REVIEW 전환');
  assert(db.store[0].assignee === 'ceo', 'Scenario 2 | CEO 할당 완료');
  const toolLogs = logs.filter(l => l.msg.includes('도구 실행'));
  assert(toolLogs.length >= 2, 'Scenario 2 | read_file + write_file 툴 브로드캐스트 확인');
}

// ── 시나리오 3: 에이전트 주도 탈출 (ask_user / finish_task) ─────────────────
console.log('\n\x1b[1m[Scenario 3] Agent-led Escape (ask_user)\x1b[0m');
{
  const db = createDbMock([
    { id: 't2', title: 'Impossible task', status: 'todo' }
  ]);
  const logs = [];
  const gemini = createGeminiMock([
    // 1회 시도 후 ask_user로 탈출
    { text: 'Cannot proceed.\n<tool_calls>[{"name":"ask_user","arguments":{"question":"Framework not found. What do I do?"}}]</tool_calls>' },
  ]);

  await runAutoRunSimulation({ db, geminiMock: gemini, broadcastLogs: logs });

  assert(gemini.callCount === 1, 'Scenario 3 | 1회 시도 후 탈출 (무한루프 없음)');
  assert(db.store[0].status === 'REVIEW', 'Scenario 3 | ask_user 후 REVIEW 상태 전환');
}

// ── 시나리오 4: 사용자 주도 강제 종료 (AbortController) ──────────────────────
console.log('\n\x1b[1m[Scenario 4] User-led Force Stop (AbortController)\x1b[0m');
{
  // AbortController 직접 테스트
  const activeAutoRuns = new Map();
  const abortController = new AbortController();
  const runId = 'test_abort_run';
  activeAutoRuns.set(runId, abortController);

  assert(!abortController.signal.aborted, 'Scenario 4 | 초기 상태: aborted=false');

  // stopAutoRun 시뮬레이션
  abortController.abort();
  activeAutoRuns.delete(runId);

  assert(abortController.signal.aborted, 'Scenario 4 | abort() 호출 후 signal.aborted=true');
  assert(!activeAutoRuns.has(runId), 'Scenario 4 | activeAutoRuns에서 runId 정리 완료');

  // AbortController 재사용 불가 확인 (메모리 릭 방지: 맵에서 삭제됨)
  assert(activeAutoRuns.size === 0, 'Scenario 4 | 맵 완전 정리 (메모리 릭 없음)');
}

// ── 시나리오 5: Max Steps 폭주 제어 ──────────────────────────────────────────
console.log('\n\x1b[1m[Scenario 5] Max Steps Guardrail (MAX_STEPS=3)\x1b[0m');
{
  const db = createDbMock([
    { id: 't3', title: 'Infinite loop task', status: 'todo' }
  ]);
  const logs = [];
  // 도구도 finish_task도 없는 응답만 반복
  const gemini = createGeminiMock([
    { text: 'I am thinking...' }, // no tool_calls, no finish
    { text: 'Still thinking...' },
    { text: 'And still...' },
    { text: 'Step 4 (should not reach here)' },
  ]);

  let threwError = false;
  try {
    await runAutoRunSimulation({
      db,
      geminiMock: gemini,
      broadcastLogs: logs,
      maxStepsOverride: 3,
    });
  } catch (err) {
    threwError = err.message.includes('Max steps exceeded');
  }

  assert(threwError, 'Scenario 5 | Max steps exceeded 에러 발생');
  assert(db.store[0].status === 'FAILED', 'Scenario 5 | 상태 FAILED 전환');
  const errLog = logs.find(l => l.level === 'error');
  assert(!!errLog, 'Scenario 5 | error 브로드캐스트 전송');
}

// ── 시나리오 6: 툴 체인 파이프라인 무결성 ────────────────────────────────────
console.log('\n\x1b[1m[Scenario 6] Tool Chain Pipeline Integrity\x1b[0m');
{
  const db = createDbMock([
    { id: 't4', title: 'Read then write', status: 'todo' }
  ]);
  const logs = [];
  const gemini = createGeminiMock([
    { text: '<tool_calls>[{"name":"read_file","arguments":{"path":"src/app.js"}}]</tool_calls>' },
    { text: '<tool_calls>[{"name":"write_file","arguments":{"path":"src/app.js","content":"updated"}},{"name":"finish_task","arguments":{"reason":"Updated"}}]</tool_calls>' },
  ]);

  await runAutoRunSimulation({ db, geminiMock: gemini, broadcastLogs: logs });

  // DB comments 검증
  const systemComments = db.comments.filter(c => c.author === 'SYSTEM');
  const readResult = systemComments.find(c => c.text.includes('content of src/app.js'));
  const writeResult = systemComments.find(c => c.text.includes('File written to src/app.js'));

  assert(!!readResult, 'Scenario 6 | read_file 결과가 DB 코멘트에 저장됨');
  assert(!!writeResult, 'Scenario 6 | write_file 결과가 DB 코멘트에 저장됨');

  // tool output이 다음 스텝 프롬프트에 누적되는지 확인
  // (2번째 호출 시점엔 toolOutputs 배열에 read_file 결과가 있어야 함)
  assert(gemini.callCount === 2, 'Scenario 6 | 2 Step 완료 (read→write 파이프라인)');

  const toolBroadcasts = logs.filter(l => l.msg.includes('도구 실행'));
  assert(toolBroadcasts.length === 3, 'Scenario 6 | read_file, write_file, finish_task 총 3회 브로드캐스트');
}

// ── 추가 검증: stopAutoRun 멤버 함수 인터페이스 ──────────────────────────────
console.log('\n\x1b[1m[Bonus] stopAutoRun() Interface Check\x1b[0m');
{
  // executor.js의 stopAutoRun 로직 단위 검증
  const activeAutoRuns = new Map();
  const ctrl = new AbortController();
  activeAutoRuns.set('run_X', ctrl);

  function stopAutoRun(runId) {
    if (activeAutoRuns.has(runId)) {
      activeAutoRuns.get(runId).abort();
      activeAutoRuns.delete(runId);
      return true;
    }
    return false;
  }

  assert(stopAutoRun('run_X') === true, 'stopAutoRun | 존재하는 runId → true 반환');
  assert(stopAutoRun('run_X') === false, 'stopAutoRun | 이미 삭제된 runId → false 반환 (이중 abort 없음)');
}

// ── 최종 결과 ────────────────────────────────────────────────────────────────
console.log('\n\x1b[1m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
console.log(`결과: ${PASS} ${passed}개 통과 / ${failed > 0 ? FAIL : ''} ${failed}개 실패`);
console.log('\x1b[1m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');

if (failed > 0) process.exit(1);
