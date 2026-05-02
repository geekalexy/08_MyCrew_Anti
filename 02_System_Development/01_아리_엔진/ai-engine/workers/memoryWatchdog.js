import fs from 'fs';
import path from 'path';
import geminiAdapter from '../adapters/geminiAdapter.js';

// 프로젝트 최상위 루트 (엔진의 두 단계 위)
const PROJECTS_ROOT = process.env.PROJECTS_ROOT_PATH || path.join(process.cwd(), '../../04_Projects');
const MAX_MEMORY_LINES = 200;

class MemoryWatchdog {
  constructor() {
    this.isProcessing = false;
  }

  start() {
    // 1분마다 현재 시간을 체크하여 자정(00:00)이면 실행
    setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        this.runWatchdog();
      }
    }, 60 * 1000);
    console.log('[MemoryWatchdog] ✅ Auto-Memory Watchdog 크론 스케줄러 등록 완료 (매일 자정 - 1분 주기 체크)');
  }

  // 외부(대시보드 등) 강제 트리거용
  async runWatchdog() {
    if (this.isProcessing) {
      console.log('[MemoryWatchdog] 이미 실행 중입니다. 스킵.');
      return;
    }
    this.isProcessing = true;
    console.log(`[MemoryWatchdog] 자율 기억 승급 파이프라인 시작... (${new Date().toISOString()})`);

    try {
      if (!fs.existsSync(PROJECTS_ROOT)) {
        console.warn(`[MemoryWatchdog] 루트 경로를 찾을 수 없습니다: ${PROJECTS_ROOT}`);
        return;
      }

      const projects = fs.readdirSync(PROJECTS_ROOT).filter(f => {
        const fullPath = path.join(PROJECTS_ROOT, f);
        return fs.statSync(fullPath).isDirectory();
      });

      for (const projectDir of projects) {
        await this.processProject(path.join(PROJECTS_ROOT, projectDir));
      }
    } catch (err) {
      console.error('[MemoryWatchdog] 실행 중 에러:', err);
    } finally {
      this.isProcessing = false;
      console.log(`[MemoryWatchdog] 자율 기억 승급 파이프라인 완료.`);
    }
  }

  async processProject(projectPath) {
    const logsDir = path.join(projectPath, '01_Memory', 'daily_session_logs');
    if (!fs.existsSync(logsDir)) return;

    const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.md'));
    if (files.length === 0) return;

    console.log(`[MemoryWatchdog] 프로젝트 스캔: ${path.basename(projectPath)} (로그 ${files.length}개 발견)`);

    for (const file of files) {
      const filePath = path.join(logsDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (!content.trim()) {
            await this.safeArchive(filePath, projectPath, file);
            continue;
        }

        const digest = await this.digestLog(content);
        if (digest) {
          await this.promoteMemory(projectPath, digest, file);
          await this.safeArchive(filePath, projectPath, file);
        }
      } catch (err) {
        console.error(`[MemoryWatchdog] 파일 처리 실패 (${file}):`, err);
      }
    }
  }

  async digestLog(content) {
    const systemPrompt = `
당신은 시스템의 지식을 영구 자산화하는 Memory Watchdog(메모리 분석관)입니다.
주어진 일일 세션 로그를 분석하여, 다음 3가지 핵심 정보를 추출하고 순수 JSON 형식으로 반환하세요.

1. user_feedback: 사용자가 명시적으로 요구한 패턴이나 기호
2. project_consensus: 기획/아키텍처/작업 방식에 대해 크루 간 확정된 의사결정 및 합의 사항
3. anti_patterns: 같은 실수를 반복하지 않도록, 시도했으나 실패한 기술적 접근이나 오류 내역과 성공 사례 (트러블슈팅)

[출력 형식 — 반드시 순수 JSON 객체만 반환 (마크다운 백틱 절대 없이)]
{
  "user_feedback": ["피드백 1", "피드백 2"],
  "project_consensus": ["합의 1", "합의 2"],
  "anti_patterns": [
    {
      "keyword": "핵심키워드(영어 소문자와 언더스코어, 예: db_connection_error)",
      "content": "실패 사례 및 해결 방법 상세 설명"
    }
  ]
}
`;
    try {
      const res = await geminiAdapter.generateResponse(
        content,
        systemPrompt,
        'gemini-2.5-flash'
      );
      
      const rawText = res.text || res.result;
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON 파싱 실패 (응답 포맷 오류)');
      
      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error('[MemoryWatchdog] LLM Digestion 에러:', err.message);
      return null;
    }
  }

  async promoteMemory(projectPath, digest, sourceFile) {
    const memoryDir = path.join(projectPath, '01_Memory');
    if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });

    const today = new Date().toISOString().split('T')[0];
    const header = `\n\n## [${today} 요약] (Source: ${sourceFile})\n`;

    // 1. User Memory
    if (digest.user_feedback && digest.user_feedback.length > 0) {
      const userMemPath = path.join(memoryDir, 'user_memory.md');
      const text = header + digest.user_feedback.map(f => `- ${f}`).join('\n') + '\n';
      fs.appendFileSync(userMemPath, text);
      this.enforceMaxLines(userMemPath);
    }

    // 2. Project Memory
    if (digest.project_consensus && digest.project_consensus.length > 0) {
      const projMemPath = path.join(memoryDir, 'project_memory.md');
      const text = header + digest.project_consensus.map(c => `- ${c}`).join('\n') + '\n';
      fs.appendFileSync(projMemPath, text);
      this.enforceMaxLines(projMemPath);
    }

    // 3. Acquired Experience (Anti-Patterns)
    if (digest.anti_patterns && digest.anti_patterns.length > 0) {
      const expDir = path.join(memoryDir, 'acquired_experience');
      if (!fs.existsSync(expDir)) fs.mkdirSync(expDir, { recursive: true });

      const dateStr = today.replace(/-/g, '');
      for (const pattern of digest.anti_patterns) {
        const fileName = `${dateStr}_${pattern.keyword || 'anti_pattern'}.md`;
        const filePath = path.join(expDir, fileName);
        const mdContent = `# Acquired Experience: ${pattern.keyword}\n\n## Date\n${today}\n\n## Context & Anti-Pattern\n${pattern.content}\n`;
        fs.writeFileSync(filePath, mdContent);
      }
    }
  }

  enforceMaxLines(filePath) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    if (lines.length > MAX_MEMORY_LINES) {
      // 가장 오래된 엔트리부터 Trim (상단 내용 제거)
      const trimmed = lines.slice(lines.length - MAX_MEMORY_LINES).join('\n');
      fs.writeFileSync(filePath, trimmed);
    }
  }

  async safeArchive(sourcePath, projectPath, fileName) {
    const archiveDir = path.join(projectPath, '01_Memory', 'auto_memory');
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

    const targetPath = path.join(archiveDir, fileName);

    // [PRD 반영] Copy -> Verify -> Delete 3단계 패턴
    fs.copyFileSync(sourcePath, targetPath);
    
    const sourceStat = fs.statSync(sourcePath);
    const targetStat = fs.statSync(targetPath);

    if (sourceStat.size === targetStat.size) {
      fs.unlinkSync(sourcePath);
      console.log(`[MemoryWatchdog] SafeArchive 완료: ${fileName}`);
    } else {
      console.error(`[MemoryWatchdog] SafeArchive 검증 실패 (사이즈 불일치): ${fileName}`);
    }
  }
}

export default new MemoryWatchdog();
