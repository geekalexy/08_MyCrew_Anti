import dbManager from '../../database.js';

/**
 * 🔐 KeyProvider: 기밀 정보(API Key, Token) 추상화 브릿지
 * 1순위: 메모리 캐시 (성능 최적화)
 * 2순위: DB user_settings (온보딩 위저드에서 저장한 값)
 * 3순위: .env (레거시/개발자 설정용 폴발)
 */
class KeyProvider {
  constructor() {
    this._cache = new Map();
  }

  /**
   * 키 값을 비동기로 가져옵니다.
   * @param {string} keyName 
   * @returns {Promise<string|null>}
   */
  async getKey(keyName) {
    // 1. 메모리 캐시 확인
    if (this._cache.has(keyName)) {
      return this._cache.get(keyName);
    }

    // 2. DB (user_settings) 확인
    try {
      // database.js의 getSetting 혹은 직접 조회를 가정 (추후 DB매니저에 메서드 추가 필요)
      const dbValue = await dbManager.getSetting(keyName);
      if (dbValue) {
        this._cache.set(keyName, dbValue);
        return dbValue;
      }
    } catch (err) {
      // DB 조회 실패 시 무시하고 다음 단계로
    }

    // 3. 환경 변수 (.env) 확인
    const envValue = process.env[keyName];
    if (envValue) {
      this._cache.set(keyName, envValue);
      return envValue;
    }

    return null;
  }

  /**
   * 온보딩/설정 탭에서 새로운 키를 저장할 때 호출합니다. 
   * 캐시를 즉시 갱신하여 서버 재시작 없이 반영되게 합니다.
   */
  async setKey(keyName, value) {
    if (!keyName || !value) return;
    
    // DB 저장
    await dbManager.setSetting(keyName, value);
    
    // 캐시 즉시 갱신
    this._cache.set(keyName, value);
    
    console.log(`[KeyProvider] ${keyName} 보안 키가 갱신되었습니다. (즉시 반영됨)`);
  }

  /**
   * DB에 저장하지 않고 메모리에만 휘발성으로 키를 유지합니다. (OAuth 토큰용)
   */
  setVolatileKey(keyName, value) {
    this._cache.set(keyName, value);
  }

  /**
   * 마스킹된 값을 반환합니다 (UI 표시용)
   */
  async getMaskedKey(keyName) {
    const value = await this.getKey(keyName);
    if (!value) return null;
    if (value.length <= 8) return '****';
    return `${value.slice(0, 4)}••••${value.slice(-4)}`;
  }
}

export default new KeyProvider();
