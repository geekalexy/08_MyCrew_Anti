// src/components/Skills/SkillAddDrawer.jsx — v2: 전체 스킬 라이브러리 리스트 + 장착/해제 토글
import { useRef, useEffect } from 'react';
import { useAgentStore } from '../../store/agentStore';
import { SKILL_REGISTRY } from '../../data/skillRegistry';

/**
 * SkillAddDrawer — 에이전트에 스킬을 장착/해제하는 슬라이드형 우측 패널
 *  - ALL non-builtin 스킬을 "장착됨 / 미장착" 섹션으로 구분 표시
 *  - 장착됨 → [해제] 버튼 / 미장착 → [장착] 버튼
 *
 * Props:
 *   isOpen           — 드로어 열림 여부
 *   onClose          — 닫기 콜백
 *   agentId          — 현재 에이전트 ID
 */
export default function SkillAddDrawer({ isOpen, onClose, agentId }) {
  const { agentMeta, toggleAgentSkill } = useAgentStore();
  const bodyRef = useRef(null);

  // 드로어가 열릴 때 스킬 리스트 최상단으로 자동 스크롤
  useEffect(() => {
    if (isOpen && bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  }, [isOpen]);
  const skillConfig = agentMeta[agentId]?.skillConfig || {};

  // non-Builtin 스킬 전체 + 활성 여부 판단
  const allSkills = Object.values(SKILL_REGISTRY)
    .filter((s) => !s.isBuiltin)
    .map((skill) => ({
      ...skill,
      isActive: skill.isRequired ? true : skillConfig[skill.id]?.active !== false,
    }));

  const equippedSkills  = allSkills.filter((s) => s.isActive);
  const availableSkills = allSkills.filter((s) => !s.isActive);

  const LAYER_LABEL = { 1: 'ENGINE', 2: 'DOMAIN', 3: 'INFRA', 4: 'WORKFLOW' };
  const LAYER_COLOR  = { 1: 'var(--brand)', 2: '#ffb963', 3: '#4ecb71', 4: '#a78bfa' };

  const handleToggle = (skill) => {
    toggleAgentSkill(agentId, skill.id, !skill.isActive);
  };

  /* ── 스킬 행 렌더 ── */
  const SkillRow = ({ skill }) => (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.75rem 0.85rem',
        borderRadius: '10px',
        background: skill.isActive
          ? 'rgba(100,135,242,0.06)'
          : 'rgba(255,255,255,0.02)',
        border: `1px solid ${skill.isActive ? 'rgba(100,135,242,0.18)' : 'rgba(255,255,255,0.06)'}`,
        marginBottom: '0.45rem',
        transition: 'all 0.15s',
      }}
    >
      {/* 아이콘 */}
      <span
        className="material-symbols-outlined"
        style={{ fontSize: '1.2rem', color: skill.color, flexShrink: 0 }}
      >
        {skill.icon}
      </span>

      {/* 이름 + 설명 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.82rem', fontWeight: 700,
          color: 'var(--text-primary)', marginBottom: '0.15rem',
          display: 'flex', alignItems: 'center', gap: '0.4rem',
        }}>
          {skill.name}
          <span style={{
            fontSize: '0.58rem', fontWeight: 700,
            color: LAYER_COLOR[skill.layer],
            background: `${LAYER_COLOR[skill.layer]}18`,
            border: `1px solid ${LAYER_COLOR[skill.layer]}30`,
            padding: '1px 5px', borderRadius: '4px',
          }}>
            {LAYER_LABEL[skill.layer]}
          </span>
        </div>
        <div style={{
          fontSize: '0.7rem', color: 'var(--text-muted)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {skill.description}
        </div>
      </div>

      {/* 장착/해제 버튼 or 필수 배지 */}
      {skill.isRequired ? (
        <span style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: '0.25rem',
          padding: '0.3rem 0.65rem',
          borderRadius: '7px',
          border: '1px solid rgba(167,139,250,0.35)',
          background: 'rgba(167,139,250,0.1)',
          color: '#a78bfa',
          fontSize: '0.7rem', fontWeight: 800,
          whiteSpace: 'nowrap', letterSpacing: '0.03em',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>lock</span>
          필수
        </span>
      ) : (
        <button
          onClick={() => handleToggle(skill)}
          style={{
            flexShrink: 0,
            padding: '0.3rem 0.7rem',
            borderRadius: '7px',
            border: '1px solid',
            borderColor: skill.isActive ? 'rgba(248,113,113,0.35)' : 'rgba(100,135,242,0.35)',
            background: skill.isActive ? 'rgba(248,113,113,0.08)' : 'rgba(100,135,242,0.1)',
            color: skill.isActive ? '#f87171' : 'var(--brand)',
            fontSize: '0.7rem', fontWeight: 700,
            cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: '0.25rem',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>
            {skill.isActive ? 'remove_circle' : 'add_circle'}
          </span>
          {skill.isActive ? '해제' : '장착'}
        </button>
      )}
    </div>
  );

  /* ── 섹션 라벨 ── */
  const SectionLabel = ({ icon, label, count, color }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.45rem',
      fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em',
      textTransform: 'uppercase', color: 'var(--text-muted)',
      marginBottom: '0.6rem', marginTop: '0.2rem',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', color }}>
        {icon}
      </span>
      {label}
      <span style={{
        background: `${color}18`, color, border: `1px solid ${color}30`,
        borderRadius: '99px', padding: '0 6px', fontSize: '0.65rem', fontWeight: 800,
      }}>
        {count}
      </span>
    </div>
  );

  return (
    <>
      {/* 배경 딤 오버레이 */}
      {isOpen && (
        <div
          className="skill-drawer__overlay"
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 'calc(var(--z-drawer-local, 200) - 1)' }}
        />
      )}

      {/* 드로어 본체 */}
      <div className={`skill-drawer${isOpen ? ' skill-drawer--open' : ''}`}>

        {/* 헤더 */}
        <div className="skill-drawer__header">
          <h3 className="skill-drawer__title">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.4rem', color: 'var(--brand)' }}
            >
              extension
            </span>
            스킬 라이브러리
          </h3>
          <button className="skill-drawer__close" onClick={onClose} aria-label="닫기">
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>close</span>
          </button>
        </div>

        {/* 안내 배너 */}
        <div className="skill-drawer__body" ref={bodyRef}>
          <p style={{
            margin: '0 0 1rem',
            fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.55,
            background: 'rgba(180,197,255,0.05)', padding: '0.75rem 0.9rem',
            borderRadius: '8px', border: '1px dashed rgba(180,197,255,0.2)',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '0.95rem', verticalAlign: 'middle', marginRight: '0.3rem', color: 'var(--brand)' }}>info</span>
            장착/해제는 즉시 반영됩니다. 다음 태스크부터 적용됩니다.
          </p>

          {/* ── 장착됨 섹션 ── */}
          {equippedSkills.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <SectionLabel
                icon="check_circle"
                label="장착됨"
                count={equippedSkills.length}
                color="var(--status-active)"
              />
              {equippedSkills.map((skill) => (
                <SkillRow key={skill.id} skill={skill} />
              ))}
            </div>
          )}

          {/* ── 미장착 섹션 ── */}
          {availableSkills.length > 0 && (
            <div>
              <SectionLabel
                icon="add_circle"
                label="장착 가능"
                count={availableSkills.length}
                color="var(--brand)"
              />
              {availableSkills.map((skill) => (
                <SkillRow key={skill.id} skill={skill} />
              ))}
            </div>
          )}

          {/* 빈 상태 */}
          {allSkills.length === 0 && (
            <div className="skill-drawer__empty">
              <span className="material-symbols-outlined" style={{ fontSize: '2rem', opacity: 0.4 }}>
                inventory_2
              </span>
              <p>등록된 스킬이 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
