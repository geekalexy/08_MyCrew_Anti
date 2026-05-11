// src/components/Status/AgentStatusBar.jsx
// 상단 전체 에이전트 현황 바
import AgentAvatar from './AgentAvatar';
import { useKanbanStore } from '../../store/kanbanStore';

const KNOWN_AGENTS = [
  { id: 'luca', name: 'Luca', role: 'CTO · Advisor' },
  { id: 'ari',  name: 'Ari',  role: 'Assistant · Engineer' },
  { id: 'pico', name: 'Pico', role: 'Creative · Designer' },
];

export default function AgentStatusBar() {
  const agents = useKanbanStore((s) => s.agents);

  const activeCount = KNOWN_AGENTS.filter(
    (a) => agents[a.id]?.status === 'active'
  ).length;

  return (
    <div className="agent-status-bar">
      <div className="agent-status-bar__label">
        <span className="agent-status-bar__badge">
          {activeCount} / {KNOWN_AGENTS.length} Active
        </span>
      </div>
      <div className="agent-status-bar__agents">
        {KNOWN_AGENTS.map((agent) => (
          <div key={agent.id} className="agent-status-bar__item">
            <AgentAvatar agentId={agent.id} size="md" />
            <div className="agent-status-bar__info">
              <span className="agent-status-bar__name">{agent.name}</span>
              <span className="agent-status-bar__role">{agent.role}</span>
              <span
                className={`agent-status-bar__status agent-status-bar__status--${
                  agents[agent.id]?.status || 'idle'
                }`}
              >
                {agents[agent.id]?.status === 'active' ? '● 작업 중' : '○ 대기 중'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
