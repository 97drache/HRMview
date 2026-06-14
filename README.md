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
- **6-1·6-2 Gemini(영수증·음성):** [docs/gemini-setup.md](docs/gemini-setup.md) — 데스크톱 전용, Vercel 미포함

## 폴더

- `data/` — 엑셀 보관용(저장소에는 내용 미포함). **설치본**은 `HRM-app/data/HRdata.xlsx` 를 수정하세요.
- `HRM-app/` — 패킹 결과물(`npm run pack`으로 재생성).

## Vercel 인원현황 — 갱신

데스크톱 앱이 **하루 1회** 모바일용 스냅샷을 자동 저장합니다. Git push·Vercel 배포 자동화는 [docs/daily-vercel-update.md](docs/daily-vercel-update.md) 참고.
