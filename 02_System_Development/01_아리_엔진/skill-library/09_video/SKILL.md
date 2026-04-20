# Video Lab Skill Data

> Gemini 2.0 Pro가 Remotion 비디오 렌더링에 필요한 JSON Props를 구축할 때 참고해야 할 성공/실패 패턴 아카이브입니다.
> 릴리와 피코는 영상 생성 컨텍스트로 이 지식을 상시 참조해야 합니다.

## 원칙
1. JSON 형식은 언제나 ````json \n { ... } \n ```` 이 아닌 순수한 `{ ... }` 포맷을 선호해야 합니다.
2. 프롭스의 시간 단위를 정확히 맞추어야 Syntax Error가 나지 않습니다.

## Training Logs

### [2026-04-19] 🏆 Winner Pattern (Score: 4)
- **Prompt**: 다음 문구를 사용해서 인스타그램 DM 자동화 솔루션을 파는 숏폼 릴스를 만들어줘.
1. 훅: "댓글 문의, 매출로 연결하는 방법"
2. 솔루션: "제품링크/문의, DM 자동화로 해결하세요."
3. 소구점: 업계최저가, 2900원
4. CTA: "최고" 댓글 달고, 시크릿 무료 쿠폰 받기
- **Feedback**: 없음
- **Props Snapshot**: {"durationInSeconds":15,"fps":30,"theme":{"primaryColor":"#1E90FF","secondaryColor":"#FAFAFA","bgGradient":["#0F172A","#1E1B4B"]},"scenes":[{"type":"hook","durationFrames":90,"layoutType":"notification","assetType":"emoji","assetContent":"✉️","textLines":["댓글 문의,","매출로 연결하는 방법"],"animationType":"bounceIn"},{"type":"solution","durationFrames":120,"layoutType":"chat-bubble","assetType":"emoji","assetContent":"💬","textLines":["제품링크/문의,","DM 자동화로 해결하세요."],"animationType":"slideLeft"},{"type":"value","durationFrames":120,"layoutType":"centered","assetType":"emoji","assetContent":"💳","textLines":["업계 최저가,","단 2,900원"],"animationType":"zoomIn","highlightColor":"#FBBF24"},{"type":"cta","durationFrames":120,"layoutType":"centered","assetType":"emoji","assetContent":"🎁","textLines":["\"최고\" 댓글 달고,","시크릿 무료 쿠폰 받기"],"animationType":"pulse","interactionElement":"comment_icon"}]}

### [2026-04-20] ⛔ Failure Case (Score: 3.6)
- **Prompt**: 다음 문구를 사용해서 다이어트 식단 관리 앱을 홍보하는 틱톡 영상을 만들어줘.
1. 훅: "여름 3주 남았는데 아직도 고민만 해?"
2. 솔루션: "AI가 내 체형에 맞춰 짜주는 초간단 식단표"
3. 소구점: 4주 평균 3kg 감량 성공률 87%
4. CTA: "도전" 댓글 달고 1개월 무료 VIP 리포트 받기
- **Feedback**: 없음
- **Props Snapshot**: {"durationInSeconds":16,"fps":30,"theme":{"primaryColor":"#4F46E5","secondaryColor":"#E0E7FF","bgGradient":["#1F2937","#1E40AF"]},"scenes":[{"type":"hook","durationFrames":90,"layoutType":"notification","assetType":"emoji","assetContent":"✉️","textLines":["댓글 문의,","매출로 연결하는 방법"],"animationType":"bounceIn"},{"type":"solution","durationFrames":120,"layoutType":"chat-bubble","assetType":"emoji","assetContent":"💬","textLines":["제품링크/문의,","DM 자동화로 해결하세요."],"animationType":"slideLeft"},{"type":"value","durationFrames":120,"layoutType":"centered","assetType":"emoji","assetContent":"💳","textLines":["업계 최저가,","단 2,900원"],"animationType":"zoomIn","highlightColor":"#FBBF24"},{"type":"cta","durationFrames":150,"layoutType":"centered","assetType":"emoji","assetContent":"🎁","textLines":["\"최고\" 댓글 달고,","시크릿 무료 쿠폰 받기"],"animationType":"pulse","interactionElement":"comment_icon"}]}

### [2026-04-20] ⛔ Failure Case (Score: 1)
- **Prompt**: 다음 문구를 사용해서 다이어트 식단 관리 앱을 홍보하는 틱톡 영상을 만들어줘.
1. 훅: "여름 3주 남았는데 아직도 고민만 해?"
2. 솔루션: "AI가 내 체형에 맞춰 짜주는 초간단 식단표"
3. 소구점: 4주 평균 3kg 감량 성공률 87%
4. CTA: "도전" 댓글 달고 1개월 무료 VIP 리포트 받기
- **Feedback**: 없음
- **Props Snapshot**: {"durationInSeconds":18,"fps":30,"theme":{"primaryColor":"#34D399","secondaryColor":"#FAFAFA","bgGradient":["#ECFDF5","#D1FAE5"]},"scenes":[{"type":"hook","durationFrames":120,"layoutType":"notification","assetType":"emoji","assetContent":"🚨","textLines":["여름 3주 남았는데","아직도 고민만 해?"],"animationType":"bounceIn"},{"type":"solution","durationFrames":150,"layoutType":"chat-bubble","assetType":"emoji","assetContent":"🤖","textLines":["AI가 내 체형에 맞춰","짜주는 초간단 식단표"],"animationType":"slideLeft"},{"type":"value","durationFrames":150,"layoutType":"centered","assetType":"emoji","assetContent":"📈","textLines":["4주 평균 3kg 감량","성공률 87%"],"animationType":"zoomIn","highlightColor":"#4ADE80"},{"type":"cta","durationFrames":120,"layoutType":"centered","assetType":"emoji","assetContent":"🎁","textLines":["\"도전\" 댓글 달고","1개월 무료 VIP 리포트 받기"],"animationType":"pulse","interactionElement":"comment_icon"}]}

