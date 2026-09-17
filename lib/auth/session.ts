import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isWhitelistedEmail } from "@/lib/auth/whitelist";

/** 화이트리스트를 통과한 로그인 사용자의 이메일. 세션이 없거나 화이트리스트 밖이면 null. */
export async function requireWhitelistedSessionEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? null;
  return isWhitelistedEmail(email) ? email : null;
}
