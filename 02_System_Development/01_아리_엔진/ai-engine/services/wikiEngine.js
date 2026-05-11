import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import dbManager from '../../database.js';
import geminiAdapter from '../adapters/geminiAdapter.js';
import { MODEL } from '../modelRegistry.js';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WikiEngine {
  constructor() {
    this.wikiDirName = 'Project_WIKI';
  }

  async getProjectRoot(projectId) {
    const projectRow = await dbManager.getProjectById(projectId);
    if (!projectRow) return null;
    const projectDirName = `${projectRow.name.replace(/[^a-zA-Z0-9가-힣]/g, '_').replace(/_+/g, '_')}_${projectRow.id.slice(-5)}`;
    return path.resolve(process.cwd(), '../../04_Users/01_Company/01_Projects', projectDirName);
  }

  async ensureOntologyDirectories(wikiRoot) {
    const dirs = [
      '00_Index',
      '10_Product',
      '20_Domain',
      '30_Requirements',
      '40_Flows',
      '50_Business_Rules',
      '60_Roles_Permissions',
      '70_External_Integrations',
      '90_Decisions',
      '99_Graph_Data',
      'raw/meetings'
    ];
    
    for (const d of dirs) {
      await fs.mkdir(path.join(wikiRoot, d), { recursive: true });
    }
  }

  async updateGraphify(projectRoot) {
    try {
      // Execute Python engine to Detect & Extract (generates graph.json)
      const scriptPath = path.resolve(__dirname, '../../graphify_mcp.py');
      await execAsync(`python3 "${scriptPath}" --update "${projectRoot}"`);
      return true;
    } catch (e) {
      console.error('[WikiEngine] Graphify update failed:', e.message);
      return false;
    }
  }

  async generateOntology(projectId) {
    try {
      const projectRow = await dbManager.getProjectById(projectId);
      if (!projectRow) throw new Error('프로젝트를 찾을 수 없습니다.');
      
      const projectRoot = await this.getProjectRoot(projectId);
      if (!projectRoot) throw new Error('프로젝트 루트 경로를 확인할 수 없습니다.');

      const wikiRoot = path.join(projectRoot, this.wikiDirName);
      await this.ensureOntologyDirectories(wikiRoot);

      console.log(`[WikiEngine] Graphify 엔진 트리거: ${projectId}`);
      const graphUpdated = await this.updateGraphify(projectRoot);
      if (!graphUpdated) throw new Error('그래프 추출에 실패했습니다.');

      // Read extracted graph.json
      const graphPath = path.join(projectRoot, 'graph.json');
      let graphData;
      try {
        const raw = await fs.readFile(graphPath, 'utf-8');
        graphData = JSON.parse(raw);
        // Move graph.json to 99_Graph_Data to respect zero-copy/ontology rule
        await fs.rename(graphPath, path.join(wikiRoot, '99_Graph_Data', 'graph.json'));
      } catch (e) {
        throw new Error('graph.json 파일을 읽을 수 없습니다.');
      }

      const elements = graphData.elements || [];
      const decisions = [];
      const concepts = [];
      const sections = [];

      // Cluster nodes by type
      for (const el of elements) {
        const data = el.data || {};
        if (data.type === 'decision') decisions.push(data.label || data.id);
        if (data.type === 'concept') concepts.push(data.id);
        if (data.type === 'section') sections.push(data.label || data.id);
      }

      console.log(`[WikiEngine] 노드 분류 완료. Decisions: ${decisions.length}, Concepts: ${concepts.length}`);

      // Export 90_Decisions (ADR)
      if (decisions.length > 0) {
        const adrPrompt = `다음은 회의록에서 추출된 프로젝트 의사결정(Decision) 노드들입니다.\n${decisions.join('\n')}\n이를 바탕으로 마크다운 형식의 DECISION_LOG.md(의사결정 기록)를 작성해주세요. (배경, 결정사항, 영향도로 구조화)`;
        const adrRes = await geminiAdapter.generateResponse(adrPrompt, "당신은 아키텍처 의사결정 기록자입니다.", MODEL.PRO);
        if (adrRes?.text) {
          await fs.writeFile(path.join(wikiRoot, '90_Decisions', 'DECISION_LOG.md'), adrRes.text, 'utf-8');
        }
      }

      // Export 20_Domain (Glossary)
      if (concepts.length > 0) {
        const domainPrompt = `다음은 프로젝트 문서에서 추출된 도메인 개념(Concept) 링크들입니다.\n${concepts.join('\n')}\n이를 바탕으로 마크다운 형식의 용어 사전(Glossary.md)을 작성해주세요. 각 용어에 대한 간단한 추론 정의를 포함하세요.`;
        const domainRes = await geminiAdapter.generateResponse(domainPrompt, "당신은 도메인 설계자입니다.", MODEL.PRO);
        if (domainRes?.text) {
          await fs.writeFile(path.join(wikiRoot, '20_Domain', 'Glossary.md'), domainRes.text, 'utf-8');
        }
      }

      // Export 00_Index (PROJECT_WIKI.md Master Index)
      const indexPrompt = `프로젝트 명: ${projectRow.name}\n목표: ${projectRow.objective}\n현재까지 수집된 노드 수: ${elements.length}\n이 프로젝트의 전체 지식을 아우르는 00_Index/PROJECT_WIKI.md 문서를 생성해주세요. 다른 온톨로지 폴더(10_Product ~ 90_Decisions)로 안내하는 인덱스 역할을 해야 합니다.`;
      const indexRes = await geminiAdapter.generateResponse(indexPrompt, "당신은 프로젝트 관리자입니다.", MODEL.PRO);
      if (indexRes?.text) {
        await fs.writeFile(path.join(wikiRoot, '00_Index', 'PROJECT_WIKI.md'), indexRes.text, 'utf-8');
      }

      console.log(`[WikiEngine] 온톨로지 Export 완료: ${projectId}`);
      return true;

    } catch (err) {
      console.error('[WikiEngine] 온톨로지 위키 생성 실패:', err.message);
      return false;
    }
  }
}

export default new WikiEngine();
