# PRD 리뷰: Phase 28a/b 통합 검토

**작성자**: Prime (Opus)
**일자**: 2026-05-02
**대상**: 
- Phase 28a Extension (프로젝트 공유 범위 설정 PRD)
- Phase 28b Zero-Config 빌딩 PRD

## 판정 요약

### Phase 28a Extension — 🟢 A- (즉시 착수 승인)
| 항목 | 판정 |
|---|---|
| 3단계 격리 모델 (Strict/Global/Cross) | ✅ NOVA 편향 사건 교훈을 정확히 반영 |
| isolation_scope JSON 구조 | ✅ 확장성 좋음. TEXT 컬럼 + DEFAULT strict |
| Project=Team 1:1 매핑 | 🟡 ARI(독립 에이전트) 처리 때문에 1:N 유지 권고 |

### Phase 28b Zero-Config — 🟡 B (선결 조건 2건)
| 항목 | 판정 |
|---|---|
| 비전/UX | ✅ MyCrew 핵심 세일즈 포인트 |
| 🔴 Opus 호출 경로 | 미확정 → Gemini 2.5 Pro로 대체 권고 (기존 API 키 활용, 10초 vs 60초, JSON 모드 공식 지원) |
| 🔴 DB 저장 파이프라인 | teams 생성 + agent_profiles 업데이트 로직 누락 → 전체 INSERT 흐름 보완 필요 |

### 🟢 보너스: P1 핫픽스 최종 코드 검증 완료
RES-22에서 보류했던 마이그레이션 순서 + 트랜잭션 통합 수정이 실제 코드에서 확인되었습니다. CREATE TABLE projects → INSERT SEED → PRAGMA 콜백 → 단일 db.serialize() + 단일 트랜잭션으로 올바르게 수정됨. ✅

## 결론
28a Extension 즉시 착수 → 완료 후 28b의 호출 경로/DB 파이프라인 확정 → 28b 착수.
