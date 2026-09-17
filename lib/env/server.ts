import "server-only";

// 서버 전용 환경변수 접근점 (T-004).
//
// "server-only" 패키지를 import하면 이 파일이 실수로 클라이언트 컴포넌트 번들에 섞여 들어갈 때
// 빌드 타임에 에러가 난다 — 서비스 롤 키 등 비밀값이 브라우저로 유출되는 경로를 원천 차단한다
// (개발요청서.md I 항목).
//
// 값은 getter로 감싸 "실제로 접근하는 시점"에만 검증한다 — 모듈을 import/타입체크만 하는
// 상황(tsc --noEmit, 이 프로젝트의 npm run verify)에서는 절대 던지지 않는다. T-002/T-003/T-010
// (Vercel/Supabase/Google 계정)이 아직 없어도 컴파일이 통과해야 한다는 요구사항과 맞물린다.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `환경변수 ${name}가 설정되지 않았습니다. .env.example을 참고해 .env.local(또는 Vercel 프로젝트 설정)에 채워주세요.`
    );
  }
  return value;
}

export const serverEnv = {
  get supabaseUrl(): string {
    return required("SUPABASE_URL");
  },
  get supabaseServiceRoleKey(): string {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get googleClientId(): string {
    return required("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret(): string {
    return required("GOOGLE_CLIENT_SECRET");
  },
  get nextAuthSecret(): string {
    return required("NEXTAUTH_SECRET");
  },
  get registrationToken(): string {
    return required("CLAUDEBRIDGE_REGISTRATION_TOKEN");
  },
};
