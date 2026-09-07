---
name: step045
persistence: session
---

# Step 45 - E2E 테스트

<!-- MOAI-ENRICHED v1 -->
> **📐 Plan → Run → Sync** (MoAI-ADK 워크플로우)
> - **Plan**: 본 Step의 SPEC 자동 생성 `step_archive/specs/SPEC-045.md` 를 먼저 읽고 Acceptance 기준을 확정한다.
> - **Run**: 본문 지침대로 실행. 구현 산출물에는 `@MX:NOTE` 최소 1개 부착 (위험 시 `@MX:WARN` + `@MX:REASON`, 계약 시 `@MX:ANCHOR` + `@MX:REASON`, 미완료 시 `@MX:TODO`). MoAI mx-tag-protocol SoT 준수.
> - **Sync**: 결과 파일 `step_archive/step045_*.md` 저장 후 1줄 완료 보고 `Step 045/50 완료`.
>
> **모델 정책**: 조사·구현 서브에이전트 = **haiku** (CLAUDE.md 정책 준수). 평가 라운드만 sonnet.
>
> **위치**: E2E 검증 구간 (최종 게이트 step050)

## 사전 체크 (구 step084 프리플라이트 흡수)

E2E 시작 전 아래를 확인하고, 미비하면 사용자에게 묻지 않고 즉시 조치한다.

1. Playwright 브라우저: `npx.cmd playwright install --check chromium` — 실패 시 `npx.cmd playwright install chromium` (최대 3회)
2. `playwright.config.js` 존재 — 없으면 프로젝트 구조에 맞게 직접 생성한다
3. `dist/index.html` 존재 — 없으면 `npm.cmd run build`를 먼저 실행한다
4. 별도 테스트 파일 매핑 단계가 없으므로, E2E 테스트 스펙은 이 단계에서 직접 작성한다

## Step-Back

실행 전에 먼저 답하라:
- 이 테스트의 핵심 목적은? (한 문장)
- 테스트 실패 시 어느 Step으로 돌아가야 하는가?
- 반드시 확인해야 할 엣지 케이스 2가지는?

프로젝트 특성을 분석하여 테스트 범위와 검증 항목을 동적으로 결정한다.

Playwright를 사용하여 E2E 테스트를 수행한다.

단일 HTML 웹앱은 플러그인 `docs/ROUTING.md`의 모든 선언 경로를 검사한다. desktop과
mobile에서 각 URL 직접 접속·새로고침, 실제 링크 이동, 뒤로/앞으로 가기와 알 수 없는
주소 fallback을 검증하고 매번 주소와 보이는 화면 ID를 함께 단언한다. 화면만 바뀌거나
주소만 바뀌는 구현은 실패다. 여러 화면일 때 이동 검사를 생략하지 않는다. 한 화면은
이동만 해당 없음으로 기록하며 직접 접속·새로고침·fallback은 계속 검사한다.
기본 브라우저와 앱 시작 전에 Navigation API를 제거한 환경에서 동일한 전체 경로를
검사한다. 실제 지원 HTTP(S) 브라우저의 native Navigation API 분기와 강제 호환 분기
실행 증거가 모두 필요하며, API를 흉내 낸 객체만으로 native 통과를 주장하지 않는다.
capability와 선택 backend의 프로젝트별 관측을 기록한다. URL/화면 일치만으로 어떤 API를
사용했는지 증명했다고 쓰지 않는다. 두 환경에서 cold bootstrap·앱 hash 변경·unknown
fallback·수정키/다른 target/download/외부 링크/form/일반 문서 앵커 우회도 검사한다.
두 시나리오는 schema version 3 보고서의 기본 `viewports`와
`compatibility.navigation_api_unavailable.viewports`에 각각 desktop/mobile 전체 결과를
남긴다. 어느 한쪽도 생략하지 않으며 동일한 공통 검사 제한 시간 안에서 실행한다.
파일 직접 열기 지원은 hash manifest로 검증한다. history manifest는 HTTP(S)가 필요하며
실행 환경에 따라 mode를 암묵 변환해 테스트하지 않는다.
history 모드는 실제 배포 서버에서도 직접 접속·새로고침을 검증해야 하며, 로컬
검사기가 제공하는 fallback만으로 배포 설정까지 통과했다고 주장하지 않는다.
"웹 앱"이 아니면 프로젝트 유형에 적합한 E2E 테스트를 수행한다.

합리적인 선에서 최대한 많은 서브에이전트를 병렬로 사용한다 (동시 실행 최대 10개).

**E2E 테스트 단계에서 절대로 superpowers:brainstorming을 사용하지 않는다.**

**검증:**
- `npx playwright test` 실행 결과 전체 PASS로 직접 검증 (구 e2e-validator.ps1은 retired — 2026-06-10 M07 정정)

**검증 실패 시:**
- 실패한 테스트 케이스 분석
- 테스트 실패 원인 수정
- 검증 통과할 때까지 반복

서브에이전트는 항상 haiku를 사용한다.

## 결과 저장

결과를 step_archive/step045_e2e테스트결과.md에 저장한다.


## Self-Calibration

테스트 완료 후:
- 모든 테스트가 통과했는가? (Y/N)
- Step-Back에서 정의한 엣지 케이스가 모두 커버되었는가? (Y/N)
- N이면 재실행한다.

---

이 지침을 완료한 즉시 자동으로 step046.md를 읽고 수행한다. 사용자 확인을 기다리지 않는다.

