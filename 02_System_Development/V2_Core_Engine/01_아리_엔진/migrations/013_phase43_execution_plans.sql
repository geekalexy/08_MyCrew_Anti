-- [Phase 43-4] Auto Run: Task Master Execution Plans Table
CREATE TABLE IF NOT EXISTS execution_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  project_id TEXT,
  plan_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES Task(id)
);
