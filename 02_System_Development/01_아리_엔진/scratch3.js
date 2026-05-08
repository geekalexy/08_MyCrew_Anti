import dbManager from './database.js';

async function test() {
  const projects = await dbManager.getProjects();
  console.log(projects);
}
test().catch(console.error);
