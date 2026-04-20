import fs from 'fs';
import path from 'path';

/**
 * Context Injector (Phase 22 - Priority 2)
 * 고성능 어댑터(CLI, Code Agent 등)에게 태스크를 위임할 때,
 * 파일 폴링이나 터미널 환경에서도 우리 팀의 정체성과 룰, 스킬을 인지할 수 있도록
 * 영구 컨텍스트(SOUL)와 시스템 워크플로우를 하나로 묶어(Stringify) 주입하는 모듈입니다.
 */
class ContextInjector {
  constructor() {
    this.rootPath = path.resolve(process.cwd(), '../../');
    // 엔진이 서브폴더에 있을 경우를 대비한 대체 경로
    this.fallbackPath = process.cwd();
  }

  _safeReadFile(filename) {
    let p = path.join(this.rootPath, filename);
    if (!fs.existsSync(p)) {
      p = path.join(this.fallbackPath, filename);
    }
    
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf-8');
    }
    return '';
  }

  /**
   * MyCrew의 범용 컨텍스트(영구 기억)를 수집합니다.
   * @returns {string} 수집된 범용 컨텍스트 문자열
   */
  getGlobalContext() {
    const filesToInject = [
      'MYCREW.md', 
      'IDENTITY.md', 
      '01_Company_Operations/04_HR_온보딩/strategic_memory.md',
      'AGENTS.md'
    ];
    
    let contextBuffer = '[GLOBAL CONTEXT - MYCREW WORKSPACE]\n';
    
    filesToInject.forEach(file => {
      const content = this._safeReadFile(file);
      if (content) {
        contextBuffer += `\n--- [${path.basename(file)}] ---\n${content.slice(0, 3000)}\n`;
      }
    });

    return contextBuffer.trim();
  }

  /**
   * 태스크별 특정 지식(Skill, Rule 등)을 주입 가능한 문자열로 패키징합니다.
   * @param {string} systemPrompt - 스킬별 고유 프롬프트
   * @param {string} livingRules - 동적 룰 하베스터로 추출된 룰
   * @returns {string} 조합된 태스크 특정 컨텍스트
   */
  getTaskContext(systemPrompt, livingRules) {
    let taskContext = '[TASK SPECIFIC INSTRUCTIONS]\n';
    
    if (livingRules && livingRules.trim() !== '') {
      taskContext += `\n[LIVING TEAM GROUND RULES - MUST FOLLOW]\n${livingRules}\n`;
    }
    
    if (systemPrompt && systemPrompt.trim() !== '') {
      taskContext += `\n[SKILL LOGIC]\n${systemPrompt}\n`;
    }

    return taskContext.trim();
  }

  /**
   * 최종적으로 어댑터에게 전달할 완벽한 주입형 페이로드를 생성합니다.
   * 기존 executor 내부에서 난잡하게 합치던 로직을 이 곳으로 완전히 격리합니다.
   * 
   * @param {string} systemPrompt 
   * @param {string} livingRules 
   * @returns {string} 
   */
  buildInjectionPayload(systemPrompt, livingRules) {
    const globalCtx = this.getGlobalContext();
    const taskCtx = this.getTaskContext(systemPrompt, livingRules);
    
    return `${globalCtx}\n\n${taskCtx}`;
  }
}

export default new ContextInjector();
