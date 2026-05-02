// src/store/projectStore.js — 프로젝트 & 아카이브 상태 (Zustand persist 적용)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4005';

export const useProjectStore = create(
  persist(
    (set, get) => ({
      projects: [],
      selectedProjectId: null,
      assignedCrew: [], // 현재 선택된 프로젝트의 크루 (AgentDetailView 등에서 사용)
      allCrews: {},     // [Sidebar Fix] 전체 프로젝트 크루 맵: { [projectId]: crew[] }
      isLoaded: false,

      // 서버에서 프로젝트 목록 동기화
      fetchProjects: async () => {
        try {
          const res = await fetch(`${SERVER_URL}/api/projects`);
          const data = await res.json();
          const activeProjects = Array.isArray(data) ? data : [];

          set((state) => {
            let nextSelected = state.selectedProjectId;
            const isSelectedValid = activeProjects.some(p => p.id === nextSelected);
            if (!isSelectedValid) {
              const globalProject = activeProjects.find(p => p.id === 'global_mycrew');
              nextSelected = globalProject ? globalProject.id : (activeProjects[0]?.id || null);
            }
            if (nextSelected && (!state.isLoaded || nextSelected !== state.selectedProjectId)) {
              setTimeout(() => get().fetchProjectCrew(nextSelected), 0);
            }
            return { projects: activeProjects, selectedProjectId: nextSelected, isLoaded: true };
          });

          // [Sidebar Fix] 전체 프로젝트 크루 병렬 fetch
          setTimeout(() => get().fetchAllProjectCrews(), 0);

        } catch (err) {
          console.error('[projectStore] fetchProjects error:', err);
          set({ isLoaded: true });
        }
      },

      selectProject: (id) => {
        set({ selectedProjectId: id });
        get().fetchProjectCrew(id);
      },

      // 현재 선택된 프로젝트 크루 (단일) — AgentDetailView, TaskCard 등에서 사용
      fetchProjectCrew: async (projectId) => {
        if (!projectId) return set({ assignedCrew: [] });
        try {
          const res = await fetch(`${SERVER_URL}/api/projects/${projectId}/crew`);
          const data = await res.json();
          const crew = Array.isArray(data) ? data : [];
          set((state) => ({
            assignedCrew: crew,
            allCrews: { ...state.allCrews, [projectId]: crew }, // allCrews도 동시 업데이트
          }));
        } catch (err) {
          console.error('[projectStore] fetchProjectCrew error:', err);
          set({ assignedCrew: [] });
        }
      },

      // [Sidebar Fix] 전체 프로젝트 크루 맵 갱신 (병렬 fetch)
      fetchAllProjectCrews: async () => {
        const { projects } = get();
        if (!projects.length) return;
        try {
          const results = await Promise.all(
            projects.map(async (p) => {
              try {
                const res = await fetch(`${SERVER_URL}/api/projects/${p.id}/crew`);
                const data = await res.json();
                return [p.id, Array.isArray(data) ? data : []];
              } catch {
                return [p.id, []];
              }
            })
          );
          set({ allCrews: Object.fromEntries(results) });
        } catch (err) {
          console.error('[projectStore] fetchAllProjectCrews error:', err);
        }
      },

      addProject: async (name, objective, isolation_scope) => {
        try {
          const payload = { name, objective, isolation_scope };
          const res = await fetch(`${SERVER_URL}/api/projects/zero-config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error('Failed to start project building');
          // 이후 상태 업데이트는 project:ready 소켓 수신 시점(useSocket)에서 처리
          return true;
        } catch (err) {
          console.error('[projectStore] addProject error:', err);
          throw err;
        }
      },

      deleteProject: async (id) => {
        try {
          const res = await fetch(`${SERVER_URL}/api/projects/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete project');
          // allCrews에서도 제거
          set((state) => {
            const updated = { ...state.allCrews };
            delete updated[id];
            return { allCrews: updated };
          });
          get().fetchProjects();
          return true;
        } catch (err) {
          console.error('[projectStore] deleteProject error:', err);
          throw err;
        }
      },

      updateProject: async (id, name, objective, isolation_scope) => {
        try {
          const currentProject = get().projects.find(p => p.id === id) || {};
          const payload = {
            name: name !== undefined ? name : currentProject.name,
            objective: objective !== undefined ? objective : currentProject.objective,
            isolation_scope: isolation_scope !== undefined ? isolation_scope : currentProject.isolation_scope
          };
          const res = await fetch(`${SERVER_URL}/api/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error('Failed to update project');
          get().fetchProjects();
          return true;
        } catch (err) {
          console.error('[projectStore] updateProject error:', err);
          throw err;
        }
      },

      getArchivedTasks: (tasks) =>
        Object.values(tasks).filter(
          (t) => t.column === 'done' || t.column === 'PENDING'
        ),
    }),
    {
      name: 'mycrew-projects',
      partialize: (state) => ({
        selectedProjectId: state.selectedProjectId,
        projects: state.projects,
      }),
    }
  )
);
