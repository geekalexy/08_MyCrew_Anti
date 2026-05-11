import { GoogleGenAI } from '@google/genai';

/**
 * [에이전트 2] 분석 및 채택 담당 에이전트 (Curation & Scripting Director)
 * Data Harvester가 긁어온 원시 데이터를 분석하여 정량 평가 후
 * Top 3 리스트를 뽑고, 이를 즉시 렌더링용 5단계 쇼츠 대본(JSON)으로 자동 기획합니다.
 *
 * [Prime P0 수정 — 2026-04-23]
 * - SDK: genai 엔진으로 통일
 * - 모델명: 환각 식별자 제거 및 2.5 flash 적용
 * - Fallback: 3씬 → 5씬 완비, 날짜 기반 로테이션 다변화
 */

const MODEL_FLASH = 'gemini-2.5-flash'; // strategic_memory.md SSOT

/** 채널별 5씬 완비 Fallback 시나리오 풀 (날짜 로테이션용) */
const FALLBACK_SCENARIOS = {
    finance: [
        {
            selectedSourceTitle: "엔비디아 젠슨황 깜짝 발언, '진짜 수혜주' 밝혀졌다",
            totalScore: 98,
            scenario: {
                durationInSeconds: 30, fps: 30,
                theme: { primaryColor: "#111827", operatorImage: "/pico.png" },
                scenes: [
                    { type: "hook",    durationFrames: 120, layoutType: "split-impact", assetContent: "🔥", textLines: ["87%가 모르는 충격 사실!", "지금 당장 확인하세요"], interactionElement: "1분 완벽 정리 🚀" },
                    { type: "problem", durationFrames: 180, layoutType: "split-impact", assetContent: "📉", textLines: ["어제까지 90% 팔아치운 한국인들,", "오늘 땅을 치며 후회 중입니다."], interactionElement: "도대체 왜? 👀" },
                    { type: "proof",   durationFrames: 210, layoutType: "split-impact", assetContent: "📊", textLines: ["JP모건 리포트가 밝힌 진실:", "월가 큰손들이 밤새 쓸어담은 종목"], interactionElement: "출처: JP모건 2024 Q1" },
                    { type: "climax",  durationFrames: 150, layoutType: "split-impact", assetContent: "⚡", textLines: ["예상 반전: 수혜주는 엔비디아가 아니라", "이 숨겨진 종목이었다!"], interactionElement: "충격 반전 공개" },
                    { type: "cta",     durationFrames: 90,  layoutType: "split-impact", assetContent: "🔔", textLines: ["내일은 더 충격적인 종목 공개!", "구독하고 놓치지 마세요 ↑"], interactionElement: "구독 & 알림 설정" }
                ]
            }
        },
        {
            selectedSourceTitle: "워런 버핏이 현금만 쌓는 진짜 이유, 폭락 신호?",
            totalScore: 94,
            scenario: {
                durationInSeconds: 30, fps: 30,
                theme: { primaryColor: "#111827", operatorImage: "/pico.png" },
                scenes: [
                    { type: "hook",    durationFrames: 120, layoutType: "split-impact", assetContent: "💰", textLines: ["버핏이 현금 500조 쌓은 이유", "주식시장 붕괴 임박?"], interactionElement: "충격 예고" },
                    { type: "problem", durationFrames: 180, layoutType: "split-impact", assetContent: "📉", textLines: ["개인투자자 97%가 놓친 신호,", "기관들은 이미 다 팔았다?"], interactionElement: "나만 모른 거야? 😨" },
                    { type: "proof",   durationFrames: 210, layoutType: "split-impact", assetContent: "📊", textLines: ["버크셔 해서웨이 13F 보고서,", "6분기 연속 순매도 확인됨"], interactionElement: "공식 데이터 확인" },
                    { type: "climax",  durationFrames: 150, layoutType: "split-impact", assetContent: "🚨", textLines: ["하지만 반전!", "버핏이 몰래 사들이는 단 1개 섹터"], interactionElement: "이 섹터가 열쇠?" },
                    { type: "cta",     durationFrames: 90,  layoutType: "split-impact", assetContent: "🔔", textLines: ["다음 편에서 그 섹터 대공개!", "지금 구독 안 하면 손해 ↑"], interactionElement: "구독 & 알림 설정" }
                ]
            }
        },
        {
            selectedSourceTitle: "금리 인하 기대감 후퇴, 부동산은 어디로?",
            totalScore: 89,
            scenario: {
                durationInSeconds: 30, fps: 30,
                theme: { primaryColor: "#111827", operatorImage: "/pico.png" },
                scenes: [
                    { type: "hook",    durationFrames: 120, layoutType: "split-impact", assetContent: "🏠", textLines: ["집값 오를 줄 알았는데...", "금리 인하 물 건너갔나?"], interactionElement: "지금 사야 해? 참아야 해?" },
                    { type: "problem", durationFrames: 180, layoutType: "split-impact", assetContent: "📉", textLines: ["2024: 금리 3번 인하 전망 → 0번", "내 집 마련 꿈 또 미뤄지나"], interactionElement: "이게 다 연준 때문?" },
                    { type: "proof",   durationFrames: 210, layoutType: "split-impact", assetContent: "📊", textLines: ["골드만삭스: 고금리 2025년까지 지속",  "서울 아파트 거래량 6년 최저"], interactionElement: "전문가 분석" },
                    { type: "climax",  durationFrames: 150, layoutType: "split-impact", assetContent: "🔑", textLines: ["그런데 이 한 지역만 반등 중!", "투자자들이 몰리는 곳은?"], interactionElement: "핵심 지역 공개" },
                    { type: "cta",     durationFrames: 90,  layoutType: "split-impact", assetContent: "🔔", textLines: ["내일 그 지역 공개합니다!", "구독하고 꼭 챙기세요 ↑"], interactionElement: "구독 & 알림 설정" }
                ]
            }
        }
    ],
    'ai-tips': [
        {
            selectedSourceTitle: "ChatGPT 아직도 이렇게 쓰면 당신만 뒤처집니다",
            totalScore: 96,
            scenario: {
                durationInSeconds: 30, fps: 30,
                theme: { primaryColor: "#3B82F6", operatorImage: "/ari.png" },
                scenes: [
                    { type: "hook",    durationFrames: 120, layoutType: "split-impact", assetContent: "🤖", textLines: ["직장인 93%가 모르는 AI 꿀팁", "나만 알고 싶은 비법"], interactionElement: "30초면 OK!" },
                    { type: "problem", durationFrames: 180, layoutType: "split-impact", assetContent: "⏰", textLines: ["아직도 ChatGPT에 질문만 던지면", "당신의 업무 시간 2배 낭비 중"], interactionElement: "이걸 몰랐다고?" },
                    { type: "proof",   durationFrames: 210, layoutType: "split-impact", assetContent: "📊", textLines: ["MIT 연구: 프롬프트 최적화 시", "업무 효율 47% 향상 증명"], interactionElement: "MIT 2024 연구" },
                    { type: "climax",  durationFrames: 150, layoutType: "split-impact", assetContent: "✨", textLines: ["이 3가지 프롬프트 공식만 써도", "상사가 놀라는 결과물 완성"], interactionElement: "공식 공개!" },
                    { type: "cta",     durationFrames: 90,  layoutType: "split-impact", assetContent: "🔔", textLines: ["내일은 Notion AI 꿀팁!", "구독하고 앞서가세요 ↑"], interactionElement: "구독 & 알림 설정" }
                ]
            }
        }
    ]
};

