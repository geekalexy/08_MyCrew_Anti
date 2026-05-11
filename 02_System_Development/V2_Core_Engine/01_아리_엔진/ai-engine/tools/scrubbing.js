/**
 * 🛡️ Data Sanitization Layer (Deterministic Entity Scrubbing)
 * LLM을 통과하기 전, 하드코딩된 기밀 데이터와 숫자를 사전에 물리적으로 파괴하여
 * 비용 제로의 완벽한 비식별화(Anonymization)를 수행합니다.
 */

// 향후 DB 연동 시 이 레지스트리를 DB에서 로드할 형태로 고도화 가능
const ENTITY_REGISTRY = {
  COMPANIES: [
    'socian', 'Socian', 'SOCIAN', '소시안',
    'mycrew', 'MyCrew', 'MYCREW', '마이크루'
  ],
  PEOPLE: [
    '알렉스', 'Alex', 'Alex J', '대표님', '대표',
    '제인', 'Jane', '존', 'John', '루카', '아리'
  ],
  COMPETITORS: [
    'hootsuite', 'Hootsuite', 'HOOTSUITE', '후트스위트',
    'buffer', 'Buffer', '버퍼'
  ]
};

/**
 * 텍스트에서 고유명사, URL, 의미 있는 수치를 비식별화합니다.
 * @param {string} text 원본 텍스트
 * @returns {string} 비식별화된 텍스트
 */
export function sanitize(text) {
  if (!text) return text;
  
  let sanitized = text;

  // 1-A: Named Entity 강제 마스킹
  ENTITY_REGISTRY.COMPANIES.forEach(entity => {
    // 단순 replaceAll 사용 시 띄어쓰기/조사 문제 대응이 어려울 수 있으나 MVP로 진행
    const regex = new RegExp(entity, 'gi');
    sanitized = sanitized.replace(regex, '[OUR_COMPANY]');
  });

  ENTITY_REGISTRY.PEOPLE.forEach(entity => {
    const regex = new RegExp(entity, 'gi');
    sanitized = sanitized.replace(regex, '[PERSON]');
  });

  ENTITY_REGISTRY.COMPETITORS.forEach(entity => {
    const regex = new RegExp(entity, 'gi');
    sanitized = sanitized.replace(regex, '[COMPETITOR]');
  });

  // 1-B: URL 강제 제거 (http, https 등)
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '[URL_REMOVED]');

  // 1-C: 숫자 데이터 범위화 (Numeric Generalization)
  // 두 자리 수 이상 숫자를 정규식으로 캐치하여 익명화
  sanitized = sanitized.replace(/\b([1-9][0-9]+[만천백십]?)\b/g, (match) => {
    const cleanMatch = match.replace(/,/g, '');
    let n = parseInt(cleanMatch, 10);
    
    // 만약 "만(10000)" 등 한글 단위 표현이 결합되어 있다면 10000 이상으로 간주 (MVP 대응)
    if (match.includes('만')) n = n * 10000;
    if (match.includes('천')) n = n * 1000;

    if (isNaN(n)) return match;

    if (n < 100) return '[이하100]';
    if (n < 1000) return '[100~1000]';
    if (n < 10000) return '[수천]';
    if (n < 100000) return '[수만]';
    return '[대규모수치]';
  });

  // 추가로 콤마가 중간에 섞인 연속된 숫자(예: 30,000) 처리
  sanitized = sanitized.replace(/(\d{1,3}(,\d{3})+)/g, (match) => {
    const n = parseInt(match.replace(/,/g, ''), 10);
    if (n < 10000) return '[수천]';
    if (n < 100000) return '[수만]';
    return '[대규모수치]';
  });

  return sanitized.trim();
}

export default { sanitize, ENTITY_REGISTRY };
