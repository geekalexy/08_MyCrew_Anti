// src/store/settingsStore.js — Heartbeat 설정 (백엔드 /api/settings 연동)
import { create } from 'zustand';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export const useSettingsStore = create((set) => ({
  heartbeat_auto_resume_level: 'SAFE_ONLY',
  batch_report_interval_min: 30,
  isLoaded: false,

  // 서버에서 초기 설정값 로드
  fetchSettings: async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/settings`);
      const { settings } = await res.json();
      set({
        heartbeat_auto_resume_level: settings.heartbeat_auto_resume_level || 'SAFE_ONLY',
        batch_report_interval_min: parseInt(settings.batch_report_interval_min || '30', 10),
        isLoaded: true,
      });
    } catch (e) {
      console.warn('[SettingsStore] 설정 로드 실패, 기본값 사용:', e.message);
      set({ isLoaded: true });
    }
  },

  // 설정값 단건 업데이트 (서버 동기화 포함)
  updateSetting: async (key, value) => {
    set({ [key]: value });
    try {
      await fetch(`${SERVER_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
    } catch (e) {
      console.error('[SettingsStore] 설정 저장 실패:', e.message);
    }
  },
}));
