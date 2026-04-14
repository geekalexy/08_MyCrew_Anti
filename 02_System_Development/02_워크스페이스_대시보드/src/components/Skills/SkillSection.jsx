// src/components/Skills/SkillSection.jsx — Phase 17-4: 스킬 섹션 오케스트레이터
import { useState } from 'react';
import { useAgentStore } from '../../store/agentStore';
import { SKILL_REGISTRY } from '../../data/skillRegistry';
import SkillCard from './SkillCard';
import SkillDetailModal from './SkillDetailModal';
import SkillAddDrawer from './SkillAddDrawer';

// 레이어 렌더 순서 및 레이블
const LAYER_ORDER = [
  { layer: 3, label: 'Layer 3 · INFRA (코어 시스템)' },
  { layer: 1, label: 'Layer 1 · ENGINE (전문 실행)' },
  { layer: 2, label: 'Layer 2 · DOMAIN (도메인 특화)' },
];

/**
 * SkillSection
 *
 * Props:
 *   agentId — 현재 에이전트 ID
 */
export default function SkillSection({ agentId }) {
  const { agentMeta, toggleAgentSkill } = useAgentStore();
  const skillConfig = agentMeta[agentId]?.skillConfig || {};

  const [selectedSkill, setSelectedSkill] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 스킬 활성 여부 확인 (Builtin은 항상 true, 나머지는 skillConfig 참조)
  const getIsActive = (skill) => {
    if (skill.isBuiltin) return true;
    return skillConfig[skill.id]?.active !== false; // undefined → true (기본 활성)
  };

  // 레이어별 스킬 그룹핑
  const skillsByLayer = LAYER_ORDER.map(({ layer, label }) => ({
    layer,
    label,
    skills: Object.values(SKILL_REGISTRY).filter((s) => s.layer === layer),
  })).filter((group) => group.skills.length > 0);

  // 이미 장착된 스킬 ID 목록 (Drawer에서 중복 제거용)
  const installedSkillIds = Object.keys(SKILL_REGISTRY);

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
            onClick={() => setIsDrawerOpen(true)}
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
                const isActive = getIsActive(skill);
                const isBuiltin = !!skill.isBuiltin;
                return (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    isActive={isActive}
                    isBuiltin={isBuiltin}
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
            setSelectedSkill(null); // 토글 후 모달 닫기
          }}
        />
      )}

      {/* 스킬 추가 Drawer (Local) */}
      <SkillAddDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        agentId={agentId}
        installedSkillIds={installedSkillIds}
      />
    </>
  );
}
