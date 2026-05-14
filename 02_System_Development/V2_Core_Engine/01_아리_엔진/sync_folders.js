import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import projectScaffolder from './ai-engine/services/projectScaffolder.js';

async function sync() {
    const DB_PATH = path.join(process.cwd(), 'database.sqlite');
    const db = new sqlite3.Database(DB_PATH);

    const projectsRoot = path.resolve(process.cwd(), '../../04_Users/01_Company/01_Projects');
    const trashRoot = path.join(projectsRoot, '.trash');
    if (!fs.existsSync(trashRoot)) fs.mkdirSync(trashRoot, { recursive: true });

    const rows = await new Promise((resolve, reject) => {
        db.all('SELECT id, name, status, objective FROM projects', (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    for (const p of rows) {
        const safeName = p.name.replace(/[^a-zA-Z0-9가-힣]/g, '_').replace(/_+/g, '_');
        const shortId = p.id.slice(-5);
        const pDirName = `${safeName}_${shortId}`;
        const pPath = path.join(projectsRoot, pDirName);

        if (p.status === 'deleted') {
            if (fs.existsSync(pPath)) {
                const trashPath = path.join(trashRoot, `${pDirName}_${Date.now()}`);
                fs.renameSync(pPath, trashPath);
                console.log(`[SYNC] Trash moved: ${pPath} -> ${trashPath}`);
            }
        } else if (p.status === 'active') {
            if (!fs.existsSync(pPath)) {
                console.log(`[SYNC] Scaffold required for active project: ${p.name}`);
                await projectScaffolder.scaffoldProjectWorkspace(p.id, p.name, p.objective || '', [], null);
                console.log(`[SYNC] Scaffolded: ${pPath}`);
            }
        }
    }
    console.log('[SYNC] Done.');
}

sync().catch(console.error);
