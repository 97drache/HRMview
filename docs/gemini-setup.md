# Gemini API 설정 (데스크톱 HRM 전용)

6-1 지출증빙·6-2 출장증빙의 **증빙 자동 분석·구두 입력**, 6-1 PDF/미리보기 **영수증 영역 자동 크롭**에 사용합니다.  
Vercel 인원현황 웹에는 포함되지 않으며, API 키는 Electron **main 프로세스**에서만 읽습니다.

## 설정 순서

### 1. API 키 발급

[Google AI Studio](https://aistudio.google.com/apikey)에서 **Create API key** → `AIza…` 형태의 키를 복사합니다.

### 2. `.env` 파일 만들기

프로젝트 폴더 `C:\Users\user\Desktop\HRM` 에서:

1. **`.env.example`** 을 복사해 **`.env`** 라는 이름으로 저장합니다.  
   - Windows 탐색기: `.env.example` 복사 → 붙여넣기 → 이름을 `.env` 로 변경  
   - 메모장: `.env.example` 열기 → **다른 이름으로 저장** → 파일 이름 `.env` → 인코딩 UTF-8  
2. `.env` 를 열고 `GEMINI_API_KEY=` **바로 뒤**에 키를 붙여넣습니다 (따옴표 없이).

```env
GEMINI_API_KEY=여기에_발급한_키
GEMINI_MODEL=gemini-2.0-flash-lite
```

> `gemini-2.0-flash` 사용 시 **429 · limit: 0 · free_tier** 오류가 나면 위처럼 `-lite` 모델로 바꾸거나 [AI Studio](https://aistudio.google.com/rate-limit)에서 한도·결제(빌링) 설정을 확인하세요.

3. 저장합니다. **`.env`는 Git에 올리지 않습니다.**

> `.env.example` 파일 안에 직접 키를 넣지 마세요. 템플릿만 Git에 있고, 비밀 키는 **`.env` 한 곳**에만 둡니다.

### 3. 앱 다시 실행

`HRM-app\HRM-Desktop.exe` 를 **완전히 종료한 뒤** 다시 실행합니다.

`.env` 는 다음 위치를 순서대로 찾습니다.

| 위치 | 용도 |
|------|------|
| `HRM\.env` | 개발·빌드 폴더 (일반적으로 여기에 둠) |
| `HRM-app\.env` | exe 옆 (선택) |
| 바탕화면 `HRM\.env` | exe만 쓸 때 프로젝트 폴더와 동일 경로 |

### 4. 동작 확인

1. 바탕화면 **증빙폴더** → 날짜 폴더(예: `2026-05-19`)에 영수증·출장 증빙 넣기  
2. **6-1** 또는 **6-2**에서 날짜 맞추기 → 자동으로 항목이 채워지면 성공  
3. **6-1** PDF·미리보기: Gemini가 영수증 종이 영역만 잘라 넣습니다 (키 없으면 로컬 크롭으로 대체)  
4. 키가 없으면 화면에 `.env` 설정 안내가 표시됩니다.

## 문제 해결

| 증상 | 확인 |
|------|------|
| 자동 분석이 안 됨 | `.env` 파일명·위치, `GEMINI_API_KEY=` 뒤 공백·따옴표, exe 재시작 |
| API 403/400 | 키 오타·만료 → AI Studio에서 재발급 |
| **429 · quota · limit: 0** | `.env` 에 `GEMINI_MODEL=gemini-2.0-flash-lite` 로 변경 후 앱 재시작. [사용량](https://aistudio.google.com/rate-limit) 확인, 필요 시 빌링 연결 |
| 필드가 비어 있음 | 증빙 이미지 해상도, 날짜 폴더, **증빙 다시 불러오기** |
