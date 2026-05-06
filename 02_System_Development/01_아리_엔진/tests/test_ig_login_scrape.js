/**
 * POC: Instagram 하이브리드 로그인 + 프로필 스크래핑 v3
 * 동작:  자동 입력 → 로그인 버튼 클릭 → 자동 스크래핑
 * 실행:  node tests/test_ig_login_scrape.js socian_official
 * 세션:  outputs/ig_session/ 에 보존 → 다음 실행 시 로그인 생략
 * 2026-05-06 | Sonnet | POC v3.1
 */

import puppeteer from 'puppeteer-core';
import * as dotenv from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TARGET_ID   = process.argv[2];
const SESSION_DIR = join(dirname(fileURLToPath(import.meta.url)), '../outputs/ig_session');
const OUTPUT_DIR  = join(dirname(fileURLToPath(import.meta.url)), '../outputs');
const IG_USERNAME = process.env.IG_USERNAME;
const IG_PASSWORD = process.env.IG_PASSWORD;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

if (!TARGET_ID) {
  console.error('❌ 예시: node tests/test_ig_login_scrape.js socian_official');
  process.exit(1);
}

async function main() {
  console.log(`\n🚀 Instagram POC v3.1 시작`);
  console.log(`   대상 계정: @${TARGET_ID}\n`);

  mkdirSync(SESSION_DIR, { recursive: true });
  mkdirSync(OUTPUT_DIR,  { recursive: true });

  // 잠금 파일 선제 제거
  try {
    const { unlinkSync } = await import('fs');
    ['SingletonLock','SingletonCookie','SingletonSocket'].forEach(f => {
      try { unlinkSync(join(SESSION_DIR, f)); } catch(_) {}
    });
  } catch(_) {}

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    userDataDir: SESSION_DIR,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--window-size=1280,900', '--no-first-run', '--no-default-browser-check',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  try {
    // ── Step 1: 인스타그램 접속 ─────────────────────────────────────────
    console.log('🌐 Step 1: 인스타그램 로그인 페이지 접속...');
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'domcontentloaded', timeout: 30000,
    });
    await sleep(3000);

    const url0 = page.url();
    const alreadyLoggedIn = !url0.includes('/accounts/login') && !url0.includes('/accounts/emailsignup');

    if (alreadyLoggedIn) {
      console.log('   ✅ 기존 세션 — 로그인 생략\n');
    } else {
      // ── Step 2: 자동 입력 ───────────────────────────────────────────
      console.log('🔐 Step 2: 아이디/비밀번호 자동 입력...');

      if (!page.url().includes('/accounts/login')) {
        await page.goto('https://www.instagram.com/accounts/login/', {
          waitUntil: 'domcontentloaded', timeout: 15000,
        });
        await sleep(2000);
      }

      const usernameSels = [
        'input[aria-label="휴대폰 번호, 사용자 이름 또는 이메일 주소"]',
        'input[name="username"]', 'input[autocomplete="username"]',
        'input[placeholder*="사용자"]', 'input[placeholder*="전화번호"]',
        'input[type="text"]',
      ];
      let uSel = null;
      for (const sel of usernameSels) {
        try { await page.waitForSelector(sel, { timeout: 3000 }); uSel = sel; break; } catch(_) {}
      }
      if (!uSel) throw new Error('Username 입력창 없음');
      console.log(`   ✅ 셀렉터: ${uSel}`);

      await page.click(uSel, { clickCount: 3 });
      await page.type(uSel, IG_USERNAME, { delay: 80 });
      await sleep(400);

      const pwSels = ['input[name="password"]','input[type="password"]','input[autocomplete="current-password"]'];
      let pSel = null;
      for (const sel of pwSels) {
        try { await page.waitForSelector(sel, { timeout: 3000 }); pSel = sel; break; } catch(_) {}
      }
      if (!pSel) throw new Error('Password 입력창 없음');

      await page.click(pSel, { clickCount: 3 });
      await page.type(pSel, IG_PASSWORD, { delay: 80 });
      await sleep(400);

      // ── Step 3: 로그인 버튼 클릭 대기 ─────────────────────────────
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('👆 Step 3: 브라우저에서 [로그인] 버튼을 클릭해주세요!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      await page.waitForFunction(
        () => !window.location.href.includes('/accounts/login'),
        { timeout: 60000, polling: 500 }
      );
      await sleep(2000);
      console.log(`   ✅ 로그인 완료! (${page.url()})\n`);
    }

    // ── Step 4: 대상 프로필 이동 ─────────────────────────────────────────
    const profileUrl = `https://www.instagram.com/${TARGET_ID}/`;
    console.log(`🔍 Step 4: 프로필 이동 → ${profileUrl}`);
    await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    const ssPath = join(OUTPUT_DIR, `ig_poc_${TARGET_ID}_${Date.now()}.png`);
    await page.screenshot({ path: ssPath });
    console.log(`   📸 스크린샷: ${ssPath}`);

    // HTML 스냅샷 저장 (디버깅용)
    const html = await page.content();
    const htmlPath = join(OUTPUT_DIR, `ig_html_${TARGET_ID}.html`);
    writeFileSync(htmlPath, html, 'utf-8');
    console.log(`   💾 HTML 저장: ${htmlPath}`);

    // ── Step 5: 데이터 추출 ───────────────────────────────────────────────
    console.log('\n📊 Step 5: 데이터 추출 중...');

    const profileData = await page.evaluate((targetId) => {
      const result = {
        instagram_id: targetId,
        follower_count: null, following_count: null, post_count: null,
        bio: null, full_name: null, is_verified: false,
        recent_posts_captions: [],
        scrape_timestamp: new Date().toISOString(),
        scrape_success: false, error: null, debug: {},
      };

      try {
        const parseCount = (text) => {
          if (!text) return null;
          text = text.trim().replace(/,/g, '').replace(/\s/g, '');
          if (text.includes('만')) return Math.round(parseFloat(text) * 10000);
          if (text.match(/[kK]/)) return Math.round(parseFloat(text) * 1000);
          if (text.match(/[mM]/)) return Math.round(parseFloat(text) * 1000000);
          return parseInt(text, 10) || null;
        };

        // 방법1: og:description 메타 태그
        const ogDesc = document.querySelector('meta[property="og:description"]')?.content;
        result.debug.og_description = ogDesc?.substring(0, 200) || null;
        if (ogDesc) {
          // 실제 형식: "팔로워 36명, 팔로잉 8명, 게시물 13개"
          const kr = ogDesc.match(/팔로워\s*([\d,.만kKmM]+)명?.*?팔로잉\s*([\d,.만kKmM]+)명?.*?게시물\s*([\d,.만kKmM]+)개?/);
          if (kr) { result.follower_count = parseCount(kr[1]); result.following_count = parseCount(kr[2]); result.post_count = parseCount(kr[3]); }
          // 영문 형식: "36 Followers, 8 Following, 13 Posts"
          const en = ogDesc.match(/([\d,.]+)\s*Followers.*?([\d,.]+)\s*Following.*?([\d,.]+)\s*Posts/i);
          if (en && !result.follower_count) { result.follower_count = parseCount(en[1]); result.following_count = parseCount(en[2]); result.post_count = parseCount(en[3]); }
        }

        // 방법2: og:title (계정명)
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
        result.debug.og_title = ogTitle || null;
        if (ogTitle) { const m = ogTitle.match(/^(.+?)\s*\(/); if (m) result.full_name = m[1].trim(); }

        // 방법3: CSS 폴백
        if (!result.follower_count) {
          const lis = document.querySelectorAll('header section ul li, header ul li');
          if (lis.length >= 3) {
            const getN = (el) => { const s = el?.querySelector('[title],span span,span'); return s?.title || s?.textContent; };
            result.post_count = parseCount(getN(lis[0]));
            result.follower_count = parseCount(getN(lis[1]));
            result.following_count = parseCount(getN(lis[2]));
          }
        }

        // 인증 뱃지
        result.is_verified = !!document.querySelector('svg[aria-label="인증됨"],svg[aria-label="Verified"]');

        // 바이오
        for (const sel of ['header section > div > span','meta[name="description"]']) {
          const el = document.querySelector(sel);
          const t = el?.innerText || el?.content;
          if (t && t.length > 2) { result.bio = t.trim(); break; }
        }

        // 게시물 캡션
        const imgs = document.querySelectorAll('article img,[role="main"] img');
        const captions = [];
        imgs.forEach(img => { const a = img.getAttribute('alt'); if (a && a.length > 5 && !captions.includes(a)) captions.push(a.substring(0, 200)); });
        result.recent_posts_captions = captions.slice(0, 12);

        result.scrape_success = result.follower_count !== null;
      } catch(e) { result.error = e.message; }
      return result;
    }, TARGET_ID);

    // ── Step 6: 결과 출력 & 저장 ─────────────────────────────────────────
    console.log('\n═══════════════════════════════════════');
    console.log('📦 수집 결과:');
    console.log('═══════════════════════════════════════');
    console.log(JSON.stringify(profileData, null, 2));

    const jsonPath = join(OUTPUT_DIR, `ig_poc_${TARGET_ID}_${Date.now()}.json`);
    writeFileSync(jsonPath, JSON.stringify(profileData, null, 2), 'utf-8');
    console.log(`\n💾 JSON: ${jsonPath}`);

    console.log('\n═══════════════════════════════════════');
    if (profileData.scrape_success) {
      console.log('✅ POC 성공!');
      console.log(`   팔로워:  ${profileData.follower_count?.toLocaleString()}`);
      console.log(`   팔로잉:  ${profileData.following_count?.toLocaleString()}`);
      console.log(`   게시물:  ${profileData.post_count?.toLocaleString()}`);
      console.log(`   캡션:    ${profileData.recent_posts_captions.length}개`);
      console.log(`   바이오:  ${profileData.bio ?? '없음'}`);
      console.log('   → MyCrew instagramAdapter.js 구현 가능 🚀');
    } else {
      console.log('⚠️  데이터 수집 불완전');
      console.log('   debug:', JSON.stringify(profileData.debug));
    }
    console.log('═══════════════════════════════════════\n');

  } catch(err) {
    console.error(`\n❌ 오류: ${err.message}`);
  } finally {
    console.log('⏳ 5초 후 종료...');
    await sleep(5000);
    await browser.close();
    console.log('✅ 완료');
  }
}

main();
