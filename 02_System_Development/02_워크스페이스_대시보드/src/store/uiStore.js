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
      workspaceLogo: null, // null 이면 기본 아이콘 사용
      
      // Phase 17-3: 온보딩 체크
      hasCompletedOnboarding: false,

      // C4: DOM 조작 제거 — App.jsx의 useEffect([theme])에서 처리
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      setLogPanelOpen: (open) =>
        set({ isLogPanelOpen: open, isBoardReadOnly: open }),

      setActiveLogTab: (tab) => set({ activeLogTab: tab }),

      setCurrentView: (view) => set({ currentView: view }),

      // 태스크 포커스/상세 전환 액션
      setFocusedTaskId: (id) => set({ focusedTaskId: id ? String(id) : null }),
      setActiveDetailTaskId: (id) => set({ activeDetailTaskId: id ? String(id) : null }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      
      // 워크스페이스 업데이트
      updateWorkspace: (updates) => set((s) => ({ ...s, ...updates }))
    }),
    {
      name: 'mycrew-ui',
      partialize: (s) => ({ 
        theme: s.theme, 
        workspaceName: s.workspaceName, 
        workspaceLogo: s.workspaceLogo,
        hasCompletedOnboarding: s.hasCompletedOnboarding
      }), // theme, workspace 정보 persist
    }
  )
);


