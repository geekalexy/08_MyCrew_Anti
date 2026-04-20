// src/components/Skills/SkillCard.jsx — Phase 17-4: 스킬 카드 (토글 + 자물쇠 UI)

const LAYER_CLASS = {
  3: 'infra',
  1: 'engine',
  2: 'domain',
  4: 'workflow',
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
 *   skill       — SKILL_REGISTRY의 스킬 객체
 *   isActive    — 현재 활성화 여부 (boolean)
 *   isBuiltin   — 해제 불가 여부 INFRA 전용 (boolean)
 *   isRequired  — 필수 스킬 (boolean) — WORKFLOW 스킬, 항상 활성
 *   onToggle    — (skillId, nextActive) => void
 *   onClick     — 상세 모달 오픈 콜백 () => void
 */
export default function SkillCard({ skill, isActive, isBuiltin, isRequired, onToggle, onClick }) {
  const layerKey = LAYER_CLASS[skill.layer] || 'engine';
  const locked   = isBuiltin || isRequired;

  const cardClass = [
    'skill-card',
    isBuiltin    ? 'skill-card--builtin'  :
    isRequired   ? 'skill-card--required' :
    isActive     ? 'skill-card--active'   : 'skill-card--inactive',
  ].join(' ');

  const handleToggle = () => {
    if (!locked) onToggle(skill.id, !isActive);
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

        {locked ? (
          <span
            className="material-symbols-outlined skill-card__lock"
            title={isBuiltin ? '코어 시스템 스킬: 해제 불가' : '필수 워크플로우 스킬: 해제 불가'}
          >
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

      {/* 푸터: 레이어 배지 + 담당 크루 (WORKFLOW만) */}
      <div className="skill-card__footer">
        <span className={`layer-badge layer-badge--${layerKey}`}>
          L{skill.layer} {skill.layerLabel}
        </span>
        {skill.crew && (
          <span style={{
            fontSize: '0.62rem', color: 'var(--text-muted)',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '4px', padding: '1px 5px',
          }}>
            @{skill.crew}
          </span>
        )}
        {isRequired && (
          <span style={{
            fontSize: '0.6rem', fontWeight: 800, color: '#a78bfa',
            background: 'rgba(167,139,250,0.12)',
            border: '1px solid rgba(167,139,250,0.3)',
            borderRadius: '4px', padding: '1px 5px', letterSpacing: '0.04em',
          }}>
            필수
          </span>
        )}
      </div>
    </div>
  );
}
