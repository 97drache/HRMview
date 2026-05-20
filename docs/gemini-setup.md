# Gemini API 설정 (데스크톱 HRM 전용)

6-1 지출증빙·6-2 출장증빙의 **영수증 인식·음성 정리**에만 사용합니다.  
**Vercel 인원현황 웹에는 포함되지 않으며**, API 키는 Electron **main 프로세스**에서만 읽습니다.

## 보안 요약

| 항목 | 설명 |
|------|------|
| 키 저장 위치 | 프로젝트 `.env`(로컬), 또는 앱 사용자 데이터 `gemini-config.json` |
| Git | `.env`, `gemini-config.json` 은 커밋되지 않음 |
| Vercel | `headcount-web` 빌드만 배포 — Gemini 코드·키 없음 |
| 브라우저 | API 키가 화면(JS)으로 전달되지 않음 (IPC만 사용) |

---

## 설정 순서 (처음 한 번)

### 1. Google AI Studio에서 API 키 발급

1. 브라우저에서 [Google AI Studio API 키](https://aistudio.google.com/apikey) 접속  
2. Google 계정 로그인  
3. **Create API key** → 새 키 생성  
4. 표시된 키(`AIza…`)를 복사해 **안전한 곳에 잠깐 보관** (다시 전체가 안 보일 수 있음)

### 2. HRM 프로젝트 폴더에 `.env` 만들기

1. `C:\Users\user\Desktop\HRM` (또는 클론한 폴더)로 이동  
2. `.env.example` 을 복사해 **`.env`** 파일 생성  
3. 아래처럼 붙여넣기:

```env
GEMINI_API_KEY=여기에_발급한_키
GEMINI_MODEL=gemini-2.0-flash
```

4. 저장 (`.env` 는 Git에 올라가지 않음)

### 3. 데스크톱 앱 실행

1. `HRM-app\HRM-Desktop.exe` 실행 (또는 `npm run dev:desktop` 개발 시)  
2. 메뉴 **6-1 지급신청서 증빙** 이동  
3. 안내 문구에 **「Gemini 사용 가능」** 이 보이면 성공  

앱 UI에서 **「API 키 저장」** 으로 넣은 키는 Windows 사용자 폴더의 앱 데이터에 저장됩니다. `.env` 보다 우선하지 않으며, 둘 다 없을 때만 UI 입력이 필요합니다.

### 4. 영수증 자동 분석 확인 (6-1)

1. 바탕화면 **증빙폴더** → 날짜 폴더(예: `2026-05-19`)에 영수증 사진/PDF 넣기  
2. 6-1에서 **영수증 날짜**를 그 날짜로 맞추기  
3. 불러오면 **Gemini가 승인일시·상호·금액 등을 자동 입력** (키가 있을 때)  
4. 값이 맞는지 확인 후 PDF 저장  

### 5. 출장 음성 (6-2)

1. **6-2 출장 증빙** → 음성 입력  
2. Gemini 설정 시 **출장지·기간을 한 번에 말하기**  
3. 6-1과 **같은 API 키** 사용  

---

## 키가 없을 때

- 6-1: 예전처럼 **OCR**로만 분석 (정확도 낮을 수 있음)  
- 6-2: **출장지·일자를 두 번** 나눠 음성 입력  

---

## 문제 해결

| 증상 | 확인 |
|------|------|
| Gemini 사용 가능이 안 뜸 | `.env` 위치, `GEMINI_API_KEY=` 뒤 공백·따옴표, 앱 재시작 |
| API 오류 403/400 | 키 만료·오타, [AI Studio](https://aistudio.google.com/)에서 키 재발급 |
| 필드가 비어 있음 | 영수증 해상도, 증빙폴더 날짜·파일명, **이미지/PDF 다시 불러오기·분석** |
| Vercel에 키 노출 걱정 | 인원 웹은 정적 JSON만 사용 — Gemini 미포함 |
