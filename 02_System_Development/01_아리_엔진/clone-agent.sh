#!/bin/bash

# 🚀 MyCrew "B2B 상용화 패키징" 스크립트 (v1.0)
# 목적: 현재 엔진의 '지능(Skill)'은 보존하고 '기억(Data/Token)'은 삭제하여 배포용 ZIP 생성

echo "===================================================="
echo "🛡️ MyCrew Commercial Packaging System starting..."
echo "===================================================="

# 1. 변수 설정
RELEASE_DIR="mycrew_release_$(date +%Y%m%d)"
ORIGIN_DIR=$(pwd)

echo "[1/5] 임시 배포 폴더 생성: $RELEASE_DIR"
mkdir -p "../$RELEASE_DIR"

# 2. 필수 파일 복사 (지능 및 엔진 코어)
echo "[2/5] 엔진 코어 및 스킬 라이브러리 복사중..."
cp -r ai-engine "../$RELEASE_DIR/"
cp -r skill-library "../$RELEASE_DIR/"
cp server.js agents.json database.js package.json package-lock.json "../$RELEASE_DIR/"

# 3. 데이터 및 기밀 파기 (The Wipe)
echo "[3/5] 🚨 기밀 데이터 및 로컬 히스토리 삭제 중..."
rm -f "../$RELEASE_DIR/database.sqlite"  # 과거 대화/칸반 내역 완전 삭제
rm -f "../$RELEASE_DIR/.env"            # 자사용 API Key 삭제
rm -f "../$RELEASE_DIR/.env.legacy"

# 4. 자아(Soul) 초기화 템플릿 생성
echo "[4/5] 기업용 페르소나(Soul) 템플릿 생성 중..."
cat <<EOF > "../$RELEASE_DIR/MYCREW.md"
# 🏢 [고객사명] 팀 미션 및 규칙
이곳에 도입사의 비전과 업무 규칙을 입력해 주세요. 에이전트가 이 내용을 바탕으로 사고합니다.

## 1. 미션
* 예: 우리는 세상을 더 이롭게 만드는 서비스를 구축한다.

## 2. 핵심 규칙
* 기밀을 준수한다.
* 보고 시 항상 요약본을 첨부한다.
EOF

cat <<EOF > "../$RELEASE_DIR/IDENTITY.md"
# 👤 에이전트 페르소나
에이전트의 성격과 말투를 정의합니다.
* 말투: 정중하고 프로페셔널한 존댓말
* 특징: 데이터 기반의 논리적 추론 선호
EOF

# 5. 압축 및 종료
echo "[5/5] 최종 배포 패키지 압축 중..."
cd ..
zip -r "${RELEASE_DIR}.zip" "$RELEASE_DIR"
rm -rf "$RELEASE_DIR"

echo "===================================================="
echo "✅ 배포 패키지 생성 완료: ${RELEASE_DIR}.zip"
echo "위 파일을 고객사 서버에 업로드하고 'npm install'을 실행하세요."
echo "===================================================="
