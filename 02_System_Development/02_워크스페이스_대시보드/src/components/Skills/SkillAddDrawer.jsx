// src/components/Skills/SkillAddDrawer.jsx — Phase 17-4: 스킬 추가 Local Drawer
import { useAgentStore } from '../../store/agentStore';
import { SKILL_REGISTRY } from '../../data/skillRegistry';

/**
 * SkillAddDrawer — 에이전트에 스킬을 추가하는 슬라이드형 드로어
 *
 * position: absolute → AgentDetailView(position:relative, overflow:hidden)에 클리핑됨
 * z-index: var(--z-drawer-local) → 글로벌 fixed 오버레이와 충돌 없음
 *
 * Props:
 *   isOpen           — 드로어 열림 여부
 *   onClose          — 닫기 콜백
 *   agentId          — 현재 에이전트 ID
 *   installedSkillIds — 이미 설치된 스킬 ID 배열 (중복 방지)
 */
export default function SkillAddDrawer({ isOpen, onClose, agentId, installedSkillIds }) {
  const { agentMeta, toggleAgentSkill } = useAgentStore();
  const skillConfig = agentMeta[agentId]?.skillConfig || {};

  // 비활성화된 스킬(설치O, active:false) 또는 미설치 스킬만 표시
  // Builtin 스킬은 항상 표시하지 않음 (해제 불가이므로 추가할 필요 없음)
  const availableSkills = Object.values(SKILL_REGISTRY).filter((skill) => {
    if (skill.isBuiltin) return false;
    const isCurrentlyActive = skillConfig[skill.id]?.active !== false;
    return !isCurrentlyActive; // 비활성 상태인 스킬만
  });

  const handleAddSkill = (skill) => {
    toggleAgentSkill(agentId, skill.id, true);
    onClose();
  };

  const LAYER_LABEL = { 1: 'ENGINE', 2: 'DOMAIN', 3: 'INFRA' };

  return (
    <>
      {/* 배경 딤 오버레이 (드로어 뒤) */}
      {isOpen && (
        <div className="skill-drawer__overlay" onClick={onClose} />
      )}

      {/* 드로어 본체 */}
      <div className={`skill-drawer${isOpen ? ' skill-drawer--open' : ''}`}>
        {/* 헤더 */}
        <div className="skill-drawer__header">
          <h3 className="skill-drawer__title">
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.4rem', color: 'var(--brand)' }}>
              extension
            </span>
            스킬 추가
          </h3>
          <button className="skill-drawer__close" onClick={onClose} aria-label="닫기">
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>close</span>
          </button>
        </div>

        {/* 스킬 목록 */}
        <div className="skill-drawer__body">
          <p style={{ margin: '0 0 0.8rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, background: 'rgba(180,197,255,0.05)', padding: '0.8rem', borderRadius: '8px', border: '1px dashed rgba(180,197,255,0.2)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.3rem', color: 'var(--brand)' }}>info</span>
            아래 목록에서 이 에이전트에게 장착할 스킬을 클릭하세요. (선택 즉시 백엔드 DB에 동기화되어 영구 장착됩니다.)
          </p>

          {availableSkills.length === 0 ? (
            <div className="skill-drawer__empty">
              <span className="material-symbols-outlined" style={{ fontSize: '2rem', opacity: 0.4 }}>check_circle</span>
              <p>현재 비활성화된 스킬이 없습니다.<br />모든 스킬이 활성화 상태입니다.</p>
            </div>
          ) : (
            availableSkills.map((skill) => (
              <div
                key={skill.id}
                className="skill-drawer__item"
                onClick={() => handleAddSkill(skill)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSkill(skill)}
              >
                <span
                  className="material-symbols-outlined skill-drawer__item-icon"
                  style={{ color: skill.color }}
                >
                  {skill.icon}
                </span>
                <div className="skill-drawer__item-info">
                  <div className="skill-drawer__item-name">{skill.name}</div>
                  <div className="skill-drawer__item-desc">{skill.description}</div>
                </div>
                <span
                  className={`layer-badge layer-badge--${skill.layer === 1 ? 'engine' : 'domain'}`}
                  style={{ marginRight: '0.25rem' }}
                >
                  {LAYER_LABEL[skill.layer]}
                </span>
                <span className="material-symbols-outlined skill-drawer__item-add">
                  add_circle
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
