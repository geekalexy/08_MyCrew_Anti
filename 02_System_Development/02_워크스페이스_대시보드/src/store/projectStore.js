// src/store/projectStore.js — 프로젝트 & 아카이브 상태 (Zustand persist 적용)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_PROJECTS = [
  { id: 'proj-1', name: '아리 엔진', color: '#6366f1' },
  { id: 'proj-2', name: '워크스페이스 대시보드', color: '#22d3ee' },
];

export const useProjectStore = create(
  persist(
    (set, get) => ({
      projects: DEFAULT_PROJECTS,
      selectedProjectId: DEFAULT_PROJECTS[0].id,

  // 프로젝트 자유 생성
  addProject: (name) => {
    const newProject = {
      id: `proj-${Date.now()}`,
      name,
      color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
    };
    set((s) => ({ projects: [...s.projects, newProject] }));
    return newProject.id;
  },

  updateProject: (id, newName) =>
    set((s) => ({
      projects: s.projects.map((p) => p.id === id ? { ...p, name: newName } : p)
    })),

  selectProject: (id) => set({ selectedProjectId: id }),

  deleteProject: (id) =>
    set((s) => {
      const filtered = s.projects.filter((p) => p.id !== id);
      // 삭제된 프로젝트가 선택 중이었다면 첫 번째로 fallback
      const nextSelected = s.selectedProjectId === id
        ? (filtered[0]?.id || null)
        : s.selectedProjectId;
      return { projects: filtered, selectedProjectId: nextSelected };
    }),

  // 아카이브: Done 또는 장기 보류 Task를 프로젝트별로 조회
  // (kanbanStore의 tasks를 파라미터로 받아 필터링)
      getArchivedTasks: (tasks) =>
        Object.values(tasks).filter(
          (t) => t.column === 'done' || t.column === 'PENDING'
        ),
    }),
    { name: 'mycrew-projects' } // localStorage key
  )
);
