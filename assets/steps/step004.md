---
name: step004
persistence: session
---

# Step 4 - 접근성 검사(axe) 환경 확인

<!-- MOAI-ENRICHED v1 -->
> **🛠 TOOLING STEP** — 외부 도구 설치/검증. Plan-Run-Sync 분리 미적용.
> 모델 정책: **haiku** (조사·설치).
> SPEC 자동 생성: step_archive/specs/SPEC-004.md (Stop hook).

**확인 명령**: 검증 체크아웃 루트에서 `node -e "require.resolve('axe-core')"` (플러그인 루트 devDependency axe-core@4.13.0; Playwright 백엔드는 browser-verifier/의 @axe-core/playwright가 axe-core를 함께 제공 — docs/BROWSER-TOOLS.md)

## 검증

확인 명령 실행 후 다음을 확인:
- `step_archive/step004_axe_core_test.md` 파일 생성 확인
- 확인 명령 종료 코드 확인 (0: axe-core 해석 성공)

**검증 실패 시:**
1. 확인 명령 출력 분석
2. 에러 원인 파악 (검증 체크아웃에 axe-core 미설치, 선택 백엔드와의 주입 방식 불일치 등 — docs/BROWSER-TOOLS.md 절차표 'axe WCAG A/AA' 행)
3. 필요한 조치 수행 (패키지 설치 등)
4. 확인 명령 재실행
5. 검증 통과할 때까지 반복

서브에이전트는 항상 haiku를 사용한다.

## Self-Calibration

실행 완료 후 다음을 스스로 평가하라:

- 이 Step의 목표가 100% 달성되었는가? (Y/N)
- 불확실한 부분이 있는가? (있으면 구체적으로 명시)
- N 또는 불확실한 부분이 있으면 재실행한다. 3회 재시도 후에도 미달이면 오류 기록 후 다음 Step 진행.

---

이 지침을 완료한 즉시 자동으로 step005.md를 읽고 수행한다. 사용자 확인을 기다리지 않는다.

