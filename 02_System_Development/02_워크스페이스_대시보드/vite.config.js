import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// /oauth-callback 경로를 oauth-callback.html로 서빙하는 플러그인
// (Google Cloud Console에 /oauth-callback으로 등록된 경우 호환)
function oauthCallbackPlugin() {
  return {
    name: 'oauth-callback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/oauth-callback')) {
          const file = path.resolve(__dirname, 'public/oauth-callback.html');
          if (fs.existsSync(file)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(fs.readFileSync(file, 'utf-8'));
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), oauthCallbackPlugin()],
  server: {
    port: 5174,
    strictPort: true,   // 5174 점유 시 에러로 명확히 알림 (silent fallback 방지)
    proxy: {
      '/webhook': 'http://localhost:4000',
      '/health':  'http://localhost:4000',
    },
  },
});

