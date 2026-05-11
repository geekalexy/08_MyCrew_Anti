// src/components/Board/KanbanBoard.jsx — API Hydration 추가 (Phase 9)
import { useMemo, useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import Column from './Column';
import TaskCard from './TaskCard';
import { useKanbanStore } from '../../store/kanbanStore';
import { useUiStore } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { useSocket } from '../../hooks/useSocket';

const COLUMNS = ['backlog', 'todo', 'in_progress', 'review', 'done', 'finalized'];
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4010';

export default function KanbanBoard() {
  const tasks = useKanbanStore((s) => s.tasks);
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const isLoaded = useProjectStore((s) => s.isLoaded);
  const isBoardReadOnly = useUiStore((s) => s.isBoardReadOnly);
  const { emitTaskMove } = useSocket();
  const [activeTask, setActiveTask] = useState(null);
  const [archivedTasks, setArchivedTasks] = useState([]); // [아카이브] 아카이브된 태스크 상태 추가
  const [selectedSprint, setSelectedSprint] = useState('ALL'); // [Sprint 필터] 선택된 스프린트

  // [Phase B] 메인 탭 상태 ('kanban' | 'graph')
  const [mainTab, setMainTab] = useState('kanban');
  const [graphExists, setGraphExists] = useState(false);
  const [graphCheckDone, setGraphCheckDone] = useState(false);

  // [Sprint 단위 보기] 현재 프로젝트의 유효한 스프린트 번호 목록 추출 (내림차순)
  const availableSprints = useMemo(() => {
    const sprints = new Set();
    Object.values(tasks).forEach(t => {
      if ((!t.projectId || t.projectId === selectedProjectId) && t.sprint_no) {
        sprints.add(t.sprint_no);
      }
    });
    return Array.from(sprints).sort((a,b) => b - a);
  }, [tasks, selectedProjectId]);

  // ── 초기 Hydration: 서버 DB 기준으로 스토어 완전 동기화 ─────────────────
  useEffect(() => {
    if (!isLoaded || !selectedProjectId) return; // 프로젝트가 로드된 후에만 Fetch

    // [Prime Fix #5] AbortController — 빠른 프로젝트 전환 시 이전 fetch 취소
    // A→B→C 전환 시 A, B의 응답이 C보다 늦게 도착해도 덮어쓰지 않음 (Race Condition 방어)
    const controller = new AbortController();

    // Step 1: localStorage에 남은 temp-/local- 카드 즉시 정리
    const { tasks, removeTask } = useKanbanStore.getState();
    Object.keys(tasks).forEach((id) => {
      if (String(id).startsWith('temp-') || String(id).startsWith('local-')) {
        removeTask(id);
        console.log(`[KanbanBoard] 잔류 temp 카드 제거: ${id}`);
      }
    });

    // Step 2: 서버 DB에서 프로젝트별 태스크 불러오기
    fetch(`${SERVER_URL}/api/tasks?project_id=${selectedProjectId}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then(({ status, tasks: remoteTasks }) => {
        if (status !== 'ok' || !Array.isArray(remoteTasks)) return;
        // [B-05 Fix] 기존 모든 태스크를 지우고 현재 프로젝트의 remoteTasks로 완전 교체
        useKanbanStore.getState().setRemoteTasks(remoteTasks);
        console.log(`[KanbanBoard] Hydration 완료: ${remoteTasks.length}개 태스크 (Project: ${selectedProjectId})`);

        // [아카이브] 완료된/보관된 태스크 추가 로드
        fetch(`${SERVER_URL}/api/tasks/archived?project_id=${selectedProjectId}`, { signal: controller.signal })
          .then(r => r.json())
          .then(data => {
            if (data.status === 'ok') setArchivedTasks(data.tasks || []);
          })
          .catch(err => {
            if (err.name !== 'AbortError') console.error('[KanbanBoard] Archived load error:', err);
          });
      })
      .catch((err) => {
        if (err.name === 'AbortError') return; // 정상 취소 — 경고 불필요
        console.warn('[KanbanBoard] Hydration 실패:', err.message);
      });

    // Cleanup: 프로젝트 전환 또는 언마운트 시 진행 중인 fetch 즉시 취소
    return () => controller.abort();
  }, [selectedProjectId, isLoaded]);

  // [Phase B] 지식 그래프 탭 전환 시 graph.html 존재 여부 확인
  useEffect(() => {
    if (mainTab !== 'graph' || !selectedProjectId) return;
    setGraphCheckDone(false);
    setGraphExists(false);
    fetch(`${SERVER_URL}/preview/${selectedProjectId}/OUTPUT/graph.html`, { method: 'HEAD' })
      .then((r) => setGraphExists(r.ok))
      .catch(() => setGraphExists(false))
      .finally(() => setGraphCheckDone(true));
  }, [mainTab, selectedProjectId]);


  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // 클릭 민감도 완화 (마우스 미세 흔들림 잡아줌)
    })
  );

  const tasksByColumn = useMemo(() => {
    const grouped = {};
    COLUMNS.forEach((col) => { grouped[col] = []; });
    Object.values(tasks).forEach((task) => {
      // ARCHIVED 상태 카드는 칸반에서 숨김 (아카이빙 후 모달 닫히기 전 상태 대비)
      if (task.status === 'ARCHIVED') return;
      // 프로젝트 필터링: projectId가 일치하거나 없는(호환성) 경우만 추가
      if (!task.projectId || task.projectId === selectedProjectId) {
        // [Sprint 필터] 선택된 스프린트에 해당하는 카드만 보이도록 필터링
        if (selectedSprint === 'ALL' || String(task.sprint_no) === String(selectedSprint)) {
          if (grouped[task.column]) grouped[task.column].push(task);
        }
      }
    });
    return grouped;
  }, [tasks, selectedProjectId]);

  const handleDragStart = ({ active }) => {
    if (isBoardReadOnly) return;
    setActiveTask(tasks[active.id] || null);
  };

  const handleDragEnd = ({ active, over }) => {
    setActiveTask(null);
    if (!over || isBoardReadOnly) return;

    const taskId = String(active.id);
    let toColumn = String(over.id);
    const fromColumn = tasks[taskId]?.column;

    // 만약 over.id가 컬럼 ID가 아니라 다른 태스크의 ID라면, 해당 태스크의 컬럼으로 인식
    if (!COLUMNS.includes(toColumn)) {
      if (tasks[toColumn]) {
        toColumn = tasks[toColumn].column;
      }
    }

    if (fromColumn && fromColumn !== toColumn && COLUMNS.includes(toColumn)) {
      emitTaskMove(taskId, fromColumn, toColumn);
      
      // [Phase 39] Zero-Command Trigger: 'To Do' -> 'In Progress' 이동 시 자율 코딩 시작
      if (fromColumn === 'todo' && toColumn === 'in_progress') {
        console.log(`[Zero-Command] Task #${taskId} 자동 실행(run_tasks) 트리거됨`);
        fetch(`${SERVER_URL}/api/tasks/${taskId}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'DEV', intent: 'run_tasks' })
        }).catch(err => console.error('[Zero-Command] 실행 호출 실패:', err));
      }
    }
  };

  const handleDragCancel = () => {
    setActiveTask(null);
  };

  // [일괄 아카이브] 선택된 스프린트의 모든 완료된(done) 카드를 아카이브 처리
  const handleBatchArchive = async () => {
    if (selectedSprint === 'ALL') {
      alert('일괄 아카이빙할 특정 스프린트를 선택해주세요.');
      return;
    }
    const doneTasksInSprint = tasksByColumn['done'];
    if (doneTasksInSprint.length === 0) {
      alert(`Sprint #${selectedSprint}에 완료된(Done) 카드가 없습니다.`);
      return;
    }

    if (!window.confirm(`Sprint #${selectedSprint}의 완료된 카드 ${doneTasksInSprint.length}개를 일괄 아카이빙 하시겠습니까?`)) return;

    for (const task of doneTasksInSprint) {
      try {
        await fetch(`${SERVER_URL}/api/tasks/${task.id}/archive`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archivedBy: 'CEO (Batch Archive)' })
        });
      } catch (err) {
        console.error(`[BatchArchive] Task #${task.id} 보관 실패:`, err);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* [Phase B] 메인 탭 네비게이션 — [칸반 보드 | 지식 그래프] */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.25rem',
        padding: '0.4rem 1rem',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface-1)',
        flexShrink: 0,
      }}>
        {[
          { key: 'kanban', icon: 'view_kanban', label: '칸반 보드' },
          { key: 'graph',  icon: 'account_tree', label: '지식 그래프' },
        ].map(tab => (
          <button
            key={tab.key}
            id={`btn-main-tab-${tab.key}`}
            onClick={() => setMainTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.4rem 0.9rem',
              fontSize: '0.8rem', fontWeight: 700,
              fontFamily: 'Space Grotesk, sans-serif',
              letterSpacing: '0.04em',
              border: 'none',
              borderBottom: mainTab === tab.key ? '2px solid var(--brand)' : '2px solid transparent',
              borderRadius: 0,
              background: 'none',
              color: mainTab === tab.key ? 'var(--brand)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
      {/* [Phase B] 지식 그래프 뷰 — graph.html 전체 Iframe */}
      {mainTab === 'graph' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!graphCheckDone ? (
            /* 로딩 상태 */
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '0.75rem', color: 'var(--text-muted)',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '2rem', opacity: 0.5, animation: 'spin 1.2s linear infinite' }}>sync</span>
              <span style={{ fontSize: '0.85rem' }}>지식 그래프 확인 중...</span>
            </div>
          ) : graphExists ? (
            /* 그래프 존재: Iframe 렌더링 */
            <iframe
              id="iframe-knowledge-graph"
              src={`${SERVER_URL}/preview/${selectedProjectId}/OUTPUT/graph.html`}
              title="프로젝트 지식 그래프"
              style={{ flex: 1, width: '100%', border: 'none', background: '#0d0f14' }}
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            /* 그래프 없음: Empty State */
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '1rem', padding: '2rem', color: 'var(--text-muted)',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '3rem', opacity: 0.3 }}>account_tree</span>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  지식 그래프가 아직 생성되지 않았습니다
                </div>
                <div style={{ fontSize: '0.8rem', lineHeight: 1.65, color: 'var(--text-muted)' }}>
                  칸반 태스크가 <strong>Done</strong> 상태로 완료되면<br />
                  Graphify 워치독이 자동으로 그래프를 생성합니다.
                </div>
              </div>
              <button
                onClick={() => {
                  setGraphCheckDone(false);
                  fetch(`${SERVER_URL}/preview/${selectedProjectId}/OUTPUT/graph.html`, { method: 'HEAD' })
                    .then((r) => setGraphExists(r.ok))
                    .catch(() => setGraphExists(false))
                    .finally(() => setGraphCheckDone(true));
                }}
                style={{
                  padding: '0.5rem 1.2rem',
                  background: 'rgba(100,135,242,0.1)',
                  border: '1px solid rgba(100,135,242,0.3)',
                  borderRadius: '8px', color: 'var(--brand)',
                  cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  transition: 'all 0.15s',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>refresh</span>
                다시 확인
              </button>
            </div>
          )}
        </div>
      )}

      {/* [Phase B] 칸반 뷰 — mainTab이 'graph'일 때 숨김 (상태 보존) */}
      <div style={{ display: mainTab === 'kanban' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {/* Sprint 필터 툴바 */}
      {availableSprints.length > 0 && (
        <div style={{ padding: '0.5rem 1rem', display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--surface-50)', borderBottom: '1px solid var(--border)', marginBottom: '1rem', borderRadius: '8px' }}>
          <select 
            value={selectedSprint} 
            onChange={(e) => setSelectedSprint(e.target.value)}
            style={{ padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
          >
            <option value="ALL">모든 스프린트 보기</option>
            {availableSprints.map(s => (
              <option key={s} value={s}>Sprint #{s}</option>
            ))}
          </select>
          {selectedSprint !== 'ALL' && (
            <button 
              onClick={handleBatchArchive}
              style={{ padding: '0.3rem 0.8rem', background: 'var(--brand)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              종료된 Sprint 일괄 아카이브
            </button>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <button
              onClick={() => useUiStore.getState().setCurrentView('archive')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.8rem', background: 'var(--surface-100)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>inventory_2</span>
              아카이브 ({archivedTasks.length})
            </button>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div 
          className={`kanban-board${isBoardReadOnly ? ' kanban-board--readonly' : ''}`}
          style={{ flex: 1, minHeight: 0 }}
        >
        {COLUMNS.map((columnId) => (
          <SortableContext
            key={columnId}
            id={columnId}
            items={tasksByColumn[columnId].map((t) => String(t.id))}
            strategy={verticalListSortingStrategy}
          >
            <Column
              columnId={columnId}
              tasks={tasksByColumn[columnId]}
              disableDnD={isBoardReadOnly}
            />
          </SortableContext>
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
      </DragOverlay>
    </DndContext>

      </div>{/* 칸반 뷰 wrapper 닫기 */}
    </div>
  );
}
