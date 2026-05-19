# Vercel 인원현황 — 매일 자동 갱신

공개 사이트(`headcount-web`)는 빌드 시 `headcount-web/public/headcount-snapshot.json` 을 포함합니다.  
**매일 06:00 (한국 시간)** GitHub Actions가 엑셀에서 스냅샷을 다시 만들고 `main`에 푸시하면, Vercel이 연결된 저장소를 자동 재배포합니다.

## 1. 한 번만 설정 (GitHub)

### A. 엑셀을 비공개 저장소에 두기 (권장)

1. GitHub에 **비공개** 저장소를 만듭니다. 예: `HRM-data`
2. 저장소 **루트**에 `HRdata.xlsx` 를 올립니다. (또는 `data/HRdata.xlsx`)
3. [Fine-grained PAT](https://github.com/settings/tokens?type=beta) 또는 Classic PAT — 권한: 해당 비공개 저장소 **Contents: Read**
4. **HRMview** (또는 배포용) 저장소 → **Settings → Secrets and variables → Actions** 에 추가:

| Secret | 예시 |
|--------|------|
| `HRDATA_REPO` | `97drache/HRM-data` |
| `HRDATA_REPO_TOKEN` | `github_pat_...` |

### B. 다운로드 URL 사용

엑셀을 웹에서 받을 수 있는 **직접 다운로드 URL**이 있으면:

| Secret | 설명 |
|--------|------|
| `HRDATA_DOWNLOAD_URL` | `curl -L` 로 받을 수 있는 URL |

> OneDrive/SharePoint는 “직접 링크” 형태여야 합니다. 브라우저 HTML만 주는 공유 페이지는 동작하지 않을 수 있습니다.

## 2. 동작 확인

1. GitHub → **Actions** → **Daily headcount snapshot** → **Run workflow** (수동 1회)
2. 성공 후 `headcount-web/public/headcount-snapshot.json` 커밋이 생기는지 확인
3. Vercel 대시보드에서 새 배포가 뜨는지 확인

## 3. 스케줄 변경

`.github/workflows/daily-headcount-snapshot.yml` 의 `cron` 을 수정합니다.

```yaml
# cron: 분 시 일 월 요일 (UTC)
- cron: '0 21 * * *'   # 06:00 KST
```

[cron 도우미](https://crontab.guru/) — **시간은 UTC** 기준입니다.

## 4. 로컬에서 수동 갱신 (기존 방식)

```bash
# data/HRdata.xlsx 를 넣은 뒤
npm run export:headcount-public
git add headcount-web/public/headcount-snapshot.json
git commit -m "chore(headcount): update snapshot"
git push
```

## 5. Vercel Cron이 필요한가?

이 프로젝트는 **정적 사이트**이므로, 데이터 갱신은 **GitHub에서 스냅샷 JSON을 갱신 → 푸시 → Vercel 빌드** 방식이 맞습니다.  
Vercel Cron만으로는 엑셀 집계를 할 수 없습니다.

## 문제 해결

| 증상 | 확인 |
|------|------|
| Actions 실패 “secrets not set” | `HRDATA_REPO` + `HRDATA_REPO_TOKEN` 또는 `HRDATA_DOWNLOAD_URL` |
| Snapshot is empty | 비공개 저장소에 파일명·경로가 `HRdata.xlsx` 인지 |
| Vercel이 안 바뀜 | Vercel이 `main` 브랜치에 연결돼 있는지, Actions 푸시 권한(`contents: write`) |
| 푸시 거부 | `main` 브랜치 보호 규칙에서 `github-actions[bot]` 허용 |
