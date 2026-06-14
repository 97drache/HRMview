# Vercel 인원현황 — 자동·수동 갱신

공개(모바일) 사이트는 `headcount-web/public/headcount-snapshot.json` 을 빌드에 포함합니다.

## 데스크톱 앱 자동 갱신 (권장)

HRM-Desktop.exe 가 **하루에 한 번** 최신 `HRdata.xlsx` 로 스냅샷을 만듭니다.

1. **data 폴더 위치**
   - 개발: `프로젝트/data/HRdata.xlsx`
   - 설치본: `HRM-app/data/HRdata.xlsx` (exe 옆 — `resources/data` 가 아닙니다)
2. 앱을 **하루에 한 번 이상** 실행하면, 당일 아직 내보내지 않았을 때 자동으로 스냅샷을 저장합니다.
3. 저장 위치: `headcount-web/public/headcount-snapshot.json` (저장소를 찾은 경우) + `%AppData%/hrm/headcount-snapshot.json`

### Git push + Vercel 배포 (기본 동작)

데스크톱 앱은 스냅샷 저장 후 **자동으로 `git push`** 합니다. (GitHub에 인증이 되어 있어야 합니다.)

끄려면 `.env` (또는 exe와 같은 폴더)에:

```env
HRM_HEADCOUNT_AUTO_PUBLISH=0
```

Vercel Deploy Hook(선택):

```env
VERCEL_DEPLOY_HOOK_URL=https://api.vercel.com/v1/integrations/deploy/...
```

- push 성공 후 Deploy Hook이 있으면 Vercel 재배포를 추가로 호출합니다.

Git 원격 인증은 PC에 이미 설정되어 있어야 합니다.

## 수동 갱신

1. `data/HRdata.xlsx` 를 최신으로 둡니다.
2. 스냅샷 생성:

```bash
npm run export:headcount-public
```

3. 변경 확인 후 커밋·푸시:

```bash
git add headcount-web/public/headcount-snapshot.json
git commit -m "chore(headcount): update snapshot"
git push origin main
```

4. Vercel 대시보드에서 배포 완료를 확인합니다.

## 기준일

당일 기준이 아니라 특정일로 맞추려면:

```bash
# Windows PowerShell
$env:HRM_SNAPSHOT_BASE_DATE="2026-05-19"
npm run export:headcount-public
```

## 엑셀 새로고침

데스크톱 앱은 `HRdata.xlsx` 변경을 감지하면 자동으로 다시 불러옵니다.  
수동으로는 상단 **「엑셀 새로고침」** 버튼을 사용하세요.

## 참고

- `HRdata.xlsx` 는 Git에 올리지 않습니다 (`.gitignore`).
- Vercel 빌드는 `npm run build:headcount-web` 만 실행합니다. CI에서 export 하지 않으므로 **스냅샷 JSON을 커밋**하거나 Deploy Hook으로 재배포해야 합니다.
