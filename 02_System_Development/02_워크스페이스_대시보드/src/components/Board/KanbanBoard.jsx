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

const COLUMNS = ['todo', 'in_progress', 'review', 'done'];
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export default function KanbanBoard() {
  const tasks = useKanbanStore((s) => s.tasks);
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const isLoaded = useProjectStore((s) => s.isLoaded);
  const isBoardReadOnly = useUiStore((s) => s.isBoardReadOnly);
  const { emitTaskMove } = useSocket();
  const [activeTask, setActiveTask] = useState(null);
  const [archivedTasks, setArchivedTasks] = useState([]); // [아카이브] 아카이브된 태스크 상태 추가
  const [selectedSprint, setSelectedSprint] = useState('ALL'); // [Sprint 필터] 선택된 스프린트

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
        
        {/* 아카이브 컬럼 (최대 5개 표시 및 더보기 버튼) */}
        <div className="column column--archived" style={{ opacity: 0.9 }}>
          <div className="column__header">
            <div className="column__header-left">
              <h3 className="column__title">Archive</h3>
              <span className="column__count">{archivedTasks.length}</span>
            </div>
          </div>
          <div className="column__cards">
            {archivedTasks.slice(0, 5).map((task) => (
              <div key={task.id} className="task-card" style={{ opacity: 0.7, pointerEvents: 'none' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  #{String(task.id).slice(-6)} {task.sprint_no ? `(S${task.sprint_no})` : ''}
                </div>
                <p className="task-card__title line-clamp-2" style={{ margin: '0.35rem 0 0', padding: 0 }}>
                  {task.title}
                </p>
              </div>
            ))}
            {archivedTasks.length > 5 && (
              <div 
                style={{ textAlign: 'center', padding: '0.8rem 0', color: 'var(--brand)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                onClick={() => useUiStore.getState().setCurrentView('archive')}
              >
                더보기 ({archivedTasks.length - 5}개)
              </div>
            )}
            {archivedTasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                보관된 카드가 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
      </DragOverlay>
    </DndContext>
    </div>
  );
}
