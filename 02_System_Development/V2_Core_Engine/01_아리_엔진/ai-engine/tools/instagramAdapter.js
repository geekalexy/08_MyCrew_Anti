/**
 * instagramAdapter.js — MyCrew 엔진용 Instagram 프로필 스크래핑 어댑터
 *
 * ariDaemon의 executeTool('instagramAnalyze', args)에서 직접 호출합니다.
 * POC(test_ig_login_scrape.js v3.1)를 기반으로 엔진 통합 형태로 구현.
 *
 * 동작 방식:
 *  1. outputs/ig_session/ 에 저장된 세션 재사용 (로그인 없이 실행)
 *  2. 세션이 없으면 에러 반환 — 로그인은 POC 스크립트로 1회만 진행
 *  3. Puppeteer 워커를 별도 child_process 없이 직접 실행 (on-demand)
 *
 * 주요 제한:
 *  - 세션 만료 시 MyCrew UI 메시지로 재로그인 안내
 *  - 비공개 계정 스크래핑 불가 (og:description 미제공)
 *  - 인스타그램 HTML 구조 변경 시 셀렉터 업데이트 필요 (og:description은 안정적)
 *
 * 2026-05-06 | Sonnet | v1.0
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, unlinkSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 경로 설정 ────────────────────────────────────────────────────────────────
const ENGINE_ROOT   = join(__dirname, '../../');          // 01_아리_엔진/
const SESSION_DIR   = join(ENGINE_ROOT, 'outputs/ig_session');
const CHROME_PATH   = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TIMEOUT_MS    = 30000;

// ── 유틸 ─────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Instagram 프로필 스크래핑 실행
 *
 * @param {string} instagramId  - 대상 Instagram 계정 ID (@제외, 예: 'socian_official')
 * @returns {Promise<{success: boolean, message: string, data?: object}>}
 */
