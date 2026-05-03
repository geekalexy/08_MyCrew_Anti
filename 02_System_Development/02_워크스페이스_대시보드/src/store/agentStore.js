// src/store/agentStore.js — Phase 16: 동적 메타데이터(agentMeta) 스토어 전환 & 5인 AI Crew 체제
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SKILL_REGISTRY } from '../data/skillRegistry';
import { ROLE_REGISTRY } from '../data/roleRegistry';


// 활동 타입 → 한글 레이블 맵핑
export const ACTIVITY_LABEL = {
  THINKING: '생각 중',
  EXPLORED: '파일 탐색 중',
  EDIT:     '작성 중',
  WORKED:   '작업 완료',
};

// [Phase 34] ID 체계 v2.0: {team}_{role} 형식
// platform: assistant  /  dev: dev_*  /  mkt: mkt_*
// 같은 역할이라도 팀이 다르면 완전히 다른 객체 (독립 메모리/컨텍스트)
const INITIAL_AGENT_META = {
  // ── Platform ──
  assistant: {
    name: 'ARI',
    role: '비서',
    skills: ['태스크 접수', '팀 라우팅', '사용자 대화'],
    avatar: '/avatars/ari.svg',
    model: 'gemini-2.5-pro',
    teamGroup: 'platform',
    experimentRole: '사용자 ⇔ 팀 가교 (전체 공유)',
  },

  // ── 개발팀 (dev_*) ──
  dev_fullstack: {
    name: '노바',
    role: '풀스택 엔지니어',
    skills: ['Frontend', 'Backend', 'DevOps', 'CI/CD'],
    avatar: '/avatars/nova.svg',
    model: 'anti-gemini-3.1-pro-high',
    teamGroup: 'dev',
    experimentRole: '개발팀 — 풀스택 개발',
  },
  dev_ux: {
    name: '루미',
    role: 'UI/UX 디자이너',
    skills: ['Figma', 'Interaction Design', 'Design System'],
    avatar: '/avatars/lumi.svg',
    model: 'anti-gemini-3.1-pro-high',
    teamGroup: 'dev',
    experimentRole: '개발팀 — UI/UX 디자인',
  },
  dev_senior: {
    name: '맔리',
    role: '시니어 엔지니어',
    skills: ['Full Stack', 'Code Review', 'Mentoring'],
    avatar: '/avatars/lily.png',
    model: 'anti-claude-sonnet-4.6-thinking',
    teamGroup: 'dev',
    experimentRole: '개발팀 — 핵심 개발·코드 리뷰',
  },
  dev_backend: {
    name: '피코',
    role: '백엔드 엔지니어',
    skills: ['API Design', 'Node.js', 'Database'],
    avatar: '/avatars/pico.svg',
    model: 'anti-claude-sonnet-4.6-thinking',
    teamGroup: 'dev',
    experimentRole: '개발팀 — API·DB 구축',
  },
  dev_qa: {
    name: '올리',
    role: 'QA 엔지니어',
    skills: ['Test Design', 'Bug Tracking', 'E2E Test'],
    avatar: '/avatars/ollie.svg',
    model: 'anti-claude-opus-4.6-thinking',
    teamGroup: 'dev',
    experimentRole: '개발팀 — 품질 검증·테스트',
  },
  dev_advisor: {
    name: '루나',
    role: '테크 어드바이저',
    skills: ['Architecture Review', 'Tech Advisory', 'Risk Assessment'],
    avatar: '/avatars/luna.png',
    model: 'anti-claude-opus-4.6-thinking',
    teamGroup: 'dev',
    experimentRole: '개발팀 — 아키텍쳐 자문 (Prime)',
  },

  // ── 마케팅팀 (mkt_*) ──
  mkt_lead: {
    name: '마케팅 리더',
    role: '마케팅 리더',
    skills: ['Campaign Lead', 'Brand Strategy', 'Performance'],
    avatar: '/avatars/nova.svg',
    model: 'anti-gemini-3.1-pro-high',
    teamGroup: 'mkt',
    experimentRole: '마케팅팀 — 쾔드 운영 총괄',
  },
  mkt_planner: {
    name: '기획자',
    role: '기획자',
    skills: ['Campaign Planning', 'Content Strategy', 'Roadmap'],
    avatar: '/avatars/pico.svg',
    model: 'anti-claude-sonnet-4.6-thinking',
    teamGroup: 'mkt',
    experimentRole: '마케팅팀 — 캐립페인 기획',
  },
  mkt_designer: {
    name: '디자이너',
    role: '디자이너',
    skills: ['Brand Design', 'Ad Creative', 'SNS Visual'],
    avatar: '/avatars/lumi.svg',
    model: 'anti-gemini-3.1-pro-high',
    teamGroup: 'mkt',
    experimentRole: '마케팅팀 — 비주얼 디자인',
  },
  mkt_analyst: {
    name: '분석가',
    role: '분석가',
    skills: ['Analytics', 'A/B Test', 'ROAS'],
    avatar: '/avatars/ollie.svg',
    model: 'anti-claude-opus-4.6-thinking',
    teamGroup: 'mkt',
    experimentRole: '마케팅팀 — 성과 지표 분석',
  },
  mkt_video: {
    name: '영상 디렉터',
    role: '영상 디렉터',
    skills: ['Video Production', 'Editing', 'YouTube', 'Shorts'],
    avatar: '/avatars/lily.png',
    model: 'anti-claude-sonnet-4.6-thinking',
    teamGroup: 'mkt',
    experimentRole: '마케팅팀 — 영상 제작·연출',
  },
  mkt_pm: {
    name: 'PM',
    role: 'PM',
    skills: ['Project Management', 'KPI', 'Sprint'],
    avatar: '/avatars/luna.png',
    model: 'anti-claude-opus-4.6-thinking',
    teamGroup: 'mkt',
    experimentRole: '마케팅팀 — 프로젝트 관리',
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

  // [Phase 35] 프로젝트별 에이전트 로드
  fetchProjectAgents: async (projectId) => {
    if (!projectId) return;
    try {
      const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4005';
      const res = await fetch(`${SERVER_URL}/api/projects/${projectId}/agents`);
      if (res.ok) {
        const data = await res.json();
        const newAgentMeta = {};
        const newAgents = {};
        data.forEach(agent => {
          // [BUG-01 FIX] agentMeta 키는 role_id 기준 (OrgView/Sidebar와 동일한 키 체계)
          // instanceId(proj-xxx-role_id)는 메타 내부에 보관
          const roleKey = (agent.role_id || agent.id || '').toLowerCase();
          const roleId = (agent.role_id || '').toLowerCase();

          // [BUG-02 FIX] role_id null-safe 처리
          const teamGroup = roleId.startsWith('mkt_') ? 'mkt'
            : (roleId === 'assistant' ? 'platform' : 'dev');

          newAgentMeta[roleKey] = {
            name: agent.nickname || agent.role_id,
            role: ROLE_REGISTRY[roleId]?.mainRole || agent.role_id,
            avatar: agent.avatar || '/avatars/nova.svg',
            model: agent.model_id,
            experimentRole: agent.role_description,
            teamGroup,
            instanceId: agent.id,   // 원본 instanceId 보존 (프로필 수정 API용)
            skillConfig: {},
          };
          newAgents[roleKey] = { status: 'idle', lastHeartbeat: Date.now() };
        });
        
        // [BUG-06 FIX] 이전 프로젝트 에이전트 잔류 방지: 플랫폼 에이전트만 유지
        const platformMeta = Object.fromEntries(
          Object.entries(INITIAL_AGENT_META).filter(([k]) =>
            (INITIAL_AGENT_META[k]?.teamGroup === 'platform') || k === 'assistant'
          )
        );
        set((s) => ({
          agentMeta: { ...platformMeta, ...newAgentMeta },
          agents: { ...newAgents },  // 이전 상태 완전 교체
        }));
      }
    } catch (err) {
      console.error('[Store] 프로젝트 에이전트 조회 실패:', err);
    }
  },

  clearAgents: () => set({ agentMeta: INITIAL_AGENT_META, agents: {} }),

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

        // [Phase 33] Role ID 체계 기준
        const DEV_AGENTS = ['dev_fullstack', 'dev_ux', 'dev_senior', 'dev_backend', 'dev_qa', 'dev_advisor'];
        const MKT_AGENTS = ['mkt_lead', 'mkt_planner', 'mkt_designer', 'mkt_analyst', 'mkt_video', 'mkt_pm'];
        const CREW_AGENTS = [...DEV_AGENTS, ...MKT_AGENTS];

        // 에이전트별 기본 모델
        const CORRECT_DEFAULTS = {
          assistant:    'gemini-2.5-pro',
          // 개발팀
          dev_fullstack: 'anti-gemini-3.1-pro-high',
          dev_ux:        'anti-gemini-3.1-pro-high',
          dev_senior:    'anti-claude-sonnet-4.6-thinking',
          dev_backend:   'anti-claude-sonnet-4.6-thinking',
          dev_qa:        'anti-claude-opus-4.6-thinking',
          dev_advisor:   'anti-claude-opus-4.6-thinking',
          // 마케팅팀
          mkt_lead:      'anti-gemini-3.1-pro-high',
          mkt_planner:   'anti-claude-sonnet-4.6-thinking',
          mkt_designer:  'anti-gemini-3.1-pro-high',
          mkt_analyst:   'anti-claude-opus-4.6-thinking',
          mkt_video:     'anti-claude-sonnet-4.6-thinking',
          mkt_pm:        'anti-claude-opus-4.6-thinking',
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

