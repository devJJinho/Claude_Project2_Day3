# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 현황

애플리케이션 본체(ClaudeBridge — Claude Code 원격 제어 대시보드 자체)는 아직 구현 전이다. 지금 저장소에 있는 코드는 backlog 관리용 도구(CLI, hooks, 대시보드)뿐이다 — Day_4_Project에서 만든 것을 그대로 재사용했다.

- **기술 스택**: Next.js(TypeScript, App Router) + Vercel 배포 + Supabase(Postgres, Auth 겸용 가능) + 로컬 상주 에이전트(Node.js) + tmux. 개발요청서.md H에서 확정. 실제 소스 코드가 생기면 `.claude/tools/quality-config.mjs`의 `SOURCE_DIRS`에 해당 디렉터리(예: `app/`, `agent/`)를 추가할 것(아직 코드가 없어 비어 있음).
- 코드 품질 명령: `npm run verify` (길이/lint/build — 세부 규칙은 `.claude/rules/code-structure.md`).
- backlog 조회/변경: `node .claude/tools/backlog-cli.mjs help` — 세부 사용법은 `.claude/skills/backlog/SKILL.md`, 변경 주체·상태 규칙은 `.claude/rules/`.
- 대시보드(백로그 뷰어, 이 프로젝트 자체가 만들려는 "웹 대시보드"와는 다른, 개발용 읽기 전용 도구): 필요 시 Day_4_Project의 `dashboard/`를 참고해 이식.

작업을 시작하기 전 반드시 `개발요청서.md` 전체를 읽을 것. 이 문서는 사용자와의 대화를 통해 확정된 개발요청서이며, "확인된 사실"과 "결정 완료(A~L)" 섹션이 최종 요구사항이다.

## 작업 실행 순서

이 순서를 따른다 (세부 규칙은 각 항목이 가리키는 파일 참고):

1. **기준 확인**: `개발요청서.md` 읽기 + `node .claude/tools/backlog-cli.mjs list/show/ready`로 현재 backlog 조회 + `.claude/rules/*.md`로 현재 적용 규칙 확인. backlog.json을 Read/Grep/Bash로 직접 열지 않는다(`.claude/rules/backlog-ownership.md`).
2. **작업 선택**: `ready` 명령으로 deps가 모두 끝난 후보만 본다. 개발요청서.md J항목의 구현 순서(1.상태기록→2.로그인→3.질문 응답 end-to-end→4.권한 승인→5.푸시→6.토큰 사용량)를 우선순위로 삼는다 — 일정이 촉박하므로(마감: 2026-09-18) 1~3번(핵심 가치 증명)을 먼저 끝까지 동작시킨다.
3. **착수 기록**: 실제로 시작했을 때 `set-status <id> doing`.
4. **구현**: `.claude/rules/code-structure.md`의 책임 분리·길이 기준을 지키며 작성하고 `npm run verify`로 hooks가 검사하는 항목(길이/lint/build)을 통과시킨다.
5. **버전 고정 후 병렬 검토**: `list --json`의 `sourceHash`로 입력 버전을 고정하고, 같은 스냅샷을 `critical-reviewer`와 `backlog-explainer`(둘 다 `.claude/agents/`)에게 전달해 병렬 실행한다.
6. **반영**: 두 결과를 합쳐, 근거(추측 아닌 확인된 사실)가 있는 지적만 CLI로 반영하고 `npm run verify`를 재실행한다.
7. **완료 기록**: done_when·검사 결과·검토 반영이 모두 확인됐을 때만 `set-status <id> done --evidence "..."`.
8. **문서·대시보드 확인**: backlog.json이 바뀌면 관련 문서/PROGRESS.md가 최신 스냅샷을 반영하는지 확인한다(`.claude/rules/doc-sync.md`).
9. **항상 이어서 시작할 수 있게 기록**: 상태가 바뀔 때마다 그 즉시 `set-status`/`set-deps`로 backlog.json에 반영한다.

