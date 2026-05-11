import dbManager from './database.js';

async function run() {
  const tasks = await new Promise((resolve, reject) => {
    dbManager.db.all(`SELECT id FROM Task WHERE project_id = 'proj-1777862333403' AND id >= 1777811330667892`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  console.log(`Found ${tasks.length} tasks to delete.`);
  for (const t of tasks) {
    try {
      await dbManager.deleteTask(t.id);
    } catch(err) {
      console.error(`Error deleting ${t.id}`, err);
    }
  }
  console.log('Done.');
  process.exit(0);
}
run();
