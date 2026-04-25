# 네이버 오픈API 전체 가이드 — 종류 및 공통 규격

> **원본 출처**: https://developers.naver.com/docs/common/openapiguide/
> **작성일**: 2026-04-25 | **정리자**: Sonnet (Claude Sonnet 4.6)
> **용도**: DataHarvester 고도화 — 네이버 뉴스/DataLab API 연동 리서치

---

## 1. 네이버 오픈API 개요

네이버 오픈API는 인증 여부에 따라 두 가지 방식으로 구분됩니다.

| 방식 | 인증 | 사용 목적 |
|------|------|----------|
| **로그인 방식 오픈 API** | OAuth 2.0 접근 토큰(access token) 필요 | 회원 정보 조회, 카페 글쓰기, 캘린더 등록 등 |
| **비로그인 방식 오픈 API** | Client-ID + Client-Secret HTTP 헤더만 필요 | 검색, 데이터랩, 번역, 이미지 분석 등 |

> ✅ **DataHarvester 연동 대상**: 비로그인 방식 오픈 API (검색, 데이터랩)

---

## 2. 비로그인 방식 오픈 API 전체 목록

### 2-1. 데이터랩 (DataLab) — 검색어 트렌드 & 쇼핑인사이트

| API | 엔드포인트 | 설명 |
|-----|-----------|------|
| 통합 검색어 트렌드 | `POST https://openapi.naver.com/v1/datalab/search` | 네이버 통합검색 키워드별 검색 추이 조회 |
| 쇼핑 카테고리 트렌드 | `POST https://openapi.naver.com/v1/datalab/shopping/categories` | 쇼핑 카테고리별 검색 추이 |
| 쇼핑 기기별 비율 | `POST https://openapi.naver.com/v1/datalab/shopping/category/device` | PC/모바일 기기별 비율 |
| 쇼핑 성별 비율 | `POST https://openapi.naver.com/v1/datalab/shopping/category/gender` | 남/여 성별 비율 |
| 쇼핑 연령별 비율 | `POST https://openapi.naver.com/v1/datalab/shopping/category/age` | 연령대별 비율 |
| 쇼핑 키워드 트렌드 | `POST https://openapi.naver.com/v1/datalab/shopping/category/keywords` | 카테고리 내 키워드별 트렌드 |
| 쇼핑 키워드-기기 | `POST https://openapi.naver.com/v1/datalab/shopping/category/keyword/device` | 키워드별 기기 비율 |
| 쇼핑 키워드-성별 | `POST https://openapi.naver.com/v1/datalab/shopping/category/keyword/gender` | 키워드별 성별 비율 |
| 쇼핑 키워드-연령 | `POST https://openapi.naver.com/v1/datalab/shopping/category/keyword/age` | 키워드별 연령 비율 |

### 2-2. 검색 (Search) — 뉴스/블로그/지식iN 등

| API | 엔드포인트 | 설명 |
|-----|-----------|------|
| **뉴스 검색** ⭐ | `GET https://openapi.naver.com/v1/search/news` | **네이버 뉴스 검색 (DataHarvester 핵심 대상)** |
| 블로그 검색 | `GET https://openapi.naver.com/v1/search/blog` | 네이버 블로그 검색 결과 |
| 백과사전 검색 | `GET https://openapi.naver.com/v1/search/encyc` | 백과사전 검색 결과 |
| 쇼핑 검색 | `GET https://openapi.naver.com/v1/search/shop` | 쇼핑 검색 결과 |
| 웹문서 검색 | `GET https://openapi.naver.com/v1/search/webkr` | 웹문서 검색 결과 |
| 이미지 검색 | `GET https://openapi.naver.com/v1/search/image` | 이미지 검색 결과 |
| 전문정보 검색 | `GET https://openapi.naver.com/v1/search/doc` | 논문/특허 등 전문정보 검색 |
| 지식iN 검색 | `GET https://openapi.naver.com/v1/search/kin` | 지식iN Q&A 검색 결과 |
| 책 검색 | `GET https://openapi.naver.com/v1/search/book` | 책 검색 결과 |
| 카페글 검색 | `GET https://openapi.naver.com/v1/search/cafearticle` | 카페 게시글 검색 결과 |
| 성인검색어 판별 | `GET https://openapi.naver.com/v1/search/adult` | 성인 검색어 여부 판별 |
| 오타 교정 | `GET https://openapi.naver.com/v1/search/errata` | 오타 교정 결과 반환 |
| 지역 검색 | `GET https://openapi.naver.com/v1/search/local` | 지역/장소 검색 결과 |

