import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import dbManager from '../../database.js';
import { fileURLToPath } from 'url';

// [C-001 Fix] exec() → execFile() 으로 교체. Shell Injection 공격 벡터 근절.
const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WikiEngine {
  constructor() {
    this.wikiDirName = 'Project_WIKI';
    // [H-002 Fix] 디바운스 타이머 맵 (프로젝트별)
    this._debounceTimers = new Map();
    this._DEBOUNCE_MS = 10_000; // 10초 디바운스
  }

  async getProjectRoot(projectId) {
    const projectRow = await dbManager.getProjectById(projectId);
    if (!projectRow) return null;
    const projectDirName = `${projectRow.name.replace(/[^a-zA-Z0-9가-힣]/g, '_').replace(/_+/g, '_')}_${projectRow.id.slice(-5)}`;
    // Fix: Use __dirname to reliably locate the 04_Users folder. 5 times '..' reaches 08_MyCrew_Anti.
    return path.resolve(__dirname, '../../../../../../04_Users/01_Company/01_Projects', projectDirName);
  }

  async ensureOntologyDirectories(wikiRoot) {
    const dirs = [
      '00_Index', '10_Product', '20_Domain', '30_Requirements',
      '40_Flows', '50_Business_Rules', '60_Roles_Permissions',
      '70_External_Integrations', '90_Decisions', '99_Graph_Data', 'raw/meetings'
    ];
    for (const d of dirs) {
      await fs.mkdir(path.join(wikiRoot, d), { recursive: true });
    }
  }

  async updateGraphify(projectRoot, projectId = null) {
    try {
      // [Phase 42-4] 로컬 graphify 바이너리로 프로젝트별 개별 그래프만 업데이트
      // [CEO 정책] global add 전면 폐기 — B타입 포함 모든 프로젝트 간 그래프 병합 금지
      // 각 프로젝트는 독립적인 graphify-out/graph.json만 유지합니다.
      await execFileAsync('graphify', ['update', projectRoot]);

      return true;
    } catch (e) {
      console.error('[WikiEngine] Graphify update failed:', e.message);
      if (e.stderr) console.error('[WikiEngine] Graphify stderr:', e.stderr);
      return false;
    }
  }

  _buildDecisionLog(decisions) {
    const now = new Date().toISOString().slice(0, 10);
    let md = `# 📋 의사결정 기록 (Decision Log)\n\n> 자동 생성일: ${now} | 총 ${decisions.length}건\n\n`;
    md += `| # | 결정사항 | 추출 신뢰도 |\n|---|---------|------------|\n`;
    decisions.forEach((d, i) => { md += `| ${i + 1} | ${d} | ● Algorithm Extracted |\n`; });
    return md;
  }

  _buildGlossary(concepts) {
    const now = new Date().toISOString().slice(0, 10);
    let md = `# 📖 도메인 용어 사전 (Glossary)\n\n> 자동 생성일: ${now} | 총 ${concepts.length}건\n\n`;
    concepts.forEach(c => { md += `### ${c}\n- *Graph에서 자동 추출된 도메인 개념 노드입니다.*\n\n`; });
    return md;
  }

  _buildCategoryMarkdown(title, sections) {
    const now = new Date().toISOString().slice(0, 10);
    let md = `# 📑 ${title}\n\n> 자동 생성일: ${now} | 총 ${sections.length}개 항목\n\n`;
    sections.forEach(s => { md += `### ${s}\n- *Graph 구조에서 탐지된 섹션입니다.*\n\n`; });
    return md;
  }

  _buildProjectIndex(projectName, objective, elements, decisions, concepts, sections) {
    const now = new Date().toISOString().slice(0, 10);
    let md = `# 🏠 ${projectName} — Project Wiki Index\n\n`;
    md += `> 자동 생성일: ${now} | Graphify 알고리즘 기반\n\n`;
    md += `## 프로젝트 목표\n${objective || '(미설정)'}\n\n`;
    md += `## 지식 그래프 통계\n`;
    md += `- 총 노드/엣지: **${elements.length}**개\n`;
    md += `- 의사결정(Decision): **${decisions.length}**건\n`;
    md += `- 도메인 개념(Concept): **${concepts.length}**건\n`;
    md += `- 문서 섹션(Section): **${sections.length}**건\n\n`;
    md += `## 온톨로지 폴더 안내\n`;
    md += `| 폴더 | 설명 |\n|------|------|\n`;
    md += `| \`10_Product/\` | 제품 비전, 타겟 오디언스, 핵심 가치 |\n`;
    md += `| \`20_Domain/\` | 도메인 모델, 용어 사전 (Glossary) |\n`;
    md += `| \`30_Requirements/\` | 기능 명세 및 요구사항 |\n`;
    md += `| \`40_Flows/\` | 유저 여정, 상태 전이 다이어그램 |\n`;
    md += `| \`50_Business_Rules/\` | 비즈니스 로직 제약사항 |\n`;
    md += `| \`90_Decisions/\` | 의사결정 기록 (ADR) |\n`;
    md += `| \`99_Graph_Data/\` | 원본 그래프 데이터 (graph.json) |\n`;
    return md;
  }

  /**
   * [H-001 Fix] 디바운스 래퍼 — 댓글 1건당 Ontology 재생성 방지
   * 최소 10초 간격으로만 실제 파이프라인을 트리거합니다.
   */
  generateOntology(projectId) {
    return new Promise((resolve) => {
      const existing = this._debounceTimers.get(projectId);
      if (existing) clearTimeout(existing);
      
      const timer = setTimeout(async () => {
        this._debounceTimers.delete(projectId);
        try {
          await this._executeOntologyPipeline(projectId);
          resolve(true);
        } catch (err) {
          console.error('[WikiEngine] 온톨로지 위키 생성 실패:', err.message);
          resolve(false);
        }
      }, this._DEBOUNCE_MS);
      
      this._debounceTimers.set(projectId, timer);
    });
  }

  async _executeOntologyPipeline(projectId) {
    const projectRow = await dbManager.getProjectById(projectId);
    if (!projectRow) throw new Error('프로젝트를 찾을 수 없습니다.');
    
    const projectRoot = await this.getProjectRoot(projectId);
    if (!projectRoot) throw new Error('프로젝트 루트 경로를 확인할 수 없습니다.');

    const wikiRoot = path.join(projectRoot, this.wikiDirName);
    await this.ensureOntologyDirectories(wikiRoot);

    console.log(`[WikiEngine] Graphify 엔진 트리거: ${projectId}`);
    const graphUpdated = await this.updateGraphify(projectRoot, projectId);
    if (!graphUpdated) throw new Error('그래프 추출에 실패했습니다.');

    // Read extracted graph.json (공식 Graphify 출력 경로는 graphify-out 폴더)
    const graphPath = path.join(projectRoot, 'graphify-out', 'graph.json');
    let graphData;
    try {
      const raw = await fs.readFile(graphPath, 'utf-8');
      graphData = JSON.parse(raw);
      
      // [Fix D-003] Zero-Copy 원칙: SQLite DB 칸반 데이터를 직접 조회하여 동적 노드로 추가 (파일 쓰기 없음)
      try {
        const tasks = await dbManager.getAllTasksByProjectId(projectId) || [];
        graphData.nodes = graphData.nodes || [];
        graphData.links = graphData.links || [];
        
        tasks.forEach(task => {
          const taskNodeId = `Task::[${task.status}] ${task.title}`;
          graphData.nodes.push({ id: taskNodeId, type: 'task', label: task.title, file_type: 'task' });
          // 태스크와 연관된 에이전트를 엣지로 연결
          if (task.assigned_agent) {
            graphData.links.push({ source: taskNodeId, target: task.assigned_agent, relation: 'ASSIGNED_TO', confidence: 1.0 });
          }
        });
        console.log(`[WikiEngine] Zero-Copy DB 인젝션: 칸반 태스크 ${tasks.length}개 추가`);
      } catch (dbErr) {
        console.warn('[WikiEngine] 칸반 DB Zero-Copy 연동 실패:', dbErr.message);
      }
      
      // [M-003 Fix] rename → copyFile: 원본 graph.json을 파괴하지 않고 복사
      await fs.writeFile(path.join(wikiRoot, '99_Graph_Data', 'graph.json'), JSON.stringify(graphData, null, 2));
    } catch (e) {
      throw new Error('graph.json 파일을 읽을 수 없습니다: ' + e.message);
    }

    const elements = graphData.nodes || [];
    const decisions = [];
    const concepts = [];
    const sections = [];

    // Cluster nodes by type
    for (const data of elements) {
      const type = data.type || data.file_type || '';
      if (type === 'decision') decisions.push(data.label || data.id);
      if (type === 'concept') concepts.push(data.id);
      if (type === 'section') sections.push(data.label || data.id);
    }

    console.log(`[WikiEngine] 노드 분류 완료. Decisions: ${decisions.length}, Concepts: ${concepts.length}, Sections: ${sections.length}`);

    // Categorize sections
    const ontology = {
      product: [], requirements: [], flows: [], rules: [], external: [], other: []
    };

    sections.forEach(s => {
      const lower = s.toLowerCase();
      if (lower.match(/(목표|비전|가치|타겟|개요|product|vision)/)) ontology.product.push(s);
      else if (lower.match(/(요구사항|명세|기능|requirements|feature)/)) ontology.requirements.push(s);
      else if (lower.match(/(흐름|여정|flow|journey|상태)/)) ontology.flows.push(s);
      else if (lower.match(/(로직|규칙|제약|정책|rule|policy)/)) ontology.rules.push(s);
      else if (lower.match(/(연동|외부|api|integration|인터페이스)/)) ontology.external.push(s);
      else ontology.other.push(s);
    });

    if (decisions.length > 0) {
      const adrMd = this._buildDecisionLog(decisions);
      await fs.writeFile(path.join(wikiRoot, '90_Decisions', 'DECISION_LOG.md'), adrMd, 'utf-8');
    }

    if (concepts.length > 0) {
      const glossaryMd = this._buildGlossary(concepts);
      await fs.writeFile(path.join(wikiRoot, '20_Domain', 'Glossary.md'), glossaryMd, 'utf-8');
    }

    if (ontology.product.length > 0) {
      await fs.writeFile(path.join(wikiRoot, '10_Product', 'Product_Vision.md'), this._buildCategoryMarkdown('Product Vision & Target', ontology.product), 'utf-8');
    }
    if (ontology.requirements.length > 0) {
      await fs.writeFile(path.join(wikiRoot, '30_Requirements', 'Requirements.md'), this._buildCategoryMarkdown('Requirements & Features', ontology.requirements), 'utf-8');
    }
    if (ontology.flows.length > 0) {
      await fs.writeFile(path.join(wikiRoot, '40_Flows', 'Flows.md'), this._buildCategoryMarkdown('User Flows & States', ontology.flows), 'utf-8');
    }
    if (ontology.rules.length > 0) {
      await fs.writeFile(path.join(wikiRoot, '50_Business_Rules', 'Business_Rules.md'), this._buildCategoryMarkdown('Business Rules & Policies', ontology.rules), 'utf-8');
    }
    if (ontology.external.length > 0) {
      await fs.writeFile(path.join(wikiRoot, '70_External_Integrations', 'Integrations.md'), this._buildCategoryMarkdown('External Integrations & APIs', ontology.external), 'utf-8');
    }

    const indexMd = this._buildProjectIndex(
      projectRow.name, projectRow.objective, elements, decisions, concepts, sections
    );
    await fs.writeFile(path.join(wikiRoot, '00_Index', 'PROJECT_WIKI.md'), indexMd, 'utf-8');

    console.log(`[WikiEngine] 온톨로지 Export 완료 (LLM 0회): ${projectId}`);
    return true;
  }
}

export default new WikiEngine();
