import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import http from 'http';
import { createServer } from 'http';
import { Server } from 'socket.io';
import TelegramBot from 'node-telegram-bot-api';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';

const execFilePromise = promisify(execFile);

// 커스텀 AI Core 모듈 로드
import dbManager from './database.js';
import keyProvider from './ai-engine/tools/keyProvider.js';
import teamActivator from './ai-engine/teamActivator.js';
import tutorialManager from './ai-engine/tutorialManager.js';
import executor, { updateAgentSignatureModel, getAgentSignatureModel } from './ai-engine/executor.js';

import modelSelector from './ai-engine/modelSelector.js';
import { launchOmoTask } from './ai-engine/omoLauncher.js';
import obsidianAdapter from './ai-engine/adapters/obsidianAdapter.js';
import zeroConfigService from './ai-engine/services/zeroConfigService.js';
import statusReporter from './ai-engine/statusReporter.js';
import { processOnboardingUrl } from './ai-engine/tools/onboardingPipeline.js';
import { initAdapterWatcher } from './ai-engine/AdapterWatcher.js';
import { MODEL } from './ai-engine/modelRegistry.js';
import ruleHarvester from './ai-engine/tools/ruleHarvester.js';
import b4System from './ai-engine/tools/b4System.js';
import imageLabRouter from './routes/imageLabRouter.js';
import videoLabRouter, { setIoForVideoLabRouter } from './routes/videoLabRouter.js';
import { detectBugdogTrigger, executeBugdogPipeline } from './ai-engine/bugdogPipeline.js';
import memoryWatchdog from './ai-engine/workers/memoryWatchdog.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4007;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',')
  : ['http://localhost:5173', 'http://localhost:5174']; // 포트 5173/5174 동시 허용

// ─── CORS: Express HTTP (Socket.io 핸드셰이크 포함) ────────────────────────
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

// ─── 정적 파일 제공 (NanoBanana 등 미디어 아웃풋 서빙용) ────────
const outputsDir = path.resolve(process.cwd(), 'outputs');
if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir, { recursive: true });
}
app.use('/outputs', express.static(outputsDir));
app.use('/api/imagelab', imageLabRouter);
app.use('/api/videolab', videoLabRouter);
app.use('/lab-assets', express.static(path.join(process.cwd(), 'skill-library/05_design/lab-assets')));

// ─── Socket.io 서버 (Opus 지적: Express CORS와 별도로 옵션 지정 필수) ────────
export const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// [Phase 25] videoLabRouter에 io 인스턴스 주입 (판정 엔드포인트 브로드캐스트용)
setIoForVideoLabRouter(io);

// 에이전트 상태 맵 { agentId: { status, lastHeartbeat } }
const agentStates = new Map();
const HEARTBEAT_TIMEOUT_MS = 15000; // Opus 권고: 5초 × 3회 = 15초 임계값

// Phase 11: Task별 실행 중인 프로세스 컨트롤러 맵 (Kill용)
const activeProcesses = new Map();

let globalAgentMap = {};
export let rawAgents = [];
// [Phase 26] agents.json 기반 동적 파생 Set — 하드코딩 KNOWN_AGENTS 대체
export let KNOWN_AGENTS_SET = new Set(['system']);
// category → default agent 매핑 (agents.json의 defaultCategory 필드 기반)
export let CATEGORY_TO_AGENT = {};
try {
  const agentsData = fs.readFileSync(path.resolve(process.cwd(), 'agents.json'), 'utf8');
  rawAgents = JSON.parse(agentsData);
  rawAgents.forEach(agent => {
    const id = agent.id.toLowerCase();
    globalAgentMap[id] = agent.id;
    if (agent.nameKo) globalAgentMap[agent.nameKo] = agent.id;
    // 동적 KNOWN_AGENTS
    KNOWN_AGENTS_SET.add(id);
    // 동적 categoryToAgent (defaultCategory 필드 기반)
    if (agent.defaultCategory) {
      // 카테고리가 이미 매핑된 경우 덮어쓰지 않음 (먼저 나오는 에이전트 우선)
      if (!CATEGORY_TO_AGENT[agent.defaultCategory]) {
        CATEGORY_TO_AGENT[agent.defaultCategory] = agent.id;
      }
    }
  });
  console.log(`[Agents] 총 ${rawAgents.length}명의 AI 팀원 명부를 로드했습니다.`);
  console.log(`[Agents] 동적 KNOWN_AGENTS: [${[...KNOWN_AGENTS_SET].join(', ')}]`);
  console.log(`[Agents] 동적 categoryToAgent:`, CATEGORY_TO_AGENT);
} catch (err) {
  console.error('[Agents] agents.json 로드 실패 (기본값ari 사용):', err.message);
}


app.get('/api/agents', (req, res) => {
  res.json({ status: 'ok', agents: rawAgents });
});


// 타임아웃 워처: 15초 이상 Heartbeat 없으면 idle 전환
setInterval(() => {
  const now = Date.now();
  for (const [agentId, state] of agentStates.entries()) {
    if (state.status === 'active' && now - state.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
      agentStates.set(agentId, { ...state, status: 'idle' });
      io.emit('agent:status_change', { agentId, status: 'idle' });
      console.log(`[Socket] Agent ${agentId} → idle (heartbeat timeout)`);
    }
  }
}, 5000);

// ─── [Phase 25] Event-Driven Task Dispatcher (이벤트 기반 Pull 모델) ───
async function dispatchNextTaskForAgent(agentId) {
  if (!dbManager || !agentId || agentId === '미할당' || agentId === 'system') return;
  try {
    const tasks = await dbManager.getAllTasksLight();
    
    // 1. 해당 에이전트가 현재 진행 중인 작업이 있는지 확인 (Busy 체크)
    const isBusy = tasks.some(t => t.assigned_agent === agentId && (t.status === 'in_progress' || t.status === 'IN_PROGRESS' || t.status === 'REVIEW'));
    if (isBusy) return; // 바쁘면 대기(To-Do 유지)

    // 2. 대기 중인 PENDING 작업 필터링 (가장 오래된 것 1개)
    const pendingTask = tasks.filter(t => t.assigned_agent === agentId && (t.status === 'todo' || t.status === 'PENDING'))
                             .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];

    if (pendingTask) {
      // 상태 변경 및 소켓 발송
      await dbManager.updateTaskStatus(pendingTask.id, 'IN_PROGRESS');
      io.emit('task:moved', { taskId: String(pendingTask.id), toColumn: 'in_progress' });
      io.emit('task:updated', { taskId: String(pendingTask.id), status: 'IN_PROGRESS', column: 'in_progress' });

      // 백그라운드 엔진 트리거
      const fullTask = await dbManager.getTaskById(pendingTask.id);
      if (fullTask) {
        broadcastLog('info', `> [${fullTask.assigned_agent}] 작업을 수신했습니다. 사고과정을 시작합니다...`, 'system', pendingTask.id);

        // ── [Fix] filePollingAdapter 대신 executor.runDirect() 직접 호출 ──
        // fire-and-forget: 서버 블로킹 없이 백그라운드에서 AI API 호출
        setImmediate(async () => {
          try {
            const result = await executor.runDirect(fullTask.content, agentId, fullTask.id);

            const status = (result.category === 'ERROR' || result.category === 'ACCESS_DENIED') ? 'FAILED' : 'REVIEW';
            const column  = status === 'FAILED' ? 'todo' : 'review';

            await dbManager.updateTaskStatus(fullTask.id, status);
            const thoughtProcess = result._meta?.thought_process || null;
            await dbManager.createComment(fullTask.id, agentId, result.text || '작업이 완료되었습니다.', thoughtProcess);

            io.emit('task:moved', { taskId: String(fullTask.id), toColumn: column });
            io.emit('task:comment_added', {
              taskId: String(fullTask.id), author: agentId,
              text: result.text, thought_process: thoughtProcess, createdAt: new Date().toISOString()
            });

            if (status === 'FAILED') {
              // [S1-5] FAILED 전환 시 에스컬레이션 알림
              const failReason = result.text ? result.text.slice(0, 120) + (result.text.length > 120 ? '...' : '') : '알 수 없는 오류';
              const failMsg = `⚠️ [Task 실패 알림]\nTask #${fullTask.id}: ${fullTask.title}\n담당: ${agentId.toUpperCase()}\n원인: ${failReason}\n\n워크스페이스에서 재시도 또는 재할당이 필요합니다.`;
              if (bot && process.env.TELEGRAM_CHAT_ID) {
                bot.sendMessage(process.env.TELEGRAM_CHAT_ID, failMsg).catch(() => {});
              }
              // [S4-3] 실패 카운터 증가
              const failureResult = await dbManager.incrementFailureCount(fullTask.id).catch(() => null);
              io.emit('task:failed', {
                taskId: String(fullTask.id),
                agentId,
                reason: result.text || '에이전트 응답 오류',
                failedAt: new Date().toISOString(),
                failureCount: (fullTask.failure_count || 0) + 1,
              });
              broadcastLog('error', `> [${agentId}] Task #${fullTask.id} 실패 — 재시도 또는 재할당 필요`, agentId, fullTask.id);
            } else {
              broadcastLog('success', `> [${agentId}] Task #${fullTask.id} 완료 — 승인 대기 중`, agentId, fullTask.id);
            }

            // Case 3: 완료 후 다음 대기 카드 자동 Pull
            setTimeout(() => dispatchNextTaskForAgent(agentId), 1000);
          } catch (err) {
            console.error(`[Dispatcher] runDirect 실패 Task #${fullTask.id}:`, err.message);
            broadcastLog('error', `> [${agentId}] Task #${fullTask.id} 실행 중 오류: ${err.message}`, agentId, fullTask.id);
            await dbManager.updateTaskStatus(fullTask.id, 'FAILED').catch(() => {});
            // [S1-5] catch 경로 에스컬레이션 알림
            const catchMsg = `⚠️ [Task 실패 알림]\nTask #${fullTask.id}: ${fullTask.title}\n담당: ${agentId.toUpperCase()}\n원인: ${err.message}\n\n워크스페이스에서 재시도 또는 재할당이 필요합니다.`;
            if (bot && process.env.TELEGRAM_CHAT_ID) {
              bot.sendMessage(process.env.TELEGRAM_CHAT_ID, catchMsg).catch(() => {});
            }
            // [S4-3] 실패 카운터 증가
            await dbManager.incrementFailureCount(fullTask.id).catch(() => null);
            io.emit('task:failed', {
              taskId: String(fullTask.id),
              agentId,
              reason: err.message,
              failedAt: new Date().toISOString(),
              failureCount: (fullTask.failure_count || 0) + 1,
            });
          }
        });
      }
    }
  } catch (err) {
    console.error(`[Dispatcher Error for ${agentId}]`, err.message);
  }
}

// ── [isFinal: false 재착수] 중간 보고 수신 후 동일 태스크 즉시 재투입 ──────
// dispatchNextTaskForAgent와 달리 busy 체크를 우회하고 특정 taskId를 강제 재실행
async function forceRedispatchTask(taskId, agentId, additionalContext = '', contextType = 'INTERIM') {
  if (!dbManager || !executor) return;
  try {
    const fullTask = await dbManager.getTaskById(taskId);
    if (!fullTask) {
      console.warn(`[ForceRedispatch] Task #${taskId} 없음 — 재착수 취소`);
      return;
    }
    
    // 추가 컨텍스트 주입 (재작업 지시 vs 중간 착수 보고)
    let enrichedContent = fullTask.content;
    if (additionalContext) {
      if (contextType === 'REWORK') {
        enrichedContent += `\n\n---\n[대표님 피드백 및 재작업 지시사항]\n${additionalContext}\n\n위 피드백을 철저히 반영하여 기존 결과물을 수정/보완하고 최종 결과물을 다시 제출하라.`;
      } else {
        enrichedContent += `\n\n---\n[이전 착수 보고]\n${additionalContext}\n\n위 착수 보고 이후 실제 작업을 지금 바로 수행하고 최종 결과물을 제출하라.`;
      }
    }

    let logMsg = `> [${agentId}] 작업 착수 트리거 (Task #${taskId})`;
    if (contextType === 'REWORK') {
      logMsg = `> [${agentId}] 대표님 재작업 지시 수신 → 재착수 트리거 (Task #${taskId})`;
    } else if (contextType === 'INTERIM') {
      logMsg = `> [${agentId}] isFinal:false 수신 → 본작업 재착수 트리거 (Task #${taskId})`;
    } else if (contextType === 'START') {
      logMsg = `> [${agentId}] 작업을 수신했습니다. 사고과정을 시작합니다...`;
    }

    broadcastLog('info', logMsg, 'system', taskId);

    setImmediate(async () => {
      try {
        const result = await executor.runDirect(enrichedContent, agentId, taskId);
        const status = (result.category === 'ERROR' || result.category === 'ACCESS_DENIED') ? 'FAILED' : 'REVIEW';
        const column  = status === 'FAILED' ? 'todo' : 'review';

        await dbManager.updateTaskStatus(taskId, status);
        
        // 실제 수행된 모델과 카테고리 정보 업데이트 (UI 반영용)
        if (result.model) {
          await dbManager.updateTaskModel(taskId, result.model, result.category);
          io.emit('task:updated', { taskId: String(taskId), model: result.model, category: result.category });
        }

        const thoughtProcess = result._meta?.thought_process || null;
        await dbManager.createComment(taskId, agentId, result.text || '작업이 완료되었습니다.', thoughtProcess);

        io.emit('task:moved', { taskId: String(taskId), toColumn: column });
        io.emit('task:comment_added', {
          taskId: String(taskId), author: agentId,
          text: result.text, thought_process: thoughtProcess, createdAt: new Date().toISOString()
        });

        if (status === 'FAILED') {
          broadcastLog('error', `> [${agentId}] Task #${taskId} 재착수 실패`, agentId, taskId);
          io.emit('task:failed', { taskId: String(taskId), agentId, reason: result.text, failedAt: new Date().toISOString() });
        } else {
          broadcastLog('success', `> [${agentId}] Task #${taskId} 재착수 완료 — 승인 대기 중`, agentId, taskId);
        }
      } catch (err) {
        console.error(`[ForceRedispatch] runDirect 오류 Task #${taskId}:`, err.message);
        broadcastLog('error', `> [${agentId}] Task #${taskId} 재착수 오류: ${err.message}`, agentId, taskId);
        await dbManager.updateTaskStatus(taskId, 'FAILED').catch(() => {});
      }
    });
  } catch (err) {
    console.error(`[ForceRedispatch Error]`, err.message);
  }
}

