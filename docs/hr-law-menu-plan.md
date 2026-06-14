# 7. 인사법령 — 구축 가이드 (국가법령정보 API + MCP)

인사·근로 관련 법령 **검색**, **주요 법령 조문 보기**, **최근 개정 알림**을 HRM 데스크톱과(선택) Cursor MCP로 제공하기 위한 준비 사항입니다.

---

## 1. 먼저 준비할 것 (법제처 OPEN API)

### 1.1 가입·승인

| 항목 | 내용 |
|------|------|
| 사이트 | [국가법령정보 공동활용](https://open.law.go.kr/) |
| 절차 | 회원가입 → **OPEN API 신청** → 담당자 승인 (보통 1~2영업일) |
| 인증값 | 승인 후 발급되는 **`OC`(API 인증값)** — 모든 요청에 필수 |
| 문의 | 기술 02-2109-6446 / 이용·승인 044-200-6797 |

### 1.2 신청 시 기입 예시 (GIST 인사팀)

- **활용 목적**: 교내 인사·근로 법령 조회, 개정 알림, 증빙·업무 참고용 내부 도구
- **적용 분야**: 인사관리 데스크톱(HRM), (선택) Cursor AI 보조
- **접근 분야**: 인터넷 (Electron 데스크톱)
- **공동활용 법령종류**: 최소 **「법령」** 체크 (행정규칙·판례는 2단계에서 추가 가능)

### 1.3 환경 변수 (HRM)

프로젝트 `.env` (Git 제외):

```env
# 국가법령정보 OPEN API (open.law.go.kr 신청 OC 값)
LAW_GO_KR_OC=발급받은_OC_값
# 응답 형식: JSON 권장
LAW_GO_KR_TYPE=JSON
```

> **공공데이터포털** (`apis.data.go.kr/1170000/law`) 경로는 **별도 serviceKey**입니다.  
> 법제처 **open.law.go.kr** 와 **data.go.kr** 중 **한 체계만** 쓰는 것을 권장합니다.  
> HRM 설계는 **open.law.go.kr + OC** 기준입니다.

### 1.4 이용 시 의무

- 데이터 **무료**, 출처 표기 필요 (예: `출처: 국가법령정보센터`)
- 상업적 이용 가능하나, 신청 시 기재 목적·트래픽 정책 준수
- API URL·스펙 변경 가능 → [활용가이드](https://open.law.go.kr/LSO/information/guide.do) 수시 확인

---

## 2. 기능별 필요 API (법령 DB)

공동활용 **「법령」** OPEN API 기준 매핑입니다. (정확한 URL·파라미터는 승인 후 개발자 LAB / 활용가이드 PDF 확인)

| HRM 화면 | 목적 | API 유형 (가이드 명칭) |
|----------|------|------------------------|
| **법령 검색** | 근로·인사 키워드로 법령 목록 | 현행법령 목록·검색 (`lawSearch`, `target=law`, `query=`) |
| **주요 법률 · 조문** | 본문·장·절·조 트리 | 현행법령 본문 (`lawService`, 법령일련번호·시행일자) |
| **최근 변경 알림** | 개정·시행일·조문 변경 | 법령 변경이력 목록, **일자별 조문 변경이력**, 조문별 변경 이력 |

### 2.1 주요 법령 후보 (인사·근로)

앱에 **바로가기**로 넣을 법령 예시 (법령ID·MST는 API 검색으로 확정):

| 구분 | 법령명 |
|------|--------|
| 근로 | 근로기준법, 근로기준법 시행령, 근로기준법 시행규칙 |
| 고용·차별 | 남녀고용평등과 모성보호의 시행에 관한 법률, 고용정책 기본법 |
| 휴가·근로시간 | 근로자의 날 제정에 관한 법률 (해당 시) |
| 공무·특수 | 국가공무원법 (교원·공무원 해당 시), 교원의 노동조합 설립 및 운영 등에 관한 법률 |
| 산재·퇴직 | 산업재해보상보험법, 근로자퇴직급여 보장법 |
| 개인정보 | 개인정보 보호법 (인사정보 처리) |

「맞춤형 법령」API는 관심 법령만 구독할 때 유용합니다(별도 신청).

### 2.2 「최근 변경」 로직 제안

1. 관심 법령 MST 목록 유지 (설정 파일 또는 `.env`)
2. **일 1회** (또는 앱 실행 시) `일자별 조문 변경이력` / `법령 변경이력` 조회
3. 마지막 확인일 이후 변경만 로컬 캐시(`userData/law-changes.json`)에 저장
4. 7-1 화면에 「○월 ○일 시행 · 근로기준법 제○조 개정」 형태로 표시

---

## 3. MCP 서버 — 무엇이 필요한지

### 3.1 MCP의 역할

| 구분 | 설명 |
|------|------|
| **Cursor MCP** | 채팅/에이전트가 「근로기준법 제23조 알려줘」처럼 **도구 호출**로 법령 조회 |
| **HRM 7. 인사법령 메뉴** | 일반 사용자 UI — **Electron main**에서 동일 API 직접 호출 권장 |

MCP만으로는 HRM 화면이 자동으로 채워지지 않습니다. **API 클라이언트는 공유**하고, **UI는 HRM**, **AI 도구는 MCP**로 나누는 구성이 적합합니다.

### 3.2 MCP 서버에 넣을 도구 (예시)

| 도구명 | 입력 | 출력 |
|--------|------|------|
| `law_search` | `query`, `page` | 법령 목록 (이름, MST, 시행일) |
| `law_get_body` | `lawId`, `efYd`(시행일) | 본문 HTML/텍스트 또는 조문 트리 |
| `law_recent_changes` | `days`, `lawIds?` | 기간 내 조문·법령 변경 요약 |

### 3.3 MCP 구현 시 필요 패키지·설정

```text
mcp-servers/korea-law/          # 신규 폴더 제안
  package.json                  # @modelcontextprotocol/sdk
  index.ts                      # StdioServerTransport
  lawClient.ts                  # OC + fetch law.go.kr DRF
```

**Cursor** `~/.cursor/mcp.json` 또는 프로젝트 MCP 설정 예:

```json
{
  "mcpServers": {
    "korea-law": {
      "command": "node",
      "args": ["C:/Users/user/Desktop/HRM/mcp-servers/korea-law/dist/index.js"],
      "env": {
        "LAW_GO_KR_OC": "여기_OC_값"
      }
    }
  }
}
```

### 3.4 MCP vs HRM 중복 방지

- `electron/lawOpenApi.cjs` — IPC용 단일 클라이언트
- `mcp-servers/korea-law/lawClient.ts` — 동일 URL 빌더를 **복사·공유**하거나 작은 `packages/law-go-kr-client`로 분리

---

## 4. HRM 앱 구현 구조 (제안)

### 4.1 메뉴

| 코드 | 화면 |
|------|------|
| 7-1 | 최근 근로·인사 법령 변경 |
| 7-2 | 법령 검색 |
| 7-3 | 주요 법령 (조문별) |

### 4.2 기술 스택

```
Renderer (React)
  → desktopBridge.lawSearch / lawGetArticle / lawGetChanges
  → Electron main (lawOpenApi.cjs)
  → https://www.law.go.kr/DRF/...?OC=...
```

- API 키는 **main 프로세스만** (Gemini와 동일 패턴)
- 응답 XML/JSON 파싱 후 React 표시
- 본문 HTML은 `sandbox` iframe 또는 텍스트·트리 UI

### 4.3 오프라인·속도

- 주요 법령 본문: 주 1회 또는 수동 「새로고침」 캐시
- 변경 알림: `userData` JSON + 마지막 조회 시각

---

## 5. 구현 단계 (권장 순서)

| 단계 | 작업 | 선행 조건 |
|------|------|-----------|
| 0 | OPEN API 신청·`OC` 발급 | 승인 완료 |
| 1 | `lawOpenApi.cjs` + `.env` + IPC 1개 (`law_search` 테스트) | OC |
| 2 | 7-3 주요 법령 3~5개 고정 MST + 조문 트리 | 본문 API 확인 |
| 3 | 7-2 검색 UI | 목록 API |
| 4 | 7-1 변경 알림 + 로컬 캐시 | 이력 API |
| 5 | MCP 서버 3 tools + Cursor 등록 | 1과 동일 OC |
| 6 | (선택) 모바일·알림 토스트 | — |

---

## 6. IT·인사팀 체크리스트

- [ ] open.law.go.kr 회원·OPEN API 신청·승인
- [ ] `OC` 값을 `.env`에 저장 (Git 미포함)
- [ ] 활용사례 등록(공동활용 약관)
- [ ] 관심 법령 목록 확정 (위 표 기준 검토)
- [ ] 출처 표기 문구 UI 반영
- [ ] (MCP 사용 시) Cursor MCP 설정·OC env

---

## 7. 참고 링크

- [OPEN API 안내](https://open.law.go.kr/information/service.do)
- [이용안내·승인 절차](https://open.law.go.kr/LSO/information/guide.do)
- [OPEN API 신청](https://open.law.go.kr/LSO/usrJoin.do)
- [공공데이터포털 — 법령정보공유](https://www.data.go.kr/data/15000115/openapi.do) (별도 키 체계)

OC 발급 후 `.env`에 `LAW_GO_KR_OC=...` 저장 → HRM 재실행.

## 8. 구현 상태 (HRM)

- [x] `electron/lawOpenApi.cjs` — 검색·본문·조문개정이력·주요법령 MST 캐시
- [x] 메뉴 7-1 / 7-2 / 7-3 UI (`HrLawPanel.tsx`)
- [x] IPC · `desktopBridge` · `.env.example`
- [x] MCP `mcp-servers/korea-law` — `docs/mcp-korea-law.md` 참고
