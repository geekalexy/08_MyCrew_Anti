// src/store/agentStore.js — Phase 16: 동적 메타데이터(agentMeta) 스토어 전환 & 5인 AI Crew 체제
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
    model: 'gemini-2.5-pro',  // 2026-04-28 Flash → Pro 격상 (지능 우선)
    teamGroup: 'independent',
    experimentRole: '사용자 ⇔ 팀 가교 (팀 외부 독립)',
  },
  nova: {
    name: 'NOVA',
    role: '이미지 크리에이터',
    skills: ['NanoBanana 프롬프팅', 'Imagen 3 생성', '이미지 벤치마크'],
    avatar: '/avatars/nova.svg',
    model: 'anti-gemini-3.1-pro-high', // AntiGravity 구독 — Gemini 3.1 Pro (High)
    teamGroup: 'A',
    experimentRole: 'Team A — 이미지 실무',
  },
  lily: {
    name: 'LILY',
    role: '영상 프로듀서',
    skills: ['Remotion 코딩', 'React 컴포지션', '영상 파이프라인'],
    avatar: '/avatars/lily.png',
    model: 'anti-claude-sonnet-4.6-thinking', // AntiGravity 구독 — Claude Sonnet 4.6 (Thinking)
    teamGroup: 'A',
    experimentRole: 'Team A — 영상/코드 실무',
  },
  ollie: {
    name: 'OLLIE',
    role: '적대적 판관',
    skills: ['비판적 검토', '오류 탐지', '품질 심사'],
    avatar: '/avatars/ollie.svg',
    model: 'anti-claude-opus-4.6-thinking', // AntiGravity 구독 — Claude Opus 4.6 (Thinking)
    teamGroup: 'A',
    experimentRole: 'Team A — 적대적 판관 (Phase 2·4)',
  },

  lumi: {
    name: 'LUMI',
    role: '이미지 크리에이터',
    skills: ['NanoBanana 프롬프팅', 'Imagen 3 생성', 'SKILL.md 학습'],
    avatar: '/avatars/lumi.svg',
    model: 'anti-gemini-3.1-pro-high', // AntiGravity 구독 — Gemini 3.1 Pro (High)
    teamGroup: 'B',
    experimentRole: 'Team B — 이미지 실무',
  },
  pico: {
    name: 'PICO',
    role: '영상 프로듀서',
    skills: ['Remotion 코딩', 'React 컴포지션', '영상 파이프라인'],
    avatar: '/avatars/pico.svg',
    model: 'anti-claude-sonnet-4.6-thinking', // AntiGravity 구독 — Claude Sonnet 4.6 (Thinking)
    teamGroup: 'B',
    experimentRole: 'Team B — 영상/코드 실무',
  },
  luna: {
    name: 'LUNA',
    role: '협력 합성자',
    skills: ['결과물 통합', '지식 동기화', 'CKS 프로토콜'],
    avatar: '/avatars/luna.png',
    model: 'anti-claude-opus-4.6-thinking', // AntiGravity 구독 — Claude Opus 4.6 (Thinking)
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

export const useAgentStore = create(
  persist(
    (set) => ({

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
  
  updateAgentMeta: (agentId, updates) => {
    // 백엔드 라우팅 로직과 실제 동기화를 위해 모델 변경 시 API 호출 (Fire-and-forget)
    if (updates.model) {
      const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4005';
      fetch(`${SERVER_URL}/api/agents/${agentId}/model`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: updates.model })
      }).catch(err => console.error('[Store] 모델 동기화 실패:', err));
    }
    
    set((s) => ({
      agentMeta: {
        ...s.agentMeta,
        [agentId]: { ...s.agentMeta[agentId], ...updates },
      },
    }));
  },

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
      const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4005';
      const res = await fetch(`${SERVER_URL}/api/agents/${agentId}/skills`);
      const data = await res.json();

      // 레지스트리 기반 기본 skillConfig 생성
      // defaultFor에 agentId가 포함되면 기본 active:true, 아니면 false
      const defaultConfig = {};
      Object.values(SKILL_REGISTRY).forEach((skill) => {
        const isDefault = skill.defaultFor?.includes(agentId) || skill.isBuiltin || skill.agentOnly === agentId;
        defaultConfig[skill.id] = { active: isDefault };
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
      const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4005';
      const res = await fetch(`${SERVER_URL}/api/agents/${agentId}/skills`, {
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
    }),
    {
      name: 'mycrew-agent-store', // localStorage key
      partialize: (state) => ({
        agentMeta: state.agentMeta,
        teamsRegistry: state.teamsRegistry,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // ── 에이전트 API 그룹 정의 ──────────────────────────────────────
        const GEMINI_GROUP    = ['ari', 'nova', 'lumi'];
        // ── ARI만 Gemini 직접 모델 / 나머지 크루는 AntiGravity 브릿지 모델 ──
        const ARI_MODELS    = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'];
        const ANTI_MODELS   = [
          'anti-gemini-3.1-pro-high', 'anti-gemini-3.1-pro-low', 'anti-gemini-3-flash',
          'anti-claude-sonnet-4.6-thinking', 'anti-claude-opus-4.6-thinking', 'anti-gpt-oss-120b',
        ];
        const CREW_AGENTS   = ['nova', 'lumi', 'lily', 'pico', 'ollie', 'luna'];

        // 에이전트별 올바른 기본값 (AntiGravity 구독 모델 기준)
        const CORRECT_DEFAULTS = {
          ari:   'gemini-2.5-pro',                 // ARI: Gemini Pro (2026-04-28 격상)
          nova:  'anti-gemini-3.1-pro-high',        // AntiGravity: Gemini 3.1 Pro (High)
          lumi:  'anti-gemini-3.1-pro-high',        // AntiGravity: Gemini 3.1 Pro (High)
          lily:  'anti-claude-sonnet-4.6-thinking', // AntiGravity: Claude Sonnet 4.6 (Thinking)
          pico:  'anti-claude-sonnet-4.6-thinking', // AntiGravity: Claude Sonnet 4.6 (Thinking)
          ollie: 'anti-claude-opus-4.6-thinking',   // AntiGravity: Claude Opus 4.6 (Thinking)
          luna:  'anti-claude-opus-4.6-thinking',   // AntiGravity: Claude Opus 4.6 (Thinking)
        };

        Object.keys(state.agentMeta || {}).forEach((agentId) => {
          const model = state.agentMeta[agentId]?.model;
          if (!model) return;

          const isCrew = CREW_AGENTS.includes(agentId);

          // 크루 에이전트에 구 식별자(gemini-2.5-* 또는 claude-*) 저장된 경우 → anti-* 교정
          if (isCrew && (ARI_MODELS.includes(model) || ['claude-opus-4-6','claude-sonnet-4-6'].includes(model))) {
            console.warn(`[AgentStore] 브릿지 모델 교정: ${agentId} (${model} → ${CORRECT_DEFAULTS[agentId]})`);
            state.agentMeta[agentId].model = CORRECT_DEFAULTS[agentId];
          }
          // ARI에 anti-* 모델 저장된 경우 → flash로 교정
          else if (agentId === 'ari' && ANTI_MODELS.includes(model)) {
            console.warn(`[AgentStore] ARI 모델 교정: ${model} → gemini-2.5-pro`);
            state.agentMeta[agentId].model = 'gemini-2.5-pro';
          }
          // 완전히 알 수 없는 값 → 기본값으로 교정
          else if (!ARI_MODELS.includes(model) && !ANTI_MODELS.includes(model)) {
            state.agentMeta[agentId].model = CORRECT_DEFAULTS[agentId] || 'gemini-2.5-pro';
          }
        });
      },

    }
  )
);

