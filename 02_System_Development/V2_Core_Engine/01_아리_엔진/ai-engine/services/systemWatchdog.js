import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SystemWatchdog {
  constructor() {
    this.systemRoot = path.resolve(__dirname, '../../../../../');
    this.systemWikiDir = path.join(this.systemRoot, '09_MyCrew_Wiki');
    this.graphOutDir = path.join(this.systemWikiDir, '99_System_Graph');
  }

  async ensureSystemOntologyDirectories() {
    const dirs = [
      '10_Engine_Core',
      '20_Frontend_UX',
      '30_Agents_Rules',
      '50_Security_Policy',
      '70_Pipeline_IO',
      '80_Agent_Brain_Logs',
      '85_History_Essays',
      '90_Architecture_Decisions',
      '99_System_Graph'
    ];
    
    for (const d of dirs) {
      await fs.mkdir(path.join(this.systemWikiDir, d), { recursive: true });
    }
  }

  async updateSystemGraph() {
    try {
      console.log('🔄 [SystemWatchdog] System Graphify 스캔 시작...');
      await this.ensureSystemOntologyDirectories();
      
      const scriptPath = path.resolve(__dirname, '../../graphify_mcp.py');
      
      // --system 옵션으로 MyCrew 코어 코드와 에이전트 브레인 동시 스캔
      const { stdout, stderr } = await execFileAsync('python3', [
        scriptPath,
        '--update', this.systemRoot,
        '--out-dir', this.graphOutDir,
        '--system'
      ]);
      
      if (stderr) console.warn('[SystemWatchdog] Python Warning:', stderr);
      console.log('✅ [SystemWatchdog] System Graphify 갱신 완료!');
      
      return true;
    } catch (e) {
      console.error('❌ [SystemWatchdog] System Graphify update failed:', e.message);
      return false;
    }
  }
}

export default new SystemWatchdog();
