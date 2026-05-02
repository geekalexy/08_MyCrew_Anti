import fs from 'fs/promises';
import path from 'path';

// [B-03 Fix] rootPath 검증 — 시작 시 경로 존재 여부 확인
const PROJECTS_ROOT = process.env.PROJECTS_ROOT_PATH
  ? path.resolve(process.env.PROJECTS_ROOT_PATH)
  : path.resolve(process.cwd(), '../../04_Projects'); // fallback: 엔진 기준 상위로 올라가 워크스페이스 루트 04_Projects 참조

class ProjectScaffolder {
  constructor() {
    this.rootPath = PROJECTS_ROOT;
    // 시작 시 경고 출력 (env 미설정 감지)
    if (!process.env.PROJECTS_ROOT_PATH) {
      console.warn(`[ProjectScaffolder] ⚠️ PROJECTS_ROOT_PATH 환경변수 미설정 — fallback 경로 사용: ${this.rootPath}`);
    } else {
      console.log(`[ProjectScaffolder] ✅ 프로젝트 루트: ${this.rootPath}`);
    }
  }

  /**
   * 프로젝트 폴더 트리를 스캐폴딩합니다.
   * @param {string} projectId   DB에 생성된 프로젝트 ID (예: proj-1777...)
   * @param {string} name        프로젝트명
   * @param {string} objective   프로젝트 목적/헌장 (요약)
   * @param {Array}  assignedCrew [{agent_id, short_role, role_description, persona_md}]
   * @param {string} charterMd   LLM이 생성한 PROJECT.md 전체 본문
   */
  async scaffoldProjectWorkspace(projectId, name, objective, assignedCrew, charterMd) {
    let projectPath = null;
    try {
      // [B-01 Fix] 이중 접두사 제거 — projectId가 이미 'proj-'를 포함하므로 추가 접두사 없음
      // [B-02 Fix] 가독성 개선 — 프로젝트명_ID마지막5자리 형식
      const safeName = name.replace(/[^a-zA-Z0-9가-힣]/g, '_').replace(/_+/g, '_');
      const shortId = projectId.slice(-5); // proj-1746812345 → 12345
      const projectDirName = `${safeName}_${shortId}`;
      projectPath = path.join(this.rootPath, projectDirName);

      console.log(`[ProjectScaffolder] 스캐폴딩 시작: ${projectPath}`);

      // 루트 경로 생성
      await fs.mkdir(this.rootPath, { recursive: true });

      // 5-Tier 구조 폴더 생성
      const directories = [
        projectPath,
        path.join(projectPath, '.project'),
        path.join(projectPath, '.project', 'rules'),
        path.join(projectPath, '01_Memory'),
        path.join(projectPath, '01_Memory', 'daily_session_logs'),
        path.join(projectPath, '01_Memory', 'acquired_experience'),
        path.join(projectPath, '01_Memory', 'auto_memory'),
        path.join(projectPath, '01_Memory', 'trend_research'),
        path.join(projectPath, '02_Team'),
        path.join(projectPath, '03_Skills'),
        path.join(projectPath, '04_IO'),
        path.join(projectPath, '04_IO', 'inputs'),
        path.join(projectPath, '04_IO', 'outputs'),
      ];

      for (const dir of directories) {
        await fs.mkdir(dir, { recursive: true });
      }

      // ─── 핵심 파일: PROJECT.md ─────────────────────────────────────────────
      // [B-09 Fix] 하드코딩 제거 — LLM 생성 본문(charterMd)을 그대로 Write
      const finalCharter = charterMd || `# PROJECT: ${name}\n\n## 🎯 프로젝트 개요\n${objective}\n\n## 🛑 대원칙 및 톤앤매너\n- (팀과 합의 후 추가 예정)\n`;
      await fs.writeFile(path.join(projectPath, 'PROJECT.md'), finalCharter, 'utf-8');

      // ─── Memory 파일 ──────────────────────────────────────────────────────
      await fs.writeFile(
        path.join(projectPath, '01_Memory', 'user_memory.md'),
        `# User Memory — ${name}\n\n> 사용자의 취향, 선호 작업 방식, 피드백이 이곳에 누적됩니다.\n`,
        'utf-8'
      );
      await fs.writeFile(
        path.join(projectPath, '01_Memory', 'project_memory.md'),
        `# Project Memory — ${name}\n\n> 세션에서 결정된 핵심 아키텍처 및 진행 맥락이 이곳에 누적됩니다.\n`,
        'utf-8'
      );

      // ─── Team 구성 및 Persona 파일 ───────────────────────────────────────
      // [B-07 Fix] 파일명 포맷: {agent_id}_{short_role}_persona.md
      let rosterContent = `# ${name}팀 — Team Roster\n\n`;
      for (const agent of assignedCrew) {
        const agentId  = (agent.agent_id || agent.agent_name || 'unknown').toLowerCase();
        const shortRole = (agent.short_role || 'member').toLowerCase().replace(/\s+/g, '_');
        const roleDesc  = agent.role_description || agent.role || '팀원';

        rosterContent += `## ${agentId.toUpperCase()}\n`;
        rosterContent += `- **역할코드:** ${shortRole}\n`;
        rosterContent += `- **담당:** ${roleDesc}\n\n`;

        // [B-07 Fix] {agentId}_{shortRole}_persona.md
        const personaFileName = `${agentId}_${shortRole}_persona.md`;
        // [B-09 Fix] LLM이 생성한 persona_md 본문 사용. 없으면 최소 기본값
        const personaContent = agent.persona_md
          || `# Persona: ${agentId.toUpperCase()}\n\n## 이 프로젝트에서의 임무\n${roleDesc}\n\n## 행동 지침\n- 위 임무를 최우선으로 수행합니다.\n`;
        await fs.writeFile(path.join(projectPath, '02_Team', personaFileName), personaContent, 'utf-8');
      }
      await fs.writeFile(path.join(projectPath, '02_Team', 'team_roster.md'), rosterContent, 'utf-8');

      // ─── Skills 가이드라인 파일 ───────────────────────────────────────────
      await fs.writeFile(
        path.join(projectPath, '03_Skills', 'repetitive_tasks.md'),
        `# Repetitive Tasks — ${name}\n\n> 반복 작업 절차를 이곳에 명세합니다.\n`,
        'utf-8'
      );
      await fs.writeFile(
        path.join(projectPath, '03_Skills', 'heavy_analysis.md'),
        `# Heavy Analysis — ${name}\n\n> 무거운 데이터 분석 및 백그라운드 위임 작업 매뉴얼.\n`,
        'utf-8'
      );

      // ─── .project 컨텍스트 ────────────────────────────────────────────────
      await fs.writeFile(
        path.join(projectPath, '.project', 'context.md'),
        `# 세부 문맥 (Context) — ${name}\n\n> 상세한 기술/기획적 배경이 이곳에 기록됩니다.\n`,
        'utf-8'
      );

      console.log(`[ProjectScaffolder] ✅ 스캐폴딩 완료: ${projectDirName}`);
      return projectPath;

    } catch (err) {
      console.error(`[ProjectScaffolder] ❌ 스캐폴딩 오류:`, err.message);
      // [Task 1-C Fix] 부분 생성된 폴더 롤백 — 불완전한 폴더 상태 방지
      if (projectPath) {
        try {
          await fs.rm(projectPath, { recursive: true, force: true });
          console.warn(`[ProjectScaffolder] 🗑️ 불완전 폴더 롤백 완료: ${projectPath}`);
        } catch (rmErr) {
          console.error(`[ProjectScaffolder] 롤백 실패:`, rmErr.message);
        }
      }
      throw err;
    }
  }
}

export default new ProjectScaffolder();
