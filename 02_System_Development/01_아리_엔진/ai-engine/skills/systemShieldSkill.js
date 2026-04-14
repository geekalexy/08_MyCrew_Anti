import crypto from 'crypto';

class SystemShieldSkill {
  constructor() {
    this.duplicateCache = new Map(); // hash -> timestamp
    this.rateLimitCache = new Map(); // agentId -> { count, windowStart }
    
    this.DUPLICATE_COOLDOWN_MS = 60 * 1000; // 60초 완전히 동일한 텍스트 쿨타임
    this.RATE_LIMIT_MAX_REQUESTS = 5;       // 분당 최대 5회 허용
    this.RATE_LIMIT_WINDOW_MS = 60 * 1000;  // 1분
    
    // 자동 메모리 정리 기능
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // 5분마다 오래된 찌꺼기 삭제
  }

  // 1. 중복 요청(Idempotency) 방어
  checkDuplicate(content, agentId) {
    if (!content) return false;
    
    const hash = crypto.createHash('sha256').update(`${agentId}:${content.trim()}`).digest('hex');
    const now = Date.now();
    
    const lastSeen = this.duplicateCache.get(hash);
    if (lastSeen && (now - lastSeen) < this.DUPLICATE_COOLDOWN_MS) {
      return true; // 차단해야 함 (중복)
    }
    
    this.duplicateCache.set(hash, now);
    return false; // 통과
  }

  // 2. 분당 요청량 한도 폭주(Rate Limiting) 방어
  checkRateLimit(agentId) {
    const now = Date.now();
    let record = this.rateLimitCache.get(agentId) || { count: 0, windowStart: now };
    
    // 윈도우(1분)가 지났으면 카운터 초기화
    if (now - record.windowStart > this.RATE_LIMIT_WINDOW_MS) {
      record = { count: 1, windowStart: now };
    } else {
      record.count += 1;
    }
    
    this.rateLimitCache.set(agentId, record);
    
    if (record.count > this.RATE_LIMIT_MAX_REQUESTS) {
      return true; // 차단해야 함 (폭주)
    }
    
    return false; // 통과
  }

  // 3. 메인 게이트 함수
  applyShield(content, agentId) {
    // 1번 관문
    if (this.checkDuplicate(content, agentId)) {
      console.warn(`[System Shield] 🚫 차단됨 (60초 이내 중복 요청): agent=${agentId}`);
      return this.getBlockResponse('동일한 요청이 60초 이내에 연속으로 감지되어 API를 보호하기 위해 차단했습니다.');
    }
    
    // 2번 관문
    if (this.checkRateLimit(agentId)) {
      console.warn(`[System Shield] 🚫 차단됨 (분당 5회 한도 초과 폭주): agent=${agentId}`);
      return this.getBlockResponse('현재 너무 많은 요청(1분당 5회 이상)이 발생하고 있습니다. 과부하를 막기 위해 일시 차단되었습니다. 잠시 후 다시 시도해주세요.');
    }
    
    return null; // 차단하지 않음 (Pass)
  }

  getBlockResponse(reason) {
    return {
      text: `[System Shield 방어막 작동 🛡️]\n${reason}`,
      model: 'system-shield-layer3',
      category: 'BLOCKED',
      score: 0,
    };
  }
  
  cleanup() {
    const now = Date.now();
    
    for (const [hash, time] of this.duplicateCache.entries()) {
      if (now - time > this.DUPLICATE_COOLDOWN_MS) {
        this.duplicateCache.delete(hash);
      }
    }
    
    for (const [agent, record] of this.rateLimitCache.entries()) {
      if (now - record.windowStart > this.RATE_LIMIT_WINDOW_MS) {
        this.rateLimitCache.delete(agent);
      }
    }
  }
}

export default new SystemShieldSkill();
