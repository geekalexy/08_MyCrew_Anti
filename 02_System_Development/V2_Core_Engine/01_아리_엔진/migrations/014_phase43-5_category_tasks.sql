-- Phase 43-5 Task Branching 지원용 컬럼 추가
-- parent_task_id: Task Master가 쪼갠 하위 카드인 경우 원본 부모 카드의 ID
-- depends_on: 실행 순서 보장을 위한 선행 태스크(category 이름 등) 의존성 씨앗

ALTER TABLE Task ADD COLUMN parent_task_id INTEGER REFERENCES Task(id);
ALTER TABLE Task ADD COLUMN depends_on TEXT;
