/**
 * [YouTubeUploader] Phase 24 — YouTube Data API v3 자동 업로드 서비스
 *
 * 완성된 MP4 파일을 유튜브에 자동 업로드합니다.
 * Refresh Token 기반 자동 갱신으로 사람 개입 0.
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const YOUTUBE_CATEGORY_ID = '22'; // People & Blogs (쇼츠 기본값)
const SHORTS_TAG = '#Shorts';

export class YouTubeUploader {
  constructor() {
    const clientId     = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('[YouTubeUploader] .env에 YOUTUBE_CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN 이 없습니다. auth-youtube.js를 먼저 실행하세요.');
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'http://localhost:9999/oauth2callback'
    );
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    this.youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * MP4 파일을 유튜브 쇼츠로 업로드
   * @param {object} options
   * @param {string} options.filePath     - 업로드할 MP4 절대 경로
   * @param {string} options.title        - 영상 제목 (훅 문장 사용 권장)
   * @param {string} options.description  - 영상 설명 (시나리오 대본 요약)
   * @param {string[]} options.tags       - 해시태그 배열 (예: ['주식', '엔비디아'])
   * @param {string} options.publishAt    - 예약 발행 ISO 시간 (없으면 즉시)
   * @param {boolean} options.dryRun      - true면 실제 업로드 없이 로그만 출력 (파인튜닝 단계 안전장치)
   * @param {'private'|'unlisted'|'public'} options.privacy - 공개 범위 (기본: private)
   * @returns {{ videoId, url }}
   */
  async uploadShorts({ filePath, title, description = '', tags = [], publishAt = null, dryRun = false, privacy = 'private' }) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`[YouTubeUploader] 파일이 존재하지 않습니다: ${filePath}`);
    }

    console.log(`\n📤 [YouTubeUploader] 업로드 준비: "${title}"`);
    console.log(`   파일: ${path.basename(filePath)} (${(fs.statSync(filePath).size / 1024 / 1024).toFixed(1)}MB)`);
    console.log(`   공개 범위: ${privacy} ${dryRun ? '| 🔒 DRY RUN 모드 — 실제 업로드 없음' : ''}`);

    // ── DRY RUN: 실제 업로드 없이 검증만 수행 ──────────────────────────
    if (dryRun) {
      console.log(`\n✅ [DRY RUN] 업로드 시뮬레이션 완료. 실제 유튜브 전송은 하지 않았습니다.`);
      console.log(`   → 파인튜닝 완료 후 dryRun: false, privacy: 'public' 으로 전환하세요.`);
      return { videoId: 'dry-run-no-upload', url: 'https://youtube.com (dry-run)' };
    }

    // 제목 끝에 '#Shorts' 없으면 자동 추가 (유튜브 쇼츠 알고리즘 인식)
    const finalTitle = title.endsWith(SHORTS_TAG) ? title : `${title} ${SHORTS_TAG}`;
    const finalTags  = [...new Set([...tags, 'Shorts', '쇼츠', '주식쇼츠'])]
      .map(t => t.replace(/^#/, '')); // '#' 제거 (API 요구사항)

    const requestBody = {
      snippet: {
        title:       finalTitle.slice(0, 100),  // 유튜브 제목 100자 제한
        description: description.slice(0, 5000),
        tags:        finalTags,
        categoryId:  YOUTUBE_CATEGORY_ID,
        defaultLanguage: 'ko',
      },
      status: {
        privacyStatus: publishAt ? 'private' : privacy,  // 예약이면 private, 아니면 지정값
        ...(publishAt && { publishAt }),
        selfDeclaredMadeForKids: false,
      },
    };

    const media = {
      mimeType: 'video/mp4',
      body:     fs.createReadStream(filePath),
    };

    try {
      const response = await this.youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody,
        media,
      });

      const videoId  = response.data.id;
      const videoUrl = `https://www.youtube.com/shorts/${videoId}`;

      console.log(`   ✅ 업로드 성공!`);
      console.log(`   📺 YouTube URL: ${videoUrl}`);
      console.log(`   🔖 Video ID: ${videoId}\n`);

      return { videoId, url: videoUrl };

    } catch (err) {
      // 할당량 초과 (403) 처리
      if (err?.code === 403) {
        const msg = err.errors?.[0]?.reason;
        if (msg === 'quotaExceeded') {
          console.error('[YouTubeUploader] ❌ 일일 업로드 할당량 초과. 내일 재시도 필요.');
        } else if (msg === 'forbidden') {
          console.error('[YouTubeUploader] ❌ 채널 권한 없음. OAuth 계정에 채널이 있는지 확인.');
        }
      }
      throw err;
    }
  }

  /**
   * 여러 영상을 황금 시간대에 맞춰 예약 발행
   * @param {Array<{filePath, title, description, tags}>} videos
   * @param {string[]} publishTimes - ISO 시각 배열 ['2026-04-23T09:00:00+09:00', ...]
   */
  async scheduleUpload(videos, publishTimes) {
    const results = [];
    for (let i = 0; i < videos.length; i++) {
      try {
        const result = await this.uploadShorts({
          ...videos[i],
          publishAt: publishTimes[i] || null,
        });
        results.push({ ...result, scheduled: publishTimes[i] });
        // 업로드 간 2초 간격 (API rate limit 방어)
        if (i < videos.length - 1) await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        console.error(`[YouTubeUploader] 영상 ${i + 1} 업로드 실패:`, err.message);
        results.push({ error: err.message, video: videos[i].title });
      }
    }
    return results;
  }
}
