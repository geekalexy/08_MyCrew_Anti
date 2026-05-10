// src/components/Views/ArchiveView.jsx — 완료 Task 보관소 (DataGrid)
// 컬럼: #ID / 타이틀 / 프로젝트 / 담당(실행방식) / 결과
import { useMemo, useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4010';

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
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' 기본 선택
  const [graphExists, setGraphExists] = useState(null);

  const projectMap = useMemo(() => {
    const map = {};
    if (projects && Array.isArray(projects)) {
      projects.forEach((p) => { map[p.id] = p.name; });
    }
    return map;
  }, [projects]);

  useEffect(() => {
    const fetchArchivedTasks = async () => {
      if (!selectedProjectId) return;
      try {
        setIsLoading(true);
        const res = await fetch(`${SERVER_URL}/api/tasks/archived?project_id=${selectedProjectId}`);
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

  const selectedProject = projects && Array.isArray(projects) ? projects.find(p => p.id === selectedProjectId) : null;
  const graphUrl = selectedProject ? `${SERVER_URL}/preview/${selectedProject.id}/OUTPUT/graph.html` : '';

  useEffect(() => {
    if (activeTab === 'graph' && graphUrl) {
      fetch(graphUrl, { method: 'HEAD' })
        .then(res => setGraphExists(res.ok))
        .catch(() => setGraphExists(false));
    }
  }, [activeTab, graphUrl]);

  return (
    <div className="archive-view" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="board-header">
        <h2 className="board-header__title">Knowledge Hub</h2>
        <p className="board-header__subtitle">프로젝트 지식 그래프 및 아카이브된 업무 보관소</p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('graph')}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: '1rem', fontWeight: activeTab === 'graph' ? 700 : 500,
            color: activeTab === 'graph' ? 'var(--brand)' : 'var(--text-muted)',
            padding: '0.5rem 1rem', position: 'relative'
          }}
        >
          Knowledge Graph (AST)
          {activeTab === 'graph' && <div style={{ position: 'absolute', bottom: '-0.5rem', left: 0, right: 0, height: '2px', background: 'var(--brand)' }} />}
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: '1rem', fontWeight: activeTab === 'tasks' ? 700 : 500,
            color: activeTab === 'tasks' ? 'var(--brand)' : 'var(--text-muted)',
            padding: '0.5rem 1rem', position: 'relative'
          }}
        >
          Archived Tasks ({archivedTasks.length})
          {activeTab === 'tasks' && <div style={{ position: 'absolute', bottom: '-0.5rem', left: 0, right: 0, height: '2px', background: 'var(--brand)' }} />}
        </button>
      </div>

      <div className="archive-content" style={{ flex: 1, overflow: 'hidden', marginTop: '1rem' }}>
        {activeTab === 'graph' ? (
          <div className="glass-panel" style={{ width: '100%', height: '100%', overflow: 'hidden', padding: 0 }}>
            {!selectedProjectId ? (
              <div className="view-empty"><p>프로젝트를 선택해주세요.</p></div>
            ) : graphExists === null ? (
              <div className="view-empty"><p>그래프를 확인하는 중입니다...</p></div>
            ) : graphExists === false ? (
              <div className="view-empty">
                <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', opacity: 0.4 }}>account_tree</span>
                <p style={{ marginTop: '0.5rem' }}>아직 Knowledge Graph가 생성되지 않았습니다.<br/><span style={{ fontSize: '0.8rem', opacity: 0.7 }}>첫 번째 태스크가 완료되면 워치독이 자동으로 생성합니다.</span></p>
              </div>
            ) : (
              <iframe
                src={graphUrl}
                title="Knowledge Graph"
                style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }}
                sandbox="allow-scripts allow-same-origin"
                onError={(e) => console.warn('그래프 렌더링 실패', e)}
              />
            )}
          </div>
        ) : (
          <div className="archive-table glass-panel" style={{ height: '100%', overflow: 'auto' }}>
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
        )}
      </div>
    </div>
  );
}