// ariDaemon 등 외부 프로세스에서 할당 이벤트를 트리거할 수 있는 엔드포인트
app.post('/api/tasks/dispatch', async (req, res) => {
  const { agentId } = req.body;
  if (agentId) {
    // 즉각 응답 후 비동기 처리
    res.json({ status: 'ok', message: 'Dispatch triggered' });
    await dispatchNextTaskForAgent(agentId);
  } else {
    res.status(400).json({ status: 'error', message: 'agentId required' });
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket] 클라이언트 연결됨: ${socket.id}`);

  // 현재 에이전트 상태 즉시 동기화
  socket.emit('agent:state_sync', Object.fromEntries(agentStates));

  // ── [Phase 28a] 프로젝트 Room 구독 ─────────────────────────────
  socket.on('project:join', async ({ projectId }) => {
    if (!projectId) return;
    socket.join(`project_${projectId}`);
    console.log(`[Socket] ${socket.id} joined project_${projectId}`);

    // [Fix #7 & #11] 엔진 컨텍스트 리셋 및 신규 프로젝트(TO DO) 자동 Pull 로직 트리거
    try {
      const crew = await dbManager.getProjectCrew(projectId);
      for (const member of crew) {
        if (member.agent_id) {
          dispatchNextTaskForAgent(member.agent_id);
        }
      }
    } catch (e) {
      console.error('[Engine AutoPull] 프로젝트 초기화 중 에러:', e);
    }
  });

  socket.on('project:leave', ({ projectId }) => {
    if (!projectId) return;
    socket.leave(`project_${projectId}`);
    console.log(`[Socket] ${socket.id} left project_${projectId}`);
  });

  // 에이전트 Heartbeat 수신
  socket.on('agent:heartbeat', ({ agentId }) => {
    if (!agentId) return;
    const prev = agentStates.get(agentId) || { status: 'idle' };
    agentStates.set(agentId, { status: 'active', lastHeartbeat: Date.now() });
    if (prev.status !== 'active') {
      io.emit('agent:status_change', { agentId, status: 'active' });
    }
  });

  // Task 이동 이벤트 (낙관적 업데이트 → 서버 검증 후 확정 또는 롤백)
  socket.on('task:move', async ({ taskId, fromColumn, toColumn }) => {
    try {
      // 컬럼 ID를 DB 상태 상수로 매핑
      const COLUMN_TO_STATUS = {
        'todo': 'PENDING',
        'in_progress': 'IN_PROGRESS',
        'review': 'REVIEW',
        'done': 'COMPLETED',
        'help_user_action': 'HELP_USER_ACTION'
      };
      const newStatus = COLUMN_TO_STATUS[toColumn] || toColumn;
      await dbManager.updateTaskStatus(taskId, newStatus);
      io.emit('task:moved', { taskId, toColumn });
      // 상태 필드 동기화도 함께 송출
      io.emit('task:updated', { taskId, status: newStatus, column: toColumn });

      // ── [Activity Log] 드래그 이동 시 상태 변경 기록 ──────────────────────
      const ACTIVITY_LABEL = { 'PENDING': '할 일', 'IN_PROGRESS': '진행 중', 'REVIEW': '승인 대기', 'COMPLETED': '완료', 'FAILED': '실패', 'PAUSED': '중단됨', 'todo': '할 일', 'in_progress': '진행 중', 'review': '승인 대기', 'done': '완료' };
      const prevLabel = ACTIVITY_LABEL[fromColumn] || fromColumn;
      const nextLabel = ACTIVITY_LABEL[newStatus] || ACTIVITY_LABEL[toColumn] || toColumn;
      await logActivity(taskId, `📋 상태: ${prevLabel} → ${nextLabel}`);


      if (toColumn === 'in_progress' && fromColumn === 'todo') {
        const task = await dbManager.getTaskById(taskId);
        if (task) {
          const agentId = task.assigned_agent || 'system';

          // 기존 진행 중인 다른 작업이 있다면 일시정지(todo로 강제 강등)하여 인터럽트 수행
          const allTasks = await dbManager.getAllTasksLight();
          const activeTasks = allTasks.filter(t => t.assigned_agent === agentId && (t.status === 'in_progress' || t.status === 'IN_PROGRESS') && String(t.id) !== String(taskId));
          
          for (const at of activeTasks) {
            await dbManager.updateTaskStatus(at.id, 'PENDING');
            io.emit('task:moved', { taskId: String(at.id), toColumn: 'todo' });
            io.emit('task:updated', { taskId: String(at.id), status: 'PENDING', column: 'todo' });
            broadcastLog('warn', `새로운 긴급 업무 지시(드래그)로 인해 기존 작업 #${at.id}을(를) 잠시 대기(To-Do) 상태로 내립니다.`, 'system', at.id);
          }

          // 드래그된 작업 즉시 착수
          forceRedispatchTask(task.id, agentId, '', 'START');
        }
      }
      
      // 작업이 완료되거나 대기로 돌아갔을 때 다음 작업 자동 Pull 트리거
      if (fromColumn === 'in_progress' && (toColumn === 'done' || toColumn === 'review')) {
        const task = await dbManager.getTaskById(taskId);
        if (task && task.assigned_agent) {
          setTimeout(() => dispatchNextTaskForAgent(task.assigned_agent), 1000);
        }
      }
    } catch (err) {
      // 실패 시 원래 열로 롤백 신호
      socket.emit('task:moved_failed', { taskId, revertTo: fromColumn, error: err.message });
    }
  });

  // 프론트엔드 수동 카드 생성 이벤트 (대표님이 직접 생성 → 'CEO' 표기)
  socket.on('task:create', async ({ title, content, assignee, priority, column, projectId }) => {
    try {
      const requester = 'CEO';
      const targetModel = (assignee && assignee !== '미할당')
        ? (getAgentSignatureModel(assignee) || 'gemini-2.5-flash')
        : 'gemini-2.5-flash';
      const targetProjectId = projectId || 'proj-1';
      const taskId = await dbManager.createTask(title, content, requester, targetModel, assignee && assignee !== '미할당' ? assignee : null, 'QUICK_CHAT', targetProjectId);
      broadcastLog('info', `태스크 생성됨: ${title}`, 'system', taskId);
      io.emit('task:created', {
        taskId: String(taskId),
        title,
        content,
        column: column || 'todo',
        agentId: assignee !== '미할당' ? assignee : null,
        priority: priority || 'medium',
        projectId: targetProjectId,
      });
      
      // 새로 할당된 에이전트가 있으면 Dispatcher 트리거
      if (assignee && assignee !== '미할당') {
        setTimeout(() => dispatchNextTaskForAgent(assignee), 500); // DB 갱신 대기 후 트리거
      }
    } catch (err) {
      console.error('[Socket] task:create 오류:', err.message);
    }
  });

  // Task 중단 (Kill)
  socket.on('task:kill', async ({ taskId }) => {
    const sid = String(taskId);
    broadcastLog('warn', `잠깐요, Task #${sid} 프로세스 중단 중입니다...`, 'system', sid);
    
    // 실행 중인 프로세스가 있다면 사살
    const controls = activeProcesses.get(sid);
    if (controls && controls.kill) {
      await controls.kill();
      activeProcesses.delete(sid);
    }

    try {
      await dbManager.updateTaskStatus(sid, 'PAUSED');
      io.emit('task:moved', { taskId: sid, toColumn: 'in_progress' }); // 위치 고수
      broadcastLog('info', `알겠습니다. Task #${sid} 일시 중단했습니다. 이어서 진행하시려면 언제든 말씀해 주세요.`, 'system', sid);
    } catch (err) {
      console.error('[Socket] task:kill DB 업데이트 오류:', err.message);
    }
  });

  // Task 댓글 기록 + [Phase 20] 담당 에이전트 자동 트리거 (Prime 9th Review 반영)
  socket.on('task:comment', async ({ taskId, author, text }) => {
    try {
      const sid = String(taskId);
      await dbManager.createComment(sid, author, text);
      io.emit('task:comment_added', { taskId: sid, author, text, createdAt: new Date().toISOString() });
      broadcastLog('info', text, author, sid);

      // ── [Phase 32] @bugdog 기록 트리거 감지 (칸반 코멘트 채널) ────────────
      if (!KNOWN_AGENTS_SET.has(author?.toLowerCase())) {
        const bugdogTrigger = detectBugdogTrigger(text);
        if (bugdogTrigger) {
          executeBugdogPipeline(
            { description: bugdogTrigger.description, taskId: sid, channel: 'kanban_comment' },
            dbManager,
            broadcastLog,
            (event, payload) => io.emit(event, payload)
          ).catch(err => console.error('[Server/Bugdog] 칸반 코멘트 파이프라인 오류:', err.message));
          return; // bugdog 트리거면 이후 에이전트 자동 트리거 생략
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      // ── 🤖 담당 에이전트 자동 트리거 ──────────────────────────────────────
      // 에이전트 자신의 응답 댓글이 다시 트리거를 유발하지 않도록 안전장치 적용
      // (이 체크가 없으면 에이전트 → 댓글 → 트리거 → 에이전트 → ... 무한 루프 발생)
      // [Fix] agents.json 기반 동적 Set 사용 (하드코딩 제거)
      if (!KNOWN_AGENTS_SET.has(author?.toLowerCase())) {
        const task = await dbManager.getTaskById(sid);

        // @멘션이 있으면 해당 에이전트, 없으면 카드 담당자로 자동 라우팅
        const mentionMatch = text.match(/^@([a-zA-Z가-힣]+)\s+(.*)/);
        let agentToTrigger = task?.assigned_agent || 'assistant';
        let aiRequestText = text;

        if (mentionMatch) {
          const mentioned = mentionMatch[1]?.toLowerCase();
          const resolved = globalAgentMap[mentioned];
          if (resolved) {
            agentToTrigger = resolved;
            aiRequestText = mentionMatch[2];
          }
        }

        // AI Trigger 중복 방지 (Prime 10th Review P1 적용)
        // ============================================
        // 여기서 executor.run()을 호출하던 로직을 제거하여,
        // REST API (POST /api/tasks/:id/comments) 측에만 AI 트리거 주도권을 부여합니다.
        // 이로써 Frontend가 Socket과 REST를 혼용하더라도 이중 429 쿼터 낭비 및 중복 댓글 생성을 방지합니다.
        // ============================================
      }
    } catch (err) {
      console.error('[Socket] task:comment 오류:', err.message);
    }
  });

  // Task 삭제 (Soft Delete)
  socket.on('task:delete', async ({ taskId }) => {
    try {
      const sid = String(taskId);
      await dbManager.deleteTask(sid);
      io.emit('task:deleted', { taskId: sid });
      broadcastLog('warn', `Task #${sid} 삭제됨 (Soft Delete)`, 'system', sid);
    } catch (err) {
      console.error('[Socket] task:delete 오류:', err.message);
    }
  });


  socket.on('disconnect', () => {
    console.log(`[Socket] 클라이언트 연결 해제: ${socket.id}`);
  });
});

