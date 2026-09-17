import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";

// T-023: 로그인 페이지. next-auth의 signIn 콜백(lib/auth/options.ts)이 화이트리스트 밖 계정을
// 거부하면 이 페이지로 `?error=AccessDenied`와 함께 돌아온다.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const { from, error } = await searchParams;

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <p className="auth-eyebrow">CLAUDEBRIDGE</p>
        <h1>대시보드에 로그인</h1>
        <p className="auth-desc">
          Claude Code 세션이 질문이나 권한 승인으로 멈춰 있을 때, 등록된 구글 계정으로 로그인하면
          바로 확인하고 응답할 수 있습니다.
        </p>
        {error === "AccessDenied" && (
          <p className="auth-error">허용되지 않은 계정입니다. 화이트리스트에 등록된 계정으로 로그인해주세요.</p>
        )}
        <GoogleLoginButton callbackUrl={from} />
      </div>
    </main>
  );
}
