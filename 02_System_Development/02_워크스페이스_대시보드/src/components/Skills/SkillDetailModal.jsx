// src/components/Skills/SkillDetailModal.jsx — Phase 17-4: 스킬 상세 모달

/**
 * SkillDetailModal
 *
 * Props:
 *   skill      — SKILL_REGISTRY 스킬 객체
 *   isActive   — 현재 활성 여부
 *   isBuiltin  — 해제 불가 여부
 *   onClose    — 닫기 콜백
 *   onToggle   — (skillId, nextActive) => void
 */
export default function SkillDetailModal({ skill, isActive, isBuiltin, onClose, onToggle }) {
  if (!skill) return null;

  const handleToggle = () => {
    if (!isBuiltin) onToggle(skill.id, !isActive);
  };

  return (
    <div className="skill-detail-backdrop" onClick={onClose}>
      {/* 클릭 버블업 차단 */}
      <div
        className="skill-detail-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ borderColor: `${skill.color}44` }}
      >
        {/* 배경 수채화 글로우 */}
        <div
          className="skill-detail-modal__glow"
          style={{ background: skill.color }}
        />

        {/* 헤더 */}
        <div className="skill-detail-modal__header">
          <span
            className="material-symbols-outlined skill-detail-modal__icon"
            style={{ color: skill.color }}
          >
            {skill.icon}
          </span>
          <div>
            <h2 className="skill-detail-modal__title">{skill.name}</h2>
            <span
              className={`layer-badge layer-badge--${skill.layer === 3 ? 'infra' : skill.layer === 1 ? 'engine' : 'domain'}`}
              style={{ marginTop: '0.3rem', display: 'inline-flex' }}
            >
              L{skill.layer} {skill.layerLabel}
            </span>
          </div>
        </div>

        {/* 내장 안내 칩 */}
        {isBuiltin && (
          <div className="skill-detail-modal__builtin-notice">
            <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>lock</span>
            코어 시스템 레이어 스킬 — 개별 에이전트가 해제할 수 없습니다
          </div>
        )}

        {/* 전문(Full Description) */}
        <div className="skill-detail-modal__desc">
          {(skill.fullDescription || skill.description).split('\n').map((line, idx) => (
            <span key={idx}>
              {line}
              <br />
            </span>
          ))}
        </div>

        {/* 실행 규칙 */}
        {skill.rules && skill.rules.length > 0 && (
          <div className="skill-detail-modal__rules">
            {skill.rules.map((rule, i) => (
              <div key={i} className="skill-detail-modal__rule">
                <span className="skill-detail-modal__rule-num">{i + 1}.</span>
                <span>{rule}</span>
              </div>
            ))}
          </div>
        )}

        {/* 푸터 */}
        <div className="skill-detail-modal__footer">
          {/* 비내장 스킬에만 토글 표시 */}
          {!isBuiltin ? (
            <div className="skill-detail-modal__toggle-row">
              <span className="skill-detail-modal__toggle-label">
                {isActive ? '활성화됨' : '비활성화됨'}
              </span>
              <label className="skill-toggle">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={handleToggle}
                />
                <span className="skill-toggle__track">
                  <span className="skill-toggle__thumb" />
                </span>
              </label>
            </div>
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              상시 활성 (해제 불가)
            </span>
          )}

          <button
            className="btn btn--ghost btn--sm"
            onClick={onClose}
            style={{ fontWeight: 700 }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
