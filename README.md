# HRM 로컬 대시보드

Electron + Vite + React. 인원·휴직·연수 엑셀을 불러와 로컬에서만 표·그래프로 봅니다.

## 실행 (배포본)

1. `SETUP.bat` — `npm install` 후 `npm run pack`까지 한 번에 (시간이 걸릴 수 있음).
2. `HRM-app\HRM-Desktop.exe` 더블클릭.  
   또는 `실행.bat`.

## 개발

- `npm install`
- `npm run dev:desktop` — 소스 수정 반영
- `npm run pack` — `HRM-app` 폴더 갱신

## 폴더

- `data/` — 엑셀 보관용(저장소에는 내용 미포함).
- `HRM-app/` — 패킹 결과물(`npm run pack`으로 재생성).

## Vercel 인원현황 — 매일 자동 갱신

GitHub Actions가 **매일 06:00 (KST)** `HRdata.xlsx` → `headcount-snapshot.json` 을 만들고 `main`에 푸시합니다. Vercel은 푸시 시 자동 재배포됩니다.

- 워크플로: `.github/workflows/daily-headcount-snapshot.yml`
- 최초 설정(비공개 엑셀 저장소·시크릿): [docs/daily-vercel-update.md](docs/daily-vercel-update.md)
