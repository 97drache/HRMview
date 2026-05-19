# Vercel 인원현황 — 수동 갱신

공개 사이트는 `headcount-web/public/headcount-snapshot.json` 을 빌드에 포함합니다.  
**엑셀을 반영할 때마다** 로컬에서 스냅샷을 만든 뒤 커밋·푸시하면 Vercel이 자동 재배포합니다.

## 절차

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

## 참고

- `HRdata.xlsx` 는 Git에 올리지 않습니다 (`.gitignore`).
- Vercel 빌드는 `npm run build:headcount-web` 만 실행합니다. CI에서 export 하지 않으므로 **반드시 스냅샷 JSON을 커밋**해야 합니다.