사람의 결정이 필요한 지점을 만나면 임의로 정하지 말고 `set-status <id> needs_info --note "<질문>"`으로 남긴다. 특히 T-029(로컬 세션 로그 위치/포맷)와 T-014에서 이어지는 tmux 세션 기동 방식(런처 vs 자동 감지)은 개발요청서.md 4장 "미결 질문"에 명시된 대로 구현 착수 시 조사·확정이 필요하다.

## 프로젝트 개요

**ClaudeBridge** — 로컬 PC의 Claude Code 세션을 웹 대시보드로 원격 제어하는 도구. Claude Code가 AskUserQuestion이나 Permission 프롬프트로 멈추면, 로컬 hooks가 이를 감지해 Supabase에 기록하고 웹 푸시로 알린다. 사용자가 어디서든 웹 대시보드(구글 로그인 + 화이트리스트)에 접속해 선택지/승인 버튼을 클릭하면, 로컬 에이전트가 이를 폴링으로 감지해 tmux 세션에 키 입력으로 주입해 Claude Code가 이어서 진행한다.

- 핵심 시나리오: Claude Code 멈춤(질문/권한) → hooks 감지 → Supabase 기록 + 푸시 알림 → 웹에서 응답 선택 → 로컬 에이전트 폴링 감지 → tmux send-keys 주입 → 세션 재개
- 사용자: 본인(jhjeong710@gmail.com) 1인 전용
- 비목표: 웹에서 자유 텍스트로 임의 명령 주입, 다중 사용자 협업, 1차 범위의 다중 프로젝트 동시 관리 UI(단, DB 스키마는 project_id로 확장 가능하게 설계)

전체 요구사항은 `개발요청서.md`(A~L 섹션)를 단일 진실 공급원으로 삼는다 — 아래는 코드 작성 시 바로 참고할 핵심 제약만 요약한 것이며, 상세·근거는 항상 원문을 확인할 것.

## 핵심 요구사항 요약 (설계 시 반드시 지킬 제약 — 상세는 개발요청서.md)

1. **연동 아키텍처(A)**: 로컬 에이전트가 Supabase를 폴링(수초~10초). Claude Code는 tmux 안에서 실행, 응답은 tmux send-keys로 주입. 로컬 PC는 인바운드 포트를 열지 않는다(webhook 수신 방식 채택 안 함).
2. **처리 범위(B)**: AskUserQuestion + Permission 프롬프트만 대상. 자유 텍스트 응답은 웹에서 받지 않는다(사전 정의된 옵션/버튼만).
3. **인증(C)**: 구글 소셜 로그인 + 이메일 화이트리스트(jhjeong710@gmail.com). 단일 사용자, 권한 등급 없음.
4. **데이터(D)**: Supabase(Postgres). 질문·답변·토큰 사용량 기록은 30일 후 자동 삭제.
5. **토큰 사용량(E)**: Claude Code 로컬 세션 로그를 파싱해 집계(정확한 위치/포맷은 T-029에서 조사 확정).
6. **알림(F)**: 웹 푸시만. 이메일/메신저 연동 없음.
7. **관리 범위(G)**: 1차는 이 프로젝트 1개만 검증하되, DB 스키마에 처음부터 project_id를 포함해 이후 다른 프로젝트 추가 시 스키마 변경 없이 확장 가능해야 한다.
8. **플랫폼(H)**: Next.js + Vercel + Supabase + Node.js 로컬 에이전트. 무료/최소 비용 인프라.
9. **보안(I)**: **안전 게이트가 최우선 — 1단계(위험 명령어 차단 훅 등록·동작 검증)를 통과해야만 2단계(웹 접근 가능 상태 점검)로 진행**하며, `claudebridge init` 때뿐 아니라 에이전트 재시작마다 매번 재검증한다(T-044~T-047). 특히 Permission 승인 원격 주입(T-021)은 이 게이트가 살아있을 때만 동작해야 한다. 그 외: 인바운드 포트 미개방, 화이트리스트화된 선택지/버튼 응답만 허용(임의 명령 주입 불가), 서비스 롤 키는 서버/로컬 전용 보관.
10. **일정(J)**: 마감 2026-09-18. 얇은 수직 슬라이스(상태기록→로그인→질문 응답 end-to-end) 우선, 이후 권한 승인/푸시/토큰 사용량 확장.
11. **UX(K)**: 한국어만. 디자인 레퍼런스 없음 — 개발자 재량.

