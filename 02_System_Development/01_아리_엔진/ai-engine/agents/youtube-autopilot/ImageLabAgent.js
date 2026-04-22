/**
 * [ImageLabAgent] Phase 24.5 — 이미지랩 에이전트 자동화 브릿지
 *
 * CurationAgent가 만든 시나리오를 받아, 각 씬에 맞는 이미지를
 * 이미지랩 API를 통해 자동 생성하고 아카이브에 저장합니다.
 *
 * ─────────────────────────────────────────────────────
 * Luca 콘벤션 3개 완전 준수:
 *  [규칙 1] HTML 카드 → transparent:true (omitBackground) PNG 출력
 *  [규칙 2] 기존 scenes 배열 불변 보존 (textLines/durationFrames 절대 수정 금지)
 *  [규칙 3] 씬별 try-catch → 실패 시 FALLBACK_ASSET 사용, 파이프라인 계속 진행
 * ─────────────────────────────────────────────────────
 */

const FALLBACK_ASSET = '/pico.png'; // 규칙 3: 모든 실패의 최종 방어선

// 씬 타입별 이미지 생성 전략
const SCENE_STRATEGY = {
  hook:    'ai-image',   // 강렬한 AI 이미지 (brand-generate)
  problem: 'html-card',  // 텍스트+그래픽 HTML 인포그래픽
  proof:   'html-card',  // 데이터/수치 느낌 HTML 카드
  climax:  'ai-image',   // 클라이맥스용 AI 이미지
  cta:     'html-card',  // "구독/좋아요" CTA HTML 카드
};

export class ImageLabAgent {
  /**
   * @param {string} serverUrl - Ari 엔진 서버 주소 (기본: localhost:4000)
   */
  constructor(serverUrl = 'http://localhost:4000') {
    this.serverUrl = serverUrl;
  }

  /**
   * 시나리오 전체에 씬별 이미지를 주입하여 반환
   * 규칙 2: scenario 원본 불변 — 새 객체로 복사하여 반환
   *
   * @param {object} scenario - CurationAgent가 생성한 시나리오 JSON
   * @param {string} channelType - 채널 유형 ('finance'|'ai-tips' 등)
   * @returns {object} enrichedScenario - assetImage가 추가된 새 시나리오
   */
  async generateAssetsForScenario(scenario, channelType = 'general') {
    console.log(`\n🎨 [ImageLabAgent] 시나리오 이미지 생성 시작 (${scenario.scenes?.length ?? 0}개 씬)`);

    const brandColors = scenario.theme?.brandColors || ['#1A1A2E', '#E94560'];
    const enrichedScenes = [];

    for (let i = 0; i < scenario.scenes.length; i++) {
      const scene = scenario.scenes[i];
      const strategy = SCENE_STRATEGY[scene.type] || 'ai-image';

      console.log(`  → [씬 ${i + 1}/${scenario.scenes.length}] type: ${scene.type} / 전략: ${strategy}`);

      // ────────────────────────────────────────────────────────────
      // 규칙 3: 씬별 try-catch — 실패해도 FALLBACK_ASSET으로 계속
      // ────────────────────────────────────────────────────────────
      let assetImage = FALLBACK_ASSET;
      try {
        if (strategy === 'ai-image') {
          assetImage = await this._generateAIImage(scene, scenario.theme, channelType);
        } else {
          assetImage = await this._generateHTMLCard(scene, scenario.theme, brandColors);
        }
        console.log(`  ✅ [씬 ${i + 1}] 이미지 생성 완료: ${assetImage}`);
      } catch (err) {
        // 실패 → fallback. 파이프라인은 멈추지 않음
        console.warn(`  ⚠️ [씬 ${i + 1}] 이미지 생성 실패 (fallback 사용): ${err.message}`);
      }

      // ────────────────────────────────────────────────────────────
      // 규칙 2: 기존 씬 데이터 절대 불변. 스프레드로 복사 + assetImage만 추가
      // textLines, durationFrames, type, layoutType 등 원본 필드 보존
      // ────────────────────────────────────────────────────────────
      enrichedScenes.push({ ...scene, assetImage });
    }

    // 시나리오 자체도 스프레드로 복사 (원본 불변)
    const enrichedScenario = {
      ...scenario,
      scenes: enrichedScenes,
      _imageLabProcessed: true,
      _processedAt: new Date().toISOString(),
    };

    console.log(`\n✅ [ImageLabAgent] 전체 완료: ${enrichedScenes.length}개 씬 이미지 주입 완료\n`);
    return enrichedScenario;
  }

