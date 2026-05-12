-- Phase 42 ADM: 010_legacy_backfill.sql
-- 레거시 데이터 백필: global_mycrew 프로젝트로 고아 데이터 귀속

-- global_mycrew 프로젝트 시딩 (부모 레코드 보장)
INSERT OR IGNORE INTO projects (id, name, objective, isolation_scope, status)
    VALUES ('global_mycrew', 'MyCrew 운영센터', '시스템 전역 태스크 및 로그 저장소', '{"type":"global_knowledge"}', 'active');

-- project_id가 NULL인 고아 Task/Log를 global_mycrew에 귀속
UPDATE Task SET project_id = 'global_mycrew' WHERE project_id IS NULL;
UPDATE Log SET project_id = 'global_mycrew' WHERE project_id IS NULL;

-- project_task_num 소급: 프로젝트별 생성 순서대로 순번 부여
UPDATE Task SET project_task_num = (
    SELECT COUNT(*) FROM Task t2
    WHERE t2.project_id = Task.project_id
      AND t2.id <= Task.id
      AND t2.deleted_at IS NULL
) WHERE project_task_num IS NULL;

-- comment_idx 소급: 카드별 생성 순서대로 순번 부여
UPDATE TaskComment SET comment_idx = (
    SELECT COUNT(*) FROM TaskComment t2
    WHERE t2.task_id = TaskComment.task_id AND t2.id <= TaskComment.id
) WHERE comment_idx IS NULL;
