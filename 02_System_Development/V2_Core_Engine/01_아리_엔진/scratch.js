import dbManager from './database.js';
import contextChainService from './ai-engine/services/contextChainService.js';

async function test() {
  const result = await contextChainService.resolveChainDetails('#15C1', 'proj-1');
  console.log(JSON.stringify(result, null, 2));
}
test().catch(console.error);
