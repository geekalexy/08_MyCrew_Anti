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
  // [전략 변경] Gemini html-generate 대신 로컬 빌트인 템플릿 사용
  //   → 503/429 에러 완전 방지, 즉시 생성, 채널 운영 안정화 우선
  //   → Gemini 고도화는 옵션으로 나중에 추가
  // 규칙 1: transparent=true → Puppeteer omitBackground → 알파 채널 보존
  // ──────────────────────────────────────────────────────────────────
  async _generateHTMLCard(scene, theme, brandColors) {
    const lines = scene.textLines || ['내용을 준비 중입니다'];
    const [primary = '#E53E3E', accent = '#FBBF24', secondary = '#1A1A2E'] = brandColors;

    // 씬 타입별 로컬 HTML 템플릿 (Gemini 불필요)
    const htmlCode = this._buildLocalHTML(scene.type, lines, { primary, accent, secondary });

    // Puppeteer로 투명 PNG 렌더링
    const snapRes = await fetch(`${this.serverUrl}/api/imagelab/html-snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html:        htmlCode,
        width:       1080,
        height:      1080,
        transparent: true,
      }),
    });

    const snapData = await snapRes.json();
    if (!snapData.snapshotUrl) throw new Error(`html-snapshot 실패: ${snapData.error || 'snapshotUrl 없음'}`);

    return await this._archiveAndGetPath(
      snapData.snapshotUrl,
      htmlCode,
      scene.type,
      lines[0],
      'autopilot'
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // PRIVATE: 씬 타입별 로컬 HTML 카드 템플릿 생성 (Gemini 없이 즉시)
  // ──────────────────────────────────────────────────────────────────
  _buildLocalHTML(sceneType, textLines, colors) {
    const { primary, accent, secondary } = colors;
    const mainText  = textLines[0] || '';
    const subText   = textLines.slice(1).join(' ') || '';

    const templates = {

      // 문제 제기 씬: 강렬한 레드+다크 드라마 카드
      problem: `<!DOCTYPE html><html><body style="margin:0;width:1080px;height:1080px;background:transparent;display:flex;align-items:center;justify-content:center;font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;">
        <div style="width:960px;padding:80px;background:linear-gradient(145deg,#0D0D0D,#1A0A0A);border-radius:32px;border:3px solid ${primary};box-shadow:0 0 60px rgba(229,62,62,0.4);">
          <div style="font-size:40px;color:${primary};font-weight:900;letter-spacing:2px;margin-bottom:40px;">⚠️ 지금 무슨 일이?</div>
          <div style="font-size:${mainText.length > 15 ? '72px' : '88px'};color:#FFFFFF;font-weight:900;line-height:1.25;word-break:keep-all;margin-bottom:40px;">${mainText}</div>
          ${subText ? `<div style="font-size:48px;color:#CCCCCC;font-weight:600;line-height:1.5;word-break:keep-all;">${subText}</div>` : ''}
          <div style="margin-top:60px;height:6px;background:linear-gradient(90deg,${primary},transparent);border-radius:3px;"></div>
        </div>
      </body></html>`,

      // 증거/데이터 씬: 클린 다크 + 숫자 강조
      proof: `<!DOCTYPE html><html><body style="margin:0;width:1080px;height:1080px;background:transparent;display:flex;align-items:center;justify-content:center;font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;">
        <div style="width:960px;padding:80px;background:linear-gradient(145deg,#0A0A14,#0D1B2A);border-radius:32px;border:3px solid ${accent};box-shadow:0 0 60px rgba(251,191,36,0.3);">
          <div style="font-size:40px;color:${accent};font-weight:900;letter-spacing:2px;margin-bottom:40px;">📊 FACT CHECK</div>
          <div style="font-size:${mainText.length > 15 ? '68px' : '84px'};color:#FFFFFF;font-weight:900;line-height:1.25;word-break:keep-all;margin-bottom:40px;">${mainText}</div>
          ${subText ? `<div style="font-size:48px;color:${accent};font-weight:700;line-height:1.5;word-break:keep-all;">${subText}</div>` : ''}
          <div style="margin-top:60px;display:flex;gap:20px;">
            <div style="flex:1;height:8px;background:${accent};border-radius:4px;"></div>
            <div style="flex:2;height:8px;background:rgba(251,191,36,0.3);border-radius:4px;"></div>
            <div style="flex:1;height:8px;background:${accent};border-radius:4px;"></div>
          </div>
        </div>
      </body></html>`,

      // CTA 씬: 구독/좋아요 유도 카드
      cta: `<!DOCTYPE html><html><body style="margin:0;width:1080px;height:1080px;background:transparent;display:flex;align-items:center;justify-content:center;font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;">
        <div style="width:960px;padding:80px;background:linear-gradient(145deg,#0F0F0F,#1A1A2E);border-radius:32px;border:3px solid #4ADE80;box-shadow:0 0 60px rgba(74,222,128,0.3);text-align:center;">
          <div style="font-size:100px;margin-bottom:30px;">🔔</div>
          <div style="font-size:72px;color:#FFFFFF;font-weight:900;line-height:1.3;word-break:keep-all;margin-bottom:50px;">${mainText}</div>
          <div style="display:inline-block;padding:30px 80px;background:#4ADE80;border-radius:60px;font-size:52px;color:#000;font-weight:900;">구독 + 좋아요 👍</div>
        </div>
      </body></html>`,
    };

    return templates[sceneType] || templates.problem;
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
