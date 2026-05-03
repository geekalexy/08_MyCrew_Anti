import antigravityAdapter, { TEAM_BUILDER_TIMEOUT_MS } from '../adapters/antigravityAdapter.js';
import geminiAdapter from '../adapters/geminiAdapter.js';
import projectScaffolder from './projectScaffolder.js';
import dbManager from '../../database.js';
import teamActivator from '../teamActivator.js';
import { MODEL } from '../modelRegistry.js';

// [C-01] 구 ID → 허용 ID 보정 맵 (P-001 준수)
const LEGACY_ID_MAP = {
  'luca': 'dev_advisor',    'sonnet': 'dev_senior',  'opus': 'dev_advisor',
  'lumi': 'dev_ux',         'nova': 'mkt_designer',  'dev_lead': 'dev_fullstack',
  'visual_director': 'mkt_designer', 'marketing_lead': 'mkt_lead',
};
const ALLOWED_IDS = new Set([
  'dev_senior','dev_fullstack','dev_backend','dev_ux','dev_qa','dev_advisor',
  'mkt_lead','mkt_planner','mkt_designer','mkt_video','mkt_pm','mkt_analyst','assistant',
]);

class ZeroConfigService {
  async buildProject(projectData, broadcast = () => {}) {
    const { name, objective, isolation_scope } = projectData;

    console.log(`[Zero-Config] 프로젝트 빌딩 시작: ${name}`);

    // ─── 역할별 권장 모델 가이드 (SSOT) ─────────────────────────────────────
    const MODEL_GUIDE = `
[역할별 배정 모델 (MANDATORY — 반드시 아래 기준 준수)]
- dev_advisor   : anti-claude-opus-4.6-thinking   ← 아키텍처·전략 판단, 최고 사고력 필수
- dev_qa        : anti-claude-sonnet-4.6-thinking ← 품질 검증·리스크 탐지 (Opus 중복 방지, 균형형)
- dev_senior    : anti-claude-sonnet-4.6-thinking ← 시니어 개발, 균형형 실력
- dev_backend   : anti-claude-sonnet-4.6-thinking ← API·DB 설계, 균형형
- dev_fullstack : anti-gemini-3.1-pro-high        ← 풀스택 실행, 고속·다목적
- dev_ux        : anti-gemini-3.1-pro-high        ← UI/UX·디자인, 고속 실행
- mkt_lead      : anti-gemini-3.1-pro-high        ← 전략 리더, 고속
- mkt_planner   : anti-claude-sonnet-4.6-thinking ← 콘텐츠 기획, 균형형
- mkt_analyst   : anti-claude-opus-4.6-thinking   ← 데이터 분석·인사이트, 정밀 추론
- mkt_pm        : anti-claude-opus-4.6-thinking   ← 프로젝트 관리, 체계적 사고
- mkt_designer  : anti-gemini-3.1-pro-high        ← 비주얼 디자인, 고속 실행
- mkt_video     : anti-claude-sonnet-4.6-thinking ← 영상 기획, 균형형
- assistant     : anti-gemini-3.1-pro-high        ← 라우팅·조율, 고속
`;

    // ─── [Phase 35 v2] 1-Stage 원샷 파이프라인 (Gemini 3.1 Pro High) ────────
    // 변경 이유: 2-Stage Opus+Gemini(~114초) → 1-Stage 원샷(~35초), 품질 차이 미미
    const singleStagePrompt = `당신은 최고 수준의 AI 팀 빌더입니다.
사용자가 제공한 프로젝트 정보를 바탕으로, 깊이 있는 분석과 함께 최적의 팀 구성, 커스텀 스킬, 초기 태스크, 업무 프로세스를 설계하고
즉시 아래 [출력 형식]의 순수 JSON으로 반환하세요.

[프로젝트 정보]
- 프로젝트명: ${name}
- 목적 및 지시사항: ${objective}
- 데이터 격리 수준: ${isolation_scope ? isolation_scope.type : 'strict_isolation'}

[기획 가이드라인 (MANDATORY)]
1. 팀원 구성: 비서(assistant) 외 최소 3명, 프로젝트 특성에 맞게 4~5명으로 자율 확장.
   - 🔴 개발(IT) 프로젝트 → assigned_crew 첫 번째에 'dev_advisor' 반드시 포함 (Opus 배정 필수).
   - 아래 [역할별 배정 모델] 기준을 반드시 따라 다양한 모델 조합 구성.
2. 커스텀 스킬: 이 프로젝트에 특화된 스킬 3~5개를 설계하고 YAML Frontmatter 포함 마크다운으로 작성.
3. 초기 태스크: 칸반 보드에 즉시 등록할 핵심 태스크 3~5개 기획 (담당자는 아래 허용 ID 중 하나).
4. 업무 프로세스: R&R, /run 명령 스프린트 자율 완주 흐름 명시.

[⚠️ CRITICAL: 허용된 에이전트 ID (STRICT 정책)]
- 개발/IT: dev_senior, dev_fullstack, dev_backend, dev_ux, dev_qa, dev_advisor
- 마케팅/기획: mkt_lead, mkt_planner, mkt_designer, mkt_video, mkt_pm, mkt_analyst
- 위 목록 외 임의 ID 생성 시 시스템 치명적 오류 발생
${MODEL_GUIDE}

[출력 형식 — 반드시 순수 JSON 객체만 반환 (마크다운 백틱 절대 없이)]
{
  "project_charter_md": "# PROJECT: ... (프로젝트 헌장)",
  "team_roster_md": "# Team Roster\\n\\n... (R&R 및 커뮤니케이션 룰)",
  "work_process_md": "# Work Process\\n\\n... (/run 스프린트 자율 완주 흐름 포함)",
  "required_skills": [
    {
      "skill_id": "short_english_id",
      "skill_md": "---\\ndisplayName: 스킬명\\ndescription: 설명\\n---\\n# 스킬 본문"
    }
  ],
  "assigned_crew": [
    {
      "agent_id": "허용된 ID 중 하나 (예: dev_advisor, dev_fullstack)",
      "model": "역할별 배정 모델 anti-* 식별자 (예: anti-claude-opus-4.6-thinking)",
      "short_role": "역할코드 영어소문자",
      "role_description": "이 프로젝트에서의 구체적 역할 (1~2문장)",
      "persona_md": "# Persona: 에이전트ID\\n\\n... (임무 및 행동 지침)"
    }
  ],
  "initial_tasks": [
    {
      "title": "[유형] 태스크 제목",
      "content": "수행해야 할 구체적 작업 내용과 목표 (2~3문장)",
      "assignee": "담당 에이전트ID"
    }
  ]
}
`;

    let planData;
    try {
      // 1-Stage: Gemini 3.1 Pro High 원샷 (기획 + JSON 통합)
      broadcast(`[1/5] Gemini 3.1 Pro가 프로젝트를 분석하고 팀을 구성 중입니다...`);
      console.log('[Zero-Config] 1-Stage 가동 (Gemini 3.1 Pro High — 원샷 팀빌딩)...');

      const response = await antigravityAdapter.generateResponse(
        '프로젝트를 분석하고 최적의 팀 구성과 JSON 스캐폴드를 생성해주세요.',
        singleStagePrompt,
        'team_builder_gemini',
        MODEL.ANTI_GEMINI_PRO_HIGH,
        TEAM_BUILDER_TIMEOUT_MS  // 2분 타임아웃
      );

      const rawText = response.text || response.result;
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON 파싱 실패 (1-Stage 응답에 JSON 블록 없음)');

      planData = JSON.parse(jsonMatch[0]);
      broadcast(`[2/5] 팀 구성 완료. 정책 검증 중입니다...`);

    } catch (err) {
      console.warn(`[Zero-Config] 브릿지 1-Stage 실패 (${err.message}). Gemini API 직접 Fallback 가동...`);

      // 🚀 Fallback: Gemini API 직접 호출 (브릿지 무관 — 항상 성공 보장)
      broadcast(`[1/5] 브릿지 연결 실패. Gemini API로 직접 팀 구성 중입니다...`);
      try {
        const fallbackRes = await geminiAdapter.generateResponse(
          singleStagePrompt,
          '당신은 AI 팀 빌더입니다. 반드시 순수 JSON만 반환하세요.',
          MODEL.PRO  // gemini-2.5-pro 직접 API 호출
        );
        const rawText = fallbackRes.text || fallbackRes.result || '';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Fallback JSON 파싱 실패');
        planData = JSON.parse(jsonMatch[0]);
        broadcast(`[2/5] Fallback 팀 구성 완료. 정책 검증 중입니다...`);
      } catch (fallbackErr) {
        throw new Error(`팀빌딩 전체 실패 — 브릿지: ${err.message} / Fallback: ${fallbackErr.message}`);
      }
    }

    // 스키마 검증
    if (!planData || !planData.assigned_crew || !planData.initial_tasks) {
      throw new Error('기획된 데이터 형식이 올바르지 않습니다.');
    }

    // ─── [C-01 FIX] 구 ID 강제 보정 (P-001) ──────────────────────────────
    broadcast(`[3/5] 정책 검증 중: 팀원 ID 확인 및 어드바이저 자동 배정...`);
    planData.assigned_crew = planData.assigned_crew.map(c => {
      const rawId = (c.agent_id || '').toLowerCase();
      const normalizedId = LEGACY_ID_MAP[rawId] || rawId;
      if (!ALLOWED_IDS.has(normalizedId)) {
        console.warn(`[Zero-Config] ⚠️ 허용되지 않은 agent_id: "${rawId}" → dev_fullstack 보정`);
        return { ...c, agent_id: 'dev_fullstack' };
      }
      return { ...c, agent_id: normalizedId };
    });
    planData.initial_tasks = planData.initial_tasks.map(t => {
      const rawId = (t.assignee || '').toLowerCase();
      const normalizedId = LEGACY_ID_MAP[rawId] || rawId;
      return { ...t, assignee: ALLOWED_IDS.has(normalizedId) ? normalizedId : 'assistant' };
    });

    // ─── [ADVISOR-FIX] 개발 프로젝트 dev_advisor 강제 포함 ──────────────
    const isDevProject = (isolation_scope?.type === 'strict_isolation')
      || planData.assigned_crew.some(c => (c.agent_id || '').startsWith('dev_'));
    const hasAdvisor = planData.assigned_crew.some(c => c.agent_id === 'dev_advisor');

    if (isDevProject && !hasAdvisor) {
      console.log('[Zero-Config] 개발 프로젝트에 dev_advisor 미포함 → 자동 추가 (Opus Thinking)');
      planData.assigned_crew.unshift({
        agent_id: 'dev_advisor',
        model: MODEL.ANTI_OPUS_THINK,
        short_role: 'advisor',
        role_description: '프로젝트 기술 리더로서 아키텍처 설계, 태스크 분해, 기술 의사결정을 주도합니다.',
        persona_md: '# Persona: dev_advisor\n\n## 임무\n이 프로젝트의 수석 아키텍트로서 기술 전략을 수립하고 팀원들의 작업을 조율합니다.\n\n## 행동 지침\n- 모든 태스크는 아키텍처 관점에서 먼저 분해합니다.\n- /run 명령 시 가장 먼저 스프린트 계획을 수립하고 팀원에게 배정합니다.\n- 기술 부채를 최소화하고 확장 가능한 설계를 추구합니다.\n',
      });
    }

    // ─── [C-02] required_skills 미생성 시 기본 스킬 보장 ───────────────
    if (!planData.required_skills || planData.required_skills.length === 0) {
      console.warn('[Zero-Config] required_skills 미생성 — 기본 운영 스킬로 보완');
      planData.required_skills = [
        {
          skill_id: 'sprint_run_guide',
          skill_md: '---\ndisplayName: /run 스프린트 가이드\ndescription: AI 크루가 /run 명령 시 자율로 스프린트를 완주하는 업무 프로세스\n---\n# /run 스프린트 가이드\n\n## 실행 순서\n1. 칸반 PENDING 태스크 선택\n2. dev_advisor가 분해 및 담당자 배정\n3. 병렬 실행 → 완료 보고\n4. QA 검토 → DONE\n',
        },
        {
          skill_id: 'team_operation_rules',
          skill_md: '---\ndisplayName: 팀 운영 규칙\ndescription: 커뮤니케이션 룰, R&R, 에스컬레이션 기준\n---\n# 팀 운영 규칙\n\n## R&R\n- CEO: 방향 결정 및 최종 승인\n- dev_advisor: 기술 결정 및 태스크 분해\n- 각 전문가: 담당 영역 자율 수행\n',
        },
      ];
    }

    // ─── [W-01] work_process_md 누락 시 기본 템플릿 ────────────────────
    if (!planData.work_process_md) {
      planData.work_process_md = `# Work Process — ${name}\n\n## 기본 업무 흐름\n1. CEO가 목표 설정 → 칸반 태스크 발행\n2. dev_advisor가 태스크 분해 및 크루 배정\n3. 각 크루 자율 실행 → 완료 보고\n4. CEO 검토 → 다음 스프린트 진행\n\n## /run 명령\n\`/run\` 입력 시 PENDING 태스크를 크루가 자율 완주합니다.\n`;
    }

    if (!planData.project_charter_md) {
      planData.project_charter_md = `# PROJECT: ${name}\n\n## 🎯 프로젝트 개요\n${objective}\n\n## 🛑 대원칙 및 톤앤매너\n- (팀과 합의 후 추가 예정)\n`;
    }

    // Stage 4: DB 트랜잭션
    broadcast(`[4/5] 팀 구성을 데이터베이스에 등록 중입니다...`);
    const projectId = `proj-${Date.now()}`;
    await dbManager.createZeroConfigProject(
      projectId, name, objective, isolation_scope,
      planData.assigned_crew, planData.initial_tasks,
      planData.required_skills  // [SKILL-FIX] LLM 설계 커스텀 스킬 전달
    );
    broadcast(`[4/5] 팀원 ${planData.assigned_crew.length}명 등록 완료. 프로젝트 파일 시스템 구성 중입니다...`);

    // strict_isolation → DEV 스킬 자동 장착
    if (isolation_scope && isolation_scope.type === 'strict_isolation') {
      console.log('[Zero-Config] strict_isolation 감지 — 개발팀(DEV) 스킬셋 자동 장착...');
      try {
        await teamActivator.activate('development');
      } catch (e) {
        console.warn('[Zero-Config] DEV 스킬 장착 실패:', e.message);
      }
    }

    // Stage 5: 파일시스템 스캐폴딩
    broadcast(`[5/5] 프로젝트 폴더와 팀원 페르소나 파일을 생성 중입니다...`);
    try {
      await projectScaffolder.scaffoldProjectWorkspace(
        projectId, name, objective, planData.assigned_crew, planData
      );
    } catch (scaffoldErr) {
      console.error('[Zero-Config] 물리적 폴더 스캐폴딩 실패 (DB는 정상 생성됨):', scaffoldErr.message);
    }

    console.log(`[Zero-Config] 프로젝트 빌딩 성공: ${projectId}`);
    return projectId;
  }
}

export default new ZeroConfigService();
