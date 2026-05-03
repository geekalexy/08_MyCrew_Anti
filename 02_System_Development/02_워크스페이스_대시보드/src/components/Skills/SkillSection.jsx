// src/components/Skills/SkillSection.jsx — Phase 17-4: 스킬 섹션 오케스트레이터
// [#4 Fix] 프로젝트 전환 시 스킬 상태 초기화를 위해 useEffect 추가
import { useState, useEffect } from 'react';
import { useAgentStore } from '../../store/agentStore';
import { SKILL_REGISTRY } from '../../data/skillRegistry';
import SkillCard from './SkillCard';
import SkillDetailModal from './SkillDetailModal';
import SkillAddDrawer from './SkillAddDrawer';

// 레이어 렌더 순서 및 레이블
const LAYER_ORDER = [
  { layer: 0, label: 'Layer 0 · CORE (기본 내장 엔진)' },
  { layer: 1, label: 'Layer 1 · ENGINE (전문 실행)' },
  { layer: 2, label: 'Layer 2 · DOMAIN (도메인 특화)' },
  { layer: 4, label: 'Layer 4 · WORKFLOW (멀티에이전트 워크플로우)' },
];

/**
 * SkillSection
 *
 * Props:
 *   agentId — 현재 에이전트 ID
 */
export default function SkillSection({ agentId, onOpenDrawer }) {
  const { agentMeta, toggleAgentSkill, fetchAgentSkills } = useAgentStore();
  const skillConfig = agentMeta[agentId]?.skillConfig || {};

  const [selectedSkill, setSelectedSkill] = useState(null);

  // [#4 Fix] 프로젝트 전환 시(agentId 변경) DB에서 스킬 상태 재로드 → 이전 프로젝트 상태 오염 방지
  useEffect(() => {
    if (agentId) fetchAgentSkills(agentId);
  }, [agentId]);

  // 스킬 활성 여부 확인
  // Builtin·Required는 항상 true (DB 무관)
  // 그 외: skillConfig에 명시된 값만 신뢰 — undefined이면 false (미장착)
  const getIsActive = (skill) => {
    if (skill.isBuiltin || skill.isRequired) return true;
    const config = skillConfig[skill.id];
    if (config === undefined) return false; // [SKILL-FIX] 기본값 false — DB 미장착 스킬은 비활성
    return config.active !== false;
  };

  // 레이어별 스킬 그룹핑 (agentOnly 필터 적용)
  const skillsByLayer = LAYER_ORDER.map(({ layer, label }) => ({
    layer,
    label,
    skills: Object.values(SKILL_REGISTRY).filter((s) =>
      s.layer === layer &&
      (!s.agentOnly || s.agentOnly === agentId)  // agentOnly 필드 없으면 전체 공개
    ),
  })).filter((group) => group.skills.length > 0);

  // 이미 장착된 스킬 ID 목록 — 삭제됨 (Drawer가 상위에서 관리)

  const handleToggle = (skillId, nextActive) => {
    toggleAgentSkill(agentId, skillId, nextActive);
  };

  const handleCardClick = (skill) => {
    setSelectedSkill(skill);
  };

  return (
    <>
      <div className="skill-section">
        {/* 섹션 헤더 */}
        <div className="skill-section__header">
          <div className="skill-section__title-row">
            <span className="material-symbols-outlined" style={{ color: '#ffb963', fontSize: '1.3rem' }}>
              extension
            </span>
            <h3 className="skill-section__title">Autonomous Skills Library</h3>
          </div>
          <button
            className="skill-section__add-btn"
            onClick={() => onOpenDrawer?.()}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>add</span>
            스킬 추가
          </button>
        </div>

        <p className="skill-section__desc">
          에이전트에게 주입된 전문 실행 능력과 외부 도구 권한 설정입니다.
          스킬을 클릭하면 상세 설명과 실행 규칙을 확인할 수 있습니다.
        </p>

        {/* 레이어별 스킬 그룹 */}
        {skillsByLayer.map(({ layer, label, skills }) => (
          <div key={layer}>
            <p className="skill-section__layer-label">{label}</p>
            <div className="skill-grid">
              {skills.map((skill) => {
                const isActive   = getIsActive(skill);
                const isBuiltin  = !!skill.isBuiltin;
                const isRequired = !!skill.isRequired;
                return (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    isActive={isActive}
                    isBuiltin={isBuiltin}
                    isRequired={isRequired}
                    onToggle={handleToggle}
                    onClick={handleCardClick}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 스킬 상세 모달 */}
      {selectedSkill && (
        <SkillDetailModal
          skill={selectedSkill}
          isActive={getIsActive(selectedSkill)}
          isBuiltin={!!selectedSkill.isBuiltin}
          onClose={() => setSelectedSkill(null)}
          onToggle={(skillId, nextActive) => {
            handleToggle(skillId, nextActive);
            setSelectedSkill(null);
          }}
        />
      )}
    </>
  );
}
