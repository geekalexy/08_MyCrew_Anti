// src/components/Views/ArchiveView.jsx — 완료 Task 보관소 (DataGrid)
// 컬럼: #ID / 타이틀 / 프로젝트 / 담당(실행방식) / 결과
import { useMemo, useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const IcoArchive = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="4" rx="1"/>
    <path d="M4 7v12a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7"/>
    <path d="M10 12h4"/>
  </svg>
);

export default function ArchiveView() {
  const projects = useProjectStore((s) => s.projects);
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const { setActiveDetailTaskId } = useUiStore();
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const projectMap = useMemo(() => {
    const map = {};
    projects.forEach((p) => { map[p.id] = p.name; });
    return map;
  }, [projects]);

  useEffect(() => {
    const fetchArchivedTasks = async () => {
      try {
        setIsLoading(true);
        const pid = selectedProjectId || 'all';
        const res = await fetch(`${SERVER_URL}/api/tasks/archived?projectId=${pid}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        if (data.status === 'ok') {
          setArchivedTasks(data.tasks || []);
        }
      } catch (err) {
        console.error('Failed to fetch archived tasks:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchArchivedTasks();
  }, [selectedProjectId]);

  return (
    <div className="archive-view">
      <div className="board-header">
        <h2 className="board-header__title">Archive</h2>
        <p className="board-header__subtitle">아카이빙 처리된 업무 보관소 — {archivedTasks.length}건</p>
      </div>

      <div className="archive-table glass-panel" style={{ marginTop: '1rem' }}>
        {isLoading ? (
          <div className="view-empty">
            <p>데이터를 불러오는 중입니다...</p>
          </div>
        ) : archivedTasks.length === 0 ? (
          <div className="view-empty">
            <IcoArchive />
            <p>아직 아카이브된 Task가 없습니다.</p>
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
                      <span className="status-badge" style={{ backgroundColor: '#F59E0B', color: '#fff', border: 'none' }}>📦 ARCHIVED</span>
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
