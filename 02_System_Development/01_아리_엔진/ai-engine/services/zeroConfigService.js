import antigravityAdapter from '../adapters/antigravityAdapter.js';
import geminiAdapter from '../adapters/geminiAdapter.js';
import projectScaffolder from './projectScaffolder.js';
import dbManager from '../../database.js';

class ZeroConfigService {
  async buildProject(projectData) {
    const { name, objective, isolation_scope } = projectData;

    console.log(`[Zero-Config] 프로젝트 빌딩 시작: ${name}`);

    // DB에서 전체 에이전트 풀 및 스킬 동적 로드
    // [Prime Fix #1] SYSTEM_AGENTS 배열 + id 기반 필터 — 한국어 role 문자열 의존 제거
    // role 값 변경 시 silent 실패 위험 방어. 새 시스템 에이전트 추가 시 이 배열만 수정.
    const SYSTEM_AGENTS = ['ari'];
    const allAgents = await dbManager.getAllAgentProfiles();
    const crewAgents = allAgents.filter(agent => !SYSTEM_AGENTS.includes(agent.id));
    let dynamicAgentPool = '';
    for (const agent of crewAgents) {
      const skills = await dbManager.getAgentSkills(agent.id);
      const activeSkills = skills.filter(s => s.is_active).map(s => s.skill_id).join(', ') || '없음';

      dynamicAgentPool += `- Agent ID: ${agent.id}\n`;
      dynamicAgentPool += `  - 닉네임: ${agent.nickname || agent.id}\n`;
      dynamicAgentPool += `  - 역할: ${agent.role}\n`;
      dynamicAgentPool += `  - 모델 스토리지: ${agent.model || '기본 할당'}\n`;
      dynamicAgentPool += `  - 스킬 라이브러리: ${activeSkills}\n`;
    }

    // [B-09 Fix] 확장된 JSON 스키마 — LLM이 PROJECT.md 헌장 + 페르소나 본문까지 직접 생성
    const systemPrompt = `
당신은 최고의 시스템 설계자이자 AI 크루 오케스트레이터입니다.
대표님이 새로운 프로젝트의 이름과 목적을 제공했습니다.
이 프로젝트를 성공적으로 수행하기 위해, 현재 가용한 AI 크루 중에서 최적의 인원들을 선발하여 팀을 구성하고,
그들이 즉시 착수해야 할 초기 태스크(백로그)들을 기획하세요.

[프로젝트 정보]
- 프로젝트명: ${name}
- 목적 및 지시사항: ${objective}
- 데이터 격리 수준: ${isolation_scope ? isolation_scope.type : 'strict_isolation'}

[가용 에이전트 풀] (반드시 아래 목록에서만 선발)
${dynamicAgentPool}

[팀 빌딩 & 백로그 기획 규칙 (MANDATORY)]
1. 핵심 인력 정확히 3명으로만 구성. 과다 투입 금지.
2. 프로젝트 성격(개발/마케팅/디자인 등)에 최적화된 에이전트 조합을 선택할 것.
3. initial_tasks는 즉시 착수 가능한 구체적인 태스크 3~5개만 생성할 것.

[출력 형식 — 반드시 순수 JSON 객체만 반환 (마크다운 백틱 절대 없이)]
{
  "project_charter_md": "# PROJECT: 프로젝트명\\n\\n## 🎯 프로젝트 개요\\n목적과 핵심 가치를 2~3문장으로 설명.\\n\\n## 🛑 대원칙 및 톤앤매너\\n- 이 프로젝트에서 반드시 지켜야 할 핵심 원칙 3~5가지.\\n\\n## 🚀 성공 지표\\n- 성공 판단 기준 2~3가지.",
  "assigned_crew": [
    {
      "agent_id": "에이전트ID (소문자, 풀 목록의 Agent ID 사용)",
      "short_role": "역할코드 영어소문자 (예: architect, coder, designer, marketer, advisor)",
      "role_description": "이 프로젝트에서의 구체적인 역할과 책임 (1~2문장)",
      "persona_md": "# Persona: 에이전트ID\\n\\n## 이 프로젝트에서의 임무\\n역할 상세.\\n\\n## 행동 지침\\n- 행동 원칙 3~5가지.\\n\\n## 전문 역량\\n- 이 프로젝트에서 집중할 전문 분야."
    }
  ],
  "initial_tasks": [
    {
      "title": "[유형] 태스크 제목 (유형: Research/Architecture/Design/Plan/Implement)",
      "assignee": "담당 에이전트ID"
    }
  ]
}
`;

    let planData;
    try {
      // 1. Primary: Antigravity Bridge (Luca — 시스템 아키텍트)
      console.log('[Zero-Config] Primary 엔진 가동 (Antigravity Bridge / Luca)...');

      const bridgeResponse = await antigravityAdapter.generateResponse(
        '프로젝트를 기획하고 JSON 형식으로 크루와 태스크를 구성해주세요.',
        systemPrompt,
        'luca'
      );

      const rawText = bridgeResponse.text || bridgeResponse.result;
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON 파싱 실패 (브릿지 응답 포맷 오류)');

      planData = JSON.parse(jsonMatch[0]);

    } catch (err) {
      console.warn(`[Zero-Config] Primary 엔진 실패 (${err.message}). Fallback 엔진(Gemini 2.5 Pro) 가동...`);

      // 2. Fallback: Gemini 2.5 Pro JSON 직접 호출
      const fallbackPrompt = `JSON 형식으로만 대답하세요.\n\n${systemPrompt}`;
      const fallbackRes = await geminiAdapter.generateResponse(
        '프로젝트를 기획하고 JSON 형식으로 크루와 태스크를 구성해주세요.',
        fallbackPrompt,
        'gemini-2.5-pro'
      );

      const jsonMatch = fallbackRes.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Fallback JSON 파싱 실패');
      planData = JSON.parse(jsonMatch[0]);
    }

    // 스키마 검증
    if (!planData || !planData.assigned_crew || !planData.initial_tasks) {
      throw new Error('기획된 데이터 형식이 올바르지 않습니다.');
    }
    // project_charter_md 누락 시 기본값 (구버전 LLM 응답 호환)
    if (!planData.project_charter_md) {
      planData.project_charter_md = `# PROJECT: ${name}\n\n## 🎯 프로젝트 개요\n${objective}\n\n## 🛑 대원칙 및 톤앤매너\n- (팀과 합의 후 추가 예정)\n`;
    }

    // 3. DB 트랜잭션 실행
    const projectId = `proj-${Date.now()}`;
    await dbManager.createZeroConfigProject(
      projectId,
      name,
      objective,
      isolation_scope,
      planData.assigned_crew,
      planData.initial_tasks
    );

    // 4. (Phase 31) 파일시스템 스캐폴딩 — LLM 생성 콘텐츠 전달
    try {
      await projectScaffolder.scaffoldProjectWorkspace(
        projectId,
        name,
        objective,
        planData.assigned_crew,
        planData.project_charter_md  // [B-09 Fix] LLM이 직접 작성한 PROJECT.md 본문
      );
    } catch (scaffoldErr) {
      console.error('[Zero-Config] 물리적 폴더 스캐폴딩 실패 (DB는 정상 생성됨):', scaffoldErr.message);
      // 스캐폴딩 실패는 DB 롤백 없이 경고만 — projectId는 정상 반환
    }

    console.log(`[Zero-Config] 프로젝트 빌딩 성공: ${projectId}`);
    return projectId;
  }
}

export default new ZeroConfigService();
