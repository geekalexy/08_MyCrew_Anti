-- Migration: 011_autorun_persistence
-- Description: Add columns to tasks table for Phase 44 Auto Run persistence

ALTER TABLE tasks ADD COLUMN last_autorun_status TEXT DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN last_autorun_step INTEGER DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN last_autorun_max_steps INTEGER DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN last_autorun_at DATETIME DEFAULT NULL;