export async function instagramAnalyze(instagramId) {
  // ── 사전 검증 ──────────────────────────────────────────────────────────────
  if (!instagramId || typeof instagramId !== 'string') {
    return { success: false, message: '❌ instagram_id가 필요합니다. 예: socian_official' };
  }

  // @ 제거 (사용자가 @포함 입력해도 처리)
  const targetId = instagramId.replace(/^@/, '').trim();

  if (!existsSync(CHROME_PATH)) {
    return { success: false, message: '❌ Chrome을 찾을 수 없습니다. Chrome이 설치되어 있는지 확인해주세요.' };
  }

  if (!existsSync(SESSION_DIR)) {
    return {
      success: false,
      message: `❌ Instagram 로그인 세션이 없습니다.\n` +
        `엔진 폴더 터미널에서 아래 명령어로 1회 로그인해주세요:\n\n` +
        `\`node tests/test_ig_login_scrape.js ${targetId}\``,
    };
  }

  // ── puppeteer 동적 import (선택적 의존성) ──────────────────────────────────
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer-core')).default;
  } catch (_) {
    return { success: false, message: '❌ puppeteer-core 패키지가 없습니다. npm install puppeteer-core 후 재시도해주세요.' };
  }

  // 잠금 파일 선제 제거
  ['SingletonLock', 'SingletonCookie', 'SingletonSocket'].forEach(f => {
    try { unlinkSync(join(SESSION_DIR, f)); } catch (_) {}
  });

  let browser = null;
  try {
    console.log(`[InstagramAdapter] 🚀 @${targetId} 프로필 스크래핑 시작`);

    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,             // 엔진 환경: headless 실행
      userDataDir: SESSION_DIR,   // 저장된 세션 재사용
      args: [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', '--disable-gpu',
        '--window-size=1280,900', '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );

    // ── 프로필 페이지 이동 ──────────────────────────────────────────────────
    const profileUrl = `https://www.instagram.com/${targetId}/`;
    await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: TIMEOUT_MS });
    await sleep(2000);

    // 로그인 만료 감지
    const finalUrl = page.url();
    if (finalUrl.includes('/accounts/login') || finalUrl.includes('/accounts/emailsignup')) {
      return {
        success: false,
        message: `⚠️ Instagram 세션이 만료되었습니다.\n` +
          `터미널에서 아래 명령어로 재로그인 후 다시 요청해주세요:\n\n` +
          `\`node tests/test_ig_login_scrape.js ${targetId}\``,
      };
    }

    // ── 데이터 추출 ─────────────────────────────────────────────────────────
    const profileData = await page.evaluate((tId) => {
      const result = {
        instagram_id: tId,
        profile_url: window.location.href,
        follower_count: null, following_count: null, post_count: null,
        bio: null, full_name: null, is_verified: false,
        recent_posts_captions: [],
        scrape_timestamp: new Date().toISOString(),
        scrape_success: false, error: null,
      };

      try {
        const parseC = (text) => {
          if (!text) return null;
          text = text.trim().replace(/,/g, '').replace(/\s/g, '');
          if (text.includes('만'))  return Math.round(parseFloat(text) * 10000);
          if (text.match(/[kK]/))   return Math.round(parseFloat(text) * 1000);
          if (text.match(/[mM]/))   return Math.round(parseFloat(text) * 1000000);
          return parseInt(text, 10) || null;
        };

        // 방법 1: og:description (가장 안정적 — "팔로워 N명, 팔로잉 M명, 게시물 K개")
        const ogDesc = document.querySelector('meta[property="og:description"]')?.content;
        if (ogDesc) {
          const kr = ogDesc.match(/팔로워\s*([\d,.만kKmM]+)명?.*?팔로잉\s*([\d,.만kKmM]+)명?.*?게시물\s*([\d,.만kKmM]+)개?/);
          if (kr) {
            result.follower_count  = parseC(kr[1]);
            result.following_count = parseC(kr[2]);
            result.post_count      = parseC(kr[3]);
          }
          const en = ogDesc.match(/([\d,.]+)\s*Followers.*?([\d,.]+)\s*Following.*?([\d,.]+)\s*Posts/i);
          if (en && !result.follower_count) {
            result.follower_count  = parseC(en[1]);
            result.following_count = parseC(en[2]);
            result.post_count      = parseC(en[3]);
          }
        }

        // 방법 2: og:title (계정명)
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
        if (ogTitle) {
          const m = ogTitle.match(/^(.+?)\s*\(/);
          if (m) result.full_name = m[1].trim();
        }

        // 방법 3: CSS 폴백
        if (!result.follower_count) {
          const lis = document.querySelectorAll('header section ul li, header ul li');
          if (lis.length >= 3) {
            const getN = (el) => { const s = el?.querySelector('[title],span span,span'); return s?.title || s?.textContent; };
            result.post_count      = parseC(getN(lis[0]));
            result.follower_count  = parseC(getN(lis[1]));
            result.following_count = parseC(getN(lis[2]));
          }
        }

        // 인증 뱃지
        result.is_verified = !!document.querySelector('svg[aria-label="인증됨"],svg[aria-label="Verified"]');

        // 바이오
        for (const sel of ['header section > div > span', 'meta[name="description"]']) {
          const el = document.querySelector(sel);
          const t = el?.innerText || el?.content;
          if (t && t.length > 2) { result.bio = t.trim(); break; }
        }

        // 최근 게시물 캡션
        const captions = [];
        document.querySelectorAll('article img,[role="main"] img').forEach(img => {
          const a = img.getAttribute('alt');
          if (a && a.length > 5 && !captions.includes(a)) captions.push(a.substring(0, 200));
        });
        result.recent_posts_captions = captions.slice(0, 12);

        result.scrape_success = result.follower_count !== null;
      } catch (e) { result.error = e.message; }
      return result;
    }, targetId);

    // ── 결과 포맷 ─────────────────────────────────────────────────────────
    if (!profileData.scrape_success) {
      // 비공개 계정 또는 존재하지 않는 계정 판별
      const isNotFound = finalUrl.includes('not-found') || finalUrl === 'https://www.instagram.com/';
      return {
        success: false,
        message: isNotFound
          ? `❌ @${targetId} 계정을 찾을 수 없습니다. 계정 ID를 확인해주세요.`
          : `⚠️ @${targetId} 데이터 수집 불완전 — 비공개 계정이거나 인스타그램 HTML 구조가 변경되었을 수 있습니다.`,
        data: profileData,
      };
    }

    // ── Ari가 읽기 좋은 포맷으로 변환 ────────────────────────────────────
    let message = `📊 **@${targetId} Instagram 프로필 분석 결과**\n\n`;
    message += `👤 **계정명**: ${profileData.full_name || targetId}`;
    if (profileData.is_verified) message += ' ✅ (인증 계정)';
    message += '\n';

    message += `📈 **수치 현황**\n`;
    message += `  - 팔로워: **${profileData.follower_count?.toLocaleString() ?? '미수집'}명**\n`;
    message += `  - 팔로잉: ${profileData.following_count?.toLocaleString() ?? '미수집'}명\n`;
    message += `  - 게시물: ${profileData.post_count?.toLocaleString() ?? '미수집'}개\n\n`;

    if (profileData.bio) {
      message += `📝 **바이오**:\n> ${profileData.bio.replace(/\n/g, '\n> ')}\n\n`;
    }

    if (profileData.recent_posts_captions.length > 0) {
      message += `🖼️ **최근 게시물 캡션** (${profileData.recent_posts_captions.length}개):\n`;
      profileData.recent_posts_captions.slice(0, 5).forEach((cap, i) => {
        message += `  ${i + 1}. ${cap.substring(0, 80)}${cap.length > 80 ? '...' : ''}\n`;
      });
    }

    message += `\n🔗 ${profileData.profile_url}`;
    message += `\n⏱️ 수집 시각: ${new Date(profileData.scrape_timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`;

    console.log(`[InstagramAdapter] ✅ @${targetId} 스크래핑 완료 — 팔로워 ${profileData.follower_count?.toLocaleString()}`);
    return { success: true, message, data: profileData };

  } catch (err) {
    console.error(`[InstagramAdapter] ❌ 오류:`, err.message);
    return {
      success: false,
      message: `❌ Instagram 스크래핑 실패: ${err.message}`,
    };
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
}

