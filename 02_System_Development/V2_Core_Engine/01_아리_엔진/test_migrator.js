import { runMigrations } from './db_migrator.js';
runMigrations().then(() => console.log('✅ SUCCESS')).catch(e => console.error('❌ FAIL:', e));
