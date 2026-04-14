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
  const isBoardReadOnly = useUiStore((s) => s.isBoardReadOnly);
  const { emitTaskMove } = useSocket();
  const [activeTask, setActiveTask] = useState(null);

  // ── 초기 Hydration: 서버 DB 기준으로 스토어 완전 동기화 ─────────────────
  useEffect(() => {
    // Step 1: localStorage에 남은 temp-/local- 카드 즉시 정리
    const { tasks, removeTask } = useKanbanStore.getState();
    Object.keys(tasks).forEach((id) => {
      if (String(id).startsWith('temp-') || String(id).startsWith('local-')) {
        removeTask(id);
        console.log(`[KanbanBoard] 잔류 temp 카드 제거: ${id}`);
      }
    });

    // Step 2: 서버 DB에서 실제 태스크 불러오기
    fetch(`${SERVER_URL}/api/tasks`)
      .then((res) => res.json())
      .then(({ status, tasks: remoteTasks }) => {
        if (status !== 'ok' || !Array.isArray(remoteTasks)) return;
        const addTask = useKanbanStore.getState().addTask;
        remoteTasks.forEach((task) => addTask(task));
        console.log(`[KanbanBoard] Hydration 완료: ${remoteTasks.length}개 태스크`);
      })
      .catch((err) => console.warn('[KanbanBoard] Hydration 실패:', err.message));
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // 클릭 민감도 완화 (마우스 미세 흔들림 잡아줌)
    })
  );

  const tasksByColumn = useMemo(() => {
    const grouped = {};
    COLUMNS.forEach((col) => { grouped[col] = []; });
    Object.values(tasks).forEach((task) => {
      // 프로젝트 필터링: projectId가 일치하거나 없는(호환성) 경우만 추가
      if (!task.projectId || task.projectId === selectedProjectId) {
        if (grouped[task.column]) grouped[task.column].push(task);
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
    const toColumn = String(over.id);
    const fromColumn = tasks[taskId]?.column;

    if (fromColumn && fromColumn !== toColumn && COLUMNS.includes(toColumn)) {
      emitTaskMove(taskId, fromColumn, toColumn);
    }
  };

  const handleDragCancel = () => {
    setActiveTask(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={`kanban-board${isBoardReadOnly ? ' kanban-board--readonly' : ''}`}>
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
  );
}