export class CurationAgent {
    constructor() {
        this.ai = null;
    }

    async _ensureClient() {
        if (this.ai) return;
        const { keyProvider } = await import('../../utils/keyProvider.js');
        const apiKey = keyProvider.getKey('GEMINI_API_KEY');
        if (!apiKey) throw new Error('GEMINI_API_KEY가 등록되지 않았습니다.');
        this.ai = new GoogleGenAI({ apiKey });
    }

    async analyzeAndSelectTop3(rawSources, channelType) {
        await this._ensureClient();
        console.log(`[Curation Director] ${rawSources.length}개의 소스를 정량 평가하여 Top 3를 채택합니다...`);

        // 프롬프트에 넣기 전 데이터 경량화 (title + pubDate만, engagementScore 랜덤값 오염 방지)
        const sourceDataStr = rawSources
            .map((s, i) => `[ID:${i}] 제목: ${s.title} / 업로드: ${s.pubDate}`)
            .join('\n');

        const prompt = `
당신은 메가 히트 페이스리스 유튜브 채널의 총괄 디렉터입니다.
아래 수집된 원시 뉴스/트렌드 소스를 다음 3가지 척도로 정량 스코어링하여 가장 숏폼 영상으로 만들었을 때 도파민이 터질 'Top 3' 기사만 채택하세요.
- 평가 기준: 
  1) 신선도(최신성) (30%)
  2) 자극성 및 대중적 관심도 (40%)
  3) "문제 제기 -> 충격적 진실" 5단계 포맷으로 풀기 좋은가 (30%)

채택된 Top 3 소스는 각각 5단계 숏폼 시나리오(Hook, Problem, Proof, Climax, CTA)로 변환하세요.

[콘텐츠 전략 — 씬별 강화 방향]
- Hook (0~3초): 숫자+감정 공식 필수 → "87%가 모르는..." / "3분 만에 X가 사라졌다"
- Problem (3~10초): 대비 구조 → "어제까지 vs 오늘" 시각적 대비
- Proof (10~18초): 출처 명시 필수 → "JP모건 리포트", "MIT 연구" 등 신뢰성 강화
- Climax (18~25초): 반전 필수 → 예상과 반대되는 결론
- CTA (25~30초): 다음 편 예고 → "내일은 더 충격적인..." 시리즈 후킹

출력은 무조건 유효한 순수 JSON 배열 스키마로만 응답하세요. (마크다운 백틱 제외)

[원시 소스 데이터]
${sourceDataStr}

[출력 데이터 JSON 스키마 — 반드시 5개 씬 포함]
[
  {
    "selectedSourceTitle": "원문 기사/트렌드 제목",
    "totalScore": 95,
    "scenario": {
      "durationInSeconds": 30,
      "fps": 30,
      "theme": { "primaryColor": "#111827", "operatorImage": "/pico.png" },
      "scenes": [
        { "type": "hook",    "durationFrames": 120, "layoutType": "split-impact", "assetContent": "🔥", "textLines": ["훅 문장1", "훅 문장2"], "interactionElement": "1분 완벽 정리" },
        { "type": "problem", "durationFrames": 180, "layoutType": "split-impact", "assetContent": "📉", "textLines": ["문제 문장1", "문장2"],   "interactionElement": "도대체 왜?" },
        { "type": "proof",   "durationFrames": 210, "layoutType": "split-impact", "assetContent": "📊", "textLines": ["증거 문장1", "출처"],     "interactionElement": "공식 데이터" },
        { "type": "climax",  "durationFrames": 150, "layoutType": "split-impact", "assetContent": "⚡", "textLines": ["반전 문장1", "문장2"],    "interactionElement": "충격 반전" },
        { "type": "cta",     "durationFrames": 90,  "layoutType": "split-impact", "assetContent": "🔔", "textLines": ["다음편 예고 문장", "구독 유도"], "interactionElement": "구독 & 알림 설정" }
      ]
    }
  }
]
`;

        try {
            const result = await this.ai.models.generateContent({
                model: MODEL_FLASH,
                contents: prompt,
                config: { temperature: 0.85 }
            });

            let responseText = result.text.trim();
            // JSON 마크다운 포맷 제거
            responseText = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '');

            const top3Scenarios = JSON.parse(responseText);

            // 씬 수 검증 — 5개 미만이면 경고
            top3Scenarios.forEach((item, idx) => {
                if (item.scenario?.scenes?.length !== 5) {
                    console.warn(`⚠️ [Curation] Rank${idx+1} 씬 수 비정상: ${item.scenario?.scenes?.length}개 (5개 필요)`);
                }
            });

            console.log(`[Curation Director] 성공적으로 Top 3 채택 및 시나리오 변환 완료!`);
            return top3Scenarios;

        } catch (error) {
            console.error('\n⚠️ [Curation Director] Gemini API 실패. Fallback 시나리오로 대체합니다.\n', error.message);

            // 날짜 기반 로테이션 — 매일 다른 시나리오
            const pool = FALLBACK_SCENARIOS[channelType] || FALLBACK_SCENARIOS.finance;
            const todayIdx = new Date().getDate() % pool.length;
            const fallbackResult = [pool[todayIdx]];

            console.log(`   → Fallback 사용: "${fallbackResult[0].selectedSourceTitle}" (로테이션 인덱스: ${todayIdx})`);
            return fallbackResult;
        }
    }
}
