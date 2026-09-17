# 진행 상황

_이 파일은 `backlog.json`으로부터 자동 생성됩니다. 직접 편집하지 마세요. (생성: 2026-09-17T09:18:22.128Z)_

프로젝트: **ClaudeBridge**

## 요약

전체 47개 작업 — 완료 46, 미결/보류 1

## 카테고리별 상세

### infra

| ID | 상태 | 제목 |
|---|---|---|
| T-001 | 완료 | Next.js 프로젝트 스캐폴드 생성 (App Router, TypeScript) |
| T-002 | 완료 | Vercel 프로젝트 생성 및 GitHub 연동 |
| T-003 | 완료 | Supabase 프로젝트 생성 및 연결 키 발급 |
| T-004 | 완료 | 환경변수 구조 설계 (서비스 롤 키는 서버 전용으로 분리) |
| T-039 | 완료 | 로컬 에이전트를 전역 설치 CLI 패키지로 구성 (bin 엔트리 + npm 전역 배포 구조) |

### backend

| ID | 상태 | 제목 |
|---|---|---|
| T-005 | 완료 | Supabase projects 테이블 스키마 작성 (project_id 기반 확장 고려) |
| T-006 | 완료 | Supabase blocked_events 테이블 스키마 작성 (질문/권한 대기 이벤트) |
| T-007 | 완료 | Supabase responses 테이블 스키마 작성 (사용자가 고른 응답 기록) |
| T-008 | 완료 | Supabase usage_logs 테이블 스키마 작성 (토큰 사용량) |
| T-009 | 완료 | 질문/응답/사용량 30일 후 자동 삭제 정책(TTL) 설정 |
| T-040 | 완료 | 프로젝트 등록 API 구현 (POST /api/projects, project_id 발급 — 콘솔 수동 작업 제거) |

### auth

| ID | 상태 | 제목 |
|---|---|---|
| T-010 | 완료 | 구글 OAuth 앱 등록 및 클라이언트 ID/시크릿 발급 |
| T-011 | 완료 | Next.js에 구글 로그인 연동 |
| T-012 | 완료 | 이메일 화이트리스트 검증 미들웨어 작성 (jhjeong710@gmail.com만 허용) |
| T-041 | 완료 | 개인 액세스 토큰 발급 및 claudebridge login 커맨드 구현 (머신당 1회 로그인) |

### agent

| ID | 상태 | 제목 |
|---|---|---|
| T-013 | 완료 | 로컬 에이전트 Node.js 프로젝트 스캐폴드 생성 |
| T-014 | 완료 | 로컬 에이전트 설정 파일 설계 (project_id/tmux 세션명/Supabase 키) |
| T-015 | 완료 | AskUserQuestion 발생 감지 훅 작성 |
| T-016 | 완료 | Permission 프롬프트 발생 감지 훅 작성 |
| T-017 | 완료 | 감지된 이벤트를 Supabase blocked_events에 기록하는 함수 작성 |
| T-018 | 완료 | Supabase responses 테이블 폴링 로직 작성 (수초~10초 간격) |
| T-019 | 완료 | tmux 세션 존재 확인 및 생성 로직 작성 |
| T-020 | 완료 | tmux send-keys로 AskUserQuestion 응답 주입하는 함수 작성 |
| T-021 | 완료 | tmux send-keys로 Permission 승인/거부 응답 주입하는 함수 작성 |
| T-042 | 완료 | claudebridge init 커맨드 구현 (등록 API 호출+settings.json 위임형 훅 삽입+tmux 세션 생성+Claude Code 실행 자동화) |
| T-043 | 완료 | settings.json 위임형 훅 템플릿 작성 (전역 CLI 호출 한 줄만 등록, 로직 파일 복사 없음) |
| T-047 | 완료 | 웹 접근 가능 상태 점검(2단계: tmux 세션·에이전트 연결·백엔드 통신 확인) 로직 작성 |
| T-046 | 완료 | 부팅 시퀀스에 안전 게이트 순서 강제 적용 (1단계 위험 명령어 차단 검증 통과 후에만 2단계 웹 접근 점검 진행, 매 재시작마다 재검증) |

### security

| ID | 상태 | 제목 |
|---|---|---|
| T-022 | 완료 | 선택지 텍스트→키 입력 매핑 규칙 정의 및 임의 텍스트 주입 차단 검증 |
| T-034 | 완료 | 서비스 롤 키 보관 점검 및 .gitignore 확인 |
| T-035 | 완료 | 화이트리스트 외 계정 접근 차단 테스트 |
| T-044 | 완료 | 위험 명령어 차단 훅 등록·동작 여부 검증 로직 작성 (.claude/settings.json PreToolUse Bash 훅 존재 확인) |
| T-045 | 완료 | 안전 게이트 1단계 실패 시 CLI 번들 표준 위험 명령어 차단 훅 자동 설치 후 재검증하는 로직 작성 |

### dashboard

| ID | 상태 | 제목 |
|---|---|---|
| T-023 | 완료 | 대시보드 로그인 페이지 UI |
| T-024 | 완료 | 백로그 상태 요약 뷰 (todo/doing/done 카운트) |
| T-025 | 완료 | 대기 중인 질문/권한 목록 뷰 |
| T-026 | 완료 | AskUserQuestion 응답 선택 UI (옵션 버튼 클릭 시 responses 기록) |
| T-027 | 완료 | Permission 승인/거부 버튼 UI |
| T-028 | 완료 | 토큰 사용량 표시 뷰 |

### usage

| ID | 상태 | 제목 |
|---|---|---|
| T-029 | 완료 | Claude Code 로컬 세션 로그 파일 위치/포맷 조사 |
| T-030 | 완료 | 로컬 세션 로그 파싱 함수 작성 |
| T-031 | 완료 | 파싱한 토큰 사용량을 Supabase usage_logs에 적재하는 로직 작성 |

### notify

| ID | 상태 | 제목 |
|---|---|---|
| T-032 | 완료 | 웹 푸시 구독 등록 (Service Worker + VAPID 키 설정) |
| T-033 | 완료 | 막힌 이벤트 발생 시 웹 푸시 발송 로직 작성 |

### qa

| ID | 상태 | 제목 |
|---|---|---|
| T-036 | 완료 | E2E 테스트: AskUserQuestion 1건 웹 응답→tmux 주입 성공 확인 |
| T-037 | 미결/보류 | E2E 테스트: Permission 승인 1건 웹 응답→tmux 주입 성공 확인 |

### docs

| ID | 상태 | 제목 |
|---|---|---|
| T-038 | 완료 | 다른 프로젝트 이식 가이드 문서 작성 (README) |
