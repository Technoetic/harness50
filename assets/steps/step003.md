---
name: step003
persistence: session
---

# Step 3 - 브라우저 자동화 환경 확인

<!-- MOAI-ENRICHED v1 -->
> **🛠 TOOLING STEP** — 외부 도구 설치/검증. Plan-Run-Sync 분리 미적용.
> 모델 정책: **haiku** (조사·설치).
> SPEC 자동 생성: step_archive/specs/SPEC-003.md (Stop hook).

**확인 명령**: 플러그인 체크아웃에서 `node scripts/verify-output.mjs --probe` — 가용 백엔드(Aside CLI 또는 Playwright)를 JSON으로 보고한다 (docs/BROWSER-TOOLS.md)

## 검증

`--probe` 실행 후 다음을 확인:
- `step_archive/step003_playwright_test.md` 파일 생성 확인 (probe JSON의 backends.playwright / backends.aside / selected / tool_version 기록)
- `--probe` 종료 코드 확인 (0: selected 백엔드 있음, 1: 가용 백엔드 없음)

**검증 실패 시:**
1. `--probe` 출력 JSON 분석
2. 에러 원인 파악 (가용 백엔드 없음: Aside 앱 미실행·aside CLI 없음, 또는 browser-verifier/ 미설치 등 — docs/BROWSER-TOOLS.md)
3. 필요한 조치 수행 (백엔드 준비 등)
4. `--probe` 재실행
5. 검증 통과할 때까지 반복

서브에이전트는 항상 haiku를 사용한다.

## Self-Calibration

실행 완료 후 다음을 스스로 평가하라:

- 이 Step의 목표가 100% 달성되었는가? (Y/N)
- 불확실한 부분이 있는가? (있으면 구체적으로 명시)
- N 또는 불확실한 부분이 있으면 재실행한다. 3회 재시도 후에도 미달이면 오류 기록 후 다음 Step 진행.

---

이 지침을 완료한 즉시 자동으로 step004.md를 읽고 수행한다. 사용자 확인을 기다리지 않는다.

