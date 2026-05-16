import fs from 'fs';

const executorPath = './ai-engine/executor.js';
let content = fs.readFileSync(executorPath, 'utf8');

const targetContent = `  async autoRun(projectId, agentId = 'dev_senior', startingTaskId = null) {
    const runId = \`\${projectId}_\${Date.now()}\`;
    const abortController = new AbortController();
    this.activeAutoRuns.set(runId, abortController);

    console.log(\`[AutoRun] 🚀 프로젝트 \${projectId} 자동 릴레이 시작 (RunID: \${runId}, StartTask: \${startingTaskId || 'Auto'})\`);

    let nextTaskIdToRun = startingTaskId; // 시작 태스크가 지정되었다면 그것부터
    let currentTaskId = null;
    let lastStepCount = 0;
    const MAX_STEPS = 15;

    try {
      while (!abortController.signal.aborted) {
        let nextTask = null;

        // 1. 카드(태스크) 획득 로직 (Scheduler)
        if (nextTaskIdToRun) {
          // 사용자가 특정 카드(PRD, IN_PROGRESS 등)에서 바로 시작하라고 명령한 경우
          nextTask = await dbManager.getTaskById(nextTaskIdToRun);
          nextTaskIdToRun = null; // 1회성 소모
        } else {
          // 일반적인 큐 스케줄링 로직
          const tasks = await dbManager.getAllTasks(projectId);
          // todo 또는 pending 상태인 것 중 최우선순위 1개 선택
          nextTask = tasks.find(t => t.status.toLowerCase() === 'todo' || t.status.toLowerCase() === 'pending');
        }

        if (!nextTask) {
          console.log(\`[AutoRun] 🏁 더 이상 처리할 대기(todo) 태스크가 없습니다. 루프 종료.\`);
          if (this._broadcastLog) this._broadcastLog('info', \`🏁 처리할 태스크가 없어 자동 릴레이를 종료합니다.\`, agentId, null);
          break;
        }

        currentTaskId = nextTask.id;
        console.log(\`[AutoRun] 📌 태스크 선택: #\${currentTaskId} (\${nextTask.title})\`);
        
        // 2. 상태 전이 (Lifecycle): 시작 시 todo -> IN_PROGRESS
        await dbManager.updateTaskStatus(currentTaskId, 'IN_PROGRESS');
        if (this._broadcastLog) {
          this._broadcastLog('info', \`▶️ 태스크 #\${currentTaskId} 실행 시작\`, agentId, currentTaskId);
        }

        // 3. 루프 제어 변수 및 강제 종료 기제(Max Steps)
        lastStepCount = 0;
        let isTaskCompleted = false;
        let toolOutputs = [];

        // 모듈형 프롬프트 주입기 호출
        const autoRunContext = contextInjector.buildAutoRunContext({
          title: nextTask.title,
          description: nextTask.content || ''
        });

        // 4. 태스크 내 단일 루프 (Continuous Mode)
        while (!isTaskCompleted && !abortController.signal.aborted) {
          lastStepCount++;
          if (lastStepCount > MAX_STEPS) {
             throw new Error('Max steps exceeded');
          }

          let currentPrompt = autoRunContext;
          if (toolOutputs.length > 0) {
            currentPrompt += \`\\n\\n[PREVIOUS TOOL OUTPUTS]\\n\${toolOutputs.join('\\n\\n')}\\n\`;
          }

          if (this._broadcastLog) {
            this._broadcastLog('info', \`⏳ [AutoRun] Step \${lastStepCount}: 에이전트 사고 회로 가동 중...\`, agentId, currentTaskId);
          }

          // [Step 5] LLM API 직접 호출 (여기서는 GeminiAdapter 활용)
          const result = await geminiAdapter.generateResponse(
            "주어진 태스크를 달성하기 위해 코딩을 진행하세요. 필요한 경우 반드시 <tool_calls>를 사용하십시오.",
            currentPrompt,
            MODEL.PRO
          );

          // [Step 4] DB에 로그(코멘트) 저장 및 UI 브로드캐스트
          await dbManager.createComment(currentTaskId, agentId.toUpperCase(), result.text);
          if (this._broadcastLog) {
            this._broadcastLog('info', result.text, agentId, currentTaskId);
          }

          // [Step 5] 도구(Tool Call) 파싱 로직
          let isBlocked = false;
          const toolCallMatch = result.text.match(/<tool_calls>([\\s\\S]*?)<\\/tool_calls>/i);
          if (toolCallMatch) {
            try {
              const calls = JSON.parse(toolCallMatch[1].trim());
              for (const call of calls) {
                const { name, arguments: args } = call;

                if (this._broadcastLog) {
                  this._broadcastLog('info', \`🔧 도구 실행 중: \${name}\`, agentId, currentTaskId);
                }

                // 단일화된 toolExecutor 사용 (WARN-001, BUG-002 방어 포함)
                const resultObj = await executeTool(name, args);
                let output = resultObj.output;

                if (resultObj.action === 'FINISH') {
                  isTaskCompleted = true;
                } else if (resultObj.action === 'PAUSE') {
                  // BUG-001: ask_user 호출 시 BLOCKED 전환
                  isTaskCompleted = true; 
                  isBlocked = true;
                  await dbManager.updateTaskStatus(currentTaskId, 'BLOCKED');
                  // Phase 44 Persistence
                  await dbManager.updateAutoRunStatus(currentTaskId, 'BLOCKED', lastStepCount, MAX_STEPS);
                  if (this._broadcastLog) {
                    this._broadcastLog('warn', \`⏸️ 사용자 응답 대기 (BLOCKED): \${resultObj.reason}\`, agentId, currentTaskId);
                  }
                } else if (resultObj.action === 'SAVE_PLAN') {
                  // Phase 43-4: DB에 실행 계획 저장 후 PLAN_COMPLETE 전환
                  await dbManager.saveExecutionPlan(currentTaskId, null, resultObj.planJson);
                  await dbManager.updateTaskStatus(currentTaskId, 'PLAN_COMPLETE');
                  await dbManager.updateAutoRunStatus(currentTaskId, 'PLAN_COMPLETE', lastStepCount, MAX_STEPS);
                  isTaskCompleted = true;
                  if (this._broadcastLog) {
                    this._broadcastLog('info', \`✅ Task Master 계획 저장 완료 (PLAN_COMPLETE)\`, agentId, currentTaskId);
                  }
                }

                // WARN-002: 대형 출력 방어 (3000자 제한)
                if (output.length > 3000) {
                  output = output.substring(0, 3000) + '\\n... (Output truncated due to size limit)';
                }

                toolOutputs.push(\`--- TOOL: \${name} ---\\nARGS: \${JSON.stringify(args)}\\nRESULT:\\n\${output}\`);
                
                // WARN-002: 최근 3개의 도구 출력 이력만 유지
                if (toolOutputs.length > 3) {
                  toolOutputs.shift();
                }
                
                // 도구 실행 결과도 시스템 로그로 저장
                await dbManager.createComment(currentTaskId, 'SYSTEM', output);

                if (isBlocked) break; // BLOCKED 상태면 남은 도구 실행 중단
              }
            } catch(e) {
              console.warn('[AutoRun] tool_calls 파싱 실패:', e.message);
              toolOutputs.push(\`Failed to parse <tool_calls> JSON: \${e.message}\`);
              await dbManager.createComment(currentTaskId, 'SYSTEM', \`❌ 도구 파싱 실패: \${e.message}\`);
            }
          } else {
            // 도구를 안 썼고 종료 선언도 안 했으면 에러 문맥 주입
            if (!isTaskCompleted) {
              toolOutputs.push(\`System Warning: No <tool_calls> found in your response. You must use tools to proceed, or call finish_task to complete.\`);
            }
          }
        }

        // 5. 작업 완료 시 판정 (Lifecycle): 무조건 REVIEW 전환 및 CEO 할당 (단, BLOCKED 상태가 아닐 때만)
        // BUG-001 수정: isBlocked 확인
        if (!abortController.signal.aborted && isTaskCompleted && !isBlocked) {
          await dbManager.updateTaskStatus(currentTaskId, 'REVIEW');
          await dbManager.updateTaskAssignee(currentTaskId, 'ceo');
          // Phase 44 Persistence
          await dbManager.updateAutoRunStatus(currentTaskId, 'COMPLETED', lastStepCount, MAX_STEPS);
          console.log(\`[AutoRun] ✅ 태스크 #\${currentTaskId} 완료 → REVIEW 전환 및 CEO 할당\`);
          if (this._broadcastLog) {
            this._broadcastLog('info', \`✅ 태스크 #\${currentTaskId} 완료. CEO의 최종 검토를 대기합니다 (REVIEW).\`, agentId, currentTaskId);
          }
        }
        
        currentTaskId = null; // 루프 종료 후 리셋
      }
    } catch (err) {
      console.error(\`[AutoRun] 🚨 에러 발생 (RunID: \${runId}):\`, err.message);
      // 에러 발생 시 진행 중이던 카드가 있다면 FAILED 처리
      if (currentTaskId) {
        await dbManager.updateTaskStatus(currentTaskId, 'FAILED');
        await dbManager.updateAutoRunStatus(currentTaskId, 'FAILED', lastStepCount, MAX_STEPS);
        if (this._broadcastLog) {
          this._broadcastLog('error', \`🚨 태스크 #\${currentTaskId} 실행 중 치명적 에러 발생: \${err.message}\`, agentId, currentTaskId);
        }
      }
    } finally {
      this.activeAutoRuns.delete(runId);
      console.log(\`[AutoRun] 🛑 프로세스 완전 종료 (RunID: \${runId})\`);
    }`;

