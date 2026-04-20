import fs from 'fs';
import path from 'path';
import urlParser from './urlParser.js';
import geminiAdapter from '../adapters/geminiAdapter.js';

/**
 * 온보딩 URL 스캔 및 팀 컨텍스트 추출 파이프라인
 */
export async function processOnboardingUrl(url, tenantPath = null) {
  console.log(`[OnboardingPipeline] 스캔 시작: ${url}`);
  
  // 1. URL 파싱
  const textContent = await urlParser.fetch(url);
  if (!textContent) {
    throw new Error("해당 URL에서 유효한 텍스트를 파싱할 수 없습니다. 접근이 차단되었거나 문서가 비어있습니다.");
  }

  // Tenant Folder (기본값: 프로젝트 루트/01_Company_Operations/04_HR_온보딩/TenantContext)
  // 향후 다중 Tenant 지원 시 이 경로가 동적으로 결정되어야 합니다.
  const targetFolder = tenantPath || path.resolve(process.cwd(), '../../01_Company_Operations/04_HR_온보딩/TenantContext');
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  // 2. 프롬프트 구성 및 순차적 LLM 호출 (Rate Limit 방지를 위해 순차 실행)
  const systemBase = `당신은 최고 수준의 AI 온보딩 분석가입니다. 제공된 텍스트를 기반으로 조직에 완벽히 세팅된 문서를 생성해야 합니다. 모든 출력은 마크다운(Markdown) 포맷으로 작성하세요. 불필요한 인사말 없이 바로 본론부터 출력하세요.`;
  
  const makeUserPrompt = (docType) => `
다음은 기업 홈페이지에서 추출한 본문입니다:
---
${textContent}
---

위 내용을 바탕으로 조직을 위한 **${docType}** 문서를 생성해 주세요.
`;

  const generateTasks = [
    { 
      filename: 'team.md', 
      prompt: '마케팅 에이전트 팀이 공유할 "행동 지침서(Team Guidelines)"를 작성해 주세요. 주 타겟층, 브랜드 보이스(어조/말투), 에이전트 간의 협업 프로토콜 등을 상세히 명시하세요.' 
    },
    { 
      filename: 'brand_guideline.md', 
      prompt: '해당 기업의 핵심 브랜드 가치, 미션, 비전, 브랜드 아이덴티티를 요약한 브랜드 가이드라인 분석 문서를 작성해 주세요.' 
    },
    { 
      filename: 'business_context.md', 
      prompt: '기업의 주요 비즈니스 모델, 주요 서비스/제품 라인업, 시장 내 강점 등을 분석한 비즈니스 컨텍스트(Business Context) 문서를 작성해 주세요.' 
    }
  ];

  const results = {};

  for (const task of generateTasks) {
    console.log(`[OnboardingPipeline] ${task.filename} 생성 중...`);
    const gen = await geminiAdapter.generateResponse(makeUserPrompt(task.filename), systemBase + '\n' + task.prompt);
    
    const filePath = path.join(targetFolder, task.filename);
    fs.writeFileSync(filePath, gen.text, 'utf-8');
    results[task.filename] = filePath;
    
    // 약간의 딜레이 (Rate Limit 안전장치)
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`[OnboardingPipeline] 완료. 파일이 ${targetFolder} 에 저장되었습니다.`);
  return results;
}
