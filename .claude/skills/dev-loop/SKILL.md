---
name: dev-loop
description: 작업 단위 하나를 todo → analyze → plan(승인 게이트) → 구현 → verify → finalize 순서로 처리하는 범용 개발 workflow 루프. 리팩토링뿐 아니라 기능 개발/버그 수정/부하 테스트 등 모든 작업 종류에 동일하게 적용한다.
---

# dev-loop

`todo`/`analyze`/`plan`/`verify`/`finalize` Skill을 하나의 작업 단위에 대해 순서대로 엮어서 처리하는 상위 루프다. `refactor-todo`가 `anything/refactor_plan.md`의 리팩토링 TODO 전용으로 이 패턴을 고정해 둔 것과 달리, 이 Skill은 작업 종류(기능 개발, 버그 수정, 리팩토링, 부하 테스트 등)와 TODO 소스 문서에 무관하게 동일한 패턴을 반복 적용한다.

`$ARGUMENTS`로 처리할 TODO 항목이나 TODO 소스 문서를 지정할 수 있고, 없으면 `todo` Skill이 기본값(`anything/refactor_plan.md`)에서 다음 항목을 찾는다.

## 핵심 원칙 (모든 단계에 우선한다)

- **AI가 임의로 설계 판단을 내리지 않는다.** 선택지가 있는 지점은 반드시 사용자에게 묻는다 (`plan` 단계 책임).
- **분석과 구현을 분리한다.** 분석(`analyze`) 단계에서는 코드를 수정하지 않는다.
- **Plan 승인 없이 Execute로 넘어가지 않는다.** Analyze → Plan → 사용자 승인 → Execute 경계는 반드시 유지한다.
- **AI_VERIFIED ≠ USER_VERIFIED.** 테스트/빌드/코드리뷰 통과와 "작업이 끝났다"는 것은 다르다. 최종 판단(커밋)은 사용자가 한다.
- 커밋(`git commit`)은 `.claude/settings.local.json`의 `permissions.ask` 규칙이, 워크로그 누락은 동일 파일의 Hook이 각각 실제 게이트로 막는다 — 이 루프는 그 게이트 앞에서 충분히 요약 보고하고 제때 워크로그를 작성하는 역할만 한다. 게이트를 텍스트로 흉내 내고 넘어가지 않는다.

## 단계

1. **`todo`** — 처리할 작업 단위를 정의(작성 모드)하거나 확인(선택 모드)한다.
2. **`analyze`** — 관련 코드/구조/영향 범위를 조사해 고정 포맷으로 보고한다. 수정 금지.
3. **`plan`** — 구현 방법을 제안하고, 설계 갈림길이 있으면 `AskUserQuestion`으로 확인받는다. 승인 전까지 다음 단계로 넘어가지 않는다.
4. **구현 (Execute)** — 승인된 범위로만 실제 작업(Feature 구현/Refactoring/Bug Fix/Load Test 등)을 수행한다. 별도 Skill 없이 바로 진행하되, 승인되지 않은 범위까지 임의로 확장하지 않는다. 구현 중 확인 삼아 테스트를 돌려보는 것(예: 방금 작성한 테스트가 버그를 재현/수정하는지 확인)은 정상적인 구현 작업의 일부이며 허용된다 — 다만 이것이 5번 `verify`를 대체하지 않는다.
5. **`verify`** — 구현이 끝나면 **바로, 별도 확인 없이 `Skill(verify)`를 명시적으로 호출**한다. 구현 중 확인차 테스트를 돌렸다는 이유로 verify Skill 호출 자체를 생략하지는 않는다 — 다만 구현 중 이미 최신 diff 기준으로 돌려서 통과를 확인한 항목(예: 방금 `npm test`/`npm run build`/`npm run test:e2e`를 전부 돌렸고 그 이후 코드 변경이 없음)은 verify에서 동일 명령을 맹목적으로 재실행하지 않고 그 결과를 그대로 인정한다. 아직 안 돈 항목(특히 diff-stat, code-review)만 마저 채운다.
6. **`finalize`** — 요약 보고 → 코드 커밋 → 워크로그 작성 → 워크로그 커밋.

## TODO 처리 단위

같은 세션에서 여러 TODO를 이어서 처리하더라도, 항목마다 1~6단계를 독립적으로 처음부터 다시 실행한다. 서로 다른 TODO의 변경사항을 하나의 diff/커밋으로 합치지 않는다 — 항목별로 코드 커밋 1개 + 워크로그 커밋 1개가 원칙이다.

## 참고

리팩토링 전용 고정 절차가 필요하면 `refactor-todo` Skill을 그대로 사용해도 된다 — 이 Skill과 별개로 유지된다.