  // ──────────────────────────────────────────────────────────────────
  // PRIVATE: AI 이미지 생성 (hook, climax — brand-generate)
  // ──────────────────────────────────────────────────────────────────
  async _generateAIImage(scene, theme, channelType) {
    const description = scene.textLines?.join(' ') || '임팩트 있는 장면';
    const brandPreset  = theme?.brandPreset || 'signature';

    const res = await fetch(`${this.serverUrl}/api/imagelab/brand-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        brandPresetId:  brandPreset,
        contentType:    'feed',   // 1:1 비율 → Remotion 씬에 최적
        lumiDirecting:  true,     // Lumi 크리에이티브 디렉팅 ON
      }),
    });

    const data = await res.json();
    if (!data.imageUrl) throw new Error(`brand-generate 실패: ${data.error || 'imageUrl 없음'}`);

    // 아카이브에 저장하고 실제 파일 경로 반환
    return await this._archiveAndGetPath(data.imageUrl, null, scene.type, description, channelType);
  }

  // ──────────────────────────────────────────────────────────────────
  // PRIVATE: HTML 카드 생성 (problem, proof, cta)
  //
  // 규칙 1: transparent=true → Puppeteer omitBackground → 알파 채널 보존
  // → Remotion split-impact 레이아웃에서 배경 이질감 0
  // ──────────────────────────────────────────────────────────────────
  async _generateHTMLCard(scene, theme, brandColors) {
    const description = scene.textLines?.join('\n') || '정보 카드';

    // STEP 1: HTML 코드 생성
    const htmlRes = await fetch(`${this.serverUrl}/api/imagelab/html-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        width:        1080,
        height:       1080,
        colors:       brandColors,
        brandName:    'Socian',
        contentLabel: scene.type,  // 씬 타입을 포맷 힌트로 전달
      }),
    });

    const htmlData = await htmlRes.json();
    if (!htmlData.html) throw new Error(`html-generate 실패: ${htmlData.error || 'html 없음'}`);

    const htmlCode = htmlData.html;

    // STEP 2: HTML → 투명 PNG 스냅샷 (규칙 1 핵심)
    const snapRes = await fetch(`${this.serverUrl}/api/imagelab/html-snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html:        htmlCode,
        width:       1080,
        height:      1080,
        transparent: true,   // ← Luca 콘벤션: 배경이 비치는 투명 PNG
      }),
    });

    const snapData = await snapRes.json();
    if (!snapData.snapshotUrl) throw new Error(`html-snapshot 실패: ${snapData.error || 'snapshotUrl 없음'}`);

    // STEP 3: 아카이브 저장 (HTML 코드 함께 보관 → 나중에 에이전트가 재편집 가능)
    return await this._archiveAndGetPath(
      snapData.snapshotUrl,
      htmlCode,
      scene.type,
      description,
      'autopilot'
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // PRIVATE: 이미지를 아카이브에 저장하고 절대 파일 경로 반환
  // VideoAdapter(Remotion)가 로컬 파일 직접 읽기 위해 절대 경로 필요
  // ──────────────────────────────────────────────────────────────────
  async _archiveAndGetPath(imageUrl, htmlCode, contentType, description, channelType) {
    const archiveRes = await fetch(`${this.serverUrl}/api/imagelab/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl,
        htmlCode:      htmlCode || null,
        contentType:   contentType || 'asset',
        description:   description?.slice(0, 80) || '',
        tags:          ['autopilot', channelType],
      }),
    });

    const archiveData = await archiveRes.json();
    if (!archiveData.archived?.url) throw new Error('아카이브 저장 실패');

    // Remotion이 읽을 서버 내부 파일 URL 반환 (/api/imagelab/archive-file/xxx.png)
    return archiveData.archived.url;
  }
}
