import dbManager from './database.js';

async function test() {
  const globalTaskId = await dbManager.getTaskIdByProjectNum('proj-1', 15);
  console.log('Global Task ID for 15:', globalTaskId);
  if (globalTaskId) {
     const comments = await dbManager.getComments(globalTaskId);
     console.log('Comments count:', comments.length);
     console.log(comments.map((c, i) => `[${i}] ${c.id}: ${c.content.slice(0,20)}`));
  }
}
test().catch(console.error);
