import axios from 'axios';
import * as cheerio from 'cheerio';

class UrlParser {
  /**
   * 주어진 URL의 웹 문서를 가져와 순수 텍스트 형태로 정제하여 반환합니다.
   * @param {string} url - 파싱할 타겟 URL
   * @returns {Promise<string|null>} - 정제된 마크다운 텍스트 또는 null
   */
  async fetch(url) {
    try {
      // 1. HTTP GET 요청 (일반적인 User-Agent 설정해 차단 회피)
      const response = await axios.get(url, {
        timeout: 10000, // 최대 10초 대기
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (HTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        }
      });

      const html = response.data;
      if (!html || typeof html !== 'string') return null;

      // 2. Cheerio를 이용한 HTML 파싱
      const $ = cheerio.load(html);

      // 스크립트, 스타일시트 등 본문과 무관한 태그 제거
      $('script, style, noscript, iframe, img, svg, video, audio, nav, footer, header').remove();

      // body 내용 추출
      let textContent = $('body').text();

      // 3. 다중 공백 및 불필요한 줄바꿈 압축 정제
      textContent = textContent.replace(/\n\s*\n/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();

      // 너무 긴 경우 AI 토큰 제한 방지를 위해 적절히 자름 (약 50000자)
      if (textContent.length > 50000) {
        textContent = textContent.substring(0, 50000) + '\n\n... (본문이 너무 길어 요약됨)';
      }

      return textContent;
    } catch (error) {
      console.error(`[UrlParser] URL 파싱 실패 (${url}):`, error.message);
      return null;
    }
  }
}

export default new UrlParser();
