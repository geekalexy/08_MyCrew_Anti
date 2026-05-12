# Graph Report - .  (2026-05-13)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1222 nodes · 2190 edges · 78 communities (62 shown, 16 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 77 edges (avg confidence: 0.66)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fc35a305`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 74|Community 74]]

## God Nodes (most connected - your core abstractions)
1. `DatabaseManager` - 84 edges
2. `TenantMiddleware` - 28 edges
3. `GeminiAdapter` - 26 edges
4. `useUiStore` - 24 edges
5. `useAgentStore` - 24 edges
6. `TestTenantMiddleware` - 24 edges
7. `useSocket()` - 23 edges
8. `AntigravityAdapter` - 22 edges
9. `TaskDetailModal()` - 22 edges
10. `AgentDetailView()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `raw` --rationale_for--> `parse_issue_page()`  [EXTRACTED]
  02_System_Development/V2_Core_Engine/01_아리_엔진/database.js → 03_Reference_IP/01_레퍼런스_코드/코드/cmux_telegram_bridge.py
- `createTask()` --calls--> `classifyRiskLevel()`  [EXTRACTED]
  04_Users/01_Company/01_Projects/미니앱_71480/07_OUTPUT/07_OUTPUT/telegram-miniapp-frontend/src/api/client.ts → 02_System_Development/V2_Core_Engine/01_아리_엔진/database.js
- `getGoogleOAuthToken()` --calls--> `_now()`  [EXTRACTED]
  02_System_Development/V2_Core_Engine/01_아리_엔진/server.js → 03_Reference_IP/04_이전_히스토리_백업/05_시스템_c1/c1c2comm/comm.py
- `runWatchdog()` --calls--> `_now()`  [EXTRACTED]
  02_System_Development/V2_Core_Engine/01_아리_엔진/server.js → 03_Reference_IP/04_이전_히스토리_백업/05_시스템_c1/c1c2comm/comm.py
- `main()` --calls--> `post_init()`  [EXTRACTED]
  02_System_Development/V2_Core_Engine/01_아리_엔진/mcp_server.js → 03_Reference_IP/01_레퍼런스_코드/코드/cmux_telegram_bridge.py

## Communities (78 total, 16 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (87): actionData, activeProcesses, activeTasks, ACTIVITY_LABEL, activityItems, agentKey, agentsData, agentsFilePath (+79 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (68): browser_type(), callback_handler(), check_daily_limit(), clean_terminal(), click(), cmd_ari(), cmd_ari_stop(), cmd_c1() (+60 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (38): apiClient, apiFetch(), createTask(), getProjects(), getTask(), getTimeline(), postCommand(), updateTaskStatus() (+30 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (19): fileName, getGoogleOAuthToken(), NotebookLMAdapter, VideoAdapter, imageLabAgent, SCENE_STRATEGY, YouTubeUploader, getModels() (+11 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (30): checkGoogleOAuth(), checkImageRenderer(), checkSocketServer(), checkTtsEndpoint(), httpGet(), isNow, runBugdog(), run() (+22 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (33): ALL_TOOLS, main(), matchAll, matchPending, pendingTasks, result, roadmapDir, server (+25 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (29): alertMessage, API_KEYS, ARI_ALLOWED_MODELS, ARI_BRAIN_PATH, ARI_TOOLS, BRIDGE_AGENT_HINTS, BRIDGE_LOG_DIR, BRIDGE_REQ_DIR (+21 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (35): destPath, filePath, files, analysis, assetDir, BRAND_ARCHIVE_DIR, brandPrompt, cleanJson (+27 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (34): outputsDir, parsed, verdictFilePath, relPath, agent, altScene, avg, combinedText (+26 more)

### Community 10 - "Community 10"
Cohesion: 0.15
Nodes (20): AdCreativesController, AdCreativesModule, AdCreativesService, CampaignsController, CampaignsModule, CampaignsService, CreateAdCreativeDto, CreateCampaignDto (+12 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (18): COLUMN_LABELS, PRIORITY_OPTIONS, KanbanBoard(), PRIORITY_DOT_COLOR, STATUS_BADGE, TeamGuidelinesEditor(), NewProjectModal(), STAGES (+10 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (15): ALLOWED_IDS, GeminiAdapter, FLASH_FALLBACK_CHAIN, MODEL, PRO_FALLBACK_CHAIN, VALID_MODELS, LOCAL_QUICK_PATTERNS, ModelSelector (+7 more)

### Community 13 - "Community 13"
Cohesion: 0.27
Nodes (23): b(), make_mia(), make_vera(), make_zeno(), big_eyes(), blk(), c(), make_bolt() (+15 more)

### Community 14 - "Community 14"
Cohesion: 0.14
Nodes (13): AuthController, AuthModule, AuthService, JwtAuthGuard, CreateUserDto, Campaign, CampaignStatus, User (+5 more)

### Community 15 - "Community 15"
Cohesion: 0.1
Nodes (18): AGENT_IDS, agentConfig, agentList, agentMap, _agentsSeed, classifyRiskLevel(), CRITICAL_KEYWORDS, dbPath (+10 more)

### Community 16 - "Community 16"
Cohesion: 0.11
Nodes (13): DESTRUCTIVE_TERMS, FORBIDDEN_AGENT_IDS, FORBIDDEN_MODEL_IDS, FORBIDDEN_MODEL_PATTERNS, PLATFORM_IDS, POLICY_DOCS, PolicyViolationError, VALID_TEAM_PREFIXES (+5 more)

### Community 17 - "Community 17"
Cohesion: 0.15
Nodes (10): App(), useSettingsStore, useUiStore, ArchiveView(), ArtifactViewer(), OnboardingWizard(), PROVIDERS, TEAM_TYPES (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.1
Nodes (10): ADAPTER_DEFS, AdapterStatusPanel(), STATUS_MAP, useAuthStore, INTEGRATIONS, IntegrationVault(), HOURS, MINUTES (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.12
Nodes (9): getRoleData(), ROLE_REGISTRY, TEAM_META, AgentDetailView(), IcoPause(), IcoPlay(), IcoStop(), OrgView() (+1 more)

### Community 20 - "Community 20"
Cohesion: 0.14
Nodes (8): AnthropicAdapter, analyzeImageForPrompt(), _ensureClient(), ProjectScaffolder, KeyProvider, RequestQueue, CurationAgent, FALLBACK_SCENARIOS

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (10): SKILL_REGISTRY, RecruitTalentModal(), ROLE_FILTERS, ROSTER_POOL, SkillAddDrawer(), LAYER_CLASS, LAYER_ORDER, SkillSection() (+2 more)

### Community 22 - "Community 22"
Cohesion: 0.2
Nodes (7): BRIDGE_DIR, lockDir, REQ_DIR, AntigravityAdapter, RES_DIR, BaseAdapter, FilePollingAdapter

### Community 23 - "Community 23"
Cohesion: 0.13
Nodes (16): appendMeetingLog(), broadcastLog(), buildLinkedContext(), cwd, dispatchNextTaskForAgent(), forceRedispatchTask(), handleResponse(), handleReviewRequest() (+8 more)

### Community 24 - "Community 24"
Cohesion: 0.13
Nodes (4): Exception, AccessDeniedError, TestIsolatedPathResolver, TestTenantContext

### Community 25 - "Community 25"
Cohesion: 0.12
Nodes (11): _agentsRaw, id, AGENT_SIGNATURE_MODELS, _agents, APPROVAL_PATTERNS, BRIDGE_AGENTS, clearSkillCache(), _HARDCODED_FALLBACK (+3 more)

### Community 26 - "Community 26"
Cohesion: 0.12
Nodes (11): CONTENT_TYPES, CUSTOM_COLOR_LABELS, DEFAULT_CUSTOM_COLORS, ImageLabView(), IMAGEN_STYLE_CATALOG, RUBRIC_DIMS, StarRating(), STYLE_PRESETS (+3 more)

### Community 27 - "Community 27"
Cohesion: 0.14
Nodes (10): cache_path(), inbox_c1_path(), inbox_c2_path(), log_path(), direction: 'c1' 또는 'c2, 메인 미들웨어 — 모든 컴포넌트를 통합, chat_id로 TenantContext 생성, status_path() (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.18
Nodes (11): statusLabel, extractChainRefs(), useContextChain(), PlanMasterModal(), formatModelName(), TaskDetailModal(), TEAM_AGENTS, WORKFLOW_STEPS (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.27
Nodes (10): Column(), LOG_LEVEL_EMOJI, TerminalLog(), Sidebar(), AgentAvatar(), AgentStatusBar(), useAgentStore, preMovSnapshot (+2 more)

### Community 30 - "Community 30"
Cohesion: 0.14
Nodes (4): 두 회사의 데이터가 완전히 격리되는지 검증, 일일 사용량이 회사별로 독립 추적되는지 검증, 멀티스레드 환경에서 컨텍스트 격리 검증, TestTenantMiddleware

### Community 31 - "Community 31"
Cohesion: 0.26
Nodes (3): __dirname, execFileAsync, WikiEngine

### Community 32 - "Community 32"
Cohesion: 0.28
Nodes (6): recentErrors, useSocket(), LogDrawer(), useChatStore, useTimelineStore, renderMarkdown()

### Community 33 - "Community 33"
Cohesion: 0.26
Nodes (11): CASE_DIR, CASE_INDEX_PATH, detectBugdogTrigger(), ENGINE_LOG_PATH, executeBugdogPipeline(), generateCaseDraft(), getCaseFormatSample(), getNextCaseId() (+3 more)

### Community 34 - "Community 34"
Cohesion: 0.27
Nodes (5): date, IsolatedPathResolver, company별 격리된 파일 경로 제공, target_path가 해당 company 디렉토리 안에 있는지 검증, TenantContext

### Community 35 - "Community 35"
Cohesion: 0.24
Nodes (4): data, TOKEN_PATH, ai, body

### Community 40 - "Community 40"
Cohesion: 0.29
Nodes (8): buildAliasMap(), buildStatusToColumn(), executeTool(), ENGINE_ROOT, instagramAnalyze(), instagramBatchAnalyze(), SESSION_DIR, sleep()

### Community 41 - "Community 41"
Cohesion: 0.31
Nodes (4): diagnoseTask(), runWatchdog(), sendBatchReport(), MemoryWatchdog

### Community 43 - "Community 43"
Cohesion: 0.25
Nodes (6): db, flash, [k,...v], models, pro, row

### Community 44 - "Community 44"
Cohesion: 0.36
Nodes (4): get_remaining(), DailyLimitTracker, 사용 가능하면 카운트 증가 후 True, 초과면 False., 남은 횟수. 무제한이면 '무제한' 반환.

### Community 45 - "Community 45"
Cohesion: 0.29
Nodes (4): chat_id로 회사 조회. 없으면 TenantNotFoundError., chat_id에 매핑된 회사가 없을 때, company_id로 직접 TenantContext 생성 (내부/관리자용), TenantNotFoundError

### Community 50 - "Community 50"
Cohesion: 0.33
Nodes (5): chunkToReplace, content, fs, idx1, idx2

### Community 52 - "Community 52"
Cohesion: 0.5
Nodes (4): ChainItemCard(), ContextChainPanel(), renderWithNestedRefs(), TYPE_LABEL

### Community 55 - "Community 55"
Cohesion: 0.5
Nodes (3): ENDPOINT, naverSearch(), stripHtml()

### Community 56 - "Community 56"
Cohesion: 0.5
Nodes (3): PENDING_DIR, COMPLETED_DIR, initAdapterWatcher()

### Community 57 - "Community 57"
Cohesion: 0.67
Nodes (3): generateVideo(), execPromise, renderRemotionVideo()

## Knowledge Gaps
- **319 isolated node(s):** `AGENT_IDS`, `CRITICAL_KEYWORDS`, `names`, `agentList`, `placeholders` (+314 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `App()` connect `Community 17` to `Community 0`, `Community 32`, `Community 3`, `Community 7`, `Community 11`, `Community 29`?**
  _High betweenness centrality (0.176) - this node is a cross-community bridge._
- **Why does `DatabaseManager` connect `Community 2` to `Community 3`, `Community 5`, `Community 46`, `Community 15`, `Community 16`, `Community 58`, `Community 61`?**
  _High betweenness centrality (0.138) - this node is a cross-community bridge._
- **Why does `RuleHarvester` connect `Community 48` to `Community 0`, `Community 12`, `Community 15`, `Community 20`, `Community 25`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `TenantMiddleware` (e.g. with `TestTenantRegistry` and `TestIsolatedPathResolver`) actually correct?**
  _`TenantMiddleware` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AGENT_IDS`, `CRITICAL_KEYWORDS`, `names` to the rest of the system?**
  _319 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._