### [2026-04-20] ⛔ Failure Case (Score: 1)
- **Prompt**: 다음 문구를 사용해서 패션 이커머스 신상 니트를 파는 숏폼 릴스를 만들어줘.
1. 훅: "지금 안 입으면 품절각! 여리여리 오프숄더"
2. 솔루션: "어깨라인 완벽 커버, 슬림핏 자동 연출"
3. 소구점: 1+1 특별 할인, 오늘 출발 무료배송
4. CTA: 링크 클릭하고 코디 좌표 바로 확인하기
- **Feedback**: 없음
- **Props Snapshot**: {"durationInSeconds":15,"fps":30,"theme":{"primaryColor":"#F8A4B8","secondaryColor":"#FAFAFA","bgGradient":["#FFDAB9","#F8A4B8"]},"scenes":[{"type":"hook","durationFrames":90,"layoutType":"notification","assetType":"emoji","assetContent":"🔥","textLines":["지금 안 입으면 품절각!","여리여리 오프숄더"],"animationType":"bounceIn"},{"type":"solution","durationFrames":120,"layoutType":"chat-bubble","assetType":"emoji","assetContent":"✨","textLines":["어깨라인 완벽 커버,","슬림핏 자동 연출"],"animationType":"slideLeft"},{"type":"value","durationFrames":120,"layoutType":"centered","assetType":"emoji","assetContent":"🛍️","textLines":["1+1 특별 할인","오늘 출발 무료배송"],"animationType":"zoomIn","highlightColor":"#FFD700"},{"type":"cta","durationFrames":120,"layoutType":"centered","assetType":"emoji","assetContent":"🔗","textLines":["링크 클릭하고","코디 좌표 바로 확인하기"],"animationType":"pulse","interactionElement":"link_icon"}]}

### [2026-04-20] 🏆 Winner Pattern (Score: 4)
- **Prompt**: 다음 문구를 사용해서 인스타그램 DM 자동화 솔루션을 파는 숏폼 릴스를 만들어줘.
1. 훅: "댓글 문의, 매출로 연결하는 방법"
2. 솔루션: "제품링크/문의, DM 자동화로 해결하세요."
3. 소구점: 업계최저가, 2900원
4. CTA: "최고" 댓글 달고, 시크릿 무료 쿠폰 받기
- **Feedback**: 없음
- **Props Snapshot**: {"durationInSeconds":15,"fps":30,"theme":{"primaryColor":"#6A5ACD","secondaryColor":"#F0F0F0","bgGradient":["#1A202C","#2D3748"]},"scenes":[{"type":"hook","durationFrames":90,"layoutType":"notification","assetType":"emoji","assetContent":"✉️","textLines":["댓글 문의,","매출로 연결하는 방법"],"animationType":"bounceIn"},{"type":"solution","durationFrames":120,"layoutType":"chat-bubble","assetType":"emoji","assetContent":"💬","textLines":["제품링크/문의,","DM 자동화로 해결하세요."],"animationType":"slideLeft"},{"type":"value","durationFrames":120,"layoutType":"centered","assetType":"emoji","assetContent":"💳","textLines":["업계 최저가,","단 2,900원"],"animationType":"zoomIn","highlightColor":"#FBBF24"},{"type":"cta","durationFrames":120,"layoutType":"centered","assetType":"emoji","assetContent":"🎁","textLines":["\"최고\" 댓글 달고,","시크릿 무료 쿠폰 받기"],"animationType":"pulse","interactionElement":"comment_icon"}]}

### [2026-04-20] ⛔ Failure Case (Score: 3)
- **Prompt**: Create a clean motion graphic video with minimal typography animation. Smooth text fade-in effects, brand color palette, and professional timing cues.
- **Feedback**: 없음
- **Props Snapshot**: {"durationInSeconds":15,"fps":30,"theme":{"primaryColor":"#1E90FF","secondaryColor":"#FAFAFA","bgGradient":["#0F172A","#1E1B4B"]},"scenes":[{"type":"hook","durationFrames":90,"layoutType":"notification","assetType":"emoji","assetContent":"✉️","textLines":["댓글 문의,","매출로 연결하는 방법"],"animationType":"bounceIn"},{"type":"solution","durationFrames":120,"layoutType":"chat-bubble","assetType":"emoji","assetContent":"💬","textLines":["제품링크/문의,","DM 자동화로 해결하세요!"],"animationType":"slideLeft"},{"type":"value","durationFrames":90,"layoutType":"centered","assetType":"emoji","assetContent":"💳","textLines":["업계 최저가,","단 2,900원"],"animationType":"zoomIn","highlightColor":"#FBBF24"},{"type":"cta","durationFrames":150,"layoutType":"centered","assetType":"emoji","assetContent":"🎁","textLines":["\"최고\" 댓글 달고,","시크릿 무료 쿠폰 받기"],"animationType":"pulse","interactionElement":"comment_icon","highlightColor":"#1E90FF"}]}
