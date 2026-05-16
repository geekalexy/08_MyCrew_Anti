import dbManager, { rawDb } from '../database.js';

class CategoryTaskService {
  /**
   * Task Master가 기획한 10개 대분류별 JSON 플랜을 실제 여러 장의 카드로 생성합니다.
   * 원자성(Atomicity) 보장을 위해 트랜잭션을 사용합니다.
   * @param {string|number} parentTaskId 원본 카드 ID
   * @param {Array} tasksGroupedByCategory [{ category: 'Backend', title: '...', depends_on: '...', description: '...' }, ...]
   */
  async createCategoryTasks(parentTaskId, tasksGroupedByCategory) {
    const parentTask = await dbManager.getTaskById(parentTaskId);
    if (!parentTask) {
      throw new Error(`Parent task ${parentTaskId} not found.`);
    }

    const projectId = parentTask.project_id;
    const requester = parentTask.requester || 'Task Master';

    return new Promise((resolve, reject) => {
      rawDb.serialize(() => {
        rawDb.run('BEGIN TRANSACTION');

        const insertStmt = rawDb.prepare(`
          INSERT INTO Task (content, status, requester, execution_mode, category, parent_task_id, depends_on, project_id, title)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let errorOccurred = null;
        const createdIds = [];

        for (const task of tasksGroupedByCategory) {
          const content = task.description || '';
          const status = 'TODO';
          const execution_mode = 'DEV'; 
          const category = task.category || 'UNKNOWN';
          const depends_on = task.depends_on ? JSON.stringify(task.depends_on) : null;
          const title = task.title || `[${category}] Task`;

          insertStmt.run([content, status, requester, execution_mode, category, parentTaskId, depends_on, projectId, title], function(err) {
            if (err) {
              errorOccurred = err;
            } else {
              createdIds.push(this.lastID);
            }
          });
        }

        insertStmt.finalize((err) => {
          if (err && !errorOccurred) errorOccurred = err;

          if (errorOccurred) {
            rawDb.run('ROLLBACK', () => {
              reject(errorOccurred);
            });
          } else {
            rawDb.run('COMMIT', () => {
              resolve(createdIds);
            });
          }
        });
      });
    });
  }
}

export default new CategoryTaskService();
