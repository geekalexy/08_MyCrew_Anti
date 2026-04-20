// src/store/agentStore.js — Phase 16: 동적 메타데이터(agentMeta) 스토어 전환 & 5인 AI Crew 체제
import { create } from 'zustand';
import { SKILL_REGISTRY } from '../data/skillRegistry';

// 활동 타입 → 한글 레이블 맵핑
export const ACTIVITY_LABEL = {
  THINKING: '생각 중',
  EXPLORED: '파일 탐색 중',
  EDIT:     '작성 중',
  WORKED:   '작업 완료',
};

// 5인의 초기 메타데이터 (동적 관리를 위해 스토어 내부 initialState로 편입)
const INITIAL_AGENT_META = {
  ari: {
    name: 'ARI',
    role: '공유 비서 · 라우터',
    skills: ['태스크 접수', '팀 라우팅', '사용자 대화'],
    avatar: '/avatars/ari.svg',
    model: 'Gemini Flash',
    teamGroup: 'independent',
    experimentRole: '사용자 ⇔ 팀 가교 (팀 외부 독립)',
  },
  nova: {
    name: 'NOVA',
    role: '이미지 크리에이터',
    skills: ['NanoBanana 프롬프팅', 'Imagen 3 생성', '이미지 벤치마크'],
    avatar: '/avatars/nova.svg',
    model: 'Gemini Flash',
    teamGroup: 'A',
    experimentRole: 'Team A — 이미지 실무',
  },
  lily: {
    name: 'LILY',
    role: '영상 프로듀서',
    skills: ['Remotion 코딩', 'React 컴포지션', '영상 파이프라인'],
    avatar: '/avatars/lily.png',
    model: 'Claude Sonnet 4.6',
    teamGroup: 'A',
    experimentRole: 'Team A — 영상/코드 실무',
  },
  ollie: {
    name: 'OLLIE',
    role: '적대적 판관',
    skills: ['비판적 검토', '오류 탐지', '품질 심사'],
    avatar: '/avatars/ollie.svg',
    model: 'Claude Opus',
    teamGroup: 'A',
    experimentRole: 'Team A — 적대적 판관 (Phase 2·4)',
  },
  lumi: {
    name: 'LUMI',
    role: '이미지 크리에이터',
    skills: ['NanoBanana 프롬프팅', 'Imagen 3 생성', 'SKILL.md 학습'],
    avatar: '/avatars/lumi.svg',
    model: 'Gemini Flash',
    teamGroup: 'B',
    experimentRole: 'Team B — 이미지 실무',
  },
  pico: {
    name: 'PICO',
    role: '영상 프로듀서',
    skills: ['Remotion 코딩', 'React 컴포지션', '영상 파이프라인'],
    avatar: '/avatars/pico.svg',
    model: 'Claude Sonnet 4.6',
    teamGroup: 'B',
    experimentRole: 'Team B — 영상/코드 실무',
  },
  luna: {
    name: 'LUNA',
    role: '협력 합성자',
    skills: ['결과물 통합', '지식 동기화', 'CKS 프로토콜'],
    avatar: '/avatars/luna.png',
    model: 'Claude Opus',
    teamGroup: 'B',
    experimentRole: 'Team B — 협력적 합성자 (Phase 2·4)',
  },
};

// [v2.0] 팀 레지스트리 — OrgView 그룹핑 기준
export const TEAMS_REGISTRY = {
  A: {
    id: 'A', name: 'Team A', type: '적대적 대조군',
    icon: '⛔', color: '#ffb963', projectBadge: '소시안 CKS 실험',
  },
  B: {
    id: 'B', name: 'Team B', type: '협력적 CKS',
    icon: '🟢', color: '#4ade80', projectBadge: '소시안 Plan C 캠페인',
  },
  independent: {
    id: 'independent', name: '독립 심사관', type: '독립',
    icon: '⚖️', color: 'var(--brand)', projectBadge: '',
  },
};

