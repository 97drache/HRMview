#!/usr/bin/env node
/**
 * 국가법령정보 OPEN API MCP (Cursor 등)
 * env: LAW_GO_KR_OC (필수), LAW_GO_KR_TYPE=JSON
 */
const path = require('path')
const os = require('os')
const { Server } = require('@modelcontextprotocol/sdk/server/index.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js')
const lawApi = require('../../electron/lawOpenApi.cjs')

function loadDotEnvFile(envPath) {
  try {
    const text = require('fs').readFileSync(envPath, 'utf8')
    const out = {}
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      out[key] = val
    }
    return out
  } catch {
    return null
  }
}

/** OC는 프로젝트 .env 에만 두고, mcp.json 에 실값을 넣지 않음 */
function loadProjectEnv() {
  const envPath = path.join(__dirname, '..', '..', '.env')
  const parsed = loadDotEnvFile(envPath)
  if (!parsed) return
  for (const [k, v] of Object.entries(parsed)) {
    if (k === 'LAW_GO_KR_OC' || k === 'LAW_GO_KR_TYPE') {
      if (process.env[k] == null || process.env[k] === '') process.env[k] = v
    }
  }
}
loadProjectEnv()

const userDataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'HRM')

const server = new Server(
  { name: 'hrm-korea-law', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'law_search',
      description: '현행 법령 검색 (국가법령정보센터)',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '검색어 (법령명)' },
          page: { type: 'number', description: '페이지 (기본 1)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'law_get_body',
      description: '법령 본문 HTML 조회 (MST 또는 lawId)',
      inputSchema: {
        type: 'object',
        properties: {
          mst: { type: 'string' },
          lawId: { type: 'string' },
          jo: { type: 'string', description: '6자리 조번호 (예: 002300 = 제23조)' },
        },
      },
    },
    {
      name: 'law_recent_hr_changes',
      description: '최근 인사·근로 관련 조문 개정 이력',
      inputSchema: {
        type: 'object',
        properties: {
          days: { type: 'number', description: '조회 일수 (기본 90)' },
        },
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  try {
    if (name === 'law_search') {
      const query = String(args?.query ?? '')
      const page = Number(args?.page) || 1
      const r = await lawApi.searchLaws(userDataDir, { query, page })
      return {
        content: [{ type: 'text', text: JSON.stringify(r, null, 2) }],
      }
    }
    if (name === 'law_get_body') {
      const r = await lawApi.getLawBody(userDataDir, {
        mst: args?.mst ? String(args.mst) : undefined,
        lawId: args?.lawId ? String(args.lawId) : undefined,
        jo: args?.jo ? String(args.jo) : undefined,
      })
      const text =
        r.format === 'html'
          ? (r.html || '').slice(0, 120000)
          : JSON.stringify(r.data ?? r, null, 2).slice(0, 120000)
      return {
        content: [
          {
            type: 'text',
            text: r.ok ? text : JSON.stringify(r, null, 2),
          },
        ],
      }
    }
    if (name === 'law_recent_hr_changes') {
      const days = Number(args?.days) || 90
      const { HR_MAJOR_LAW_NAMES } = require('../../electron/hrLawConfig.cjs')
      const r = await lawApi.getRecentHrLawChanges(userDataDir, {
        days,
        filterNames: HR_MAJOR_LAW_NAMES,
      })
      return {
        content: [{ type: 'text', text: JSON.stringify(r, null, 2) }],
      }
    }
    throw new Error(`Unknown tool: ${name}`)
  } catch (err) {
    return {
      content: [
        {
          type: 'text',
          text: err instanceof Error ? err.message : String(err),
        },
      ],
      isError: true,
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
