// src/store/projectStore.js — 프로젝트 & 아카이브 상태 (Zustand persist 적용)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4005';

export const useProjectStore = create(
  persist(
    (set, get) => ({
      projects: [],
      selectedProjectId: null,
      isLoaded: false,

      // 서버에서 프로젝트 목록 동기화
      fetchProjects: async () => {
        try {
          const res = await fetch(`${SERVER_URL}/api/projects`);
          const data = await res.json();
          const activeProjects = Array.isArray(data) ? data : [];
          
          set((state) => {
            let nextSelected = state.selectedProjectId;
            // 로컬에 저장된 selectedProjectId가 서버 응답에 없거나 처음일 때
            const isSelectedValid = activeProjects.some(p => p.id === nextSelected);
            if (!isSelectedValid) {
              // global_mycrew가 있으면 우선 선택, 없으면 첫 번째 프로젝트
              const globalProject = activeProjects.find(p => p.id === 'global_mycrew');
              nextSelected = globalProject ? globalProject.id : (activeProjects[0]?.id || null);
            }
            
            return {
              projects: activeProjects,
              selectedProjectId: nextSelected,
              isLoaded: true,
            };
          });
        } catch (err) {
          console.error('[projectStore] fetchProjects error:', err);
          set({ isLoaded: true }); // 에러 나도 로드 끝난 것으로 처리해서 무한 로딩 방지
        }
      },

      selectProject: (id) => set({ selectedProjectId: id }),

      // 아카이브: Done 또는 장기 보류 Task를 프로젝트별로 조회
      // (kanbanStore의 tasks를 파라미터로 받아 필터링)
      getArchivedTasks: (tasks) =>
        Object.values(tasks).filter(
          (t) => t.column === 'done' || t.column === 'PENDING'
        ),
    }),
    { 
      name: 'mycrew-projects', // localStorage key
      // isLoaded 상태는 저장하지 않도록 필터링
      partialize: (state) => ({ 
        selectedProjectId: state.selectedProjectId,
        // projects 데이터는 서버 동기화가 메인이지만 캐시용으로 저장
        projects: state.projects
      }),
    }
  )
);
