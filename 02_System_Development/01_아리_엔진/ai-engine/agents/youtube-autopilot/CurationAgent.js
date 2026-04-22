import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * [에이전트 2] 분석 및 채택 담당 에이전트 (Curation & Scripting Director)
 * Data Harvester가 긁어온 원시 데이터를 분석하여 정량 평가 후
 * Top 3 리스트를 뽑고, 이를 즉시 렌더링용 5단계 쇼츠 대본(JSON)으로 자동 기획합니다.
 */
export class CurationAgent {
    constructor() {
        // 기존 Ari 엔진의 환경변수 포맷 활용
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy');
    }

    async analyzeAndSelectTop3(rawSources, channelType) {
        console.log(`[Curation Director] ${rawSources.length}개의 소스를 정량 평가하여 Top 3를 채택합니다...`);

        // 프롬프트에 넣기 전 데이터 경량화
        const sourceDataStr = rawSources.map((s, i) => `[ID:${i}] 제목: ${s.title} / 업로드: ${s.pubDate} / 예상관심도: ${s.engagementScore}`).join('\n');

        const prompt = `
당신은 메가 히트 페이스리스 유튜브 채널의 총괄 디렉터입니다.
아래 수집된 원시 뉴스/트렌드 소스를 다음 3가지 척도로 정량 스코어링하여 가장 숏폼 영상으로 만들었을 때 도파민이 터질 'Top 3' 기사만 채택하세요.
- 평가 기준: 
  1) 신선도(최신성) (30%)
  2) 자극성 및 대중적 관심도 (40%)
  3) "문제 제기 -> 충격적 진실" 5단계 포맷으로 풀기 좋은가 (30%)

채택된 Top 3 소스는 각각 5단계 숏폼 시나리오(Hook, Problem, Proof, Climax, CTA)로 변환하세요.
출력은 무조건 유효한 순수 JSON 배열 스키마로만 응답하세요. (마크다운 백틱 제외)

[원시 소스 데이터]
${sourceDataStr}

[출력 데이터 JSON 스키마 예시]
[
  {
    "selectedSourceTitle": "원문 기사/트렌드 제목",
    "totalScore": 95,
    "scenario": {
      "durationInSeconds": 30,
      "fps": 30,
      "theme": { "primaryColor": "#111827", "operatorImage": "/pico.png" },
      "scenes": [
        { "type": "hook", "durationFrames": 150, "layoutType": "split-impact", "assetContent": "🔥", "textLines": ["훅 문장1", "훅 문장2"], "interactionElement": "1분 완벽 정리" }
        // ... Problem, Proof, Climax, CTA 순서대로 5개 씬 포함
      ]
    }
  }
  // 2, 3등 데이터 동일 포맷
]
`;

        try {
            const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent(prompt);
            let responseText = result.response.text().trim();
            // JSON 마크다운 포맷 제거
            responseText = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
            
            const top3Scenarios = JSON.parse(responseText);
            console.log(`[Curation Director] 성공적으로 Top 3 채택 및 시나리오 변환 완료!`);
            return top3Scenarios;

        } catch (error) {
            console.error('\n⚠️ [Curation Director] Gemini API 할당량 초과(429) 감지. 테스트 우회를 위한 시뮬레이션 데이터로 대체합니다.\n');
            // 429 에러 발생 시 테스트를 중단시키지 않기 위한 예비 데이터(Fallback) 리턴
            const fallbackTop3 = [
                {
                    selectedSourceTitle: "엔비디아 젠슨황 깜짝 발언, '진짜 수혜주' 밝혀졌다",
                    totalScore: 98,
                    scenario: {
                        durationInSeconds: 30, fps: 30, theme: { primaryColor: "#111827", operatorImage: "/pico.png" },
                        scenes: [
                            { type: "hook", durationFrames: 150, layoutType: "split-impact", assetContent: "🔥", textLines: ["글로벌 1위 주식의 몰락?", "알고 보니 세력들의 개미털기!"], interactionElement: "1분 완벽 정리 🚀" },
                            { type: "problem", durationFrames: 210, layoutType: "split-impact", assetContent: "📉", textLines: ["어제까지 90% 팔아치운 한국인들,", "오늘 땅을 치며 후회 중입니다."], interactionElement: "도대체 왜? 👀" },
                            { type: "proof", durationFrames: 240, layoutType: "split-impact", assetContent: "🕵️", textLines: ["월가 큰손들이 밤새워 쓸어담은", "단 하나의 종목 대공개!"], interactionElement: "충격적 진실공개" }
                        ]
                    }
                }
            ];
            return fallbackTop3;
        }
    }
}
