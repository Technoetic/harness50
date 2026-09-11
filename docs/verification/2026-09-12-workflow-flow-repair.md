# 50단계 흐름 교정 검증 — 2026-09-12

- `task_id`: `workflow-flow-repair-20260912`
- 기준: 공개 v2.4.1, `b4b4b8f1e7982415c2ae30cee1194fff257c62fb`
- 작업 브랜치: `fix/workflow-flow-20260912`
- 작업 경로: `D:/harness50-worktrees/flow-repair-20260912`
- 범위: 사용자가 승인한 흐름 문제 8건의 로컬 수정·검증. 릴리스·원격 push·실제 설치는 수행하지 않았다.

## 반영 내용

| 문제 | 반영한 동작 |
|---|---|
| Codex 38·44·50 품질 판정 누락 | 새 완료 전에 현재 소스·설정·coverage의 측정 PASS를 직접 검사하고 보고서 hash를 영수증에 기록한다. |
| 후반 수정 뒤 이전 QA 재사용 | 마지막 build 뒤 E2E·스크린샷·키보드·마우스·디자인·콘솔 전체 행렬을 같은 HTML에서 재검증한다. 두 호스트의 최종 게이트가 여섯 필수 범주와 현재 HTML 결속을 확인한다. |
| 17→19 빈 GitHub 검색 응답 | HTTP 성공 뒤에도 관련 후보가 없으면 남은 사전 선정 검색을 수행한다. 세 검색의 성공·무후보가 검증되면 명시적 no-reference로 인계하며 가짜 clone을 만들지 않는다. |
| 24 자료 부족의 복구 경로 없음 | 현재 시도에서 부족 항목만 최대 네 번 보완하고 독립 재검증한다. 기존 증거·영수증은 보존하고 새 증거 경로·hash·통합 분석을 후속 기획과 구현에 전달한다. |
| Claude 최종 기획 검증 시점 | 29의 최종 보강 뒤 독립 검증과 hash를 기록하고 30에서 변경·누락을 거부한다. 위임 프롬프트도 최종 보완 자료를 받는다. |
| 도구 선택·필수 조건 충돌 | 테스트 러너를 결정한 뒤 준비한다. c8의 이유 있는 SKIP과 러너의 coverage 대안을 허용하되 실제 품질 게이트의 측정 coverage 기준은 유지한다. |
| Claude 실패 후 건너뛰기 | 해당 QA 단계의 실패·미실행을 INCOMPLETE로 통일하고 PowerShell/Bash 완료 writer가 현재 QA PASS를 확인한다. |
| history 모드의 배포 선행 요구 | 로컬 HTTP fallback 검사를 필수로 수행하고, 승인된 실제 배포 대상이 있을 때만 live 검증한다. 대기는 로컬 완료와 구분하고 사용자 요구인 배포 완료로 계산하지 않는다. |

Claude와 Codex의 실제 선행 산출물 이름을 따로 대조했다. 특히 Claude24는 실제 `step020_선정URL.md`, `awwwards-*.txt`, `screenshots/research/awwwards-*.png`와 23단계 인용에서 자체 입력 manifest를 만든다. Codex의 고정 primary 파일을 Claude에서 요구하지 않는다.

기존 완료 기록의 재시도는 새 완료와 구분한다. 공개 기준 커밋에서 직접 확인한 Step5의 `npx c8 --version` 증거와 새 시각 필드가 없는 이전 Step50 기록을 보존한다. 이 경로는 검사를 실행하거나 새 PASS를 추가하지 않으며, 원래 필수 항목과 영수증의 증거 일치를 유지한다.

## 검증 명령과 결과

환경: Windows, Node `v24.19.0`, PowerShell `5.1.26100.9444`, 설치된 Brave의 별도 테스트 브라우저 컨텍스트.

| 명령 | 결과 |
|---|---|
| `node codex/scripts/validate-steps.mjs` | 50단계 검증 통과 |
| `node --test codex/tests/*.test.mjs` | 1,196개 중 1,194 통과, 실패 0, Windows 심볼릭 링크 제약으로 2개 건너뜀 |
| `node --test codex/tests/steps-validator.test.mjs codex/tests/steps-parity.test.mjs` | 마지막 줄 정규화·hash 동기화 후 190 통과 |
| `HARNESS50_BROWSER_PATH=<Brave 경로> node --test tests/browser-output.test.mjs tests/navigation-api.test.mjs` | 45 통과, 실패 0 |
| `powershell.exe -NoProfile -ExecutionPolicy Bypass -File codex/tests/claude-regression-copy.ps1 -SourceRoot .` | 격리된 배포 파일 복사본 45 통과, 실패 0 |
| `H50_TEST_BASH=1 node --test codex/tests/claude-qa-completion.test.mjs codex/tests/claude-final-output.test.mjs` | Git Bash 경로 13 통과, 실패 0 |
| `git diff --check` | 통과 |

신규 회귀 검사는 수정 전 실패를 먼저 확인했다. 품질 보고서 누락·실패·stale, 최종 회귀 범주 누락, HTML·증거 변경, PowerShell/Bash의 잘못된 완료 선언, 실제 이전 계약의 영수증 재시도를 포함한다. 스케줄러의 50단계 완주 테스트도 새 품질 게이트를 통과하도록 실제 로컬 측정 runner와 명시적 합성 QA fixture를 사용한다.

`verification_commands_and_results`의 원문 로그는 로컬 `step_archive/flow-repair/`에 보존한다: `frozen-full-tests.log`, `final-contract-tests.log`, `browser-tests.log`, `claude-installed-copy.log`, `bash-completion-tests.log`. 이 로그 디렉터리는 저장소 정책대로 Git에서 제외한다.

## 독립 검증과 한계

- `verified_by`: `/root/review_completion_gates` — 품질·최종 회귀·Claude 최종 게이트 35개 독립 재실행, 실패 0.
- `verified_by`: `/root/review_research_planning` — 조사 분기 검사 6개와 양 호스트 생산·소비 경로 대조. 발견한 시각 capability·위임 입력·Claude24 파일명 문제를 수정 후 재확인했다.
- `verified_by`: `/root/review_final_branch`, 2026-09-12 08:22~08:27 KST — PowerShell·Bash·조사·완료 게이트 55개, 단계 구조 50개, 로컬 import 16파일 확인. 마지막 실제 기준 커밋의 legacy 재시도 3개와 원래 증거 deep equality도 독립 재검증했다. 남은 확인된 결함 없음.
- `artifact_paths`: 위 작업 경로의 `assets/steps/`, `codex/assets/steps/`, `codex/scripts/lib/acceptance.mjs`, `scripts/lib/final-regression.mjs`, QA·품질 CLI와 라이브러리, 두 완료 writer, 관련 테스트, 이 검증 기록과 spec/plan.
- `assumptions`: 로컬 증거는 서명된 증명이 아니다. 조사 관련성·이미지 해석은 실제 실행자의 검증 책임이며, 런타임은 제출된 범위·판정·파일 hash의 일관성을 확인한다. 기존 영수증 복구는 현재 제품을 다시 검증했다는 뜻이 아니다.
- `unresolved`: 실제 모델로 앱을 생성하는 50단계 완주, native Linux/macOS, 실제 배포 서버, 설치 캐시 적용은 이번 검증 범위에 포함하지 않았다. Git Bash 검사는 Windows에서 POSIX 분기를 시험한 것이다.
- `next_safe_action`: 검증된 로컬 브랜치를 검토한다. 공개 반영·릴리스·설치는 별도 후속 작업이다.