export function broadcastLog(level, message, agentId = 'system', taskId = null, source = 'DASHBOARD', projectId = null) {
  console.log(`[${agentId}]${taskId ? ` (Task #${taskId})` : ''} ${message} (${source})`);
  
  // 비동기 Fallback 래퍼 (기존 호출부 호환성 유지)
  (async () => {
    let resolvedProjectId = projectId;
    
    // projectId가 없고 taskId가 있으면 DB에서 역추적
    if (!resolvedProjectId && taskId) {
      try {
        const task = await dbManager.getTaskById(taskId);
        if (task && task.project_id) {
          resolvedProjectId = task.project_id;
        }
      } catch (err) {
        // 무시하고 진행
      }
    }
    
    dbManager.insertLog(level, message, agentId, taskId, source, resolvedProjectId)
      .catch(err => console.warn(`[Log] Async DB Insert Failed for Task #${taskId}:`, err.message));
    
    const payload = { 
      level, message, agentId, taskId: taskId ? String(taskId) : null,
      projectId: resolvedProjectId,
      timestamp: new Date().toISOString() 
    };
    
    if (resolvedProjectId) {
      // 1. 프로젝트 전용 룸으로 브로드캐스트
      io.to(`project_${resolvedProjectId}`).emit('log:append', payload);
      // [점진적 전환] 2. 아직 클라이언트 프론트가 Room 구독을 안했을 수 있으므로 임시로 전역 방출도 병행
      // 프론트엔드 작업(28a)이 완전히 끝나면 아래 글로벌 emit은 제거 예정입니다.
      io.emit('log:append', payload);
    } else {
      // 프로젝트가 없는 전역 시스템 로그
      io.emit('log:append', payload);
    }
  })();
}

// 순환 참조 해결을 위한 Dependency Injection
// executor 구동 전 로깅 함수를 주입합니다.
executor.setBroadcastLog(broadcastLog);

// [Phase 1] 파일 폴링 어댑터 감시 데몬 실행 개시
// [Case 3 Fix] dispatchNextTaskForAgent 주입 — 작업 완료 후 자동 Pull 연결
initAdapterWatcher(io, dbManager, broadcastLog, dispatchNextTaskForAgent);

// ─── [Phase 25] Review Studio 소켓 네임스페이스 ──────────────────────────────
// VideoLab/ImageLab 리뷰 스튜디오 전용 실시간 채널
// Antigravity(Sonnet/Prime/Luca)가 POST /api/videolab/review/agent-verdict 호출 시
// 이 네임스페이스를 통해 연결된 모든 VideoLab 클라이언트에 판정 브로드캐스트됨
const reviewNs = io.of('/review');
reviewNs.on('connection', (socket) => {
  console.log(`[Socket/review] 리뷰 스튜디오 세션 연결됨: ${socket.id}`);

  // 연결 시 최근 판정 이력 동기화 (sessionId 기반)
  socket.on('review:join_session', async ({ sessionId }) => {
    if (!sessionId) return;
    socket.join(sessionId);
    console.log(`[Socket/review] ${socket.id} → 세션 [${sessionId}] 참여`);

    // 기존 판정 이력 즉시 전송 (fs/path 는 상단 import 사용)
    const verdictFilePath = path.resolve(process.cwd(), `outputs/review_verdicts/${sessionId}.json`);
    if (fs.existsSync(verdictFilePath)) {
      try {
        const history = JSON.parse(fs.readFileSync(verdictFilePath, 'utf8'));
        socket.emit('review:history_sync', { sessionId, verdicts: history });
      } catch {}
    }
  });

  // 대표님 직접 채팅 (VideoLab 채팅창 → 소켓으로 전달)
  socket.on('review:human_message', ({ sessionId, content, focusedCard }) => {
    const msg = {
      id:         `human_${Date.now()}`,
      agent:      '대표님',
      role:       'user',
      sessionId,
      focusedCard: focusedCard ?? null,
      verdict:    'COMMENT',
      content,
      createdAt:  new Date().toISOString()
    };
    // 같은 세션의 모든 참여자에게 브로드캐스트
    reviewNs.to(sessionId).emit('review:agent_verdict', msg);
    console.log(`[Socket/review] 대표님 메시지 → 세션 [${sessionId}]: "${content.slice(0, 40)}..."`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket/review] 세션 해제: ${socket.id}`);
  });
});

// HTTP REST /api/chat 완전 대체 — 실시간 스트리밍 응답 지원
const ariNs = io.of('/ari');
ariNs.on('connection', (socket) => {
  console.log(`[Socket/ari] ✅ Ari 비서 세션 연결됨: ${socket.id}`);

  socket.on('ari:message', async (data) => {
    const { content, channel = 'dashboard', author = 'CEO', images = [], preferredModel, projectId } = data || {};
    if (!content?.trim() && images.length === 0) return;

    console.log(`[Socket/ari] 메시지 수신 (${channel}): ${content}`);
    // [ImageAttach] 이미지가 없는 순수 텍스트만 broadcastLog (클라이언트 optimistic과 중복 방지)
    // 이미지 포함 메시지는 클라이언트가 이미 로컬 로그에 추가했으므로 서버 broadcast 생략
    if (images.length === 0) {
      broadcastLog('info', content, author, null, 'WEB_CHAT', projectId);
    }

    // ── [Phase 32] @bugdog 기록 트리거 감지 (Fire-and-forget) ────────────────
    const bugdogTrigger = detectBugdogTrigger(content);
    if (bugdogTrigger) {
      socket.emit('ari:stream_chunk', { text: '🐕 Bugdog이 기록을 시작합니다! 잠시 후 칸반 카드가 생성됩니다.' });
      socket.emit('ari:stream_done', { fullText: '🐕 Bugdog이 기록을 시작합니다! 잠시 후 칸반 카드가 생성됩니다.', model: 'Bugdog v1' });
      executeBugdogPipeline(
        { description: bugdogTrigger.description, channel },
        dbManager,
        broadcastLog,
        (event, payload) => io.emit(event, payload)
      ).catch(err => console.error('[Server/Bugdog] 파이프라인 오류:', err.message));
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    try {
      // [Phase 22] 실제 AI 실행 (executor → Ari 비서 레이어)
      const evaluation = await modelSelector.selectModel(content);

      // [T-08] ASYNC_CATEGORIES 레거시 강제 위임 블록 제거
      // 이전: server.js가 카테고리를 판단하여 크루에게 직접 위임 (ariDaemon 우회)
      // 현재: 모든 요청을 ariDaemon(5050)으로 포워딩 → ariDaemon의 Secretary SKILL.md가 판단
      // - 명시적 위임 키워드("팀에게 맡겨", "할당해줘")가 있으면 createKanbanTask 호출
      // - 없으면 직접 처리 (writeFile, writeCEOLog, googleSearch 등)

      
      // --- [Phase 22] 독립 구동되는 Ari Daemon (포트 5050)으로 포워딩 ---
      // [Phase 22.5 버그 픽스] 직접 변수 접근 시 만료된 토큰이 전달되어 401/400 에러 발생.
      // 반드시 getGoogleOAuthToken()을 호출하여 만료 시 자동 갱신된 토큰을 받아와야 함.
      const currentToken = await getGoogleOAuthToken();
      const postData = JSON.stringify({ content, author, oauthToken: currentToken, preferredModel });

      const reqDaemon = http.request({
        hostname: 'localhost',
        port: 5050,
        path: '/api/compute',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (resDaemon) => {
        if (resDaemon.statusCode !== 200) {
          console.warn(`[Socket/ari] 데몬 비정상 응답 상태코드: ${resDaemon.statusCode}`);
          reqDaemon.emit('error', new Error(`Status ${resDaemon.statusCode}`));
          return;
        }

        let fullText = '';
        let buffer = '';
        
        resDaemon.on('data', (chunk) => {
          buffer += chunk.toString();
          
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            
            if (line.startsWith('event: error')) {
              console.warn('[Socket/ari] 데몬 에러 이벤트 수신 (503 등 일시적 과부하)');
              const msg = '아리가 잠깐 바빠요 🙏 잠시 후 다시 말 걸어주세요!';
              socket.emit('ari:stream_chunk', { text: msg });
              socket.emit('ari:stream_done', { fullText: msg, model: 'Ari Daemon' });
              return; // 스트림 종료, 중복 end 이벤트 방지
            }

            
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (dataStr === '{}') continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.text) {
                  fullText += parsed.text;
                  socket.emit('ari:stream_chunk', { text: parsed.text });
                }
              } catch(e) {
                console.error('[Socket/ari] JSON 파싱 오류 (청크 잘림 무시):', e.message);
              }
            }
          }
        });
        
        resDaemon.on('end', () => {
          socket.emit('ari:stream_done', { fullText, model: 'Ari Daemon (Flash)' });
        });
      });

      reqDaemon.on('error', async (err) => {
        console.warn('[Socket/ari] 독립 Daemon(5050) 통신 실패. 로컬 엔진으로 폴백합니다.', err.message);
        const result = await executor.run(content, evaluation, 'assistant');
        const words = (result.text || '').split(' ');
        for (let i = 0; i < words.length; i++) {
          const isLast = i === words.length - 1;
          socket.emit('ari:stream_chunk', { text: words[i] + (isLast ? '' : ' ') });
          await new Promise(r => setTimeout(r, 20)); // 단어 단위 딜레이
        }
        socket.emit('ari:stream_done', { fullText: result.text, model: result.model });
      });

      reqDaemon.write(postData);
      reqDaemon.end();

    } catch (err) {
      console.error('[Socket/ari] AI 실행 오류:', err.message);
      socket.emit('ari:stream_chunk', { text: '죄송해요, 잠시 문제가 생겼어요. 다시 시도해 주세요. 😵' });
      socket.emit('ari:stream_done', { error: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket/ari] Ari 세션 해제: ${socket.id}`);
  });
});

// ─── Telegram Bot ────────────────────────────────────────────────────────────
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatIdEnv = process.env.TELEGRAM_CHAT_ID;
const defaultModel = process.env.DEFAULT_MODEL || 'Gemini';
let bot = null;

if (!chatIdEnv) {
  console.warn('⚠️ TELEGRAM_CHAT_ID 환경변수가 없습니다. 아웃바운드 푸시 알림이 발송되지 않습니다.');
}

if (token && token.length > 10) {
  bot = new TelegramBot(token, { polling: true });
  statusReporter.setBotConfig(bot, chatIdEnv);
  console.log('🤖 Telegram Bot Polling started...');
  console.log(`📡 Default AI Model: ${defaultModel}`);

  // 1. 루카 전용 호출 명령어 (/luca [지시사항])
  bot.onText(/^\/luca(?:\s+(.+))?$/, async (msg, match) => {
    const text = match[1];
    if (!text) return;
    console.log(`[Bot] Luca 전달 메시지 관측됨: ${text}`);
    const chatId = msg.chat.id;
    try {
      const taskTitle = `[LUCA] ${text.slice(0, 30)}`;
      const taskId = await dbManager.createTask(taskTitle, text, msg.from.username || 'User');
      broadcastLog('info', `[LUCA] ${text}`, 'luca');
      await bot.sendMessage(chatId, `🟢 루카(Antigravity)에게 메시지가 성공적으로 전달되었습니다.\n(루카는 워크스페이스에서 직접 확인 후 처리합니다.)`);
    } catch (error) {
      console.error(`[Bot] Luca 메시지 전달 실패:`, error);
      await bot.sendMessage(chatId, `❌ 전달 실패: ${error.message}`);
    }
  });

  // 2. 명령어 처리 (/cmd)
  bot.onText(/^\/cmd(?:\s+(.+))?$/, async (msg, match) => {
    const text = match[1];
    if (!text) return;
    console.log(`[Bot] 명령어 관측됨: ${text}`);
    handleResponse(msg, text, true);
  });

  // 3. 일반 대화
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    console.log(`[Bot] 일반 대화 관측됨: ${msg.text}`);
    handleResponse(msg, msg.text, false);
  });

  const processedMessages = new Set();
  const MAX_DEDUP_SIZE = 1000;

  async function handleResponse(msg, text, isCommand) {
    const chatId = msg.chat.id;

    // Idempotency Guard: 메시지 고유 ID 기반 중복 방지 (Polling Replay 방지)
    const msgKey = `${msg.message_id}_${chatId}`;
    if (processedMessages.has(msgKey)) {
      console.log(`[Bot] 중복 메시지 무시 (Idempotency Guard 작동): ${msgKey}`);
      return;
    }
    processedMessages.add(msgKey);
    if (processedMessages.size > MAX_DEDUP_SIZE) {
      const oldest = processedMessages.values().next().value;
      processedMessages.delete(oldest);
    }

    const author = msg.from.username || 'User';

    try {
      // 1. 카테고리 자율 판별 (기존 무지성 단어 매칭 대신 AI의 의도 파악을 먼저 수행)
      const evaluation = await modelSelector.selectModel(text);

      // Phase 11: 지능형 트리거 - QUICK_CHAT(일반적인 질문, 잡담, 승인)이 아닐 때만 카드로 만듭니다.
      // (단, 사용자가 명시적으로 /cmd 명령어를 쓴 경우는 항상 카드로 만듭니다)
      const shouldCreateTask = isCommand || (evaluation.category !== 'QUICK_CHAT');

      // [Bug 2] 담당자(Assignee) 자동 할당 매핑 — agents.json의 defaultCategory 기반 (하드코딩 제거)
      // CATEGORY_TO_AGENT는 agents.json 로드 시 동적으로 구성됨
      const assignedAgent = CATEGORY_TO_AGENT[evaluation.category] || 'assistant';

      let taskId = null;
      if (shouldCreateTask) {
        if (isCommand) {
          bot.sendMessage(chatId, `⏳ 지시가 로컬 SQLite Task Queue에 등록됩니다...`);
        }
        const taskTitle = text.slice(0, 30) + (text.length > 30 ? '...' : '');
        const targetModel = assignedAgent 
          ? (getAgentSignatureModel(assignedAgent) || 'gemini-2.5-flash') 
          : 'gemini-2.5-flash';
        taskId = await dbManager.createTask(taskTitle, text, author, targetModel, assignedAgent);
        broadcastLog('info', `태스크 생성됨: ${text}`, assignedAgent, taskId, 'TELEGRAM');
        io.emit('task:created', { taskId: String(taskId), title: taskTitle, content: text, column: 'todo', agentId: assignedAgent });
      } else {
        // 일반 대화는 Interaction 로그로만 기록 (카드 생성 안 됨)
        broadcastLog('info', `[Interaction] ${text}`, 'ari', null, 'TELEGRAM');
      }

      // --- [DEEP_WORK Fire-and-Forget 비동기 위임] ---
      if (evaluation.category === 'DEEP_WORK') {
        if (taskId) {
          dbManager.updateTaskStatus(taskId, 'in_progress');
          await dbManager.updateTaskExecutionMode(taskId, 'omo').catch(()=>{});
          bot.sendMessage(chatId, `🔧 [Task #${taskId}]\n전문 개발팀이 투입되었습니다.\n서버 블로킹 없이 백그라운드에서 실무 코딩을 진행합니다.`);
          
          agentStates.set('devteam', { status: 'active', lastHeartbeat: Date.now() });
          io.emit('agent:status_change', { agentId: 'devteam', status: 'active' });
          const sid = String(taskId);
          io.emit('task:moved', { taskId: sid, toColumn: 'in_progress', agentId: 'devteam' });

          // 딥워크 시작 알림 (텔레그램)
          statusReporter.reportAgentRunning(taskId, 'devteam (omo)', text, 'TELEGRAM');

          const controls = launchOmoTask(text, process.cwd(), 
            (log) => broadcastLog('info', log, 'devteam', sid, 'TELEGRAM'),
            async (code) => {
              const finalStatus = code === 0 ? 'REVIEW' : 'FAILED';
              await dbManager.updateTaskStatus(taskId, finalStatus);
              io.emit('task:moved', { taskId: sid, toColumn: code === 0 ? 'review' : 'todo' });
              
              agentStates.set('devteam', { status: 'idle', lastHeartbeat: Date.now() });
              io.emit('agent:status_change', { agentId: 'devteam', status: 'idle' });
              activeProcesses.delete(sid); // 프로세스 종료 시 맵에서 제거

              const finishMsg = code === 0 
                ? `✅ [Task #${taskId}] 개발팀 백그라운드 작업 완료!` 
                : `❌ [Task #${taskId}] 개발팀 작업 실패 (exit code: ${code})`;
              bot.sendMessage(chatId, finishMsg);

              if (code === 0) {
                 obsidianAdapter.archiveTask({
                   id: taskId, content: text, requester: author,
                   execution_mode: 'omo', model: 'ultrawork'
                 });
              }
            }
          );
          activeProcesses.set(String(taskId), controls); // 컨트롤 객체 보관
        }
        return; 
      }

      // --- [QUICK_CHAT 및 KNOWLEDGE 동기 처리] ---
      if (isCommand && taskId) {
        bot.sendMessage(chatId, `🧠 (Task #${taskId}) 지능형 분석 및 실행을 시작합니다...`);
      } else if (!isCommand) {
        bot.sendChatAction(chatId, 'typing');
      }

      agentStates.set(assignedAgent, { status: 'active', lastHeartbeat: Date.now() });
      io.emit('agent:status_change', { agentId: assignedAgent, status: 'active' });
      if (taskId) {
        io.emit('task:moved', { taskId: String(taskId), toColumn: 'in_progress' });
        statusReporter.reportAgentRunning(taskId, assignedAgent, text, 'TELEGRAM');
      }
      
      const result = await executor.run(text, evaluation, assignedAgent);

      if (taskId) {
        await dbManager.updateTaskStatus(taskId, 'REVIEW');
        // [Phase 14] 실제 사용된 기술적 모델명(Gemini... 등)을 DB에 기록 (Normalization)
        await dbManager.updateTaskModel(taskId, result.model);
        const sid = String(taskId);
        io.emit('task:updated', { taskId: sid, model: result.model });
        
        io.emit('task:moved', { taskId: sid, toColumn: 'review' });
        broadcastLog('success', `Task #${sid} 완료 대기 (리뷰 필요) (${result.model})`, assignedAgent, sid);
        
        obsidianAdapter.archiveTask({
          id: taskId, content: text, requester: author,
          execution_mode: assignedAgent, model: result.model
        });
      }


      const MAX_LENGTH = 4000;
      const chunks = [];
      let currentText = result.text;
      while (currentText.length > 0) {
        if (currentText.length <= MAX_LENGTH) { chunks.push(currentText); break; }
        let chunk = currentText.substring(0, MAX_LENGTH);
        const lastNewline = chunk.lastIndexOf('\n');
        if (lastNewline > MAX_LENGTH * 0.8) chunk = currentText.substring(0, lastNewline);
        chunks.push(chunk);
        currentText = currentText.substring(chunk.length).trim();
      }
      for (const chunk of chunks) await bot.sendMessage(chatId, chunk);

    } catch (error) {
      console.error(`[Bot] !!! 치명적 에러 !!!`, error);
      broadcastLog('error', error.message, 'ari');
      let friendlyMsg = `❌ 아리아리! 죄송해요 대표님. 업무 처리 중에 문제가 생겼어요.`;
      if (error.message.includes('503')) friendlyMsg = `☁️ 지금 구글 서버에 사람이 너무 많나 봐요!`;
      else if (error.message.includes('429')) friendlyMsg = `⏳ 아리가 너무 열심히 일했나 봐요!`;
      else friendlyMsg += `\n(에러: ${error.message})`;
      bot.sendMessage(chatId, friendlyMsg);
    }
  }
} else {
  console.warn('⚠️ TELEGRAM_BOT_TOKEN이 없거나 잘못되었습니다. 텔레그램 연동이 비활성화됩니다.');
}

// ─── REST API ─────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mycrew-bridge-server', version: '2.0.0' });
});

