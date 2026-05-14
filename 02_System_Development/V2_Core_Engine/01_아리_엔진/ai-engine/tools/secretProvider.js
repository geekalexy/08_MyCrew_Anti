import { execFileSync } from 'child_process';
import os from 'os';

/**
 * [Phase 44-3 / GAP-008] 데몬 Keychain 추상화 (SecretProvider)
 * macOS Keychain과 Linux/Docker ENV 폴백을 지원합니다.
 */
class SecretProvider {
  /**
   * macOS 환경인지 확인
   */
  isMac() {
    return os.platform() === 'darwin';
  }

  /**
   * 키체인 또는 ENV에서 비밀값을 가져옵니다.
   * @param {string} serviceName - 키체인 서비스 이름 (예: mycrew-daemon)
   * @param {string} accountName - 키체인 계정 이름 (예: API_KEY)
   * @returns {string|null}
   */
  getSecret(serviceName, accountName) {
    if (this.isMac()) {
      try {
        const result = execFileSync('security', [
          'find-generic-password',
          '-s', serviceName,
          '-a', accountName,
          '-w'
        ], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        return result.trim();
      } catch (err) {
        // 키체인에 없으면 에러 발생, ENV로 폴백 진행
      }
    }

    // Fallback 1: 서비스 이름과 계정 이름 조합 (예: MYCREW_DAEMON_API_KEY)
    const envKey = `${serviceName.toUpperCase().replace(/-/g, '_')}_${accountName.toUpperCase().replace(/-/g, '_')}`;
    if (process.env[envKey]) {
      return process.env[envKey];
    }
    
    // Fallback 2: 계정 이름만 (예: API_KEY)
    if (process.env[accountName]) {
      return process.env[accountName];
    }

    return null;
  }

  /**
   * 키체인에 비밀값을 안전하게 저장합니다. (macOS 한정)
   * Linux 환경에서는 ENV나 Secret Manager를 사용해야 하므로 No-op 처리.
   * @param {string} serviceName
   * @param {string} accountName
   * @param {string} secretValue
   * @returns {boolean} 성공 여부
   */
  setSecret(serviceName, accountName, secretValue) {
    if (this.isMac()) {
      try {
        // 1. 기존 값이 있다면 삭제 (오류 무시)
        try {
          execFileSync('security', [
            'delete-generic-password',
            '-s', serviceName,
            '-a', accountName
          ], { stdio: 'ignore' });
        } catch (e) {
          // 키체인에 아직 등록되지 않은 경우 무시
        }

        // 2. 새 값으로 추가
        execFileSync('security', [
          'add-generic-password',
          '-s', serviceName,
          '-a', accountName,
          '-w', secretValue
        ], { stdio: 'ignore' });
        return true;
      } catch (err) {
        console.error(`[SecretProvider] macOS 키체인 저장 실패: ${err.message}`);
        return false;
      }
    } else {
      console.warn(`[SecretProvider] macOS가 아니므로 키체인에 저장할 수 없습니다. 환경변수(${accountName})를 직접 구성해 주세요.`);
      return false;
    }
  }
}

export default new SecretProvider();
