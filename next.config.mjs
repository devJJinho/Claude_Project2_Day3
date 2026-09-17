/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 서비스 롤 키(SUPABASE_SERVICE_ROLE_KEY)는 lib/supabase/admin.ts에서만 읽고, 그 파일은
  // "server-only"를 import해 클라이언트 번들에 섞이면 빌드 타임에 에러가 나도록 막는다
  // (개발요청서.md I 항목 — 서비스 롤 키를 브라우저에 노출하지 않는다).
};

export default nextConfig;
