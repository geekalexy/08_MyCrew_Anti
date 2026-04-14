// src/components/Skills/SkillCard.jsx — Phase 17-4: 스킬 카드 (토글 + 자물쇠 UI)

const LAYER_CLASS = {
  3: 'infra',
  1: 'engine',
  2: 'domain',
};

/**
 * SkillToggle — 커스텀 토글 스위치
 * onClick에서 버블링 차단 + 토글 처리를 모두 수행
 */
function SkillToggle({ checked, onToggle, disabled }) {
  const handleClick = (e) => {
    e.stopPropagation(); // 카드 클릭(모달) 버블링 완전 차단
    e.preventDefault();  // label 기본 동작 방지
    if (!disabled) onToggle();
  };

  return (
    <label
      className={`skill-toggle${disabled ? ' skill-toggle--disabled' : ''}`}
      onClick={handleClick}
    >
      {/* readOnly + checked: React controlled, 실제 토글은 onToggle 콜백으로 처리 */}
      <input type="checkbox" checked={checked} readOnly />
      <span className="skill-toggle__track">
        <span className="skill-toggle__thumb" />
      </span>
    </label>
  );
}

/**
 * SkillCard — 스킬 단위 카드
 *
 * Props:
 *   skill      — SKILL_REGISTRY의 스킬 객체
 *   isActive   — 현재 활성화 여부 (boolean)
 *   isBuiltin  — 해제 불가 여부 (boolean)
 *   onToggle   — (skillId, nextActive) => void
 *   onClick    — 상세 모달 오픈 콜백 () => void
 */
export default function SkillCard({ skill, isActive, isBuiltin, onToggle, onClick }) {
  const layerKey = LAYER_CLASS[skill.layer] || 'engine';

  const cardClass = [
    'skill-card',
    isBuiltin ? 'skill-card--builtin' : (isActive ? 'skill-card--active' : 'skill-card--inactive'),
  ].join(' ');

  const handleToggle = () => {
    if (!isBuiltin) onToggle(skill.id, !isActive);
  };

  const handleCardClick = () => {
    onClick(skill);
  };

  return (
    <div className={cardClass} onClick={handleCardClick} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}>

      {/* 헤더 행: 아이콘 + 이름 + 토글 or 자물쇠 */}
      <div className="skill-card__header">
        <div className="skill-card__title-row">
          <span
            className="material-symbols-outlined skill-card__icon"
            style={{ color: skill.color }}
          >
            {skill.icon}
          </span>
          <span className="skill-card__name">{skill.name}</span>
        </div>

        {isBuiltin ? (
          <span className="material-symbols-outlined skill-card__lock" title="코어 시스템 스킬: 해제 불가">
            lock
          </span>
        ) : (
          <SkillToggle
            checked={isActive}
            onToggle={handleToggle}
            disabled={false}
          />
        )}
      </div>


      {/* 설명 */}
      <p className="skill-card__desc">{skill.description}</p>

      {/* 푸터: 레이어 뱃지 */}
      <div className="skill-card__footer">
        <span className={`layer-badge layer-badge--${layerKey}`}>
          L{skill.layer} {skill.layerLabel}
        </span>
      </div>
    </div>
  );
}