### 2-3. 기타 비로그인 API

| API | 엔드포인트 | 설명 |
|-----|-----------|------|
| Clova Face Recognition | `POST https://openapi.naver.com/v1/vision/face` | 얼굴 인식 API |
| 셀러브리티 인식 | `POST https://openapi.naver.com/v1/vision/celebrity` | 유명인 얼굴 인식 |
| 이미지 캡차 발급 | `GET https://openapi.naver.com/v1/captcha/ncaptcha.bin` | 이미지 캡차 발급 |
| 이미지 캡차 키 | `GET https://openapi.naver.com/v1/captcha/nkey` | 캡차 키 발급 |
| 음성 캡차 발급 | `GET https://openapi.naver.com/v1/captcha/scaptcha` | 음성 캡차 발급 |
| 네이버 공유하기 | `http://share.naver.com/web/shareView` | 블로그/카페 공유 |

---

## 3. 공통 인증 방식 (비로그인)

```http
GET https://openapi.naver.com/v1/search/news.json?query=주식
X-Naver-Client-Id: {클라이언트 아이디}
X-Naver-Client-Secret: {클라이언트 시크릿}
```

### 인증 헤더 필드

| 헤더명 | 설명 |
|--------|------|
| `X-Naver-Client-Id` | 애플리케이션 등록 후 발급받은 클라이언트 아이디 |
| `X-Naver-Client-Secret` | 애플리케이션 등록 후 발급받은 클라이언트 시크릿 (비밀번호 성격) |

> ⚠️ **보안 주의**: Client Secret은 .env에 저장하고 절대 코드에 하드코딩 금지

---

## 4. 애플리케이션 등록 절차

1. [네이버 개발자 센터](https://developers.naver.com/) 접속 → 네이버 계정으로 로그인
2. [Application > 애플리케이션 등록](https://developers.naver.com/apps/#/wizard/register) 선택
3. 이용약관 동의
4. 계정 정보 등록 (휴대폰 인증 1회 — 최초 등록 시만 필요)
5. 애플리케이션 세부정보 입력:
   - **애플리케이션 이름**: 최대 40자 (로그인 API 사용 시 10자 이내 권장)
   - **사용 API**: 검색, 데이터랩 등 필요한 API 선택
   - **비로그인 오픈 API 서비스 환경**: WEB 설정 → 웹 서비스 URL 입력 (최대 10개)
     - 로컬 개발 시: `http://localhost:3000` 등 입력
6. 등록하기 클릭 → Client ID, Client Secret 발급 확인

---

## 5. 오류 코드 공통 형식

```json
// JSON 오류 응답 예시
{
  "errorMessage": "Authentication failed (인증에 실패하였습니다.)",
  "errorCode": "024"
}
```

| HTTP 상태 코드 | 의미 |
|---------------|------|
| `200` | 정상 처리 |
| `400` | 잘못된 요청 (파라미터 오류 등) |
| `401` | 인증 실패 (Client-ID/Secret 오류) |
| `403` | 권한 없음 |
| `429` | 호출 한도 초과 |
| `500` | 서버 내부 오류 |

---

## 6. MyCrew DataHarvester 연동 전략

### 즉시 적용 가능 (비로그인, 키 발급만 하면 됨)
- ✅ **뉴스 검색 API** — 키워드 기반 실시간 뉴스 수집 (현재 구글 RSS 대체)
- ✅ **DataLab 검색어 트렌드** — 실시간 트렌드 키워드 자동 수집 (하드코딩 키워드 대체)
- ✅ **블로그 검색** — 심층 정보 수집 보조

### 한도 비교
| API | 일일 한도 |
|-----|----------|
| 뉴스 검색 | **25,000회/일** |
| DataLab 트렌드 | **1,000회/일** |
| 블로그 검색 | **25,000회/일** |

---

*정리: Sonnet (Claude Sonnet 4.6 / Antigravity) | 2026-04-25*
