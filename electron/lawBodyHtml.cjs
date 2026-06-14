/**
 * 국가법령정보 OPEN API JSON → 앱 내 정적 HTML (JS 불필요)
 */

function asArray(v) {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatYmd(ymd) {
  const s = String(ymd).replace(/\D/g, '')
  if (s.length !== 8) return String(ymd)
  return `${s.slice(0, 4)}. ${Number(s.slice(4, 6))}. ${Number(s.slice(6, 8))}.`
}

function pickText(row, keys) {
  for (const k of keys) {
    const v = row?.[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function renderMok(mok) {
  return asArray(mok)
    .map((m) => {
      const text = pickText(m, ['목내용', 'content'])
      return text ? `<p class="mok">${escapeHtml(text)}</p>` : ''
    })
    .join('')
}

function renderHo(ho) {
  return asArray(ho)
    .map((h) => {
      const text = pickText(h, ['호내용', 'content'])
      let out = text ? `<p class="ho">${escapeHtml(text)}</p>` : ''
      if (h?.목) out += renderMok(h.목)
      return out
    })
    .join('')
}

function renderHang(hang) {
  return asArray(hang)
    .map((h) => {
      const text = pickText(h, ['항내용', 'content'])
      let out = text ? `<p class="hang">${escapeHtml(text)}</p>` : ''
      if (h?.호) out += renderHo(h.호)
      return out
    })
    .join('')
}

function renderJoUnit(unit) {
  const kind = pickText(unit, ['조문여부'])
  const body = pickText(unit, ['조문내용'])
  const title = pickText(unit, ['조문제목'])
  const hang = unit?.항

  if (kind === '전문' || kind === '편' || kind === '장' || kind === '절') {
    return `<h3 class="section">${escapeHtml(body)}</h3>`
  }

  const heading = body || (title ? `제${unit.조문번호}조(${title})` : '')
  let html = `<article class="jo">`
  if (heading) {
    html += `<h4 class="jo-title">${escapeHtml(heading)}</h4>`
  }
  if (hang) {
    html += renderHang(hang)
  } else if (body && kind === '조문') {
    html += `<p class="jo-body">${escapeHtml(body)}</p>`
  }
  html += `</article>`
  return html
}

function extractLawRoot(json) {
  return json?.법령 || json?.Law || json
}

function renderLawBodyHtml(json) {
  const law = extractLawRoot(json)
  if (!law) return null

  const info = law.기본정보 || law.basicInfo || {}
  const lawName = pickText(info, ['법령명_한글', '법령명한글', '법령명'])
  const efYd = pickText(info, ['시행일자', 'efYd'])
  const pubYd = pickText(info, ['공포일자', 'pubYd'])
  const amend = pickText(info, ['제개정구분', 'amendType'])
  const dept =
    pickText(info, ['소관부처', 'dept']) ||
    pickText(info?.소관부처, ['content', '소관부처명']) ||
    ''

  const joBlock = law.조문 || law.jo || {}
  const units = asArray(joBlock.조문단위 || joBlock.joUnit)
  const body = units.map(renderJoUnit).join('\n')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(lawName)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 1.25rem 1.5rem 2rem;
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
      font-size: 14px;
      line-height: 1.65;
      color: #1e293b;
      background: #fff;
    }
    .meta {
      margin-bottom: 1.25rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e2e8f0;
    }
    .meta h1 {
      margin: 0 0 0.5rem;
      font-size: 1.35rem;
      font-weight: 700;
      color: #0f172a;
    }
    .meta p { margin: 0.2rem 0; font-size: 0.85rem; color: #64748b; }
    .section {
      margin: 1.5rem 0 0.75rem;
      font-size: 1.05rem;
      font-weight: 700;
      color: #334155;
    }
    .jo { margin: 1rem 0; }
    .jo-title {
      margin: 0 0 0.5rem;
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
    }
    .jo-body, .hang, .ho, .mok {
      margin: 0.35rem 0;
      white-space: pre-wrap;
      word-break: keep-all;
    }
    .ho { padding-left: 1rem; }
    .mok { padding-left: 2rem; }
    .source {
      margin-top: 2rem;
      padding-top: 0.75rem;
      border-top: 1px solid #e2e8f0;
      font-size: 0.75rem;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <header class="meta">
    <h1>${escapeHtml(lawName)}</h1>
    ${efYd ? `<p>시행 ${escapeHtml(formatYmd(efYd))}</p>` : ''}
    ${pubYd ? `<p>공포 ${escapeHtml(formatYmd(pubYd))}${amend ? ` · ${escapeHtml(amend)}` : ''}</p>` : ''}
    ${dept ? `<p>소관 ${escapeHtml(dept)}</p>` : ''}
  </header>
  <main>${body || '<p>조문 내용이 없습니다.</p>'}</main>
  <footer class="source">출처: 국가법령정보센터 · OPEN API</footer>
</body>
</html>`
}

module.exports = { renderLawBodyHtml }
