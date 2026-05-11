/**
 * naverSearchAdapter.js — ariDaemon용 네이버 검색 어댑터
 *
 * NaverNewsHarvester(뉴스) + 네이버 블로그/카페/웹문서 API 통합
 * ariDaemon의 executeTool('naverSearch', args)에서 직접 호출합니다.
 *
 * 지원 검색 타입:
 *   - news   : 네이버 뉴스 (기본, 한국 뉴스 특화)
 *   - blog   : 네이버 블로그 (한국어 정보 풍부)
 *   - webkr  : 네이버 웹문서 (공식 사이트, 포럼 등)
 *   - encyc  : 네이버 백과사전 (개념/용어 정의)
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── API 설정 ──────────────────────────────────────────────────────────────────
const CLIENT_ID     = process.env.NAVER_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const TIMEOUT_MS    = 8000;

const ENDPOINT = {
  news:  'https://openapi.naver.com/v1/search/news.json',
  blog:  'https://openapi.naver.com/v1/search/blog.json',
  webkr: 'https://openapi.naver.com/v1/search/webkr.json',
  encyc: 'https://openapi.naver.com/v1/search/encyc.json',
};

/** HTML 태그 제거 (<b>검색어</b> → 검색어) */
function stripHtml(str = '') {
  return str.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
}

/**
 * 네이버 검색 실행
 *
 * @param {string} query       - 검색 키워드
 * @param {'news'|'blog'|'webkr'|'encyc'} type - 검색 유형 (기본: news)
 * @param {number} display     - 결과 수 (1~10, 기본 5 — Ari 컨텍스트 절약)
 * @returns {Promise<{success: boolean, message: string, items?: Array}>}
 */
export async function naverSearch(query, type = 'news', display = 5) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return {
      success: false,
      message: '❌ NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수 미설정. .env를 확인해주세요.',
    };
  }

  const endpoint = ENDPOINT[type] || ENDPOINT.news;
  const params   = new URLSearchParams({
    query,
    display: String(Math.min(display, 10)),
    start: '1',
    sort: 'date',   // 최신순
  });

  try {
    const resp = await fetch(`${endpoint}?${params}`, {
      headers: {
        'X-Naver-Client-Id':     CLIENT_ID,
        'X-Naver-Client-Secret': CLIENT_SECRET,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    // ── 에러 처리 ─────────────────────────────────────────────────────────
    if (resp.status === 401) {
      return { success: false, message: '❌ 네이버 API 인증 실패 — 개발자 센터에서 "검색" API 권한 확인 필요' };
    }
    if (resp.status === 429) {
      return { success: false, message: '⚠️ 네이버 API 일일 호출 한도 초과 (25,000회)' };
    }
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return { success: false, message: `❌ 네이버 API 오류: HTTP ${resp.status} — ${err.errorMessage || '알 수 없는 오류'}` };
    }

    const data  = await resp.json();
    const items = (data.items || []).map(item => ({
      title:       stripHtml(item.title),
      description: stripHtml(item.description || item.blogerentry || ''),
      link:        item.originallink || item.link,
      pubDate:     item.pubDate || item.postdate || '',
    }));

    if (items.length === 0) {
      return { success: true, message: `"${query}"에 대한 검색 결과가 없습니다.`, items: [] };
    }

    // ── Ari가 읽기 좋은 포맷으로 변환 ────────────────────────────────────
    const typeLabel = { news: '뉴스', blog: '블로그', webkr: '웹문서', encyc: '백과사전' }[type] || type;
    let message = `🔍 **네이버 ${typeLabel} 검색 결과: "${query}"** (${items.length}건)\n\n`;

    items.forEach((item, i) => {
      message += `**${i + 1}. ${item.title}**\n`;
      if (item.description) message += `> ${item.description.slice(0, 150)}${item.description.length > 150 ? '...' : ''}\n`;
      if (item.pubDate)     message += `📅 ${item.pubDate}  `;
      // ⚠️ URL 환각 방지: 검색 결과에 포함된 link만 표시. 없으면 "URL 미확인" 명시.
      if (item.link && item.link.startsWith('http')) {
        message += `🔗 ${item.link}\n\n`;
      } else {
        message += `🔗 URL 미확인 (naverSearch webkr 타입으로 재검색 권장)\n\n`;
      }
    });

    console.log(`[NaverSearch] "${query}" (${type}) → ${items.length}건`);
    return { success: true, message, items };

  } catch (err) {
    return { success: false, message: `❌ 네이버 검색 실패: ${err.message}` };
  }
}
