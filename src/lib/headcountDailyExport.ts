import { useEffect } from 'react'
import { buildHeadcountPublicSnapshot } from './headcountPublicSnapshot'
import {
  isDesktopApp,
  onHeadcountExportRequest,
  onHrdataChanged,
  publishHeadcountSnapshot,
  shouldExportHeadcountToday,
} from './desktopBridge'
import type { ParsedWorkbook } from '../types/hr'

/** 데스크톱 「모바일 반영」 — Vercel은 Git push 후 재배포되어야 화면 날짜가 바뀝니다. */
export async function publishMobileHeadcountSnapshot(
  data: ParsedWorkbook,
  baseDate: Date,
): Promise<string> {
  const snap = buildHeadcountPublicSnapshot(
    data.personnel,
    data.training,
    baseDate,
    data.sheetNotes,
    false,
    data.leave,
  )
  const r = await publishHeadcountSnapshot(JSON.stringify(snap, null, 2))
  const lines = [`스냅샷 저장 (${snap.baseDate})`]
  if (r.gitMessage) lines.push(r.gitMessage)
  if (!r.gitOk) {
    lines.push('모바일 반영 실패 — git 인증·네트워크를 확인하세요')
  }
  if (r.deployMessage && r.deployOk) lines.push(r.deployMessage)
  return lines.join(' · ')
}

async function exportSnapshotFromData(
  data: ParsedWorkbook,
  baseDate: Date,
): Promise<void> {
  const need = await shouldExportHeadcountToday()
  if (!need) return
  const snap = buildHeadcountPublicSnapshot(
    data.personnel,
    data.training,
    baseDate,
    data.sheetNotes,
    false,
    data.leave,
  )
  await publishHeadcountSnapshot(JSON.stringify(snap, null, 2))
}

export function useHeadcountDailyExport(
  data: ParsedWorkbook | null,
  baseDate: Date,
  reloadFromFolder: () => Promise<void>,
) {
  useEffect(() => {
    if (!isDesktopApp()) return

    const unsubHr = onHrdataChanged(() => {
      void reloadFromFolder()
    })

    const unsubExport = onHeadcountExportRequest(() => {
      if (!data?.personnel?.length) return
      void exportSnapshotFromData(data, baseDate)
    })

    return () => {
      unsubHr()
      unsubExport()
    }
  }, [reloadFromFolder, data, baseDate])

  useEffect(() => {
    if (!isDesktopApp() || !data?.personnel?.length) return
    void exportSnapshotFromData(data, baseDate)
  }, [data, baseDate])
}
