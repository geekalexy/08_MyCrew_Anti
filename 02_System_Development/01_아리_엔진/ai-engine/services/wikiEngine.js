import fs from 'fs/promises';
import path from 'path';
import dbManager from '../../database.js';
import geminiAdapter from '../adapters/geminiAdapter.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WikiEngine {
  constructor() {
    this.wikiDirName = '.mycrew/wiki';
  }

  async getProjectRoot(projectId) {
    const projectRow = await dbManager.getProjectById(projectId);
    if (!projectRow) return null;
    const projectDirName = `${projectRow.name.replace(/[^a-zA-Z0-9가-힣]/g, '_').replace(/_+/g, '_')}_${projectRow.id.slice(-5)}`;
    return path.resolve(process.cwd(), '../../04_Users/01_Company/01_Projects', projectDirName);
  }

  async ensureDirectories(projectRoot) {
    const wikiDir = path.join(projectRoot, this.wikiDirName);
    const rawDir = path.join(wikiDir, 'raw');
    const rulesDir = path.join(wikiDir, 'rules');
    
    await fs.mkdir(wikiDir, { recursive: true });
    await fs.mkdir(rawDir, { recursive: true });
    await fs.mkdir(rulesDir, { recursive: true });
    
    return { wikiDir, rawDir, rulesDir };
  }

  async readSources(projectRoot, rawDir) {
    const sources = {};
    
    // 1. 칸반 카드 수집 (최근 카드 20개 정도)
    // 실제로는 DB에서 가져오는 로직이 필요. 현재는 간단하게 생략 또는 Mocking.
    
    // 2. raw/ 디렉토리 수집
    try {
      const files = await fs.readdir(rawDir);
      const rawContents = [];
      for (const file of files) {
        if (file.endsWith('.txt') || file.endsWith('.md')) {
          const content = await fs.readFile(path.join(rawDir, file), 'utf-8');
          rawContents.push(`[${file}]\n${content}`);
        }
      }
      sources.raw = rawContents.join('\n\n');
    } catch (e) {
      sources.raw = '';
    }

    return sources;
  }

  async generateWiki(projectId) {
    try {
      const projectRow = await dbManager.getProjectById(projectId);
      if (!projectRow) throw new Error('프로젝트를 찾을 수 없습니다.');
      
      const projectType = (projectRow.project_type || 'development').toUpperCase();
      const projectRoot = await this.getProjectRoot(projectId);
      if (!projectRoot) throw new Error('프로젝트 루트 경로를 확인할 수 없습니다.');

      const { wikiDir, rawDir, rulesDir } = await this.ensureDirectories(projectRoot);

      // Rule 파일 읽기
      const ruleFileName = `WIKI_RULES_${projectType}.md`;
      const ruleFilePath = path.join(rulesDir, ruleFileName);
      let rulesContent = '';
      try {
        rulesContent = await fs.readFile(ruleFilePath, 'utf-8');
      } catch (e) {
        console.warn(`[WikiEngine] 규칙 파일 없음. 템플릿 복사 시도: ${ruleFilePath}`);
        try {
          const templatePath = path.resolve(__dirname, 'templates', ruleFileName);
          rulesContent = await fs.readFile(templatePath, 'utf-8');
          await fs.writeFile(ruleFilePath, rulesContent, 'utf-8');
        } catch (tmplErr) {
          console.warn(`[WikiEngine] 템플릿 파일도 없음. 기본 규칙 텍스트 사용.`);
          rulesContent = `
# 기본 위키 생성 규칙
이 프로젝트는 ${projectType} 유형입니다.
요약, 진행 상태, 핵심 결정 사항을 마크다운으로 정리해주세요.
          `;
        }
      }

      // 소스 데이터 수집
      const sources = await this.readSources(projectRoot, rawDir);
      
      // LLM 프롬프트 구성
      const systemPrompt = `당신은 MyCrew의 자율 Project Wiki Generator입니다.
당신은 주어진 데이터 소스와 규칙(WIKI_RULES)을 바탕으로 프로젝트 전체를 조망하는 PROJECT_WIKI.md 파일을 생성해야 합니다.

[WIKI_RULES]
${rulesContent}

반드시 완성된 마크다운 텍스트만 출력하세요. 추가적인 설명이나 인사말은 생략하세요.`;

      const userPrompt = `[프로젝트 정보]
이름: ${projectRow.name}
목표: ${projectRow.objective}
상태: ${projectRow.status}

[수집된 원본 소스 (raw/)]
${sources.raw || '(자료 없음)'}

위 내용을 바탕으로 최신 프로젝트 위키를 작성해주세요.`;

      // 생성 (비서 모델 대신 좀 더 큰 모델 혹은 빠르고 정확한 모델 사용)
      console.log(`[WikiEngine] 프로젝트 위키 갱신 시작: ${projectId}`);
      const response = await geminiAdapter.generateResponse(userPrompt, systemPrompt, 'gemini-1.5-pro'); // 또는 flash
      
      if (response && response.text) {
        const wikiPath = path.join(wikiDir, 'PROJECT_WIKI.md');
        await fs.writeFile(wikiPath, response.text, 'utf-8');
        console.log(`[WikiEngine] PROJECT_WIKI.md 갱신 완료: ${wikiPath}`);
        return true;
      }
    } catch (err) {
      console.error('[WikiEngine] 위키 생성 실패:', err.message);
      return false;
    }
  }
}

export default new WikiEngine();
