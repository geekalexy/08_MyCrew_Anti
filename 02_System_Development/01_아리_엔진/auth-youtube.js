/**
 * auth-youtube.js — YouTube OAuth 2.0 1회성 인증 스크립트
 *
 * 실행: node auth-youtube.js
 * → 브라우저 자동 오픈 → 구글 계정 선택 → 허용
 * → YOUTUBE_REFRESH_TOKEN이 .env에 자동 저장됨
 * → 이후로는 이 스크립트 다시 실행 불필요
 */

import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import open from 'open';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH  = path.resolve(__dirname, '.env');

const CLIENT_ID     = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI  = 'http://localhost:9999/oauth2callback';
const SCOPES        = ['https://www.googleapis.com/auth/youtube.upload'];

if (!CLIENT_ID || CLIENT_ID.includes('client_id')) {
  console.error('❌ .env에 YOUTUBE_CLIENT_ID가 설정되지 않았습니다.');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',  // Refresh Token 강제 발급
});

console.log('\n🔐 [YouTube OAuth] 브라우저를 열어 구글 계정 인증을 시작합니다...');
console.log('브라우저가 자동으로 열리지 않으면 아래 URL을 직접 열어주세요:');
console.log(`\n${authUrl}\n`);

// 브라우저 자동 오픈
await open(authUrl);

// 로컬 서버로 콜백 수신
const server = http.createServer(async (req, res) => {
  try {
    const qs     = new url.URL(req.url, REDIRECT_URI);
    const code   = qs.searchParams.get('code');

    if (!code) {
      res.end('<h2>❌ 인증 코드를 받지 못했습니다. 다시 시도해주세요.</h2>');
      return;
    }

    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      res.end('<h2>⚠️ Refresh Token을 받지 못했습니다. 구글 계정 보안 설정에서 앱 접근 권한을 제거 후 재시도하세요.</h2>');
      server.close();
      return;
    }

    // .env 파일에 Refresh Token 자동 저장
    let envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    if (envContent.includes('YOUTUBE_REFRESH_TOKEN=')) {
      envContent = envContent.replace(
        /YOUTUBE_REFRESH_TOKEN=.*/,
        `YOUTUBE_REFRESH_TOKEN="${refreshToken}"`
      );
    } else {
      envContent += `\nYOUTUBE_REFRESH_TOKEN="${refreshToken}"\n`;
    }
    fs.writeFileSync(ENV_PATH, envContent);

    console.log('\n✅ Refresh Token 발급 성공! .env에 자동 저장되었습니다.');
    console.log('이 스크립트는 다시 실행하지 않아도 됩니다.\n');

    res.end(`
      <html><body style="font-family:sans-serif;text-align:center;padding:4rem;background:#0d0d1a;color:#4ade80">
        <h1>✅ YouTube 인증 완료!</h1>
        <p>Refresh Token이 .env에 저장되었습니다.</p>
        <p>이 창을 닫고 MyCrew 서버를 재시작하세요.</p>
      </body></html>
    `);
    server.close();
    process.exit(0);

  } catch (err) {
    console.error('인증 처리 중 오류:', err);
    res.end('<h2>❌ 오류 발생: ' + err.message + '</h2>');
    server.close();
    process.exit(1);
  }
});

server.listen(9999, () => {
  console.log('⏳ 인증 대기 중... (포트 9999)\n');
});
