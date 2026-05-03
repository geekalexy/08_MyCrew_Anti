import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_TIMELINES = 500;

export const useTimelineStore = create(
  persist(
    (set) => ({
      timelines: [],

      appendTimeline: (timelineLog) =>
        set((s) => {
          if (s.timelines.length >= MAX_TIMELINES) {
            const timelines = s.timelines.slice(1);
            timelines.push(timelineLog);
            return { timelines };
          }
          return { timelines: [...s.timelines, timelineLog] };
        }),

      // 타임라인은 업무 감사 로그이므로 프론트엔드 단일 초기화 기능 제공 안함 (Immutable 원칙)
      dangerouslyPurgeAllTimelines: () => set({ timelines: [] }),
    }),
    {
      name: 'ari-timeline-storage', // 로컬스토리지 키 이름
    }
  )
);
