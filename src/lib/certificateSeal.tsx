import { CERT_LOGO_GIST_DATA_URL, CERT_LOGO_WORDMARK_DATA_URL } from './certificateLetterheadAssets'

/** 증명서 좌상단 관인 영역 — 미확인 시 TEST 워터마크, 확인 후 전자관인 */

export function certificateSealHtml(officerVerified: boolean): string {
  const label =
    '<div class="t8" style="margin-top:4px;line-height:1.35;font-weight:600;">광주과학기술원<br/>총장</div>'
  if (officerVerified) {
    return `<div style="position:relative;width:120px;">
      <div title="관인" style="width:54px;height:54px;border:2.5px solid #b91c1c;border-radius:3px;display:flex;align-items:center;justify-content:center;color:#b91c1c;font-weight:bold;font-size:15pt;letter-spacing:-1px;transform:rotate(-10deg);user-select:none;">印</div>
      ${label}
    </div>`
  }
  return `<div style="position:relative;width:120px;min-height:78px;">
    <div aria-hidden="true" style="position:absolute;left:-4px;top:2px;width:100px;height:58px;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0;">
      <span style="font-size:26pt;font-weight:800;color:rgba(185,28,28,0.14);letter-spacing:3px;transform:rotate(-16deg);user-select:none;white-space:nowrap;">TEST</span>
    </div>
    <div style="position:relative;z-index:1;width:54px;height:54px;border:1px dashed #bbb;border-radius:3px;background:rgba(255,255,255,0.85);"></div>
    ${label}
  </div>`
}

export function CertificateSealPreview({ officerVerified }: { officerVerified: boolean }) {
  if (officerVerified) {
    return (
      <div className="w-[120px]">
        <div
          className="flex h-[54px] w-[54px] items-center justify-center border-[2.5px] border-red-700 text-[15pt] font-bold text-red-700"
          style={{ transform: 'rotate(-10deg)' }}
        >
          印
        </div>
        <div className="mt-1 text-[8pt] font-semibold leading-snug text-slate-700">
          광주과학기술원
          <br />
          총장
        </div>
      </div>
    )
  }
  return (
    <div className="relative min-h-[78px] w-[120px]">
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-1 flex h-14 w-24 items-center justify-center"
      >
        <span
          className="select-none whitespace-nowrap text-[26pt] font-extrabold text-red-700/15"
          style={{ transform: 'rotate(-16deg)', letterSpacing: '0.08em' }}
        >
          TEST
        </span>
      </div>
      <div className="relative z-[1] h-[54px] w-[54px] rounded border border-dashed border-slate-300 bg-white/90" />
      <div className="relative z-[1] mt-1 text-[8pt] font-semibold leading-snug text-slate-700">
        광주과학기술원
        <br />
        총장
      </div>
    </div>
  )
}

export function certificateSealStampHtml(officerVerified: boolean): string {
  if (officerVerified) {
    return `<div title="관인" style="width:58px;height:58px;border:2.5px solid #b91c1c;border-radius:3px;display:flex;align-items:center;justify-content:center;color:#b91c1c;font-weight:bold;font-size:16pt;letter-spacing:-1px;transform:rotate(-10deg);user-select:none;">印</div>`
  }
  return `<div style="position:relative;width:58px;height:58px;border:1px dashed #bbb;border-radius:3px;background:rgba(255,255,255,0.88);overflow:hidden;">
    <div aria-hidden="true" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
      <span style="font-size:20pt;font-weight:800;color:rgba(185,28,28,0.16);letter-spacing:2px;transform:rotate(-18deg);user-select:none;white-space:nowrap;">TEST</span>
    </div>
  </div>`
}

export function CertificateSealStampPreview({ officerVerified }: { officerVerified: boolean }) {
  if (officerVerified) {
    return (
      <div
        className="flex h-[58px] w-[58px] items-center justify-center border-[2.5px] border-red-700 text-[16pt] font-bold text-red-700"
        style={{ transform: 'rotate(-10deg)' }}
      >
        印
      </div>
    )
  }
  return (
    <div className="relative h-[58px] w-[58px] overflow-hidden rounded border border-dashed border-slate-300 bg-white/90">
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span
          className="select-none whitespace-nowrap text-[20pt] font-extrabold text-red-700/15"
          style={{ transform: 'rotate(-18deg)', letterSpacing: '0.08em' }}
        >
          TEST
        </span>
      </div>
    </div>
  )
}

export function certificateLetterheadHtml(): string {
  return `<div style="margin-bottom:18px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
      <div>
        <img src="${CERT_LOGO_GIST_DATA_URL}" alt="GIST" style="display:block;width:165px;height:auto;"/>
        <img src="${CERT_LOGO_WORDMARK_DATA_URL}" alt="광주과학기술원" style="display:block;width:150px;height:auto;margin-top:4px;"/>
      </div>
      <div style="text-align:right;font-size:8pt;color:#4b5563;line-height:1.4;">
        <div>61005 광주광역시 북구 첨단과기로 123(오룡동)</div>
        <div>Tel. 062-715-5043 &nbsp; Fax. 062-715-5049</div>
      </div>
    </div>
    <div style="margin-top:8px;border-top:1px solid #cbd5e1;"></div>
    <div style="margin-top:2px;border-top:2px solid #111827;"></div>
  </div>`
}

export function CertificateLetterheadPreview() {
  return (
    <div className="mb-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <img src={CERT_LOGO_GIST_DATA_URL} alt="GIST" className="block w-[165px]" />
          <img src={CERT_LOGO_WORDMARK_DATA_URL} alt="광주과학기술원" className="mt-1 block w-[150px]" />
        </div>
        <div className="text-right text-[8pt] leading-snug text-slate-600">
          <div>61005 광주광역시 북구 첨단과기로 123(오룡동)</div>
          <div>Tel. 062-715-5043 &nbsp; Fax. 062-715-5049</div>
        </div>
      </div>
      <div className="mt-2 border-t border-slate-300" />
      <div className="mt-0.5 border-t-2 border-slate-900" />
    </div>
  )
}
