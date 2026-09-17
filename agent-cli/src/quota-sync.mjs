// quota-scraper.mjs가 읽어온 /status 값을 usage_quota에 upsert한다(daemon.mjs가 주기 호출).
import { getSupabaseClient } from "./supabase-client.mjs";
import { TABLES } from "./schema-contract.mjs";
import { scrapeStatusQuota } from "./quota-scraper.mjs";

/**
 * @param {string} projectId
 * @param {string} sessionName
 * @returns {Promise<{synced:boolean, reason?:string}>}
 */
export async function syncQuotaForProject(projectId, sessionName) {
  const result = await scrapeStatusQuota(sessionName);
  if (result.skipped) return { synced: false, reason: result.reason };

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLES.USAGE_QUOTA).upsert(
    {
      project_id: projectId,
      session_percent_used: result.sessionPercentUsed,
      session_resets_at: result.sessionResetsAt,
      week_percent_used: result.weekPercentUsed,
      week_resets_at: result.weekResetsAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id" }
  );
  if (error) throw new Error(`usage_quota upsert 실패: ${error.message}`);
  return { synced: true };
}