const newContent = `  async autoRun(projectId, agentId = 'dev_senior', startingTaskId = null) {
    const runId = \`\${projectId}_\${Date.now()}\`;
    const abortController = new AbortController();
    this.activeAutoRuns.set(runId, abortController);

    console.log(\`[AutoRun] 🚀 프로젝트 \${projectId} 자동 릴레이 시작 (RunID: \${runId}, StartTask: \${startingTaskId || 'Auto'})\`);

    let nextTaskIdToRun = startingTaskId; 
    let currentTaskId = null;
    let lastStepCount = 0;
    const MAX_STEPS = 20;

    try {
      while (!abortController.signal.aborted) {
        let nextTask = null;

        if (nextTaskIdToRun) {
          nextTask = await dbManager.getTaskById(nextTaskIdToRun);
          nextTaskIdToRun = null; 
        } else {
          const tasks = await dbManager.getAllTasks(projectId);
          nextTask = tasks.find(t => t.status.toLowerCase() === 'todo' || t.status.toLowerCase() === 'pending');
        }

        if (!nextTask) {
          console.log(\`[AutoRun] 🏁 더 이상 처리할 대기(todo) 태스크가 없습니다. 루프 종료.\`);
          if (this._broadcastLog) this._broadcastLog('info', \`🏁 처리할 태스크가 없어 자동 릴레이를 종료합니다.\`, agentId, null);
          break;
        }

        currentTaskId = nextTask.id;
        console.log(\`[AutoRun] 📌 태스크 선택: #\${currentTaskId} (\${nextTask.title}), Mode: \${nextTask.execution_mode}\`);
        
        await dbManager.updateTaskStatus(currentTaskId, 'IN_PROGRESS');
        if (this._broadcastLog) {
          this._broadcastLog('info', \`▶️ 태스크 #\${currentTaskId} 실행 시작 (Mode: \${nextTask.execution_mode})\`, agentId, currentTaskId);
        }

        // --- TASK_MASTER 모드 분기 로직 ---
        if (nextTask.execution_mode === 'BRANCHING') {
          lastStepCount = 0;
          let isTaskCompleted = false;
          let toolOutputs = [];
          
          const autoRunContext = contextInjector.buildAutoRunContext({
            title: nextTask.title,
            description: nextTask.content || ''
          }, 'TASK_MASTER');

          while (!isTaskCompleted && !abortController.signal.aborted) {
            lastStepCount++;
            if (lastStepCount > MAX_STEPS) throw new Error('Max steps exceeded');

            let currentPrompt = autoRunContext;
            if (toolOutputs.length > 0) currentPrompt += \`\\n\\n[PREVIOUS TOOL OUTPUTS]\\n\${toolOutputs.join('\\n\\n')}\\n\`;

            if (this._broadcastLog) this._broadcastLog('info', \`⏳ [AutoRun] Step \${lastStepCount}: Task Master 사고 회로 가동 중...\`, 'Task Master', currentTaskId);

            const result = await geminiAdapter.generateResponse(
              "태스크를 카테고리별로 쪼개기 위해 계획을 세우고 create_category_tasks 도구를 사용하세요. 완료 시 finish_task 도구를 사용하세요.",
              currentPrompt,
              MODEL.PRO
            );

            await dbManager.createComment(currentTaskId, 'TASK_MASTER', result.text);
            if (this._broadcastLog) this._broadcastLog('info', result.text, 'Task Master', currentTaskId);

            let isBlocked = false;
            const toolCallMatch = result.text.match(/<tool_calls>([\\s\\S]*?)<\\/tool_calls>/i);
            if (toolCallMatch) {
              try {
                const calls = JSON.parse(toolCallMatch[1].trim());
                for (const call of calls) {
                  const { name, arguments: args } = call;
                  if (this._broadcastLog) this._broadcastLog('info', \`🔧 도구 실행 중: \${name}\`, 'Task Master', currentTaskId);

                  const resultObj = await executeTool(name, args, { currentTaskId, projectId, agentId: 'Task Master', mode: 'TASK_MASTER' });
                  let output = resultObj.output;

                  if (resultObj.action === 'FINISH' || resultObj.action === 'CREATE_TASKS') {
                    isTaskCompleted = true;
                    if (resultObj.action === 'CREATE_TASKS') {
                      await dbManager.updateTaskStatus(currentTaskId, 'PLAN_COMPLETE');
                      if (this._broadcastLog) this._broadcastLog('info', \`✅ Task Master 계획 및 자식 카드 생성 완료 (PLAN_COMPLETE)\`, 'Task Master', currentTaskId);
                    }
                  } else if (resultObj.action === 'PAUSE') {
                    isTaskCompleted = true; isBlocked = true;
                    await dbManager.updateTaskStatus(currentTaskId, 'BLOCKED');
                    if (this._broadcastLog) this._broadcastLog('warn', \`⏸️ 대기 (BLOCKED): \${resultObj.reason}\`, 'Task Master', currentTaskId);
                  }

                  if (output.length > 3000) output = output.substring(0, 3000) + '\\n...';
                  toolOutputs.push(\`--- TOOL: \${name} ---\\nARGS: \${JSON.stringify(args)}\\nRESULT:\\n\${output}\`);
                  if (toolOutputs.length > 3) toolOutputs.shift();
                  await dbManager.createComment(currentTaskId, 'SYSTEM', output);

                  if (isBlocked) break;
                }
              } catch(e) {
                toolOutputs.push(\`Failed to parse <tool_calls> JSON: \${e.message}\`);
                await dbManager.createComment(currentTaskId, 'SYSTEM', \`❌ 도구 파싱 실패: \${e.message}\`);
              }
            } else {
              if (!isTaskCompleted) toolOutputs.push(\`System Warning: No <tool_calls> found.\`);
            }
          }
          currentTaskId = null;
          continue;
        }

        // --- 일반 DEV (Single Card) 모드 로직 ---
        lastStepCount = 0;
        let isTaskCompleted = false;
        let toolOutputs = [];
        let consecutiveErrors = 0;

        const autoRunContext = contextInjector.buildAutoRunContext({
          title: nextTask.title,
          description: nextTask.content || ''
        }, 'DEV');

        while (!isTaskCompleted && !abortController.signal.aborted) {
          lastStepCount++;
          if (lastStepCount > MAX_STEPS) throw new Error('Max steps exceeded');

          let currentPrompt = autoRunContext;
          if (toolOutputs.length > 0) currentPrompt += \`\\n\\n[PREVIOUS TOOL OUTPUTS]\\n\${toolOutputs.join('\\n\\n')}\\n\`;

          if (this._broadcastLog) this._broadcastLog('info', \`⏳ [AutoRun] Step \${lastStepCount}: 에이전트 사고 회로 가동 중...\`, agentId, currentTaskId);

          let result;
          try {
            result = await geminiAdapter.generateResponse(
              "주어진 태스크를 달성하기 위해 코딩을 진행하세요. 필요한 경우 반드시 <tool_calls>를 사용하십시오.",
              currentPrompt,
              MODEL.PRO
            );
            consecutiveErrors = 0;
          } catch(e) {
            consecutiveErrors++;
            await dbManager.createComment(currentTaskId, 'SYSTEM', \`❌ LLM 호출 에러: \${e.message}\`);
            if (consecutiveErrors >= 3) {
              await dbManager.updateTaskStatus(currentTaskId, 'BLOCKED');
              throw new Error(\`연속 3회 LLM 에러 발생. 루프 중단.\`);
            }
            continue;
          }

          await dbManager.createComment(currentTaskId, agentId.toUpperCase(), result.text);
          if (this._broadcastLog) this._broadcastLog('info', result.text, agentId, currentTaskId);

          let isBlocked = false;
          const toolCallMatch = result.text.match(/<tool_calls>([\\s\\S]*?)<\\/tool_calls>/i);
          if (toolCallMatch) {
            try {
              const calls = JSON.parse(toolCallMatch[1].trim());
              for (const call of calls) {
                const { name, arguments: args } = call;
                if (this._broadcastLog) this._broadcastLog('info', \`🔧 도구 실행 중: \${name}\`, agentId, currentTaskId);

                const resultObj = await executeTool(name, args, { currentTaskId, projectId, agentId, mode: 'DEV' });
                let output = resultObj.output;

                if (resultObj.action === 'FINISH') {
                  isTaskCompleted = true;
                } else if (resultObj.action === 'PAUSE') {
                  isTaskCompleted = true; isBlocked = true;
                  await dbManager.updateTaskStatus(currentTaskId, 'BLOCKED');
                  await dbManager.updateAutoRunStatus(currentTaskId, 'BLOCKED', lastStepCount, MAX_STEPS);
                  if (this._broadcastLog) this._broadcastLog('warn', \`⏸️ 사용자 응답 대기 (BLOCKED)\`, agentId, currentTaskId);
                } else if (resultObj.action === 'SAVE_PLAN') {
                  await dbManager.saveExecutionPlan(currentTaskId, null, resultObj.planJson);
                  await dbManager.updateTaskStatus(currentTaskId, 'PLAN_COMPLETE');
                  await dbManager.updateAutoRunStatus(currentTaskId, 'PLAN_COMPLETE', lastStepCount, MAX_STEPS);
                  isTaskCompleted = true;
                }

                if (output.length > 3000) output = output.substring(0, 3000) + '\\n... (Output truncated)';
                toolOutputs.push(\`--- TOOL: \${name} ---\\nARGS: \${JSON.stringify(args)}\\nRESULT:\\n\${output}\`);
                if (toolOutputs.length > 3) toolOutputs.shift();
                await dbManager.createComment(currentTaskId, 'SYSTEM', output);

                if (isBlocked) break;
              }
            } catch(e) {
              toolOutputs.push(\`Failed to parse <tool_calls> JSON: \${e.message}\`);
              await dbManager.createComment(currentTaskId, 'SYSTEM', \`❌ 도구 파싱 실패: \${e.message}\`);
            }
          } else {
            if (!isTaskCompleted) toolOutputs.push(\`System Warning: No <tool_calls> found in your response. You must use tools to proceed.\`);
          }
        }

        if (!abortController.signal.aborted && isTaskCompleted && !isBlocked) {
          const t = await dbManager.getTaskById(currentTaskId);
          await dbManager.updateTaskStatus(currentTaskId, 'REVIEW');
          await dbManager.updateTaskAssignee(currentTaskId, 'ceo');
          await dbManager.updateAutoRunStatus(currentTaskId, 'COMPLETED', lastStepCount, MAX_STEPS);
          
          if (t && t.parent_task_id) {
            const siblings = await dbManager.getAllTasks(projectId);
            const mySiblings = siblings.filter(x => x.parent_task_id === t.parent_task_id);
            const allDone = mySiblings.every(x => x.status === 'DONE' || x.status === 'REVIEW');
            if (allDone) {
              await dbManager.updateTaskStatus(t.parent_task_id, 'REVIEW');
              if (this._broadcastLog) this._broadcastLog('info', \`🎉 부모 태스크 #\${t.parent_task_id} 자식 카드 전체 완료됨\`, 'SYSTEM', t.parent_task_id);
            }
          }
          
          if (this._broadcastLog) this._broadcastLog('info', \`✅ 태스크 #\${currentTaskId} 완료. (REVIEW)\`, agentId, currentTaskId);
        }
        
        currentTaskId = null; 
      }
    } catch (err) {
      console.error(\`[AutoRun] 🚨 에러 발생 (RunID: \${runId}):\`, err.message);
      if (currentTaskId) {
        await dbManager.updateTaskStatus(currentTaskId, 'FAILED');
        await dbManager.updateAutoRunStatus(currentTaskId, 'FAILED', lastStepCount, MAX_STEPS);
        if (this._broadcastLog) {
          this._broadcastLog('error', \`🚨 태스크 #\${currentTaskId} 실행 중 치명적 에러 발생: \${err.message}\`, agentId, currentTaskId);
        }
      }
    } finally {
      this.activeAutoRuns.delete(runId);
      console.log(\`[AutoRun] 🛑 프로세스 완전 종료 (RunID: \${runId})\`);
    }`;

if (content.indexOf(targetContent) !== -1) {
  content = content.replace(targetContent, newContent);
  fs.writeFileSync(executorPath, content, 'utf8');
  console.log("Success");
} else {
  console.log("Target content not found. Writing target content to dump_target.js for inspection.");
  fs.writeFileSync('dump_target.js', targetContent, 'utf8');
}
