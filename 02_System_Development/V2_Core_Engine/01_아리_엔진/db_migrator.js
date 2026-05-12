import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const sqlite3Verbose = sqlite3.verbose();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'database.sqlite');
const migrationsDir = path.resolve(__dirname, 'migrations');

// 1. Backup Function
function backupDatabase() {
    if (!fs.existsSync(dbPath)) {
        console.log('[Migrator] No existing database found, skipping backup.');
        return;
    }
    
    // STRICT Policy: 백업은 안전한 시스템 저장소나 .bak 형태로 분리
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const backupPath = path.resolve(__dirname, `database.sqlite.${timestamp}.bak`);
    
    try {
        fs.copyFileSync(dbPath, backupPath);
        console.log(`[Migrator] Database backed up to ${backupPath}`);
    } catch (err) {
        console.error('[Migrator] CRITICAL: Failed to backup database!', err);
        throw err;
    }
}

// 2. Run Migrations
export async function runMigrations() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3Verbose.Database(dbPath);
        
        db.serialize(() => {
            // 마이그레이션 이력 테이블 생성
            db.run(`CREATE TABLE IF NOT EXISTS _migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT UNIQUE NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            // 기존 적용된 마이그레이션 목록 가져오기
            db.all(`SELECT filename FROM _migrations`, (err, rows) => {
                if (err) {
                    console.error('[Migrator] Failed to read _migrations table');
                    return reject(err);
                }
                
                const appliedMigrations = new Set(rows.map(row => row.filename));
                
                // 마이그레이션 폴더 없으면 생성
                if (!fs.existsSync(migrationsDir)) {
                    fs.mkdirSync(migrationsDir, { recursive: true });
                }
                
                // .sql 파일들 읽어서 오름차순 정렬 (001_, 002_, ...)
                const files = fs.readdirSync(migrationsDir)
                    .filter(f => f.endsWith('.sql'))
                    .sort();
                
                const pendingMigrations = files.filter(f => !appliedMigrations.has(f));
                
                if (pendingMigrations.length === 0) {
                    console.log('[Migrator] Database is up to date.');
                    db.close();
                    return resolve();
                }
                
                // 백업 수행
                try {
                    backupDatabase();
                } catch(e) {
                    db.close();
                    return reject(e);
                }
                
                console.log(`[Migrator] Found ${pendingMigrations.length} pending migrations.`);
                
                // 트랜잭션 기반 순차 실행
                db.run('BEGIN TRANSACTION');
                
                let hasError = false;
                
                const executeNext = (index) => {
                    if (index >= pendingMigrations.length) {
                        if (!hasError) {
                            db.run('COMMIT', (commitErr) => {
                                if (commitErr) {
                                    console.error('[Migrator] Failed to commit migrations:', commitErr);
                                    db.run('ROLLBACK');
                                    db.close();
                                    return reject(commitErr);
                                }
                                console.log('[Migrator] Successfully applied all migrations.');
                                db.close();
                                resolve();
                            });
                        }
                        return;
                    }
                    
                    const filename = pendingMigrations[index];
                    const filepath = path.resolve(migrationsDir, filename);
                    const sql = fs.readFileSync(filepath, 'utf-8');
                    
                    console.log(`[Migrator] Executing ${filename}...`);
                    
                    db.exec(sql, (execErr) => {
                        if (execErr) {
                            hasError = true;
                            console.error(`[Migrator] CRITICAL: Error executing ${filename}`, execErr.message);
                            db.run('ROLLBACK', () => {
                                console.log(`[Migrator] Rolled back transaction due to error in ${filename}`);
                                db.close();
                                reject(execErr);
                            });
                            return;
                        }
                        
                        // 이력 기록
                        db.run(`INSERT INTO _migrations (filename) VALUES (?)`, [filename], (insertErr) => {
                            if (insertErr) {
                                hasError = true;
                                console.error(`[Migrator] CRITICAL: Failed to record ${filename} in _migrations`, insertErr.message);
                                db.run('ROLLBACK', () => {
                                    db.close();
                                    reject(insertErr);
                                });
                                return;
                            }
                            // 다음 파일 실행
                            executeNext(index + 1);
                        });
                    });
                };
                
                // 첫 파일 실행 시작
                executeNext(0);
            });
        });
    });
}
