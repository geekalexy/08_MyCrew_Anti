/**
 * BaseAdapter (고성능 실행 레이어 추상화 모델)
 * Phase 22 아키텍처에 정의된 공통 인터페이스입니다.
 * 모든 어댑터는 이 클래스를 상속받아야 하며, Controller(Ari 엔진)는
 * 내부 구현의 세부 사항을 알지 못한 채 execute()만 호출합니다.
 */
export default class BaseAdapter {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * 태스크 컨텍스트를 주입받아 비동기로 자율 실행을 수행합니다.
   * @param {Object} taskContext - { taskId, content, systemPrompt, modelConfig, agentId, ... }
   * @returns {Promise<Object>} - 초기 접수 응답 { status: 'queued' | 'started', taskId }
   */
  async execute(taskContext) {
    throw new Error('Adapter must implement execute() method');
  }

  /**
   * 진행 중인 작업을 강제로 중단합니다.
   * @param {string} taskId
   */
  async abort(taskId) {
    throw new Error('Adapter must implement abort() method');
  }

  /**
   * 튜댑터의 현재 가용성(Health) 상태를 체크합니다.
   * @returns {Promise<Object>} - { status: 'ok'|'error', details }
   */
  async healthCheck() {
    throw new Error('Adapter must implement healthCheck() method');
  }
}
