// src/store/uiStore.js — UI 상태 (theme persist, 나머지는 휘발성)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useUiStore = create(
  persist(
    (set) => ({
      theme: 'dark',
      isLogPanelOpen: true,
      activeLogTab: 'time',
      isBoardReadOnly: false,
      // Phase 10: 멀티뷰 라우팅  (B-1 반영: 'organization' 포함)
      currentView: 'projects', // 'projects' | 'agent-detail' | 'archive' | 'settings' | 'organization'
      
      // Phase 11: 태스크 포커스 및 상세 모달 상태
      focusedTaskId: null,      // 타임라인 필터링용
      activeDetailTaskId: null, // 상세 모달 오픈용

      workspaceName: 'Socian',
      workspaceLogo: null,
      teamPageTitle: 'Team',
      teamPageSubtitle: 'AI 팀 구성원 및 프로젝트 현황',
      
      // Phase 17-3: 온보딩 체크
      hasCompletedOnboarding: false,

      // C4: DOM 조작 제거 — App.jsx의 useEffect([theme])에서 처리
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      setLogPanelOpen: (open) =>
        set({ isLogPanelOpen: open }),

      setActiveLogTab: (tab) => set({ activeLogTab: tab }),

      setCurrentView: (view) => set({ currentView: view }),

      // 태스크 포커스/상세 전환 액션
      setFocusedTaskId: (id) => set({ focusedTaskId: id ? String(id) : null }),
      setActiveDetailTaskId: (id) => set({ activeDetailTaskId: id ? String(id) : null }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      
      // 워크스페이스 업데이트
      updateWorkspace: (updates) => set((s) => ({ ...s, ...updates })),

      // Phase 21: ArtifactViewer 풀스크린
      // activeArtifact: null | { id, title, content, type, agentName }
      activeArtifact: null,
      openArtifact: (artifact) => set({ activeArtifact: artifact }),
      closeArtifact: () => set({ activeArtifact: null }),

      // [v2.0] Multi-Team 아키텍체 상태
      teams: [
        { id: 'team_B', group: 'B', name: 'Team B (초안 & 크로스체크)', projectId: 'sosiann_verify', projectName: '소시안 검수 프로젝트' },
        { id: 'team_A', group: 'A', name: 'Team A (크리에이티브)',    projectId: 'sosiann_creative',   projectName: '소시안 기획 프로젝트'    },
      ],
      projects: [
        { id: 'sosiann_creative',   name: '소시안 기획 프로젝트',     active: true },
        { id: 'sosiann_verify', name: '소시안 검수 프로젝트', active: true },
      ],
      addTeam:    (teamDef)    => set((s) => ({ teams:    [...s.teams,    teamDef]    })),
      addProject: (projectDef) => set((s) => ({ projects: [...s.projects, projectDef] })),
    }),
    {
      name: 'mycrew-ui',
      partialize: (s) => ({ 
        theme: s.theme, 
        workspaceName: s.workspaceName, 
        workspaceLogo: s.workspaceLogo,
        hasCompletedOnboarding: s.hasCompletedOnboarding,
        teamPageTitle: s.teamPageTitle,
        teamPageSubtitle: s.teamPageSubtitle,
      }), // theme, workspace, 팀 메타 정보 persist
    }
  )
);