export const useAgentStore = create((set) => ({
  // 팀 그룹 메타데이터 (수정 가능하도록 상태화)
  teamsRegistry: {
    A: { id: 'A', name: 'Team A', type: '적대적 대조군', icon: '⛔', color: '#ff6b6b', projectBadge: 'CKS 실험 — 적대적 시나리오' },
    B: { id: 'B', name: 'Team B', type: 'CKS 협력 실험군', icon: '🌙', color: '#4ade80', projectBadge: 'CKS 실험 — 협력 통합 시나리오' },
    independent: { id: 'independent', name: '독립 라우터', type: '라우팅', icon: '⚡', color: 'var(--brand)', projectBadge: '' },
  },
  updateTeamRegistry: (teamKey, updates) => set((s) => ({
    teamsRegistry: {
      ...s.teamsRegistry,
      [teamKey]: { ...s.teamsRegistry[teamKey], ...updates }
    }
  })),

  // 동적 메타데이터 (이름, 이미지 수정 등을 위해 상태화)
  agentMeta: INITIAL_AGENT_META,
  
  updateAgentMeta: (agentId, updates) =>
    set((s) => ({
      agentMeta: {
        ...s.agentMeta,
        [agentId]: { ...s.agentMeta[agentId], ...updates },
      },
    })),

  // 신규 에이전트 생성
  addAgent: (roleDesc, teamGroup = 'B') =>
    set((s) => {
      const newId = `crew_${Date.now()}`;
      const newName = `NEW_CREW_${Math.floor(Math.random() * 100)}`;
      return {
        agentMeta: {
          ...s.agentMeta,
          [newId]: {
            name: newName,
            role: roleDesc,
            skills: ['신규 배정 업무'],
            avatar: '/avatars/pico.svg',
            model: 'Claude Sonnet 4.6 (Thinking)',
            teamGroup,
            experimentRole: '신규 크루',
          }
        },
        agents: {
          ...s.agents,
          [newId]: { status: 'idle', lastHeartbeat: Date.now() }
        }
      };
    }),

  // { agentId: { status: 'active'|'idle', lastHeartbeat } }
  agents: {},
  selectedAgentId: null,   // null = 전체 뷰, agentId = 해당 에이전트 단독 뷰

  /**
   * activeTaskMap: Map<taskId(string), { type: 'THINKING'|'EXPLORED'|'EDIT', since: timestamp }>
   */
  activeTaskMap: new Map(),

  syncAgentStates: (stateMap) =>
    set((s) => ({ agents: { ...s.agents, ...stateMap } })),

  setAgentStatus: (agentId, status) =>
    set((s) => ({
      agents: {
        ...s.agents,
        [agentId]: { ...(s.agents[agentId] || {}), status, lastHeartbeat: Date.now() },
      },
    })),

  // ─── [Phase 17-4] 스킬 관리 (DB 연동) ───
  fetchAgentSkills: async (agentId) => {
    try {
      const res = await fetch(`http://localhost:4000/api/agents/${agentId}/skills`);
      const data = await res.json();

      // 레지스트리 기반 기본 skillConfig 생성 (DB에 없는 스킬 = 기본 inactive)
      const defaultConfig = {};
      Object.values(SKILL_REGISTRY).forEach((skill) => {
        defaultConfig[skill.id] = { active: false }; // 기본: 비활성화하여 유저가 직접 추가하게 유도
      });

      // DB에서 가져온 설정으로 덮어쓰기
      if (data.status === 'ok') {
        const dbConfig = {};
        data.skills.forEach((s) => {
          dbConfig[s.skill_id] = { active: s.is_active === 1 };
        });

        // Builtin 스킬은 DB 값과 무관하게 항상 active:true 강제
        Object.values(SKILL_REGISTRY)
          .filter((skill) => skill.isBuiltin)
          .forEach((skill) => {
            dbConfig[skill.id] = { active: true };
          });

        const skillConfig = { ...defaultConfig, ...dbConfig };
        set((s) => ({
          agentMeta: {
            ...s.agentMeta,
            [agentId]: { ...s.agentMeta[agentId], skillConfig },
          },
        }));
      } else {
        // API 실패 시 기본값으로 fallback
        set((s) => ({
          agentMeta: {
            ...s.agentMeta,
            [agentId]: { ...s.agentMeta[agentId], skillConfig: defaultConfig },
          },
        }));
      }
    } catch (err) {
      console.error('[Store] 스킬 조회 실패:', err);
    }
  },

  toggleAgentSkill: async (agentId, skillId, isActive) => {
    // 롤백을 위한 이전 상태 캡처
    const prevSkillConfig = useAgentStore.getState().agentMeta[agentId]?.skillConfig;

    try {
      // Optimistic update
      set((s) => {
        const currentConfig = s.agentMeta[agentId]?.skillConfig || {};
        return {
          agentMeta: {
            ...s.agentMeta,
            [agentId]: {
              ...s.agentMeta[agentId],
              skillConfig: { ...currentConfig, [skillId]: { active: isActive } }
            }
          }
        };
      });

      // API 호출
      const res = await fetch(`http://localhost:4000/api/agents/${agentId}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId, active: isActive })
      });
      const data = await res.json();
      if (data.status !== 'ok') throw new Error(data.message);
    } catch (err) {
      console.error('[Store] 스킬 토글 실패, 이전 상태로 롤백합니다:', err);
      // 실패 시 롤백
      set((s) => ({
        agentMeta: {
          ...s.agentMeta,
          [agentId]: { ...s.agentMeta[agentId], skillConfig: prevSkillConfig }
        }
      }));
    }
  },

  setActiveTask: (taskId, type = 'THINKING') =>
    set((s) => {
      const next = new Map(s.activeTaskMap);
      next.set(String(taskId), { type, since: Date.now() });
      return { activeTaskMap: next };
    }),

  clearActiveTask: (taskId) =>
    set((s) => {
      const next = new Map(s.activeTaskMap);
      next.delete(String(taskId));
      return { activeTaskMap: next };
    }),

  selectAgent: (agentId) => set({ selectedAgentId: agentId }),
  clearAgentSelection: () => set({ selectedAgentId: null }),
}));
