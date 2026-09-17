import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isWhitelistedEmail } from "@/lib/auth/whitelist";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  redirect(isWhitelistedEmail(session?.user?.email) ? "/dashboard" : "/login");
}
