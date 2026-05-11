/**
 * MyCrew 분양 사전질문서 - 구글 폼 질문 항목 추가 스크립트
 *
 * 사용법:
 * 1. https://docs.google.com/forms/d/1hZ48ILUQQwNu-25-Rkk4Q68y2ZW4uAdMb6o8PuQncUs/edit 에서
 *    확장 프로그램 → Apps Script 클릭
 * 2. 기존 코드 전체를 이 스크립트로 교체
 * 3. setupForm 함수 선택 후 실행 (▶ 버튼)
 * 4. 권한 승인 (최초 1회)
 */

function setupForm() {
  var form = FormApp.openById('1hZ48ILUQQwNu-25-Rkk4Q68y2ZW4uAdMb6o8PuQncUs');

  // 폼 제목과 설명 설정
  form.setTitle('MyCrew 분양 사전질문서');
  form.setDescription('맞춤형 AI 팀을 세팅해드리기 위한 사전 질문입니다. 모르는 항목은 비워두셔도 됩니다.');

  // ========================================
  // 섹션 1: 환경 확인
  // ========================================

  // 1. Mac 사용 여부 (필수, 객관식)
  var q1 = form.addMultipleChoiceItem();
  q1.setTitle('Mac을 사용하고 계신가요?')
    .setChoices([
      q1.createChoice('Yes'),
      q1.createChoice('No')
    ])
    .setRequired(true);

  // 2. macOS 버전 (단답형)
  form.addTextItem()
    .setTitle('macOS 버전은? (시스템 설정 → 일반 → 정보)')
    .setRequired(false);

  // 3. Claude 유료 구독 여부 (객관식)
  var q3 = form.addMultipleChoiceItem();
  q3.setTitle('Claude 유료 구독 중이신가요?')
    .setChoices([
      q3.createChoice('무료'),
      q3.createChoice('Pro($20)'),
      q3.createChoice('Max($100)'),
      q3.createChoice('Team')
    ])
    .setRequired(false);

  // 4. 텔레그램 ID (단답형)
  form.addTextItem()
    .setTitle('텔레그램 ID (@아이디)')
    .setRequired(false);

  // 5. 구글 워크스페이스 연동 필요 여부 (객관식)
  var q5 = form.addMultipleChoiceItem();
  q5.setTitle('구글 워크스페이스(Gmail, 캘린더 등) 연동이 필요한가요?')
    .setChoices([
      q5.createChoice('Yes'),
      q5.createChoice('No')
    ])
    .setRequired(false);

  // ========================================
  // 섹션 2: 회사 기본 정보
  // ========================================
  form.addPageBreakItem().setTitle('회사 기본 정보');

  // 6. 회사 이름 (단답형)
  form.addTextItem()
    .setTitle('회사(또는 브랜드) 이름')
    .setRequired(false);

  // 7. 업종 (단답형)
  form.addTextItem()
    .setTitle('업종은 무엇인가요?')
    .setRequired(false);

  // 8. 주요 제품/서비스 (단답형)
  form.addTextItem()
    .setTitle('주요 제품 또는 서비스')
    .setRequired(false);

  // 9. 타겟 고객 (단답형)
  form.addTextItem()
    .setTitle('타겟 고객은 누구인가요?')
    .setRequired(false);

  // ========================================
  // 섹션 3: AI 팀에게 맡기고 싶은 업무
  // ========================================
  form.addPageBreakItem().setTitle('AI 팀에게 맡기고 싶은 업무');

  // 10. AI 팀이 해줬으면 하는 업무 (체크박스, 복수 선택)
  var q10 = form.addCheckboxItem();
  q10.setTitle('AI 팀이 해줬으면 하는 업무는? (복수 선택 가능)')
    .setChoices([
      q10.createChoice('콘텐츠 기획/제작'),
      q10.createChoice('마케팅/광고 운영'),
      q10.createChoice('시장조사/경쟁사 분석'),
      q10.createChoice('고객 응대/CS'),
      q10.createChoice('기획/전략 수립'),
      q10.createChoice('디자인'),
      q10.createChoice('데이터 분석/보고서'),
      q10.createChoice('기타')
    ])
    .setRequired(false);

  // 11. 가장 급한 업무 (단답형)
  form.addTextItem()
    .setTitle('가장 급한 업무 1가지는?')
    .setRequired(false);

  // 12. 현재 업무 담당자 (객관식)
  var q12 = form.addMultipleChoiceItem();
  q12.setTitle('현재 이 업무를 누가 하고 있나요?')
    .setChoices([
      q12.createChoice('본인'),
      q12.createChoice('직원'),
      q12.createChoice('외주'),
      q12.createChoice('안하고있음')
    ])
    .setRequired(false);

  // ========================================
  // 섹션 4: AI 비서 캐릭터
  // ========================================
  form.addPageBreakItem().setTitle('AI 비서 캐릭터');

  // 13. AI 비서 캐릭터 선택 (객관식)
  var q13 = form.addMultipleChoiceItem();
  q13.setTitle('AI 비서 캐릭터 선택')
    .setHelpText('AI 비서가 텔레그램으로 소통합니다. 원하는 캐릭터를 선택해주세요.')
    .setChoices([
      q13.createChoice('Ari (밝고 영민한 비서)'),
      q13.createChoice('Ollie (지혜로운 관리자)'),
      q13.createChoice('Luca (프로페셔널 비서)'),
      q13.createChoice('Lumi (따뜻한 길잡이)'),
      q13.createChoice('Nova (에너지 넘치는 리더)')
    ])
    .setRequired(false);

  Logger.log('폼 설정 완료!');
  Logger.log('편집 URL: ' + form.getEditUrl());
  Logger.log('응답 URL: ' + form.getPublishedUrl());
}
