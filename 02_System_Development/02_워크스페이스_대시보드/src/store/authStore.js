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
        try {
          const res = await fetch(`${SERVER_URL}/api/auth/status`);
          const data = await res.json();
          if (data.status === 'ok' && data.mode === 'google_oauth' && data.token) {
            set({ 
              authMode: 'google_oauth', 
              oauthToken: data.token, 
              oauthExpiry: new Date(data.tokenExpiresAt).getTime()
            });
            console.log('[AuthStore] 🔄 백엔드 토큰 로드 완료 (자동 갱신됨)');
          } else if (get().authMode === 'google_oauth' && !data.token) {
            // 백엔드에 토큰이 없는데 프론트엔드는 google_oauth 모드인 경우
            set({ oauthToken: null, oauthExpiry: null, authMode: 'api_key' });
          }
        } catch (e) {
          console.warn('[AuthStore] 백엔드 동기화 실패', e);
        }
      },

      // ── Google OAuth 로그인 ────────────────────────────────
      signInWithGoogle: () => {
        if (!GOOGLE_CLIENT_ID) {
          alert('VITE_GOOGLE_CLIENT_ID가 설정되지 않았습니다. .env를 확인해주세요.');
          return;
        }
        set({ isSigningIn: true });

        // Google OAuth 팝업 (Offline Access Authorization Code Flow)
        const scope = [
          'https://www.googleapis.com/auth/cloud-platform', // Vertex/Gemini 통합 스코프
          'https://www.googleapis.com/auth/generative-language.retriever', // Gemini 특화 스코프
          'profile',
          'email',
        ].join(' ');

        const params = new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri: window.location.origin + '/oauth-callback',
          response_type: 'code',   // Authorization Code 플로우로 변경
          scope,
          access_type: 'offline',  // refresh_token 발급 필수
          prompt: 'consent',       // 강제 동의를 통해 refresh_token 확보
        });

        const popup = window.open(
          `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
          'google_login',
          'width=500,height=600,scrollbars=yes'
        );

        // 팝업에서 인가 코드(Code) 수신 대기
        const handleMessage = async (event) => {
          if (event.origin !== window.location.origin) return;
          if (!event.data?.googleOAuthCode) return;

          window.removeEventListener('message', handleMessage);
          const { code, redirectUri } = event.data.googleOAuthCode;

          try {
            // 백엔드와 Code 교환 (refresh_token 저장 및 access_token 발급)
            const tokenRes = await fetch(`${SERVER_URL}/api/auth/google-code`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code, redirectUri }),
            });
            const data = await tokenRes.json();
            if (data.status !== 'ok') throw new Error(data.error || '토큰 교환 실패');

            const token = data.token;
            const expiresIn = data.expiresIn || 3600;

            // 새 토큰으로 사용자 정보 조회
            const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${token}` },
            }).then(r => r.json());

            set({
              oauthToken: token,
              oauthExpiry: Date.now() + (expiresIn - 60) * 1000,
              googleUser: { name: userInfo.name, email: userInfo.email, picture: userInfo.picture },
              authMode: 'google_oauth',
              isSigningIn: false,
            });

            console.log('[AuthStore] ✅ Google OAuth 영구 인증 완료:', userInfo.email);
          } catch (err) {
            console.error('[AuthStore] 인증 처리 실패:', err);
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
      partialize: (state) => ({
        authMode: state.authMode,
        oauthToken: state.oauthToken,
        oauthExpiry: state.oauthExpiry,
        googleUser: state.googleUser,
      }),
    }
  )
);