// ─── [Phase 21] Onboarding Pipeline: URL Scan & Context Extraction ────────
app.post('/api/onboarding/scan-url', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ status: 'error', message: 'URL이 필요합니다.' });

  try {
    broadcastLog('info', `[Onboarding] ${url} 웹사이트 스캔 및 팀 컨텍스트 추출을 시작합니다...`, 'system');
    
    // 비동기 파이프라인 실행
    const files = await processOnboardingUrl(url);
    
    broadcastLog('success', `[Onboarding] 스캔 완료 및 컨텍스트 파일 자동 생성 완료!`, 'system');
    res.json({ status: 'ok', message: '컨텍스트 추출이 완료되었습니다.', files });
  } catch (error) {
    console.error('[API] /api/onboarding/scan-url 에러:', error.message);
    broadcastLog('error', `[Onboarding] 추출 에러 발생: ${error.message}`, 'system');
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ─── [Phase 21] Settings & Integration Vault API ─────────────────────────────
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await dbManager.getAllSettings();
    // 보안을 위해 일부 키는 마스킹 처리해서 보낼 수도 있으나, 현재는 어드민 단독 사용이므로 전체 반환
    res.json({ status: 'ok', settings });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ status: 'error', message: '키 값이 필요합니다.' });
    
    // KeyProvider를 통해 저장 시, DB 저장과 함께 앱 메모리 캐시도 즉시 갱신됨
    await keyProvider.setKey(key, value);
    broadcastLog('info', `[Settings] ${key} 설정이 업데이트 되었습니다.`, 'system');
    res.json({ status: 'ok', message: '설정이 성공적으로 저장되었습니다.' });
  } catch (error) {
    console.error('[API] /api/settings 저장 에러:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ─── [Week 3: Memory 흡수] FTS5 전문 검색 API ──────────────────────────────
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    const projectId = req.query.projectId || req.query.project_id || null;
    if (!q) return res.status(400).json({ status: 'error', message: 'Missing search query component' });
    
    // FTS DB 쿼리 실행
    const rows = await dbManager.searchTasks(q, projectId);
    
    // UI에 보여주기 위해 프론트엔드가 기대하는 포맷으로 간단 매핑
    const results = rows.map((row) => {
      const fullText = (row.content || '').trim();
      const breakIdx = fullText.indexOf('\n');
      let titleLine = fullText;
      let detailContent = fullText;
      if (breakIdx !== -1) {
        titleLine = fullText.substring(0, breakIdx).trim();
        detailContent = fullText.substring(breakIdx + 1).trim();
      }
      return {
        id: String(row.id),
        title: titleLine,
        content: detailContent,
        createdAt: row.created_at,
        assignee: row.assigned_agent,
        status: row.status,
        projectId: row.project_id || 'proj-1'
      };
    });

    res.status(200).json({ status: 'ok', count: results.length, results });
  } catch (err) {
    console.error('[Search] 검색 예외 발생:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * GET /api/projects — 워크스페이스 프로젝트 목록 조회
 */
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await dbManager.getAllProjects();
    res.json(projects);
  } catch (err) {
    console.error('[API] /api/projects 에러:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /api/projects/:id/crew — 특정 프로젝트의 할당된 팀 크루 조회
 */
app.get('/api/projects/:id/crew', async (req, res) => {
  try {
    const crew = await dbManager.getProjectCrew(req.params.id);
    res.json(crew);
  } catch (err) {
    console.error('[API] /api/projects/:id/crew 에러:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * PATCH /api/projects/:id/crew/:agentId/nickname — 팀원 닉네임 설정
 * 닉네임 없음 = null (역할명으로 표시), 닉네임 있음 = 사용자 지정 이름으로 표시
 */
app.patch('/api/projects/:id/crew/:agentId/nickname', async (req, res) => {
  try {
    const { nickname } = req.body; // null 허용 (닉네임 제거)
    await dbManager.setCrewNickname(req.params.id, req.params.agentId, nickname || null);
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('[API] PATCH /crew/:agentId/nickname 에러:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * [Phase 35] GET /api/projects/:id/agents — 프로젝트별 동적 에이전트 목록 조회
 */
app.get('/api/projects/:id/agents', async (req, res) => {
  try {
    const agents = await dbManager.getProjectAgents(req.params.id);
    res.json(agents);
  } catch (err) {
    console.error('[API] GET /api/projects/:id/agents 에러:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * [Phase 35] PATCH /api/agents/:agentId/profile — 에이전트 인스턴스 프로필(닉네임, 아바타) 수정
 */
app.patch('/api/agents/:agentId/profile', async (req, res) => {
  try {
    const { nickname, avatar } = req.body;
    await dbManager.updateProjectAgentProfile(req.params.agentId, nickname, avatar);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] PATCH /api/agents/:agentId/profile 에러:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /api/projects — 새 프로젝트(워크스페이스) 생성
 */
app.post('/api/projects', async (req, res) => {
  try {
    const { id, name, objective, isolation_scope } = req.body;
    if (!id || !name) return res.status(400).json({ error: 'id and name are required' });
    await dbManager.createProject(id, name, objective, isolation_scope);
    res.json({ status: 'ok', id });
  } catch (err) {
    console.error('[API] POST /api/projects 에러:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /api/projects/zero-config — Zero-Config AI 빌딩
 */
app.post('/api/projects/zero-config', async (req, res) => {
  try {
    const { name, objective, isolation_scope } = req.body;
    if (!name || !objective) return res.status(400).json({ error: 'name and objective are required' });

    // [STAGE-LOG] 단계별 로그 콜백 함수 충주 — zeroConfigService가 호출하여 실시간 진행 현황 전송
    const projectBroadcast = (message, level = 'info') => {
      broadcastLog(level, message, 'system', null, 'DASHBOARD');
    };

    projectBroadcast(`✨ [${name}] 프로젝트 생성을 시작합니다. (실제 소요시간: 약 1분 15초)`);

    // ZeroConfigService에 빌딩 위임 (Background 처리)
    zeroConfigService.buildProject({ name, objective, isolation_scope }, projectBroadcast)
      .then(projectId => {
        broadcastLog('success', `✅ [${name}] 프로젝트 세팅 완료! 크루 배치가 완료되었으며 워크스페이스가 자동 전환됩니다.`, 'system', null, 'DASHBOARD', projectId);
        io.emit('project:ready', { projectId });
      })
      .catch(err => {
        broadcastLog('error', `❌ [${name}] 프로젝트 세팅 실패: ${err.message}`, 'system', null, 'DASHBOARD');
        console.error('[API] Zero-Config 백그라운드 에러:', err);
        io.emit('project:error', { error: err.message });
      });

    // HTTP 타임아웃을 막기 위해 즉각 응답
    res.json({ status: 'processing', message: 'AI is building the project in the background.' });
  } catch (err) {
    console.error('[API] POST /api/projects/zero-config 에러:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

/**
 * PUT /api/projects/:id — 프로젝트 설정 (타이틀, 목적, 공유범위) 수정
 * [PRD#32 / CP-4] objective_raw, workflow_raw 분리 저장 지원
 */
app.put('/api/projects/:id', async (req, res) => {
  try {
    const { name, objective, isolation_scope, objective_raw, workflow_raw } = req.body;
    await dbManager.updateProject(req.params.id, name, objective, isolation_scope, objective_raw, workflow_raw);
    // 실시간 프로젝트 업데이트 소켓 알림
    io.emit('project:updated', { id: req.params.id, name, objective, objective_raw, workflow_raw, isolation_scope });
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('[API] PUT /api/projects/:id 에러:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * DELETE /api/projects/:id — 프로젝트 삭제
 */
app.delete('/api/projects/:id', async (req, res) => {
  try {
    await dbManager.deleteProject(req.params.id);
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('[API] DELETE /api/projects/:id 에러:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * [Phase 36] GET /api/projects/:id/project_md — PROJECT.md 읽기
 */
app.get('/api/projects/:id/project_md', async (req, res) => {
  try {
    const { version } = req.query;
    const project = await dbManager.getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const PROJECTS_ROOT = process.env.PROJECTS_ROOT_PATH
      ? path.resolve(process.env.PROJECTS_ROOT_PATH)
      : path.resolve(process.cwd(), '../../04_Projects');

    const safeName = project.name.replace(/[^a-zA-Z0-9가-힣]/g, '_').replace(/_+/g, '_');
    const shortId = project.id.slice(-5);
    
    let targetPath = path.join(PROJECTS_ROOT, `${safeName}_${shortId}`, 'PROJECT.md');
    if (version && version.startsWith('PROJECT_v') && version.endsWith('.md')) {
      targetPath = path.join(PROJECTS_ROOT, `${safeName}_${shortId}`, '.versions', path.basename(version));
    }

    try {
      const content = await fs.promises.readFile(targetPath, 'utf-8');
      res.json({ content });
    } catch (e) {
      if (e.code === 'ENOENT') {
        res.json({ content: '' }); // 파일이 없으면 빈 문자열
      } else {
        throw e;
      }
    }
  } catch (err) {
    console.error('[API] GET /api/projects/:id/project_md 에러:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * [Phase 36] GET /api/projects/:id/project_md/versions — PROJECT.md 버전 목록 조회
 */
app.get('/api/projects/:id/project_md/versions', async (req, res) => {
  try {
    const project = await dbManager.getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const PROJECTS_ROOT = process.env.PROJECTS_ROOT_PATH
      ? path.resolve(process.env.PROJECTS_ROOT_PATH)
      : path.resolve(process.cwd(), '../../04_Projects');

    const safeName = project.name.replace(/[^a-zA-Z0-9가-힣]/g, '_').replace(/_+/g, '_');
    const shortId = project.id.slice(-5);
    const versionsDir = path.join(PROJECTS_ROOT, `${safeName}_${shortId}`, '.versions');

    let files = [];
    try {
      files = await fs.promises.readdir(versionsDir);
    } catch (e) {
      // 폴더 없으면 넘어감
    }

    const versions = files
      .filter(f => f.startsWith('PROJECT_v') && f.endsWith('.md'))
      .map(f => {
        const parts = f.replace('PROJECT_v', '').replace('.md', '').split('_');
        return {
          filename: f,
          label: `ver.${parts[0]}_${parts[1]}`, 
          date: parts[0],
          time: parts[1]
        };
      })
      .sort((a, b) => {
        // 최신순 정렬 (내림차순)
        if (a.date === b.date) return b.time.localeCompare(a.time);
        return b.date.localeCompare(a.date);
      });

    res.json({ versions });
  } catch (err) {
    console.error('[API] GET /api/projects/:id/project_md/versions 에러:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * [Phase 36] PUT /api/projects/:id/project_md — PROJECT.md 쓰기 (자동 버전 백업)
 */
app.put('/api/projects/:id/project_md', async (req, res) => {
  try {
    const { content } = req.body;
    const project = await dbManager.getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const PROJECTS_ROOT = process.env.PROJECTS_ROOT_PATH
      ? path.resolve(process.env.PROJECTS_ROOT_PATH)
      : path.resolve(process.cwd(), '../../04_Projects');

    const safeName = project.name.replace(/[^a-zA-Z0-9가-힣]/g, '_').replace(/_+/g, '_');
    const shortId = project.id.slice(-5);
    const projectRoot = path.join(PROJECTS_ROOT, `${safeName}_${shortId}`);
    const projectPath = path.join(projectRoot, 'PROJECT.md');
    const versionsDir = path.join(projectRoot, '.versions');

    // 1. 버전 폴더 확인 및 생성
    try {
      await fs.promises.mkdir(versionsDir, { recursive: true });
    } catch (e) {}

    // 2. 기존 파일 읽어서 백업 (내용이 변경된 경우만)
    try {
      const oldContent = await fs.promises.readFile(projectPath, 'utf-8');
      if (oldContent.trim() !== content.trim()) {
        const date = new Date();
        const yy = String(date.getFullYear()).slice(2);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const HH = String(date.getHours()).padStart(2, '0');
        const MM = String(date.getMinutes()).padStart(2, '0');
        const SS = String(date.getSeconds()).padStart(2, '0');
        const versionFileName = `PROJECT_v${yy}${mm}${dd}_${HH}${MM}${SS}.md`;
        await fs.promises.writeFile(path.join(versionsDir, versionFileName), oldContent, 'utf-8');
      }
    } catch (e) {
      // 기존 파일이 없으면 그냥 넘어감
    }

    // 3. 새 내용 덮어쓰기
    await fs.promises.writeFile(projectPath, content, 'utf-8');
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('[API] PUT /api/projects/:id/project_md 에러:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /api/tasks — 대시보드 초기 진입(Hydration)용 Task 전체 목록
 * 프론트엔드 KanbanBoard가 새로고침 될 때 이 API로 과거 데이터를 복원합니다.
 */
app.get('/api/tasks', async (req, res) => {
  try {
    const projectId = req.query.projectId || req.query.project_id || null;
    const rows = await dbManager.getAllTasks(projectId);
    // DB status → 칸반 column 매핑
    const STATUS_TO_COLUMN = {
      PENDING:     'todo',
      in_progress: 'in_progress',
      IN_PROGRESS: 'in_progress',
      REVIEW:      'review',
      review:      'review',
      HELP_USER_ACTION: 'review', // [W1] HELP_USER_ACTION 상태를 리뷰 컬럼으로 이동
      COMPLETED:   'done',
      done:        'done',
      FAILED:      'todo',
    };
    const tasks = rows.map((row) => {
      // [Phase27 Step3] title/content 분리 — DB title 컬럼 직접 사용
      // 구형 레코드(title='')는 content 첫 줄 폴백 (단, content 자체는 오염 안 함)
      const rawTitle   = (row.title || '').trim();
      const rawContent = (row.content || '').trim();
      const title = rawTitle || rawContent.split('\n')[0].trim(); // 폴백: 첫 줄
      const content = rawContent; // content는 전체 그대로 전달

      return {
      id: String(row.id),
      title,
      content,
      column: STATUS_TO_COLUMN[row.status] || 'todo',
      status: row.status,
      riskLevel: row.risk_level || 'SAFE',
      executionMode: row.execution_mode || 'assistant',
      assignee: row.assigned_agent || row.requester,
      author: row.requester,
      assignedAgent: row.assigned_agent || '미할당',
      model: row.model,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      projectId: row.project_id || 'proj-1',
      project_task_num: row.project_task_num ?? null,  // [프로젝트 순번] #1부터 시작
    };
    });
    res.json({ status: 'ok', tasks });

  } catch (err) {
    console.error('[API] /api/tasks 에러:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/** GET /api/tasks/archived — 보관소(Archive)용 Task 목록 */
app.get('/api/tasks/archived', async (req, res) => {
  try {
    const projectId = req.query.projectId || req.query.project_id || null;
    const rows = await dbManager.getArchivedTasks(projectId);
    const tasks = rows.map((row) => {
      // [Phase27 Step3] title/content 분리 — DB title 컬럼 직접 사용
      const rawTitle   = (row.title || '').trim();
      const rawContent = (row.content || '').trim();
      const title = rawTitle || rawContent.split('\n')[0].trim();
      const content = rawContent;

      return {
        id: String(row.id),
        title,
        content,
        column: 'archived',
        status: row.status,
        riskLevel: row.risk_level || 'SAFE',
        executionMode: row.execution_mode || 'assistant',
        assignee: row.assigned_agent || row.requester,
        author: row.requester,
        assignedAgent: row.assigned_agent || '미할당',
        model: row.model,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        projectId: row.project_id || 'proj-1',
        project_task_num: row.project_task_num ?? null,  // [프로젝트 순번]
      };
    });
    res.json({ status: 'ok', tasks });
  } catch (err) {
    console.error('[API] /api/tasks/archived 에러:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/** POST /api/tasks/notify-created — 시스템/에이전트가 생성한 태스크 소켓 브로드캐스트 */
app.post('/api/tasks/notify-created', async (req, res) => {
  try {
    const { taskId, title, content, column, agentId, priority } = req.body;
    io.emit('task:created', { 
      taskId: String(taskId), 
      title, 
      content, 
      column: column || 'todo', 
      agentId, 
      priority 
    });
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// [Phase 14] 멘션 기반 즉시 태스크 생성 API (대표님 직접 멘션 → 'CEO')
app.post('/api/tasks/mention', async (req, res) => {
  try {
    const { agent, content } = req.body;
    const targetAgent = globalAgentMap[agent.toLowerCase()] || 'assistant';
    
    // [W1 Fix] 대표님 직접 멘션은 항상 'CEO' 작성자로 생성
    const targetModel = targetAgent 
      ? (getAgentSignatureModel(targetAgent) || 'gemini-2.5-flash') 
      : 'gemini-2.5-flash';
    const taskId = await dbManager.createTask(content.slice(0,30), content, 'CEO', targetModel, targetAgent);
    
    // 생성 직후 In Progress로 강제 진입
    await dbManager.updateTaskStatus(taskId, 'in_progress');
    
    // [W2 Fix] 레이스 컨디션 제거: 처음부터 in_progress 컬럼으로 단일 이벤트 방출
    io.emit('task:created', { 
      taskId: String(taskId), title: content.slice(0,30), content, 
      column: 'in_progress',  // ← 바로 in_progress로 생성 (setTimeout 제거)
      agentId: targetAgent 
    });
    io.emit('agent:status_change', { agentId: targetAgent, status: 'active' });

    // 히스토리 남김
    dbManager.insertLog('info', `[Mention] ${author}님이 @${targetAgent} 호출: ${content}`, targetAgent, taskId, 'WEB').catch(()=>{});

    res.status(200).json({ status: 'ok', taskId, agent: targetAgent });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * [Phase 14] 순수 채팅 전용 API (태스크 생성 없음)
 * Chatting 탭에서 @멘션을 사용하더라도 카드를 만들지 않고 대화만 진행합니다.
 */
app.post('/api/chat', async (req, res) => {
  console.log(`[API] /api/chat 요청 수신:`, req.body);
  try {
    const { agent, content, author = '대표님', projectId } = req.body;
    const targetAgent = globalAgentMap[agent?.toLowerCase()] || 'assistant';

    // 1. 유저 메시지 로그 기록
    broadcastLog('info', `${content}`, author, null, 'WEB_CHAT', projectId);

    // 2. AI 실행 (태스크 ID 없이 실행)
    const evaluation = await modelSelector.selectModel(content);
    
    // 에이전트 상태 활성화 (소켓)
    agentStates.set(targetAgent, { status: 'active', lastHeartbeat: Date.now() });
    io.emit('agent:status_change', { agentId: targetAgent, status: 'active' });

    // 3. AI 응답 생성
    const result = await executor.run(content, evaluation, targetAgent);

    // 4. AI 응답 완료 알림 (타임라인에는 요약 뱃지만 — 결과물 전문은 카드 Discussion에서 확인)
    // 결과물 전문을 broadcastLog하면 타임라인에 긴 텍스트가 그대로 노출됨 → 제거
    broadcastLog('success', `> [${targetAgent}] 작업 완료 — 카드 Discussion에서 결과물을 확인하세요.`, targetAgent, null, 'WEB_CHAT_REPLY');


    res.status(200).json({ status: 'ok', text: result.text, agent: targetAgent });
  } catch (err) {
    console.error('[API] /api/chat 에러:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});


// ── Task 상세 REST API (Phase 11: TaskDetailModal 지원) ───────────────────

/** GET /api/comments/recent — 프로젝트별 타임라인 조회를 위한 태스크 최근 댓글 목록 (Phase 28a) */
app.get('/api/comments/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const projectId = req.query.projectId || req.query.project_id || null;
    const comments = await dbManager.getRecentGlobalComments(limit, projectId);
    res.json({ status: 'ok', comments });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/** GET /api/tasks/:id/comments — 태스크 댓글 목록 조회 (v2.1 위상 DTO) */
app.get('/api/tasks/:id/comments', async (req, res) => {
  try {
    const sid = req.params.id;
    const task = await dbManager.getTaskById(sid);
    // [v2.1] getCommentsWithTopology: requester(보고 대상)도 전달 → 크루가 CEO/ARI 중 올바른 대상에게 보고
    const comments = await dbManager.getCommentsWithTopology(
      sid,
      task?.assigned_agent || 'assistant',
      task?.requester || 'CEO'
    );
    res.json({ status: 'ok', comments });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/** POST /api/tasks/:id/comments — 댓글 추가 */
app.post('/api/tasks/:id/comments', async (req, res) => {
  try {
    const { author, content, worked, assignedAgent } = req.body;
    if (!author || !content) return res.status(400).json({ status: 'error', message: '작성자와 내용 필수' });
    const sid = req.params.id;
    await dbManager.createComment(sid, author, content);
    // 실시간 브로드캐스트 — author를 agentId로 전달해 채팅 버블 방향 식별
    io.emit('task:comment_added', { taskId: sid, author, text: content, createdAt: new Date().toISOString() });
    broadcastLog('info', content, author, sid);

    // ── 🏓 핑퐁 규칙: worked=true 시 담당자를 requester(원래 할당자)로 복귀 ──
    if (worked === true) {
      try {
        const task = await dbManager.getTaskById(sid);
        if (task && task.requester) {
          await dbManager.updateTaskStatus(sid, 'PENDING'); // 보드: 재검토 대기
          io.emit('task:moved', { taskId: sid, toColumn: 'todo' });
          io.emit('task:updated', { taskId: sid, assignee: task.requester });
          broadcastLog('info', `[WORKED] 태스크 #${sid} 작업이 완료됐어요! 🎉 [${task.requester}]에게 검토 요청을 드릴게요.`, 'ari', sid);
        }
      } catch (pingPongErr) {
        console.error('[PingPong] 담당자 복귀 오류:', pingPongErr.message);
      }
    }

    // ── [Phase 32] @bugdog 기록 트리거 — 멘션 파싱보다 먼저 검사 ────────────
    // (감지 시 ARI로 폴백되지 않도록 mentionMatch 이전에 처리)
    if (!KNOWN_AGENTS_SET.has(author?.toLowerCase())) {
      const bugdogTrigger = detectBugdogTrigger(content);
      if (bugdogTrigger) {
        res.json({ status: 'ok', message: '🐕 Bugdog이 기록을 시작합니다! 잠시 후 칸반 카드가 생성됩니다.' });
        executeBugdogPipeline(
          { description: bugdogTrigger.description, taskId: sid, channel: 'kanban_comment_rest' },
          dbManager,
          broadcastLog,
          (event, payload) => io.emit(event, payload)
        ).catch(err => console.error('[REST/Bugdog] 파이프라인 오류:', err.message));
        return; // 이후 ARI 트리거 생략
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    // ── 🤖 코멘트 내 멘션 감지 및 AI 담당자 자동 트리거 ────────────────────
    // [Fix] agents.json 기반 동적 Set 사용 (하드코딩 제거)
    if (!KNOWN_AGENTS_SET.has(author?.toLowerCase())) {
      const task = await dbManager.getTaskById(sid);
      // [Fix] 모달에서 비동기로 전달된 assignedAgent를 최우선으로 사용하여 Race Condition 방지
      let agentToTrigger = assignedAgent || task?.assigned_agent || 'assistant';
      let aiRequestText = content;
      // [S3-1] 멘션 라우팅 메타: @멘션은 이 댓글의 실행자만 바꾼다. DB assigned_agent는 변경 안함.
      let isMentionRouted = false;

      // @멘션 우선권 — [S3-1] DB assigned_agent 불변 보장
      const mentionMatch = content.match(/^@([a-zA-Z가-힣]+)\s+(.*)/);
      if (mentionMatch) {
        const requestedAgent = mentionMatch[1]?.toLowerCase();
        const resolved = globalAgentMap[requestedAgent];
        if (resolved) {
          agentToTrigger = resolved;
          aiRequestText = mentionMatch[2];
          isMentionRouted = true;
          // [S3-6] 멘션 라우팅 투명성: 타임라인에 경로 이벤트 노출
          broadcastLog('info',
            `[라우팅] @${mentionMatch[1]} 멘션 — ${resolved.toUpperCase()}에게 위임합니다. (카드 담당자 변경 아님)`,
            'system', sid
          );
        }
      }

      // [BugFix] 할당된 담당자가 AI 에이전트가 아니면 (예: "CEO", "개발팀"), 기본 비서인 'ari'가 응답하도록 폴백
      if (!KNOWN_AGENTS_SET.has(agentToTrigger?.toLowerCase())) {
        console.log(`[Bypass] Target assignee '${agentToTrigger}' is NOT an AI agent. Falling back to 'ari'.`);
        agentToTrigger = 'ari';
      }

      // [Phase 22.6] 동시성 개입(Interruption) 방어: 이미 에이전트가 작업 중이면 LLM 트리거 생략
      if (agentStates.get(agentToTrigger)?.status === 'active') {
        console.log(`[Interruption] ${agentToTrigger} is already active. Comment saved but AI trigger skipped.`);
        return;
      }


      // 백그라운드 비동기 실행 (REST 응답 차단 방지)
      (async () => {
        try {
          agentStates.set(agentToTrigger, { status: 'active', lastHeartbeat: Date.now() });
          io.emit('agent:status_change', { agentId: agentToTrigger, status: 'active' });

          // 태스크 상태를 IN_PROGRESS로 이동하여 UI에서 작업 시작을 명확히 함
          await dbManager.updateTaskStatus(sid, 'IN_PROGRESS');
          io.emit('task:moved', { taskId: sid, toColumn: 'in_progress' });
          broadcastLog('info', `> 댓글 지시를 수신했습니다. 즉시 사고과정 및 분석을 시작합니다...`, agentToTrigger, sid);

          // [Living Playbook] 유저 피드백 분석 및 룰 수확
          const harvested = await ruleHarvester.classifyAndHarvest(content, author, sid);
          if (harvested && harvested.scope === 'TEAM') {
            io.emit('rule:synthesized', { scope: 'TEAM', rule: harvested.rule });
            broadcastLog('success', `💡 새로운 팀 룰 발견! [${harvested.rule}]을 인지했습니다.`, 'system', sid);
          }

          // ── [Phase 23] Fast-Track Intent 가로채기 (UX 극대화) ──
          if (/^(아카이브해|아카이빙해|아카이빙해줘|아카이브|아카이빙|닫아줘)$/i.test(aiRequestText.trim())) {
             await dbManager.updateTaskStatus(sid, 'ARCHIVED');
             io.emit('task:archived', { taskId: sid });
             broadcastLog('success', `[Fast-Track] 지시를 가로채 즉시 아카이빙 처리했습니다.`, 'system', sid);
             agentStates.set(agentToTrigger, { status: 'idle', lastHeartbeat: Date.now() });
             io.emit('agent:status_change', { agentId: agentToTrigger, status: 'idle' });
             return; // AI LLM 실행 건너뜀
          }

          const evaluation = await modelSelector.selectModel(aiRequestText);
          
          // [Fix] AI가 태스크 전체 내용(초안)과 대화 맥락을 파악할 수 있도록 Context 합치기
          const recentComments = await dbManager.getCommentsWithTopology(sid, agentToTrigger, task?.requester || 'CEO');
          // 마지막 명령어 제외한 이전 대화들 (최대 5개)
          const historyLimit = recentComments.slice(0, -1).slice(-5);
          const historyText = historyLimit.map(c => `[${c.author}] ${c.content}`).join('\n');
          
          // [추가] 아티팩트(파일)가 있을 경우 내용 읽어오기
          let artifactContent = '';
          if (task?.has_artifact === 1 && task?.artifact_url) {
            if (/\.(md|txt|json|csv|html)$/i.test(task.artifact_url)) {
              try {
                const fs = await import('fs');
                const path = await import('path');
                const filePath = path.resolve(process.cwd(), task.artifact_url);
                if (fs.existsSync(filePath)) {
                   artifactContent = fs.readFileSync(filePath, 'utf-8');
                }
              } catch (e) {
                console.warn('[Artifact Read] 파일 읽기 실패:', e.message);
              }
            } else {
              artifactContent = `[미디어 파일 첨부됨: ${task.artifact_url}]`;
            }
          }

          let fullContextText = `[Original Task Content]\n${task?.content || '내용 없음'}\n\n`;
          if (artifactContent) {
            fullContextText += `[Attached Artifact Document]\n${artifactContent}\n\n`;
          }
          if (historyText) {
            fullContextText += `[Recent Discussion History]\n${historyText}\n\n`;
          }
          fullContextText += `[Latest Instruction for you]\n${aiRequestText}\n\n`;
          
          // [System UX Directive] 대표님 피드백 반영: 문서를 인지했음을 나타내는 서두 강제
          fullContextText += `[System UX Action Directive]\n`;
          fullContextText += `유저가 기존 작업물(초안이나 첨부 문서)의 수정을 지시했거나 참조를 요구한 경우, 당신의 응답 가장 처음에 반드시 "문서를 확인했습니다." 라는 문장으로 시작하여 문서를 성공적으로 읽었음을 사용자에게 알리세요. 그 다음 수정된 작업물 결과를 출력하세요.`;

          // [Fix] 댓글 응답은 즉각적이어야 하므로 runDirect() 사용 (filePollingAdapter 우회)
          const result = await executor.runDirect(fullContextText, agentToTrigger, sid);

          let cleanText = result.text || '';
          let nextState = 'REVIEW'; // 기본값
          let nextColumn = 'review';
          let reassignTarget = null;
          let removeCard = false;

          // [Phase 23] MyCrew Operating Protocol JSON 블록 파싱
          const jsonMatch = cleanText.match(/```json\s*(\{[\s\S]*?"system_action"[\s\S]*?\})\s*```/);
          if (jsonMatch) {
            try {
              const actionData = JSON.parse(jsonMatch[1]);
              if (actionData.system_action) {
                const action = actionData.system_action;
                if (action.action === 'CHANGE_STATUS' && action.target) {
                  nextState = action.target.toUpperCase();
                  const colMap = { 'TODO': 'todo', 'IN_PROGRESS': 'in_progress', 'REVIEW': 'review', 'COMPLETED': 'done', 'ARCHIVED': 'archived' };
                  nextColumn = colMap[nextState] || 'review';
                  if (nextState === 'ARCHIVED') removeCard = true;
                }
                if (action.assignee) {
                  reassignTarget = action.assignee.toLowerCase();
                }
              }
              // JSON 블록을 응답 텍스트에서 제거 (사용자 노출 방지)
              cleanText = cleanText.replace(jsonMatch[0], '').trim();
            } catch (e) {
              console.error('[Action Protocol] JSON 파싱 실패:', e.message);
            }
          }

          // 태스크 상태 업데이트 (AI의 자율 판단에 따른 유연한 전이)
          await dbManager.updateTaskStatus(sid, nextState);
          
          if (removeCard) {
            io.emit('task:archived', { taskId: sid });
            broadcastLog('success', `[ARCHIVED] 에이전트 자율 판단으로 카드가 아카이빙되었습니다.`, agentToTrigger, sid);
          } else {
            io.emit('task:moved', { taskId: sid, toColumn: nextColumn });
          }

          if (reassignTarget) {
            const taskObj = await dbManager.getTaskById(sid);
            await dbManager.updateTaskDetails(sid, taskObj.title, taskObj.content, reassignTarget, result.model);
            io.emit('task:updated', { taskId: sid, assignee: reassignTarget });
            broadcastLog('info', `담당자가 [${reassignTarget}]로 변경되었습니다.`, agentToTrigger, sid);
          }

          // [Phase 3.2] 실제 수행된 모델과 카테고리 정보를 DB에 업데이트 (UI 필터링용)
          await dbManager.updateTaskModel(sid, result.model, result.category);
          io.emit('task:updated', { taskId: sid, model: result.model, category: result.category });

          // AI의 응답을 해당 카드에 신규 코멘트로 저장
          if (cleanText) {
            const thoughtProcess = result._meta?.thought_process || null;
            await dbManager.createComment(sid, agentToTrigger, cleanText, thoughtProcess);
            io.emit('task:comment_added', { taskId: sid, author: agentToTrigger, text: cleanText, thought_process: thoughtProcess, createdAt: new Date().toISOString() });
            broadcastLog('info', cleanText, agentToTrigger, sid);
          }
          
          agentStates.set(agentToTrigger, { status: 'idle', lastHeartbeat: Date.now() });
          io.emit('agent:status_change', { agentId: agentToTrigger, status: 'idle' });
        } catch (err) {
          console.error('[Comment AI Reply Error]', err);
          const errMsg = '앗, 코멘트를 분석해서 대답하려다 잠깐 머리가 하얘졌어요. 😵';
          await dbManager.createComment(sid, agentToTrigger, errMsg);
          io.emit('task:comment_added', { taskId: sid, author: agentToTrigger, text: errMsg, createdAt: new Date().toISOString() });
          broadcastLog('error', errMsg, agentToTrigger, sid);
        }
      })();
    }

    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/** DELETE /api/tasks/:id — Soft Delete */
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const sid = req.params.id;
    await dbManager.deleteTask(sid);
    io.emit('task:deleted', { taskId: sid });
    broadcastLog('warn', `Task #${sid} 삭제됨 (Soft Delete)`, 'system', sid);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/** POST /api/tasks/:id/kill — 실행 중인 태스크 강제 중단 */
app.post('/api/tasks/:id/kill', async (req, res) => {
  const sid = String(req.params.id);
  broadcastLog('warn', `Task #${sid} Kill 요청 수신`, 'system', sid);

  const controls = activeProcesses.get(sid);
  if (controls && controls.kill) {
    await controls.kill();
    activeProcesses.delete(sid);
  }

  try {
    await dbManager.updateTaskStatus(sid, 'PAUSED');
    io.emit('task:updated', { taskId: sid, status: 'PAUSED', column: 'in_progress' });
    io.emit('task:moved', { taskId: sid, toColumn: 'in_progress' });
    broadcastLog('error', `Task #${sid} 실행이 중단되었습니다 (PAUSED)`, 'system', sid);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── [Phase 20] Activity Log 헬퍼 — 배치 지원 버전 ────────────────────────
// [문제 10 Fix] 동일 트랜잭션의 복수 변경사항을 단일 시스템 댓글로 묶어 출력
// 단일 메시지: logActivity(taskId, '메시지')
// 배치 메시지: logActivity(taskId, ['메시지1', '메시지2', ...])
async function logActivity(taskId, messageOrItems) {
  const sid = String(taskId);
  try {
    const isArray = Array.isArray(messageOrItems);
    let message;
    if (isArray && messageOrItems.length > 1) {
      // 복수 변경사항: 단일 댓글로 묶어 표시
      const lines = messageOrItems.map(m => `  • ${m}`).join('\n');
      message = `🔄 카드 업데이트\n${lines}`;
    } else {
      message = isArray ? messageOrItems[0] : messageOrItems;
    }
    if (!message) return;
    await dbManager.createComment(sid, 'system', message);
    io.emit('task:comment_added', {
      taskId: sid, author: 'system',
      text: message, createdAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('[ActivityLog] 기록 실패:', e.message);
  }
}

/** PATCH /api/tasks/:id — 태스크 상세 정보 업데이트 (수동 편집) */
app.patch('/api/tasks/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { content, title, assignee, model, column, priority } = req.body;
    // 기존 태스크 상태 조회 (변경 전 값과 비교용)
    const prevTask = await dbManager.getTaskById(taskId).catch(() => null);
    
    // [BugFix] 할당자 처리: payload에 assignee가 명시되지 않았다면 기존 담당자 유지
    let parsedAssignee;
    if (assignee === undefined) {
      parsedAssignee = prevTask?.assigned_agent || null;
    } else {
      parsedAssignee = (assignee === '미할당' || assignee === null || assignee === '') ? null : assignee;
    }

    // [P-21 Fix & BugFix] 각 필드가 전달되지 않은 경우 기존 값으로 폴백
    const finalContent = content !== undefined ? content : (prevTask?.content || '');
    const finalTitle   = title   !== undefined ? title   : (prevTask?.title   || '');
    const finalModel   = model   !== undefined ? model   : (prevTask?.model   || (parsedAssignee ? getAgentSignatureModel(parsedAssignee) || 'gemini-2.5-flash' : 'gemini-2.5-flash'));
    
    await dbManager.updateTaskDetails(taskId, finalTitle, finalContent, parsedAssignee, finalModel);
    
    let finalColumn = column; // [Handoff 고도화] 담당자 변경 시 자동 이동을 위한 변수
    
    // ── Activity Log: 변경 내역 배치 기록 (단일 댓글로 묶음) ─────────────────
    if (prevTask) {
      const activityItems = [];
      if (parsedAssignee && prevTask.assigned_agent !== parsedAssignee) {
        const prev = prevTask.assigned_agent || '미할당';
        activityItems.push(`[시스템] 태스크 담당자가 '${prev}'에서 '${parsedAssignee}'(으)로 변경되었습니다.`);

          // ── [S4-1] Handoff 프로토콜 — 이전 작업 컨텍스트 인계 로그 간소화 ──────────
          try {
            let handoffBody = `🔁 **[Handoff] ${prev.toUpperCase()} → ${parsedAssignee.toUpperCase()} 업무 인계 완료**`;
            await dbManager.createComment(taskId, 'system', handoffBody);
          io.emit('task:comment_added', {
            taskId: String(taskId), author: 'system', text: handoffBody,
            createdAt: new Date().toISOString()
          });
          broadcastLog('info', `[S4-1 Handoff] Task #${taskId}: ${prev} → ${parsedAssignee} 인계 완료`, 'system', taskId);
        } catch (handoffErr) {
          console.warn('[S4-1 Handoff] 인계 댓글 생성 오류:', handoffErr.message);
        }
        
        // [UX 고도화] Handoff 시, 칸반 컬럼이 명시적으로 지정되지 않았고 현재 진행 중이라면 새 담당자의 대기열(todo)로 스르륵 이동
        if (!column && prevTask && ['IN_PROGRESS', 'REVIEW'].includes(prevTask.status?.toUpperCase())) {
          finalColumn = 'todo';
        }
        // ── Handoff END ───────────────────────────────────────────────────────
      }
      if (priority && prevTask.priority !== priority) {
        const priorityLabel = { high: '높음', medium: '보통', low: '낮음' };
        activityItems.push(`[시스템] 태스크 우선순위가 '${priorityLabel[prevTask.priority] || prevTask.priority || '보통'}'에서 '${priorityLabel[priority] || priority}'(으)로 변경되었습니다.`);
      }
      if (activityItems.length > 0) {
        await logActivity(taskId, activityItems);
      }
    }

    
    // 컬럼(status)이나 priority 변경이 있다면 처리
    if (finalColumn) {
      const colToStatus = { todo: 'PENDING', in_progress: 'IN_PROGRESS', review: 'REVIEW', done: 'COMPLETED' };
      if (colToStatus[finalColumn]) {
        await dbManager.updateTaskStatus(taskId, colToStatus[finalColumn]);
        if (prevTask) {
          const statusLabel = { 'PENDING': '할 일', 'IN_PROGRESS': '진행 중', 'REVIEW': '승인 대기', 'COMPLETED': '완료' };
          const prevLabel = statusLabel[prevTask.status?.toUpperCase()] || prevTask.status;
          const nextLabel = statusLabel[colToStatus[finalColumn]] || finalColumn;
          // 배치 배열에 상태 변경 추가: 담당자/우선순위와 함께 묶임
          // Handoff에 의한 자동 이동인 경우 메시지 생략 (너무 많은 알림 방지)
          if (!(!column && finalColumn === 'todo')) {
            const statusItems = [`[시스템] 태스크 진행 상태가 '${prevLabel}'에서 '${nextLabel}'(으)로 변경되었습니다.`];
            await logActivity(taskId, statusItems);
          }
        }
      }

      // ── [Fix] 모든 column 이동 시 task:moved emit (담당자 유무와 무관) ──────
      // 이전: in_progress + assigned_agent 있을 때만 emit → 담당자 없거나 다른 column 이동 시 칸반 미반영
      // 수정: column 변경이 있으면 무조건 task:moved emit → confirmTaskMove 트리거 보장
      io.emit('task:moved', { taskId: String(taskId), toColumn: finalColumn });

      // ── [BugFix] in_progress로 변경 시 에이전트 실행 트리거 ──────────────
      if (finalColumn === 'in_progress') {
        const freshTask = await dbManager.getTaskById(taskId);
        if (freshTask?.assigned_agent) {
          const agentId = freshTask.assigned_agent;
          io.emit('task:updated', { taskId: String(taskId), status: 'IN_PROGRESS', column: 'in_progress' });

          // 담당자가 CEO인 경우 AI 실행을 하지 않고 상태만 IN_PROGRESS로 업데이트
          if (agentId.toLowerCase() !== 'ceo') {
            // FilePollingAdapter 대신 엔진에서 직접 실행
            forceRedispatchTask(taskId, agentId, '', 'START');
          }
        }
      }
    }
    
    // [P-21 Fix] 소켓 전송 — DB에 실제 저장된 값(finalContent/finalTitle)을 전송
    // 원본 payload의 undefined 값 대신 확정된 값을 사용하여 store가 undefined로 덮어써지는 것 방지
    // [Handoff Fix] assignee 파라미터가 undefined일 때도 정확한 parsedAssignee와 finalColumn을 전송
    io.emit('task:patched', { taskId, title: finalTitle, content: finalContent, assignee: parsedAssignee, model, column: finalColumn, priority });

    res.json({ status: 'ok', message: 'Task updated successfully' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/** PATCH /api/tasks/:id/approve — 대표님 승인: Review → Done + Obsidian 아카이브 */
app.patch('/api/tasks/:id/approve', async (req, res) => {
  const sid = String(req.params.id);
  try {
    const task = await dbManager.getTaskById(sid);
    if (!task) return res.status(404).json({ status: 'error', message: '태스크를 찾을 수 없습니다.' });
    
     // [Prime W1] 상태 가드: REVIEW 상태인 경우만 승인 가능 (대소문자 무시)
    if (task.status?.toUpperCase() !== 'REVIEW') {
      return res.status(400).json({ 
        status: 'error', 
        message: `Review 상태의 태스크만 승인할 수 있습니다. (현재 상태: ${task.status})` 
      });
    }
    
    await dbManager.updateTaskStatus(sid, 'COMPLETED');
    // column과 status 모두 동기화하도록 task:updated 사용 (또는 moved와 함께 송출)
    io.emit('task:updated', { taskId: sid, status: 'COMPLETED', column: 'done' });
    io.emit('task:moved', { taskId: sid, toColumn: 'done' });
    
    // 승인 로그 및 코멘트 (CEO 표기)
    await dbManager.createComment(sid, 'CEO', '✅ 승인 완료. 수고했어요!');
    io.emit('task:comment_added', { taskId: sid, author: 'CEO', text: '✅ 승인 완료. 수고했어요!', createdAt: new Date().toISOString() });
    broadcastLog('success', `[APPROVED] Task #${sid} CEO 승인 → Done 이동`, 'CEO', sid);
    
    // Obsidian 아카이브 트리거 (기존 로직 재활용)
    obsidianAdapter.archiveTask({
      id: task.id,
      content: task.content,
      requester: task.requester,
      execution_mode: task.execution_mode || 'assistant',
      model: task.model || 'unknown',
    });

    // [B4 System] 자동 회고 및 그라운드룰 동기화 실행
    (async () => {
      const insight = await b4System.runRetrospective(sid);
      if (insight) {
        broadcastLog('success', `🧠 [B4 회고] 이번 태스크에서 새로운 교훈을 얻었습니다: "${insight}" → 팀 지식망에 동기화되었습니다.`, 'system', sid);
      }
    })();
    
    res.json({ status: 'ok', message: '승인 완료. Obsidian에 아카이브했습니다.' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/** PATCH /api/tasks/:id/archive — 즉시 아카이빙 (상태 무관, CEO 직접 또는 ARI 위임) */
// approve와 다르게 상태 가드 없음: Done, Review, In Progress 어디서든 수동 아카이빙 가능
app.patch('/api/tasks/:id/archive', async (req, res) => {
  const sid = String(req.params.id);
  const { archivedBy = 'CEO' } = req.body; // 'CEO' 또는 'ARI(위임)'
  try {
    const task = await dbManager.getTaskById(sid);
    if (!task) return res.status(404).json({ status: 'error', message: '태스크를 찾을 수 없습니다.' });

    // DB 상태를 ARCHIVED로 변경 (COMPLETED와 구분)
    await dbManager.updateTaskStatus(sid, 'ARCHIVED');

    // 소켓 브로드캐스트 (UI 실시간 반영)
    io.emit('task:updated', { taskId: sid, status: 'ARCHIVED', column: 'done' });
    io.emit('task:archived', { taskId: sid, archivedBy }); // 칸반에서 카드 제거 트리거

    // 아카이빙 댓글 — author: 'SYSTEM' (CEO→SYSTEM 토폴로지)
    const archiveMsg = archivedBy === 'ARI(위임)'
      ? `📦 [ARI 위임] 아카이빙 처리 완료. Obsidian에 저장했습니다.`
      : '📦 아카이빙 완료. 기록을 Obsidian에 저장했습니다.';
    await dbManager.createComment(sid, 'SYSTEM', archiveMsg);
    io.emit('task:comment_added', { taskId: sid, author: 'SYSTEM', text: archiveMsg, createdAt: new Date().toISOString() });
    broadcastLog('success', `[ARCHIVE] Task #${sid} 아카이빙 (by ${archivedBy})`, archivedBy, sid);

    // Obsidian 아카이브 트리거
    obsidianAdapter.archiveTask({
      id: task.id,
      content: task.content,
      requester: task.requester,
      execution_mode: task.execution_mode || 'manual',
      model: task.model || 'unknown',
    });

    // [B4 System] 자동 회고
    (async () => {
      const insight = await b4System.runRetrospective(sid);
      if (insight) {
        broadcastLog('success', `🧠 [B4 회고] \"${insight}\" → 팀 지식망에 동기화됩니다.`, 'system', sid);
      }
    })();

    res.json({ status: 'ok', message: `아카이빙 완료 (by ${archivedBy}). Obsidian에 저장했습니다.` });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── [2주 자동 아카이빙 스케줄러] ──────────────────────────────────────────
// 원칙: COMPLETED/done 상태이며 완료 후 14일(2주) 이상 경과한 카드를 매일 자정에 자동 아카이빙
const AUTO_ARCHIVE_DAYS = 14;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function runAutoArchive() {
  if (!dbManager) return;
  try {
    const allTasks = await dbManager.getAllTasksLight();
    const now = Date.now();
    const threshold = AUTO_ARCHIVE_DAYS * ONE_DAY_MS;

    const targets = allTasks.filter(t => {
      const isDone = ['COMPLETED', 'done', 'DONE'].includes(t.status);
      if (!isDone) return false;
      const updatedAt = new Date(t.updated_at || t.created_at || 0).getTime();
      return (now - updatedAt) >= threshold;
    });

    if (targets.length === 0) return;

    console.log(`[AutoArchive] 🗂️ ${targets.length}건 자동 아카이빙 시작 (${AUTO_ARCHIVE_DAYS}일 경과)`);

    for (const task of targets) {
      await dbManager.updateTaskStatus(String(task.id), 'COMPLETED');
      io.emit('task:archived', { taskId: String(task.id), archivedBy: 'AUTO(2주)' });
      obsidianAdapter.archiveTask({
        id: task.id,
        content: task.content,
        requester: task.requester,
        execution_mode: 'auto_archive',
        model: task.model || 'unknown',
      });
      broadcastLog('info', `[AUTO-ARCHIVE] Task #${task.id} — ${AUTO_ARCHIVE_DAYS}일 경과 자동 아카이빙`, 'system', String(task.id));
    }

    broadcastLog('success', `🗂️ [2주 자동 아카이빙] ${targets.length}건 Obsidian에 저장 완료`, 'system');
  } catch (err) {
    console.error('[AutoArchive] 오류:', err.message);
  }
}

// 서버 시작 후 24시간마다 실행 (다음 자정에 맞추는 방식 대신 단순 24h 인터벌)
function scheduleAutoArchive() {
  const now = new Date();
  // 오늘 자정(23:59:59) 까지 남은 밀리초 계산 → 첫 실행 시점 맞춤
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight.getTime() - now.getTime();

  setTimeout(() => {
    runAutoArchive();                          // 첫 실행 (자정)
    setInterval(runAutoArchive, ONE_DAY_MS);   // 이후 매 24시간
  }, msUntilMidnight);

  console.log(`[AutoArchive] 🕛 다음 자동 아카이빙: ${midnight.toLocaleString('ko-KR')} (${Math.round(msUntilMidnight / 60000)}분 후)`);
}
scheduleAutoArchive();

/** PATCH /api/tasks/:id/rework — 대표님 재작업 지시: Review → In Progress */
app.patch('/api/tasks/:id/rework', async (req, res) => {
  const sid = String(req.params.id);
  const { reason = '추가 검토 후 재작업이 필요합니다.' } = req.body;
  try {
    const task = await dbManager.getTaskById(sid);
    if (!task) return res.status(404).json({ status: 'error', message: '태스크를 찾을 수 없습니다.' });
    
     // [Prime W1] 상태 가드: REVIEW 상태인 경우만 재작업 지시 가능 (대소문자 무시)
    if (task.status?.toUpperCase() !== 'REVIEW') {
      return res.status(400).json({ 
        status: 'error', 
        message: `Review 상태의 태스크만 재작업을 지시할 수 있습니다. (현재 상태: ${task.status})` 
      });
    }
    
    await dbManager.updateTaskStatus(sid, 'IN_PROGRESS');
    io.emit('task:updated', { taskId: sid, status: 'IN_PROGRESS', column: 'in_progress' });
    io.emit('task:moved', { taskId: sid, toColumn: 'in_progress' });
    
    // 재작업 사유 코멘트 자동 삽입 (CEO 표기)
    const reworkMsg = `🔄 재작업 지시: ${reason}`;
    await dbManager.createComment(sid, 'CEO', reworkMsg);
    io.emit('task:comment_added', { taskId: sid, author: 'CEO', text: reworkMsg, createdAt: new Date().toISOString() });
    broadcastLog('warn', `[REWORK] Task #${sid} 재작업 지시 → In Progress 이동 및 백그라운드 재실행 트리거`, 'CEO', sid);
    
    // [Phase 4] CKS 지표 - 반복 수정 횟수(IRC) 증가
    await dbManager.incrementCksIrc(sid).catch(e => console.error('[DB] IRC 증가 실패:', e));

    // [버그 수정] 재작업 지시 시 에이전트가 실제로 작업을 다시 수행하도록 강제 트리거
    forceRedispatchTask(sid, task.assigned_agent, reason, 'REWORK');

    
    res.json({ status: 'ok', message: '재작업 지시 완료. In Progress로 이동했습니다.' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 워크스페이스 CLI 폴더 (process.cwd) 정보 API
app.get('/api/system/workspace', (req, res) => {
  const cwd = process.cwd();
  const isObsidian = fs.existsSync(path.join(cwd, '.obsidian'));
  res.json({ workspacePath: cwd, isObsidianVault: isObsidian });
});


/**
 * Antigravity → Paperclip 엔드포인트
 * [보안 패치] execFile + 화이트리스트 검증으로 Command Injection 원천 차단
 */
app.post('/webhook/antigravity/command', async (req, res) => {

  try {
    const { action, payload } = req.body;
    console.log(`[Bridge] Received command from Antigravity: ${action}`);

    // 허용된 액션 화이트리스트
    const ALLOWED_ACTIONS = ['ISSUE_COMMENT', 'ISSUE_CREATE', 'WORKSPACE_STATUS'];
    if (!ALLOWED_ACTIONS.includes(action)) {
      return res.status(400).json({ error: 'Unknown action mapped' });
    }

    // [보안] ticketId 형식 검증 (예: SOCA-21, 영문 대문자 + 숫자만 허용)
    const TICKET_ID_REGEX = /^[A-Z]+-\d+$/;
    let args = [];

    switch (action) {
      case 'ISSUE_COMMENT':
        if (!TICKET_ID_REGEX.test(payload.ticketId)) {
          return res.status(400).json({ error: 'Invalid ticketId format' });
        }
        // execFile로 인자를 배열로 분리 → shell injection 불가
        args = ['paperclipai', ['issue', 'comment', payload.ticketId, '--body', String(payload.text)]];
        break;
      case 'ISSUE_CREATE':
        args = [
          'paperclipai',
          [
            'issue', 'create',
            '--title', String(payload.title),
            ...(payload.assignee ? ['--assignee', payload.assignee] : []),
            ...(payload.priority ? ['--priority', payload.priority] : []),
            ...(payload.category ? ['--category', payload.category] : [])
          ]
        ];
        break;
      case 'WORKSPACE_STATUS':
        args = ['paperclipai', ['doctor']];
        break;
    }

    const { stdout, stderr } = await execFilePromise('npx', args[1] ? [args[0], ...args[1]] : [args[0]], {
      cwd: process.env.HOME || '/Users/alex',
    });

    if (stderr && stderr.toLowerCase().includes('error')) {
      return res.status(500).json({ status: 'error', message: stderr });
    }
    res.json({ status: 'success', data: stdout });

  } catch (error) {
    console.error('[Bridge] Fatal Error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * Paperclip → Antigravity 엔드포인트 (상태 동기화)
 */
app.post('/webhook/paperclip/event', async (req, res) => {
  try {
    const { eventType, eventData } = req.body;
    console.log(`[Bridge] Received event from Paperclip: ${eventType}`);
    broadcastLog('info', `Paperclip 이벤트: ${eventType}`, 'system');
    // TODO: Supabase or Antigravity Webhook outbound
    res.json({ status: 'relayed' });
  } catch (error) {
    console.error('[Bridge] Error relaying to Antigravity:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ─── Google OAuth 구독인증 API ─────────────────────────────────────────────────
// 프론트엔드에서 Google OAuth 토큰을 백엔드에 등록 → Gemini API를 token으로 호출

// 현재 등록된 OAuth 토큰 (Refresh 지원)
let _googleOAuthToken = null;
let _googleOAuthExpiry = 0;
let _googleRefreshToken = null;

const TOKEN_PATH = path.resolve(process.cwd(), 'token.json');

try {
  if (fs.existsSync(TOKEN_PATH)) {
    const data = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    _googleRefreshToken = data.refresh_token;
    _googleOAuthToken = data.access_token;
    _googleOAuthExpiry = data.expiry_date;
    console.log('[Auth] 🔄 token.json 오프라인 토큰 로드 완료');
  }
} catch (e) {
  console.log('[Auth] token.json 로드 실패', e.message);
}

/** 외부에서 현재 OAuth 토큰 조회 (geminiAdapter에서 사용) — 만약 만료 시 자동 갱신 지원 */
export async function getGoogleOAuthToken() {
  if (_googleOAuthToken && Date.now() < _googleOAuthExpiry - 60000) {
    return _googleOAuthToken;
  }
  
  if (_googleRefreshToken) {
    console.log('[Auth] 🔄 Access Token 만료 임박. Refresh Token으로 재발급 시도...');
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.VITE_GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: _googleRefreshToken,
          grant_type: 'refresh_token'
        })
      });
      const data = await response.json();
      if (data.access_token) {
        _googleOAuthToken = data.access_token;
        _googleOAuthExpiry = Date.now() + data.expires_in * 1000;
        
        fs.writeFileSync(TOKEN_PATH, JSON.stringify({
          access_token: _googleOAuthToken,
          refresh_token: _googleRefreshToken,
          expiry_date: _googleOAuthExpiry
        }));
        
        keyProvider.setVolatileKey('OAUTH_TOKEN', _googleOAuthToken);
        console.log('[Auth] ✅ Access Token 백그라운드 재발급 성공!');
        return _googleOAuthToken;
      } else {
        console.error('[Auth] ❌ 구글 API 토큰 갱신 거절 응답:', data);
        if (data.error === 'invalid_grant') {
           console.error('[Auth] ⚠️ Refresh Token이 무효화되었습니다 (테스트 앱 수명 만료 또는 권한 회수). 사용자 재로그인이 필요합니다.');
        }
      }
    } catch (err) {
      console.error('[Auth] 토큰 갱신 에러:', err.message);
    }
  }
  return null;
}

/** 구독 인증 모드가 한 번이라도 설정되었는지 확인 (Silent API Fallback 차단용) */
export function hasOAuthSetup() {
  return !!_googleOAuthToken || !!_googleRefreshToken || fs.existsSync(TOKEN_PATH);
}

/** POST /api/auth/google-code — Authorization Code 토큰 교환 */
app.post('/api/auth/google-code', async (req, res) => {
  const { code, redirectUri } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: (process.env.VITE_GOOGLE_CLIENT_ID || '').trim(),
        client_secret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
        code: code.trim(),
        grant_type: 'authorization_code',
        redirect_uri: redirectUri.trim()
      }).toString()
    });
    
    const data = await response.json();
    if (data.error) {
      console.error('[Auth] 구글 토큰 교환 상세 에러:', data);
      throw new Error(data.error_description || data.error);
    }

    _googleOAuthToken = data.access_token;
    _googleOAuthExpiry = Date.now() + (data.expires_in * 1000);
    if (data.refresh_token) {
      _googleRefreshToken = data.refresh_token; // Consent 화면에서 최초 1회 발급
    }

    fs.writeFileSync(TOKEN_PATH, JSON.stringify({
      access_token: _googleOAuthToken,
      refresh_token: _googleRefreshToken,
      expiry_date: _googleOAuthExpiry
    }));
    
    keyProvider.setVolatileKey('OAUTH_TOKEN', _googleOAuthToken);
    keyProvider.setVolatileKey('OAUTH_TOKEN_EXPIRY', _googleOAuthExpiry);

    console.log('[Auth] ✅ Google OAuth Offline 토큰 발급 및 저장 완료.');
    res.json({ status: 'ok', mode: 'google_oauth', token: _googleOAuthToken, expiresIn: data.expires_in });

  } catch (err) {
    console.error('[Auth] google-code 토큰 교환 실패:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/auth/google-token — 프론트엔드가 OAuth 토큰 등록 */
app.post('/api/auth/google-token', (req, res) => {
  const { token, expiresIn } = req.body;
  if (!token) return res.status(400).json({ error: 'token is required' });

  _googleOAuthToken = token;
  _googleOAuthExpiry = Date.now() + ((expiresIn || 3600) - 60) * 1000; // 60초 버퍼

  // 전역 캐시에 등록 (순환 참조 문제 해결을 위함)
  keyProvider.setVolatileKey('OAUTH_TOKEN', token);
  keyProvider.setVolatileKey('OAUTH_TOKEN_EXPIRY', _googleOAuthExpiry);

  console.log('[Auth] ✅ Google OAuth 토큰 등록 및 캐시 공유 완료. 구독인증 모드 활성화.');
  res.json({ status: 'ok', mode: 'google_oauth', expiresAt: new Date(_googleOAuthExpiry).toISOString() });
});

/** DELETE /api/auth/google-token — 로그아웃 시 토큰 제거 */
app.delete('/api/auth/google-token', (req, res) => {
  _googleOAuthToken = null;
  _googleOAuthExpiry = 0;
  _googleRefreshToken = null;
  try { if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH); } catch (e) {}
  console.log('[Auth] Google OAuth 토큰 및 파일 제거. API Key 모드로 복귀.');
  res.json({ status: 'ok', mode: 'api_key' });
});

/** GET /api/auth/status — 현재 인증 모드 확인 */
app.get('/api/auth/status', async (req, res) => {
  try {
    const validToken = await getGoogleOAuthToken();
    const hasValidToken = !!validToken;
    res.json({
      status: 'ok',
      mode: hasValidToken ? 'google_oauth' : 'api_key',
      hasApiKey: !!(process.env.GEMINI_API_KEY),
      tokenExpiresAt: hasValidToken ? new Date(_googleOAuthExpiry).toISOString() : null,
      token: validToken
    });
  } catch (err) {
    res.json({
      status: 'error',
      mode: 'api_key',
      hasApiKey: !!(process.env.GEMINI_API_KEY)
    });
  }
});

// ─── 설정 API (GET/PUT /api/settings) ────────────────────────────────────────

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await dbManager.getAllSettings();
    res.json({ status: 'ok', settings });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const { key, value } = req.body;
    const ALLOWED_KEYS = [
      'heartbeat_auto_resume_level',
      'batch_report_interval_min',
      'telegram_report_mode',
      'telegram_report_hour',
      'telegram_report_minute',
    ];
    if (!ALLOWED_KEYS.includes(key) && !key.startsWith('guidelines_')) {
      return res.status(400).json({ error: `Unknown setting key: ${key}` });
    }
    await dbManager.setSetting(key, value);
    // 다른 탭(클라이언트) 실시간 동기화
    io.emit('settings:updated', { key, value });
    res.json({ status: 'ok', key, value });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── [Phase 20] 기밀 정보 전용 API (Secret Management) ──────────────────────

app.get('/api/secrets', async (req, res) => {
  try {
    const SECRET_KEYS = ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'TELEGRAM_BOT_TOKEN'];
    const secrets = {};
    for (const k of SECRET_KEYS) {
      secrets[k] = await keyProvider.getMaskedKey(k);
    }
    res.json({ status: 'ok', secrets });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/secrets', async (req, res) => {
  try {
    const { key, value } = req.body;
    const SECRET_KEYS = ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'TELEGRAM_BOT_TOKEN'];
    
    if (!SECRET_KEYS.includes(key)) {
      return res.status(400).json({ error: 'Not a secret key or unauthorized.' });
    }

    // KeyProvider를 통해 보안 저장 및 즉시 반영
    await keyProvider.setKey(key, value);
    
    // ⚠ 보안 주의: 비밀번호/키는 절대 Socket.io로 브로드캐스트(io.emit) 하지 않습니다.
    res.json({ status: 'ok', key, masked: await keyProvider.getMaskedKey(key) });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── 어댑터 상태 API (Phase 22 Sprint 1) ─────────────────────────────────────
app.get('/api/adapters/status', async (req, res) => {
  try {
    const { readdir: fsReaddir } = await import('fs/promises');
    const { existsSync } = await import('fs');
    const PENDING_DIR = path.resolve(process.cwd(), '.agents/tasks/pending');

    // pending 큐 깊이
    let queueDepth = 0;
    if (existsSync(PENDING_DIR)) {
      const files = await fsReaddir(PENDING_DIR).catch(() => []);
      queueDepth = files.filter(f => f.endsWith('.json')).length;
    }

    // API 키 존재 여부로 어댑터 가용성 판단
    const geminiKey     = process.env.GEMINI_API_KEY     || '';
    const anthropicKey  = process.env.ANTHROPIC_API_KEY  || '';

    res.json({
      status: 'ok',
      adapters: {
        antigravity: {
          status:     queueDepth > 0 ? 'active' : (geminiKey ? 'idle' : 'error'),
          queueDepth,
          configured: !!geminiKey,
        },
        imagen3: {
          status:     geminiKey ? 'idle' : 'error',
          queueDepth: 0,
          configured: !!geminiKey,
        },
        claude_code: {
          status:     anthropicKey ? 'idle' : 'disabled',
          queueDepth: 0,
          configured: !!anthropicKey,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/onboarding/activate-team', async (req, res) => {
  try {
    const { teamType } = req.body;
    const result = await teamActivator.activate(teamType);
    
    // 실시간으로 에이전트 스킬 상태 동기화 (UI 갱신용)
    io.emit('agent:skills_bulk_updated', { teamType, result });
    
    res.json({ status: 'ok', ...result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/onboarding/finish', async (req, res) => {
  try {
    const { userName, teamName, projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ status: 'error', message: 'projectId is required' });
    }
    await tutorialManager.bootstrap(userName || '대표님', teamName || '우리팀', io, projectId);
    res.json({ status: 'ok', message: 'Tutorial missions created.' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/onboarding/test-connection', async (req, res) => {
  try {
    const { type, value } = req.body;
    // 시뮬레이션 및 기초 검증: sk- 또는 AIzaSy 로 시작하거나 이메일 형식이면 성공으로 간주
    const isSuccess = (type === 'key' && (value?.startsWith('sk-') || value?.startsWith('AIzaSy'))) || 
                      (type === 'sub' && value?.includes('@'));
    
    // 약간의 딜레이를 주어 실제 검증 느낌 제공
    await new Promise(r => setTimeout(r, 1200));

    if (isSuccess) {
      res.json({ status: 'ok', message: '연동 확인되었습니다.' });
    } else {
      res.status(400).json({ status: 'error', message: '유효하지 않은 정보입니다.' });
    }
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});



// ─── [Agent Profile API] ──────────────────────────────────────────
app.patch('/api/agents/:agentId/model', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { model } = req.body;
    if (!model) return res.status(400).json({ status: 'error', message: 'model is required' });

    // [Phase 30] 1순위: DB agent_profiles 업데이트 (SSOT)
    await dbManager.upsertAgentModel(agentId, model);

    // [Phase 30] 2순위: agents.json 동기화 (읽기 전용 시드 폴백 역할 유지)
    try {
      const agentsFilePath = path.resolve(process.cwd(), 'agents.json');
      const agentsData = JSON.parse(fs.readFileSync(agentsFilePath, 'utf8'));
      for (let agent of agentsData) {
        if (agent.id === agentId) {
          if (agent.bridge) {
            agent.antiModel = model;
          } else {
            agent.model = model;
          }
          break;
        }
      }
      fs.writeFileSync(agentsFilePath, JSON.stringify(agentsData, null, 2), 'utf8');
    } catch (fileErr) {
      console.warn('[Agent Model] agents.json 동기화 실패 (DB는 저장됨):', fileErr.message);
    }

    // 메모리 캐시 즉시 갱신 + 소켓 브로드캐스트
    updateAgentSignatureModel(agentId, model);
    io.emit('agent:model_updated', { agentId, model });
    res.json({ status: 'ok', agentId, model, source: 'db' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }

});

// ─── [Phase 17-4] 스킬 라이브러리 API ──────────────────────────────────────────

app.get('/api/agents/:agentId/skills', async (req, res) => {
  try {
    const { agentId } = req.params;
    const skills = await dbManager.getAgentSkills(agentId);
    res.json({ status: 'ok', skills });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/agents/:agentId/skills', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { skillId, active } = req.body;
    if (!skillId) return res.status(400).json({ status: 'error', message: 'skillId is required' });
    
    await dbManager.toggleAgentSkill(agentId, skillId, active);
    // 상태 변경 소켓 브로드캐스트
    io.emit('agent:skill_updated', { agentId, skillId, active });
    
    res.json({ status: 'ok', agentId, skillId, active });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── [Phase 26] GET /api/skills/library — skill-library/ 자동 스캔 ────────
// skillRegistry.js 없이도 SKILL.md를 실시간 스캔하여 메타데이터 반환
// 외부 스킬 추가 시 서버 재시작만으로 자동 반영됨
const SKILL_LIB_PATH = path.resolve(process.cwd(), 'skill-library');

function scanSkillLibrary() {
  const skills = [];
  try {
    const folders = fs.readdirSync(SKILL_LIB_PATH).filter(f => {
      return fs.existsSync(path.join(SKILL_LIB_PATH, f, 'SKILL.md'));
    });

    for (const folder of folders) {
      const skillMdPath = path.join(SKILL_LIB_PATH, folder, 'SKILL.md');
      const raw = fs.readFileSync(skillMdPath, 'utf-8');

      // frontmatter 파싱 (경량 파서)
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) continue;

      const data = {};
      const lines = fmMatch[1].split('\n');
      let i = 0;
      while (i < lines.length) {
        const colonIdx = lines[i].indexOf(':');
        if (colonIdx === -1) { i++; continue; }
        const key = lines[i].slice(0, colonIdx).trim();
        const val = lines[i].slice(colonIdx + 1).trim();
        if (val === '|' || val === '>') {
          const ml = []; i++;
          while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) {
            ml.push(lines[i].trim()); i++;
          }
          data[key] = ml.join(' ').trim(); continue;
        }
        if (val === '' && i + 1 < lines.length && lines[i + 1].startsWith('  -')) {
          const arr = []; i++;
          while (i < lines.length && lines[i].startsWith('  -')) {
            arr.push(lines[i].replace(/^\s*-\s*/, '').replace(/^["']|["']$/g, '').trim()); i++;
          }
          data[key] = arr; continue;
        }
        if (val === '[]') { data[key] = []; i++; continue; }
        if (!isNaN(val) && val !== '') { data[key] = Number(val); i++; continue; }
        data[key] = val.replace(/^["']|["']$/g, '');
        i++;
      }

      skills.push({
        id: data.name || folder,
        folder,
        displayName: data.displayName || data.name || folder,
        description: data.description || '',
        layer: typeof data.layer === 'number' ? data.layer : 1,
        layerLabel: data.layer === 0 ? 'ENGINE' : data.layer === 2 ? 'WORKFLOW' : 'DOMAIN',
        tools: Array.isArray(data.tools) ? data.tools : [],
        commands: Array.isArray(data.commands) ? data.commands : [],
        author: data.author || 'MyCrew',
        version: data.version || '1.0.0',
        skillMdPath: `skill-library/${folder}/SKILL.md`,
      });
    }
  } catch (e) {
    console.warn('[SkillScan] 스캔 실패:', e.message);
  }
  return skills;
}

app.get('/api/skills/library', (req, res) => {
  try {
    const skills = scanSkillLibrary();
    console.log(`[API] /api/skills/library — ${skills.length}개 스킬 스캔 완료`);
    res.json({ status: 'ok', count: skills.length, skills });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── [Bugdog v1] 실시간 경보 수신 엔드포인트 ────────────────────────────────
/**
 * POST /api/bugdog-alert — bugdogRunner가 CRITICAL/WARNING 감지 시 호출
 * 1) 소켓으로 전체 클라이언트에 bugdog:alert 브로드캐스트 (프론트 UI 갱신)
 * 2) CS 리포트 DB 자동 저장 (CRITICAL만)
 * 3) ariDaemon에 HTTP relay → Ari 대화 컨텍스트에 경보 주입
 */
app.post('/api/bugdog-alert', async (req, res) => {
  try {
    const { severity, service, errorCode, errorMsg, results, startedAt } = req.body;
    if (!severity || !service) {
      return res.status(400).json({ status: 'error', message: 'severity, service 필수' });
    }

    const alertPayload = { severity, service, errorCode, errorMsg, detectedAt: startedAt || new Date().toISOString() };
    console.log(`[Bugdog v1] 🚨 경보 수신 — [${severity}] ${service}: ${errorMsg}`);

    // ── 1. 전체 클라이언트 브로드캐스트 ──────────────────────────────────────
    io.emit('bugdog:alert', alertPayload);

    // ── 2. CRITICAL 이면 CS 리포트 자동 저장 ────────────────────────────────
    let reportNo = null;
    if (severity === 'CRITICAL') {
      try {
        const rno = `CS-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
        await dbManager.createCsReport({
          reportNo: rno, severity, service,
          affectedService: service,
          errorCode: errorCode || 'BUGDOG_ALERT',
          errorMsg, reporter: 'bugdog-v1',
        });
        reportNo = rno;
        io.emit('bugdog:report_created', { reportNo: rno, severity, service, status: 'OPEN' });
        console.log(`[Bugdog v1] CS 리포트 저장 — #${rno}`);
      } catch (dbErr) {
        console.warn('[Bugdog v1] CS 리포트 저장 실패 (무시):', dbErr.message);
      }
    }

    // ── 3. ariDaemon HTTP relay (fire-and-forget) ────────────────────────────
    const ARI_DAEMON_URL = process.env.ARI_DAEMON_URL || 'http://localhost:5050';
    fetch(`${ARI_DAEMON_URL}/api/bugdog-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...alertPayload, reportNo, allResults: results }),
    }).catch((e) => {
      console.warn('[Bugdog v1] ariDaemon relay 실패 (Ari 오프라인 가능성):', e.message);
    });

    res.json({ status: 'ok', broadcasted: true, reportNo });
  } catch (err) {
    console.error('[Bugdog v1] /api/bugdog-alert 에러:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── [Phase 27] Bugdog CS 리포트 API ────────────────────────────────────────
/** POST /api/cs-reports — Bugdog 또는 Ari가 CS 리포트를 DB에 저장 */
app.post('/api/cs-reports', async (req, res) => {
  try {
    const { reportNo, severity, service, affectedService, errorCode, errorMsg, stackTrace, reporter } = req.body;
    if (!severity || !service) return res.status(400).json({ status: 'error', message: 'severity, service 필수' });
    // P6 수정(Prime): severity enum 애플리케이션 레벨 검증 추가
    if (!['WARNING', 'CRITICAL'].includes(severity)) return res.status(400).json({ status: 'error', message: 'severity는 WARNING 또는 CRITICAL만 허용' });
    const rno = reportNo || `CS-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const id = await dbManager.createCsReport({ reportNo: rno, severity, service, affectedService, errorCode, errorMsg, stackTrace, reporter });
    console.log(`[Bugdog] CS 리포트 저장 — #${rno} (${severity}) ${service}`);
    io.emit('bugdog:report_created', { id, reportNo: rno, severity, service, status: 'OPEN' });
    res.json({ status: 'ok', id, reportNo: rno });
  } catch (err) {
    console.error('[API] POST /api/cs-reports 에러:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/** GET /api/cs-reports — CS 리포트 목록 조회 (?status=OPEN&limit=20) */
app.get('/api/cs-reports', async (req, res) => {
  try {
    const { status, limit } = req.query;
    // P3 수정(Prime): status 유효성 검증 + limit 상한선(200) 추가
    const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ status: 'error', message: '유효하지 않은 status 필터' });
    }
    const MAX_LIMIT = 200;
    const parsedLimit = Math.min(parseInt(limit) || 50, MAX_LIMIT);
    const reports = await dbManager.getCsReports({ status, limit: parsedLimit });
    res.json({ status: 'ok', count: reports.length, reports });
  } catch (err) {
    console.error('[API] GET /api/cs-reports 에러:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/** PATCH /api/cs-reports/:id/status — 리포트 상태 변경 (OPEN→IN_PROGRESS→RESOLVED) */
app.patch('/api/cs-reports/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(status)) {
      return res.status(400).json({ status: 'error', message: '유효하지 않은 status 값' });
    }
    const changes = await dbManager.updateCsReportStatus(id, status);
    io.emit('bugdog:report_updated', { id: parseInt(id), status });
    res.json({ status: 'ok', changes });
  } catch (err) {
    console.error('[API] PATCH /api/cs-reports 에러:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── [v2.0] OrgView: 조직도 벌크 조회 ──────────────────────────────────────
/** GET /api/workspace/roster — teams + agents 중첩 JSON (OrgView 초기 로딩) */
app.get('/api/workspace/roster', async (req, res) => {
  try {
    const roster = await dbManager.getRoster();
    res.json({ status: 'ok', ...roster });
  } catch (err) {
    console.error('[API] /api/workspace/roster 에러:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/** POST /api/teams — 새 팀 생성 (기존 프로젝트 합류 또는 신규 프로젝트) */
app.post('/api/teams', async (req, res) => {
  try {
    const { name, groupType, icon, color, projectId, newProjectName } = req.body;
    if (!name) return res.status(400).json({ status: 'error', message: '팀 이름은 필수입니다.' });
    const result = await dbManager.createTeam({ name, groupType, icon, color, projectId, newProjectName });
    io.emit('team:created', result);
    res.json({ status: 'ok', ...result });
  } catch (err) {
    console.error('[API] /api/teams 에러:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/** GET /api/tasks/:id — Task 단건 전체 조회 (TaskDetailModal lazy-load) */
app.get('/api/tasks/:id', async (req, res) => {
  try {
    const task = await dbManager.getTaskByIdFull(req.params.id);
    if (!task) return res.status(404).json({ status: 'error', message: '태스크를 찾을 수 없습니다.' });
    
    // 백엔드의 파서 노드에서 마크다운 리턴 값 내부에 미디어가 있는지 사전 판별하는 플래그 (Artifact Preview 연동용)
    const hasMedia = /!\[.*?\]\(.*?\)/.test(task.content || '');
    const enhancedTask = {
      ...task,
      has_artifact: hasMedia,
      artifact_type: hasMedia ? 'image' : null
    };

    res.json({ status: 'ok', task: enhancedTask });
  } catch (err) {
    console.error('[API] /api/tasks/:id 에러:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});


/** GET /api/metrics/cks — CKS 분석 메트릭 실연동 (Phase 4) */
app.get('/api/metrics/cks', async (req, res) => {
  try {
    const stats = await dbManager.getCksMetricsStats();
    res.json({
      status: 'ok',
      metrics: {
        TEI: Math.round(stats.avg_tei || 0),
        KSI_R: Math.round(stats.avg_ksi_r || 0),
        KSI_S: Number((stats.avg_ksi_s || 0).toFixed(2)),
        HER: Math.round(stats.avg_her || 0),
        EII: Number((stats.avg_eii || 0).toFixed(1)),
        IRC: Math.round(stats.avg_irc || 0),
        UXS: Number((stats.avg_uxs || 0).toFixed(1)),
        totalSamples: stats.total_samples || 0
      }
    });
  } catch (err) {
    console.error('[API] /api/metrics/cks 에러:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/** GET /api/bridge/status — Anti-Bridge 대기 상태 조회 */
app.get('/api/bridge/status', (req, res) => {
  try {
    const BRIDGE_DIR = path.resolve(process.cwd(), '.bridge');
    const LOCK_DIR   = path.join(BRIDGE_DIR, 'locks');
    const REQ_DIR    = path.join(BRIDGE_DIR, 'requests');

    const waiting = [];

    // lock 파일 확인 (prime.lock, nexus.lock)
    if (fs.existsSync(LOCK_DIR)) {
      fs.readdirSync(LOCK_DIR).forEach((f) => {
        if (!f.endsWith('.lock')) return;
        const agentKey = f.replace('.lock', '');
        const since    = Number(fs.readFileSync(path.join(LOCK_DIR, f), 'utf-8')) || 0;
        const elapsedSec = Math.floor((Date.now() - since) / 1000);

        // 매칭되는 request 파일 찾기
        let taskId = null;
        if (fs.existsSync(REQ_DIR)) {
          const reqFile = fs.readdirSync(REQ_DIR)
            .find((f2) => f2.startsWith(`req_${agentKey}_`));
          if (reqFile) {
            try {
              const parsed = JSON.parse(fs.readFileSync(path.join(REQ_DIR, reqFile), 'utf-8'));
              taskId = parsed.taskId || null;
            } catch { /* 무시 */ }
          }
        }

        waiting.push({ agentKey, taskId, elapsedSec, timedOut: elapsedSec > 270 });
      });
    }

    res.json({ status: 'ok', waiting });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});


/** POST /api/agents/inline-edit — ARI 우회, 단일 에이전트 직접 핑 (부분 수정 전용) */
app.post('/api/agents/inline-edit', async (req, res) => {
  try {
    const { taskId, agentId = 'lumi', instruction, currentContent } = req.body;
    if (!instruction) return res.status(400).json({ status: 'error', message: 'instruction 필수' });

    agentStates.set(agentId, { status: 'active', lastHeartbeat: Date.now() });
    io.emit('agent:status_change', { agentId, status: 'active' });

    // 기존 내용을 컨텍스트로 넣어 에이전트 단독 실행 (ARI 라우팅 없이 직접 ping)
    const prompt = `다음 콘텐츠의 일부를 수정해 주세요.\n\n[현재 콘텐츠]\n${currentContent || ''}\n\n[수정 지시]\n${instruction}`;
    const evaluation = { category: 'CONTENT', model: 'claude' };
    const result = await executor.run(prompt, evaluation, agentId, taskId);

    // 태스크 댓글로 결과 저장 + 소켓 브로드캐스트
    if (taskId) {
      const thoughtProcess = result._meta?.thought_process || null;
      await dbManager.createComment(String(taskId), agentId, result.text, thoughtProcess);
      io.emit('task:comment_added', { taskId: String(taskId), author: agentId, text: result.text, thought_process: thoughtProcess, createdAt: new Date().toISOString() });
    }

    agentStates.set(agentId, { status: 'idle', lastHeartbeat: Date.now() });
    io.emit('agent:status_change', { agentId, status: 'idle' });

    res.json({ status: 'ok', text: result.text, agent: agentId });
  } catch (err) {
    console.error('[API] /api/agents/inline-edit 에러:', err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── Active Heartbeat 2.0: 와치독 스케줄러 ───────────────────────────────────
// 재귀적 setTimeout 패턴: 사용자 설정 변경이 즉각 다음 사이클에 반영됨 (setInterval 미사용)

const batchReportQueue = []; // Case A/B 누적 보고 큐

async function diagnoseTask(task, autoResumeLevel) {
  // Case C: CRITICAL 등급 Task → 즉시 텔레그램 보고
  if (task.risk_level === 'CRITICAL') {
    const msg = `🚨 [Watchdog] CRITICAL 태스크 #${task.id} 장기 대기 감지 (관리자 승인 필요)\n내용: ${task.content}`;
    broadcastLog('error', msg, 'system');
    if (bot) {
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (chatId) bot.sendMessage(chatId, msg).catch(() => {});
    }
    return;
  }

  // Case A: SAFE 등급이고 auto_resume이 허용된 경우 → 자동 재개
  if (task.risk_level === 'SAFE' && (autoResumeLevel === 'ALL' || autoResumeLevel === 'SAFE_ONLY')) {
    await dbManager.updateTaskStatus(task.id, 'in_progress');
    broadcastLog('warn', `[Watchdog] 태스크 #${task.id} 장기 대기 감지 → 안전 상태 확인 및 자동 재개 완료`, 'system');
    io.emit('task:moved', { taskId: task.id, toColumn: 'in_progress' });
    batchReportQueue.push({ type: 'A', taskId: task.id, content: task.content, at: new Date().toISOString() });
    return;
  }

  // Case B: SAFE지만 auto_resume 꺼진 경우 → 초기화 후 재시작 기록
  broadcastLog('warn', `[Watchdog] 태스크 #${task.id} 장기 대기 감지 → 안전 확보를 위해 대기(To Do) 상태로 롤백됨`, 'system');
  await dbManager.updateTaskStatus(task.id, 'PENDING');
  io.emit('task:moved', { taskId: task.id, toColumn: 'todo' });
  batchReportQueue.push({ type: 'B', taskId: task.id, content: task.content, at: new Date().toISOString() });
}

async function sendBatchReport() {
  const activities = await dbManager.getDailyActivities();
  if (activities.length === 0 && batchReportQueue.length === 0) return;
  
  let msg = '';
  // 아리 어투: Case A/B 처리 내역
  if (batchReportQueue.length > 0) {
    const items = batchReportQueue.splice(0);
    const str = items.map((i) => {
      if (i.type === 'A') return `• 태스크 #${i.taskId}: 승인이 없길래 제가 이어서 진행했어요 🏃‍♀️`;
      return `• 태스크 #${i.taskId}: 좀 막힌 것 같아서 대기(To Do)로 돌려뒀어요`;
    }).join('\n');
    msg += `앗, 지난 시간 동안 멈춰있던 작업들을 정리했어요!\n${str}\n\n`;
  }
  
  // 일간 요약 (AI 호출 없이 템플릿 기반)
  const summary = await statusReporter.generateActivitySummary(activities);
  msg += summary;

  broadcastLog('info', '일간 활동 보고를 발송했어요 📋', 'ari', null, 'SYSTEM');
  if (bot && process.env.TELEGRAM_CHAT_ID) {
    bot.sendMessage(process.env.TELEGRAM_CHAT_ID, msg).catch(() => {});
  }
}

async function runWatchdog() {
  try {
    const settings = await dbManager.getAllSettings();
    const autoResumeLevel = settings['heartbeat_auto_resume_level'] || 'SAFE_ONLY';

    // 5분 이상 업데이트 없는 in_progress Task 조회
    const staleTasks = await dbManager.getStaleTasks(5);
    for (const task of staleTasks) {
      await diagnoseTask(task, autoResumeLevel);
    }

    // ── 텔레그램 보고 주기 동적 처리 (DB 설정값 기반) ──────────────────────────
    const mode = settings['telegram_report_mode'] || 'daily'; // disabled | 6h | 12h | daily
    const now = new Date();
    const today = now.toDateString();

    if (mode === 'disabled') {
      // 보고 안 함
    } else if (mode === '6h' || mode === '12h') {
      const intervalMs = (mode === '6h' ? 6 : 12) * 60 * 60 * 1000;
      const lastSent = runWatchdog._lastBatchAt || 0;
      if (Date.now() - lastSent >= intervalMs) {
        await sendBatchReport();
        runWatchdog._lastBatchAt = Date.now();
      }
    } else {
      // 'daily' — 매일 지정 시각 1회
      const targetHour   = parseInt(settings['telegram_report_hour']   || '8',  10);
      const targetMinute = parseInt(settings['telegram_report_minute'] || '30', 10);
      const isTargetTime =
        now.getHours() === targetHour &&
        now.getMinutes() >= targetMinute &&
        now.getMinutes() < targetMinute + 5; // 5분 윈도우 (와치독 5분 주기와 일치)
      if (isTargetTime && runWatchdog._lastBatchDate !== today) {
        await sendBatchReport();
        runWatchdog._lastBatchDate = today;
      }
    }
  } catch (err) {
    console.error('[Watchdog] 에러:', err.message);
  } finally {
    // 재귀 호출: 5분 주기
    setTimeout(runWatchdog, 5 * 60 * 1000);
  }
}

// ─── 서버 기동 (app.listen → httpServer.listen으로 변경: socket.io 필수) ────
if (process.env.NO_SERVER !== 'true') {
  httpServer.listen(PORT, () => {
    console.log(`🚀 MyCrew Bridge Server v2.0 running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.io ready | CORS: ${FRONTEND_ORIGIN}`);
  console.log(`📡 Linked to Local SQLite Database & AI Engine`);
  // [W1 Fix] 부팅 시점을 기준으로 인터벌 카운트 시작 → 재시작 직후 즉시 발송 방지
  runWatchdog._lastBatchAt = Date.now();
  // 와치독 시작 (서버 기동 5분 후 첫 사이클)
  setTimeout(runWatchdog, 5 * 60 * 1000);
  console.log('🐶 Heartbeat Watchdog 2.0 armed (첫 실행: 5분 후)');

  // ─── [Phase 32] Auto-Memory Watchdog 시작 ──────────────────────────────────
  memoryWatchdog.start();

  // ─── [Phase 22] Ari Daemon 자동 구동 ────────────────────────────────────────
  // ariDaemon.js는 아리의 독립 두뇌(Port 5050). 서버와 함께 자동 시작/모니터링.
  const DAEMON_PATH = path.resolve(process.cwd(), 'ai-engine/ariDaemon.js');
  let daemonProcess = null;
  let daemonRestartCount = 0;
  const MAX_DAEMON_RESTARTS = 5;

  function startAriDaemon() {
    if (daemonRestartCount >= MAX_DAEMON_RESTARTS) {
      console.error(`[AriDaemon] 🚨 최대 재시작 횟수(${MAX_DAEMON_RESTARTS}회) 도달. 자동 재시작 중단.`);
      return;
    }
    console.log(`[AriDaemon] 🚀 독립 두뇌 프로세스 기동 시도... (Port 5050)`);
    daemonProcess = spawn('node', [DAEMON_PATH], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    daemonProcess.stdout.on('data', (d) => process.stdout.write(`[AriDaemon] ${d}`));
    daemonProcess.stderr.on('data', (d) => process.stderr.write(`[AriDaemon:ERR] ${d}`));
    daemonProcess.on('exit', (code, signal) => {
      if (code !== 0 && signal !== 'SIGTERM') {
        daemonRestartCount++;
        const delay = Math.min(3000 * daemonRestartCount, 30000); // 지수 백오프 (최대 30초)
        console.warn(`[AriDaemon] ⚠️ 비정상 종료 (code: ${code}). ${delay/1000}초 후 재시작 시도... (${daemonRestartCount}/${MAX_DAEMON_RESTARTS})`);
        setTimeout(startAriDaemon, delay);
      } else {
        console.log('[AriDaemon] 정상 종료.');
      }
    });
    daemonProcess.on('spawn', () => {
      daemonRestartCount = 0; // 성공적으로 기동되면 카운트 리셋
      console.log('[AriDaemon] ✅ 독립 두뇌 프로세스 연결 완료 (Port 5050)');
    });
  }

  startAriDaemon();

  // 메인 서버 종료 시 데몬도 함께 종료
  process.on('SIGTERM', () => { daemonProcess?.kill('SIGTERM'); process.exit(0); });
  process.on('SIGINT',  () => { daemonProcess?.kill('SIGTERM'); process.exit(0); });

  // ─── [S3-5] Hard Timeout 감지기 비활성화 ──────────────────────────
  // AdapterWatcher에서도 제거됨. review 대기 중 태스크 강제 중단 UX 버그 방지.
  // 재활성화 필요 시: PENDING 파일 기준 queuedAt 타임스탬프로 executor 레벨에서 처리할 것.

  // ─── [Week 1] Boot Recovery Sequence ─────────────────────────────
  // 크래시 등 예기치 않은 종료로 인해 IN_PROGRESS 상태에 갇힌 미응답 Task 복구

  setTimeout(async () => {
    try {
      const staleTasks = await dbManager.getStaleTasks(0); // 기동 시점 기준 즉시 전체
      const inProgressTasks = staleTasks.filter(t => 
        (t.status === 'in_progress' || t.status === 'IN_PROGRESS') && t.execution_mode !== 'omo'
      );
      
      if (inProgressTasks.length > 0) {
        console.log(`[Boot Recovery] ${inProgressTasks.length}개의 미완료 태스크(Flying Write)를 찾아 복구를 시도합니다.`);
        
        for (const t of inProgressTasks) {
          broadcastLog('warn', `서버 재기동 감지. 중단되었던 Task #${t.id}의 실행을 다시 시도합니다.`, 'ari', t.id, 'SYSTEM');
          if (bot && process.env.TELEGRAM_CHAT_ID) {
            bot.sendMessage(process.env.TELEGRAM_CHAT_ID, `⚠️ [Boot Recovery] 시스템 재시작 감지. Task #${t.id}의 처리를 다시 시도합니다.`).catch(console.error);
          }

          // 백그라운드 재실행 (강제 투입)
          (async () => {
            try {
              const targetAgent = t.assigned_agent || 'assistant';
              const evaluation = await modelSelector.selectModel(t.content);
              const result = await executor.run(t.content, evaluation, targetAgent);
              
              await dbManager.updateTaskStatus(t.id, 'REVIEW');
              await dbManager.updateTaskModel(t.id, result.model);
              io.emit('task:updated', { taskId: String(t.id), model: result.model });
              io.emit('task:moved', { taskId: String(t.id), toColumn: 'review' });
              
              // [버그 수정] Boot Recovery에서도 결과물을 DB와 채팅 로그에 반영해야 함
              const thoughtProcess = result._meta?.thought_process || null;
              await dbManager.createComment(t.id, targetAgent, result.text || '복구 작업 완료', thoughtProcess);
              io.emit('task:comment_added', {
                taskId: String(t.id), author: targetAgent,
                text: result.text || '복구 작업 완료', thought_process: thoughtProcess, createdAt: new Date().toISOString()
              });

              broadcastLog('success', `Task #${t.id} 재실행 완료. 리뷰 대기(${result.model})`, targetAgent, t.id);
              
              if (bot && process.env.TELEGRAM_CHAT_ID) {
                bot.sendMessage(process.env.TELEGRAM_CHAT_ID, `✅ [Boot Recovery] Task #${t.id} 정상 처리 완료. 워크스페이스에서 점검해 주세요.`).catch(console.error);
              }
            } catch (e) {
              console.error(`[Boot Recovery] Task #${t.id} 복구 중 에러 발생:`, e);
              // 강제 투입마저 실패/동일 이슈 발생 시 PENDING (To Do)으로 이동
              await dbManager.updateTaskStatus(t.id, 'PENDING');
              io.emit('task:moved', { taskId: String(t.id), toColumn: 'todo' });
              broadcastLog('error', `Task #${t.id} 복구 실패로 Todo로 이동시켰습니다. (${e.message})`, 'ari', t.id);
              
              if (bot && process.env.TELEGRAM_CHAT_ID) {
                bot.sendMessage(process.env.TELEGRAM_CHAT_ID, `❌ [Boot Recovery] Task #${t.id} 재처리에 실패하여 Todo 대기열로 되돌렸습니다.`).catch(console.error);
              }
            }
          })();
        }
      }
    } catch (err) {
      console.error('[Boot Recovery Error]', err);
    }

    // ── [Phase 17-3] 자동 온보딩: 태스크가 전혀 없을 경우 첫 미션 카드 발급 (텔레그램 연결)
    try {
      const allTasks = await dbManager.getAllTasks();
      if (allTasks.length === 0) {
        const onboardingTitle = "[필수] 외부에서도 에이전트 팀의 보고를 받을 수 있도록 텔레그램 봇 연결하기";
        const onboardingContent = `환영합니다 대표님! 저희 MyCrew 팀이 실무에 즉각 투입되기 위해서는 텔레그램 봇 연결이 1회 필요합니다. 아래 가이드를 따라 3분만에 세팅을 완료해 주세요.

1. 텔레그램 앱에서 **BotFather** 검색하기
2. \`/newbot\` 입력 후 봇 이름과 Username 생성하기
3. 발급받은 **API Token**을 복사하기
4. 서버의 \`.env\` 파일 내 \`TELEGRAM_BOT_TOKEN\` 위치에 붙여넣기 (또는 시스템 설정화면에서 입력)

연결이 완료되면 이 카드를 '완료' 칸으로 옮기거나 "텔레그램 연결 완료했다"고 말씀해 주세요!`;
        const newTaskId = await dbManager.createTask(onboardingTitle, onboardingContent, 'system', MODEL.PRO, 'assistant');
        await dbManager.updateTaskStatus(newTaskId, 'PENDING');
      }
    } catch (err) {
      console.error('[Onboarding Error]', err);
    }
  }, 3000); // 3초 여유 대기 후 시작
  });
}
