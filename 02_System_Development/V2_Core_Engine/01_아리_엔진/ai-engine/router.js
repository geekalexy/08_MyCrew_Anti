import generalSkill from './skills/generalSkill.js';
import researchSkill from './skills/researchSkill.js';
import mediaSkill from './skills/mediaSkill.js';
import marketingSkill from './skills/marketingSkill.js';
import contentSkill from './skills/contentSkill.js';
import designSkill from './skills/designSkill.js';
import analysisSkill from './skills/analysisSkill.js';
import routingSkill from './skills/routingSkill.js';

class TaskRouter {
    /**
     * 카테고리에 따라 최적의 전문 스킬셋을 반환합니다.
     * @param {string} taskContent 
     * @param {string} category
     */
    route(taskContent, category = 'QUICK_CHAT') {
        console.log(`[Router] 임무 카테고리 감지: ${category}`);

        switch (category) {

            // ── Socian 콘텐츠 마케팅 스킬 ──────────────────────────────
            case 'MARKETING':
                // 릴스/숏폼/광고 기획 → NOVA CMO
                return marketingSkill;

            case 'CONTENT':
                // SNS 카피라이팅/대본 → PICO 카피라이터
                return contentSkill;

            case 'DESIGN':
                // 비주얼/미드저니 프롬프트 → LUMI 디렉터
                return designSkill;

            case 'ANALYSIS':
                // KPI 분석/A/B 테스트/역설계 → OLLIE 분석가
                return analysisSkill;

            case 'ROUTING':
                // 팀 오케스트레이션/일정 조율 → ARI 비서실장
                return routingSkill;

            // ── 지식 & 리서치 ────────────────────────────────────────────
            case 'KNOWLEDGE':
                // 미디어 의도가 포함되면 LUMI 미디어 스킬
                if (taskContent.includes('이미지') || taskContent.includes('영상') || taskContent.includes('미디어')) {
                    return mediaSkill;
                }
                return researchSkill;

            case 'MEDIA':
                // 미디어 생성 전용 (구 KNOWLEDGE + 미디어 키워드)
                return mediaSkill;

            // ── 심층 작업 (Omo 위임) ─────────────────────────────────────
            case 'DEEP_WORK':
                // DEEP_WORK는 Omo 위임 프로세스로 별도 처리
                // Fallback으로 routingSkill 제공
                return routingSkill;

            // ── 기본 (QUICK_CHAT 및 미분류) ──────────────────────────────
            case 'QUICK_CHAT':
            default:
                return generalSkill;
        }
    }
}

export default new TaskRouter();
