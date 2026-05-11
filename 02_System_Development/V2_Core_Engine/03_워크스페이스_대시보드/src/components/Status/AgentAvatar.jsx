// src/components/Status/AgentAvatar.jsx
// 에이전트 상태별 bouncing / aura 애니메이션
import { useKanbanStore } from '../../store/kanbanStore';
import { useAgentStore } from '../../store/agentStore';

export default function AgentAvatar({ agentId, size = 'md', showName = false }) {
  const status = useKanbanStore((s) => s.agents[agentId]?.status || 'idle');
  const agentMeta = useAgentStore((s) => s.agentMeta);
  
  const meta = agentMeta[agentId] || { name: agentId, avatar: '/avatars/ari.svg' };

  return (
    <div
      className={`agent-avatar agent-avatar--${size} agent-avatar--${status}`}
      title={`${meta.name} (${status})`}
    >
      <img
        src={meta.avatar}
        alt={meta.name}
        className="agent-avatar__img"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
      {/* 활성 시 초록 aura 링 애니메이션은 CSS에서 처리 */}
      <span className={`agent-avatar__status-dot agent-avatar__status-dot--${status}`} />
      {showName && <span className="agent-avatar__name">{meta.name}</span>}
    </div>
  );
}
