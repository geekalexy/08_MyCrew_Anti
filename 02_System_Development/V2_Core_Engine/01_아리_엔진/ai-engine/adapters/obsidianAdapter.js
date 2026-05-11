import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import 'dotenv/config';

// .env 에 선언된 옵시디언 볼트 경로. 없으면 상위 폴더의 IP 폴더를 임시로 사용
const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || path.resolve(process.cwd(), '../02_지식_및_IP/옵시디언_뇌');

class ObsidianAdapter {
  /**
   * ripgrep(rg)를 사용하여 옵시디언 볼트를 초고속(수 ms)으로 딥서칭합니다.
   * @param {string} keyword 검색할 단어
   * @returns {string[]} 검색된 문서들의 경로 목록
   */
  search(keyword) {
    if (!keyword || keyword.trim() === '') return [];
    
    // 볼트 폴더가 없으면 생성 후 빈 배열 반환
    if (!fs.existsSync(VAULT_PATH)) {
      fs.mkdirSync(VAULT_PATH, { recursive: true });
      return [];
    }

    try {
      const result = execFileSync('rg', [
        '--files-with-matches', // 파일명만 반환
        '--type', 'md',         // Markdown 파일 한정
        '--max-count', '1',     // 존재 유무만 알면 되므로 첫 매치에서 중단(속도 향상)
        '-i',                   // 대소문자 무시
        keyword,
        VAULT_PATH
      ], { encoding: 'utf-8', timeout: 5000 });

      return result.trim().split('\n').filter(Boolean);
    } catch (err) {
      // rg는 매칭 실패 시 status 코드 1을 내뱉음 (정상 동작)
      if (err.status === 1) {
        return [];
      }
      console.warn(`[Obsidian] 검색 경고 (ripgrep 설치 필요): ${err.message}`);
      return [];
    }
  }

  /**
   * Task 완료 시, 해당 결과를 포맷팅하여 옵시디언 마크다운 파일로 백업합니다.
   * 백링크와 태그가 동적 주입됩니다.
   * @param {Object} task DB에서 업데이트를 마친 Task 객체 전문
   */
  archiveTask(task) {
    const dateStr = new Date().toISOString().split('T')[0];
    
    // 특수문자 제거 후 파일명 생성
    const safeTitle = task.content.replace(/[^a-zA-Z0-9가-힣_-]/g, '_').substring(0, 30);
    const fileName = `${dateStr}_Task${task.id}_${safeTitle}.md`;
    // 대표님이 생성하신 마이크루 전용 폴더
    const targetDir = path.join(VAULT_PATH, '07_Mycrew_obcidian');
    const destPath = path.join(targetDir, fileName);

    const content = `---
type: execution_log
task_id: ${task.id}
date: ${new Date().toISOString()}
executor: ${task.execution_mode || 'ari'}
---

# Task #${task.id}: ${task.content}

### Execution Detail
- **Status**: COMPLETED
- **Requester**: ${task.requester || 'User'}
- **Model / Delegator**: ${task.model || 'Unknown'}

---
### 🧠 연결 지식 망 (Backlinks)
[[Task_${task.id}]] #ExecutionLog #${task.execution_mode || 'ari'}
`;

    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(destPath, content, 'utf-8');
      console.log(`[Obsidian] 태스크 아카이빙 완료: ${fileName}`);
      return destPath;
    } catch (err) {
      console.error(`[Obsidian] 아카이빙 에러:`, err.message);
      return null;
    }
  }
}

export default new ObsidianAdapter();
