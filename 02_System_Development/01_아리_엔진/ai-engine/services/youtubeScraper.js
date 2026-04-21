/**
 * 유튜브 URL 배열을 받아 각 영상의 자막 전체 텍스트와 메타데이터를 추출합니다.
 * @param {string[]} urls - 유튜브 영상 URL 배열
 * @returns {Promise<Array<{ url: string, transcript: string, title?: string, isError?: boolean, errorMsg?: string }>>}
 */
export async function extractTranscripts(urls) {
  if (!Array.isArray(urls) || urls.length === 0) {
    return [];
  }

  // 동적 import로 라이브러리 로드
  const pkg = await import('youtube-transcript');
  const YoutubeTranscript = pkg.YoutubeTranscript || pkg.default?.YoutubeTranscript || pkg.default || pkg;

  const results = [];

  for (const url of urls) {
    try {
      // 1. URL에서 videoId 추출 (일반, 쇼츠, 모바일, 공유링크, Embed 모두 대응)
      const match = url.match(/[?&]v=([^&]+)/) 
                 || url.match(/youtu\.be\/([^?]+)/) 
                 || url.match(/shorts\/([^/?]+)/)
                 || url.match(/embed\/([^/?]+)/);
      const videoId = match ? match[1] : null;
      
      if (!videoId) throw new Error('유효한 유튜브 URL이 아닙니다.');

      // 2. youtube-transcript의 자체 정규식 버그(쇼츠 URL 미지원 등)를 우회하기 위해 정규화된 URL 전달
      const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const transcriptList = await YoutubeTranscript.fetchTranscript(normalizedUrl);
      
      // 3. 추출된 데이터를 하나의 텍스트로 결합
      const fullText = transcriptList.map(item => item.text).join(' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
      
      results.push({
        url,
        transcript: fullText,
        isError: false
      });
    } catch (err) {
      console.warn(`[YoutubeScraper] 자막 추출 실패 (${url}): ${err.message}`);
      results.push({
        url,
        transcript: null,
        isError: true,
        errorMsg: err.message
      });
    }
  }

  return results;
}
