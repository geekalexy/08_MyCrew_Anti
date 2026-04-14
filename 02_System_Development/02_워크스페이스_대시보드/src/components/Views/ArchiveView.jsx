// src/components/Views/ArchiveView.jsx — 완료 Task 보관소 (DataGrid)
// 컬럼: #ID / 타이틀 / 프로젝트 / 담당(실행방식) / 결과
import { useMemo } from 'react';
import { useKanbanStore } from '../../store/kanbanStore';
import { useProjectStore } from '../../store/projectStore';
import { useAgentStore } from '../../store/agentStore';

import { useUiStore } from '../../store/uiStore';

const IcoArchive = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="4" rx="1"/>
    <path d="M4 7v12a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7"/>
    <path d="M10 12h4"/>
  </svg>
);

export default function ArchiveView() {
  const tasks = useKanbanStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const { setActiveDetailTaskId } = useUiStore();

  const projectMap = useMemo(() => {
    const map = {};
    projects.forEach((p) => { map[p.id] = p.name; });
    return map;
  }, [projects]);

  const archivedTasks = useMemo(() =>
    Object.values(tasks)
      .filter((t) => t.column === 'done')
      .sort((a, b) => (b.id > a.id ? 1 : -1)),
    [tasks]
  );

  return (
    <div className="archive-view">
      <div className="board-header">
        <h2 className="board-header__title">Archive</h2>
        <p className="board-header__subtitle">완료된 업무 보관소 — {archivedTasks.length}건</p>
      </div>

      <div className="archive-table glass-panel" style={{ marginTop: '1rem' }}>
        {archivedTasks.length === 0 ? (
          <div className="view-empty">
            <IcoArchive />
            <p>아직 완료된 Task가 없습니다.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#ID</th>
                <th>타이틀</th>
                <th>프로젝트</th>
                <th>담당</th>
                <th>결과</th>
              </tr>
            </thead>
            <tbody>
              {archivedTasks.map((task) => {
                const projectName = task.projectId
                  ? (projectMap[task.projectId] || '—')
                  : '—';

                return (
                  <tr 
                    key={task.id} 
                    onClick={() => setActiveDetailTaskId(task.id)}
                    style={{ cursor: 'pointer' }}
                    className="archive-table-row"
                  >
                    <td className="data-table__id">#{task.id}</td>
                    <td className="data-table__content">{task.title || task.content}</td>
                    <td className="data-table__project">{projectName}</td>
                    <td>
                      <span className={`exec-badge exec-badge--${task.executionMode || 'ari'}`}>
                        {task.executionMode === 'omo' ? 'Dev Team' : 'Ari'}
                      </span>
                    </td>
                    <td>
                      <span className="status-badge status-badge--done">✓ DONE</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
