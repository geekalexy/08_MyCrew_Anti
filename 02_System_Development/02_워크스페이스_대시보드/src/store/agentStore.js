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
    name: 'ARI (비서)',
    role: 'AI 오케스트레이터',
    skills: ['업무 라우팅', '태스크 큐 관리', '엔진 조율'],
    avatar: '/avatars/ari.svg',
    model: 'Gemini 3.1 Pro (High)',
  },
  nova: {
    name: 'NOVA (CMO)',
    role: '최고 마케팅 책임자 (CMO)',
    skills: ['마케팅 기획', '트렌드 수집', '카피라이팅'],
    avatar: '/avatars/nova.svg',
    model: 'Claude Sonnet 4.6 (Thinking)',
  },
  lumi: {
    name: 'LUMI (디자이너)',
    role: '수석 디자이너',
    skills: ['UI/UX 기획', '이미지 검수', '디자인 토큰'],
    avatar: '/avatars/lumi.svg',
    model: 'Gemini 3 Flash',
  },
  pico: {
    name: 'PICO (컨텐츠매니저)',
    role: '콘텐츠 매니저',
    skills: ['SEO 포맷팅', '블로그 작성', '텍스트 윤문'],
    avatar: '/avatars/pico.svg',
    model: 'Claude Sonnet 4.6 (Thinking)',
  },
  ollie: {
    name: 'OLLIE (분석가)',
    role: '데이터 분석가',
    skills: ['데이터 조회', '파이썬 실행', '시각화 코드'],
    avatar: '/avatars/ollie.svg',
    model: 'Claude Opus 4.6 (Thinking)',
  },
};

export const useAgentStore = create((set) => ({
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
  addAgent: (roleDesc) =>
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
            avatar: '/avatars/pico.svg', // 기본 아바타
            model: 'Claude Sonnet 4.6 (Thinking)', // 기본 모델
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