/**
 * Instagram 여러 계정 배치 분석 (브라우저 1회 실행으로 순차 처리)
 * @param {string[]} instagramIds - 분석할 계정 ID 배열 (최대 10개)
 */
export async function instagramBatchAnalyze(instagramIds) {
  if (!Array.isArray(instagramIds) || instagramIds.length === 0) {
    return { success: false, message: '❌ instagram_ids 배열이 필요합니다.' };
  }
  const ids = instagramIds.map(id => id.replace(/^@/, '').trim()).filter(Boolean).slice(0, 10);

  if (!existsSync(SESSION_DIR)) {
    return { success: false, message: `❌ Instagram 로그인 세션이 없습니다.\n\`node tests/test_ig_login_scrape.js ${ids[0]}\` 로 1회 로그인해주세요.` };
  }

  let puppeteer;
  try { puppeteer = (await import('puppeteer-core')).default; }
  catch (_) { return { success: false, message: '❌ puppeteer-core 패키지 없음.' }; }

  ['SingletonLock', 'SingletonCookie', 'SingletonSocket'].forEach(f => {
    try { unlinkSync(join(SESSION_DIR, f)); } catch (_) {}
  });

  let browser = null;
  const results = [];

  try {
    console.log(`[InstagramAdapter] 🚀 배치 분석 시작 — ${ids.length}개 계정`);
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH, headless: true, userDataDir: SESSION_DIR,
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=1280,900','--no-first-run','--no-default-browser-check'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    for (let i = 0; i < ids.length; i++) {
      const targetId = ids[i];
      console.log(`[InstagramAdapter] [${i + 1}/${ids.length}] @${targetId} 분석 중...`);
      try {
        await page.goto(`https://www.instagram.com/${targetId}/`, { waitUntil: 'networkidle2', timeout: TIMEOUT_MS });
        await sleep(2000);
        if (page.url().includes('/accounts/login')) {
          results.push({ instagram_id: targetId, scrape_success: false, error: '세션 만료' });
          break;
        }
        const data = await page.evaluate((tId) => {
          const r = { instagram_id: tId, profile_url: window.location.href, follower_count: null, following_count: null, post_count: null, bio: null, full_name: null, is_verified: false, recent_posts_captions: [], scrape_success: false, error: null };
          try {
            const parseC = (text) => { if (!text) return null; text = text.trim().replace(/,/g,'').replace(/\s/g,''); if (text.includes('만')) return Math.round(parseFloat(text)*10000); if (text.match(/[kK]/)) return Math.round(parseFloat(text)*1000); if (text.match(/[mM]/)) return Math.round(parseFloat(text)*1000000); return parseInt(text,10)||null; };
            const ogDesc = document.querySelector('meta[property="og:description"]')?.content;
            if (ogDesc) {
              const kr = ogDesc.match(/팔로워\s*([\d,.만kKmM]+)명?.*?팔로잉\s*([\d,.만kKmM]+)명?.*?게시물\s*([\d,.만kKmM]+)개?/);
              if (kr) { r.follower_count=parseC(kr[1]); r.following_count=parseC(kr[2]); r.post_count=parseC(kr[3]); }
            }
            const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
            if (ogTitle) { const m = ogTitle.match(/^(.+?)\s*\(/); if (m) r.full_name = m[1].trim(); }
            r.is_verified = !!document.querySelector('svg[aria-label="인증됨"],svg[aria-label="Verified"]');
            for (const sel of ['header section > div > span','meta[name="description"]']) { const el=document.querySelector(sel); const t=el?.innerText||el?.content; if (t&&t.length>2){r.bio=t.trim();break;} }
            const captions=[]; document.querySelectorAll('article img,[role="main"] img').forEach(img=>{const a=img.getAttribute('alt');if(a&&a.length>5&&!captions.includes(a))captions.push(a.substring(0,200));}); r.recent_posts_captions=captions.slice(0,12);
            r.scrape_success = r.follower_count !== null;
          } catch(e){r.error=e.message;}
          return r;
        }, targetId);
        results.push(data);
        console.log(`[InstagramAdapter] ✅ @${targetId} — 팔로워 ${data.follower_count?.toLocaleString()??'미수집'}`);
        if (i < ids.length - 1) await sleep(2000);
      } catch (err) {
        results.push({ instagram_id: targetId, scrape_success: false, error: err.message });
      }
    }
  } finally {
    if (browser) { try { await browser.close(); } catch(_){} }
  }

  const succeeded = results.filter(r => r.scrape_success);
  let message = `📊 **Instagram 배치 분석 완료** (${succeeded.length}/${results.length}개 성공)\n\n`;
  results.forEach((r, i) => {
    message += `**${i+1}. @${r.instagram_id}**${r.is_verified?' ✅':''}\n`;
    if (!r.scrape_success) { message += `  ❌ 실패: ${r.error||'수집 불가'}\n\n`; return; }
    message += `  - 팔로워: **${r.follower_count?.toLocaleString()??'-'}** | 팔로잉: ${r.following_count?.toLocaleString()??'-'} | 게시물: ${r.post_count?.toLocaleString()??'-'}\n`;
    if (r.full_name) message += `  - 이름: ${r.full_name}\n`;
    if (r.bio) message += `  - 바이오: ${r.bio.substring(0,80)}${r.bio.length>80?'...':''}\n`;
    message += `  - 🔗 ${r.profile_url}\n\n`;
  });
  return { success: true, message, results };
}
