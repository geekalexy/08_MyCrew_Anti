// src/store/authStore.js — Google 구독인증 관리
// 인증 방식: 'api_key' | 'google_oauth'
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // ── 상태 ──────────────────────────────────────────────
      authMode: 'api_key',          // 'api_key' | 'google_oauth'
      oauthToken: null,             // Google OAuth Access Token
      oauthExpiry: null,            // 만료 시각 (ms timestamp)
      googleUser: null,             // { name, email, picture }
      isSigningIn: false,

      // 앱 실행 시 백엔드와 토큰 상태 동기화
      syncWithBackend: async () => {
        const { oauthToken, oauthExpiry, authMode } = get();
        if (authMode === 'google_oauth' && oauthToken && oauthExpiry > Date.now()) {
          const expiresIn = Math.floor((oauthExpiry - Date.now()) / 1000);
          try {
            await fetch(`${SERVER_URL}/api/auth/google-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: oauthToken, expiresIn }),
            });
            console.log('[AuthStore] 🔄 백엔드와 Google OAuth 토큰 동기화 완료');
          } catch (e) {
            console.warn('[AuthStore] 백엔드 토큰 동기화 실패', e);
          }
        }
      },

      // ── Google OAuth 로그인 ────────────────────────────────
      signInWithGoogle: () => {
        if (!GOOGLE_CLIENT_ID) {
          alert('VITE_GOOGLE_CLIENT_ID가 설정되지 않았습니다. .env를 확인해주세요.');
          return;
        }
        set({ isSigningIn: true });

        // Google OAuth 팝업 (implicit flow — 빠른 구현)
        const scope = [
          'https://www.googleapis.com/auth/cloud-platform', // Vertex/Gemini 통합 스코프
          'https://www.googleapis.com/auth/generative-language.retriever', // Gemini 특화 스코프
          'profile',
          'email',
        ].join(' ');

        const params = new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri: window.location.origin + '/oauth-callback',
          response_type: 'token',   // implicit flow → 즉시 access_token 반환
          scope,
          prompt: 'select_account',
        });

        const popup = window.open(
          `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
          'google_login',
          'width=500,height=600,scrollbars=yes'
        );

        // 팝업에서 토큰 수신 대기
        const handleMessage = async (event) => {
          if (event.origin !== window.location.origin) return;
          if (!event.data?.googleOAuthToken) return;

          window.removeEventListener('message', handleMessage);
          const { token, expiresIn } = event.data.googleOAuthToken;

          // 토큰으로 사용자 정보 조회
          try {
            const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${token}` },
            }).then(r => r.json());

            set({
              oauthToken: token,
              oauthExpiry: Date.now() + (expiresIn - 60) * 1000, // 60초 버퍼
              googleUser: { name: userInfo.name, email: userInfo.email, picture: userInfo.picture },
              authMode: 'google_oauth',
              isSigningIn: false,
            });

            // 백엔드에 토큰 등록
            await fetch(`${SERVER_URL}/api/auth/google-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, expiresIn }),
            }).catch(() => {});

            console.log('[AuthStore] ✅ Google OAuth 인증 완료:', userInfo.email);
          } catch (err) {
            console.error('[AuthStore] 사용자 정보 조회 실패:', err);
            set({ isSigningIn: false });
          }

          popup?.close();
        };

        window.addEventListener('message', handleMessage);

        // 타임아웃 (2분)
        setTimeout(() => {
          window.removeEventListener('message', handleMessage);
          set({ isSigningIn: false });
          popup?.close();
        }, 120_000);
      },

      // ── 로그아웃 ──────────────────────────────────────────
      signOut: async () => {
        set({ oauthToken: null, oauthExpiry: null, googleUser: null, authMode: 'api_key' });
        await fetch(`${SERVER_URL}/api/auth/google-token`, { method: 'DELETE' }).catch(() => {});
      },

      // ── 인증 모드 전환 (API키 ↔ 구독인증) ─────────────────
      setAuthMode: (mode) => {
        if (mode === 'api_key') {
          set({ authMode: 'api_key' });
        } else if (mode === 'google_oauth') {
          const { oauthToken, oauthExpiry } = get();
          if (!oauthToken || Date.now() > oauthExpiry) {
            // 토큰 없으면 로그인 먼저
            get().signInWithGoogle();
          } else {
            set({ authMode: 'google_oauth' });
          }
        }
      },

      // ── 토큰 유효 여부 확인 ────────────────────────────────
      isOAuthValid: () => {
        const { oauthToken, oauthExpiry } = get();
        return !!oauthToken && Date.now() < oauthExpiry;
      },
    }),
    {
      name: 'mycrew-auth',
      partialState: (state) => ({
        authMode: state.authMode,
        oauthToken: state.oauthToken,
        oauthExpiry: state.oauthExpiry,
        googleUser: state.googleUser,
      }),
    }
  )
);