## 다른 프로젝트로 이식하는 방법 (plug-and-play — 핵심 설계 제약)

개발요청서.md 3장 참고. **파일 복사, 클라우드 콘솔 수동 조작, 프로젝트별 의존성 설치는 전부 금지**한다. 목표 흐름은:

- 머신당 1회: `npm i -g claudebridge` (전역 CLI, 프로젝트별 node_modules 없음) + `claudebridge login`
- 프로젝트마다 1회: `claudebridge init` — 등록 API 호출(기존 Supabase/Vercel 재사용, 새 리소스 생성 안 함) + `.claude/settings.json`에 위임형 훅(전역 CLI 호출 한 줄) 자동 삽입 + tmux 세션 생성까지 자동

T-039~T-043(전역 CLI 패키지화, 등록 API, login/init 커맨드, 위임형 훅 템플릿)이 이 요구사항을 구현하는 작업이다. 구현 중 project_id 기반 스키마를 절대 임의로 단일 프로젝트 전제로 하드코딩하지 않는다.

## UI/UX 디자인 참고

개발요청서.md K 항목 참고. 사용자가 제시한 SaaS 대시보드 스타일(좌측 사이드바 내비, 색상별 통계 카드 4개, 도넛/링 차트로 상태 분포, "대기 중" 항목을 색상 바+시간으로 구분한 타임라인 패널, 부드러운 그라디언트 배경 + 화이트 라운드 카드 + 퍼플 강조색)을 레이아웃·톤 참고용으로 따른다. 원본 이미지의 문구·일러스트·브랜드 자산을 그대로 복제하지 않는다.

## 개발자 재량 / 임의로 정하지 말아야 할 것

- 기술 스택 자체는 재량이지만, 선택한 뒤에는 `.claude/tools/quality-config.mjs`의 `SOURCE_DIRS`에 실제 소스 디렉터리를, `.claude/tools/backlog-schema.mjs`의 `KNOWN_CATEGORIES`에 실제 기능 카테고리를 반영해 최신 상태로 유지할 것.
- 개발요청서.md에 없는 세부사항(정확한 UI 문구, tmux 키 입력 매핑 규칙의 예외 처리 등)은 지어내지 말고 `needs_info`로 남기거나 사용자에게 확인한다.
- 임의 텍스트를 tmux에 주입하는 경로를 추가하지 않는다 — I 항목(보안)에서 명시적으로 금지한 사항이다.
- 안전 게이트(1단계 위험 명령어 차단 검증)를 우회하거나 "일단 통과시키고 나중에 고치는" 임시 코드로 대체하지 않는다 — 이 게이트가 없으면 웹에서의 Permission 원격 승인 자체가 성립하지 않는 핵심 전제다.

## 일하는 방식 세부 규칙

`.claude/rules/`에 아래 파일들이 있고, Claude Code가 세션 시작 시 이 CLAUDE.md와 같은 우선순위로 자동 로드한다:

- `parallel-execution.md` — 리뷰 병렬 실행 방식
- `backlog-ownership.md` — backlog.json 직접 접근 금지, CLI 사용 원칙
- `status-transition.md` — 상태 전이 규칙(doing/done 진입 시 deps 검증 등)
- `commit-cadence.md` — 커밋 시점 규칙
- `code-structure.md` — 코드 길이/책임 분리 기준
- `doc-sync.md` — 문서·backlog 동기화 규칙
