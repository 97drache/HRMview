# korea-law MCP (Cursor)

국가법령정보 OPEN API를 Cursor 에이전트 도구로 노출합니다.

## 설치

```bash
cd mcp-servers/korea-law
npm install
```

## OC (인증값)

**실제 OC는 HRM 프로젝트 루트 `.env`의 `LAW_GO_KR_OC`에만 넣습니다.** (`.gitignore` 대상)

MCP 서버는 기동 시 위 `.env`를 읽습니다. `mcp.json`에 OC를 적지 마세요.

## Cursor 설정 예시

```json
{
  "mcpServers": {
    "korea-law": {
      "command": "node",
      "args": ["C:/Users/user/Desktop/HRM/mcp-servers/korea-law/index.cjs"]
    }
  }
}
```

## 도구

| 도구 | 설명 |
|------|------|
| `law_search` | 법령명 검색 |
| `law_get_body` | 본문 HTML (MST/lawId, 선택 jo) |
| `law_recent_hr_changes` | 최근 인사·근로 조문 개정 |

HRM 앱 **7. 인사법령** 메뉴는 Electron `lawOpenApi.cjs`를 직접 사용합니다.
