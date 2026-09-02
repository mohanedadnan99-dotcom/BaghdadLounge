import { neon } from "@neondatabase/serverless";

const OPS_SPREADSHEET_ID = "1MDNnsv9akz2y9ADL0Dmi285hjjlG5mv9HSzqP3O8sHQ";
const OPS_SHEET_NAME = "سجل العمليات";

export function getOpsSheetSyncConfiguration() {
  const webhook = String(process.env.OPS_SHEETS_WEBHOOK_URL || "").trim();
  const token = String(process.env.OPS_SHEETS_WEBHOOK_TOKEN || "").trim();
  let validWebhook = false;

  try {
    validWebhook = new URL(webhook).protocol === "https:";
  } catch {
    validWebhook = false;
  }

  return {
    ready: validWebhook && Boolean(token),
    webhookConfigured: Boolean(webhook),
    tokenConfigured: Boolean(token),
    spreadsheetId: OPS_SPREADSHEET_ID,
    sheetName: OPS_SHEET_NAME,
    message: !validWebhook
      ? webhook
        ? "رابط Google Sheet غير صالح؛ يجب أن يبدأ بـ https://"
        : "ربط Google Sheet غير مهيأ في إعدادات النظام"
      : token
        ? "ربط Google Sheet مهيأ"
        : "رمز حماية Google Sheet غير مهيأ في إعدادات النظام",
  };
}

function connectionString() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}
function sql() { return neon(connectionString()); }

export async function ensureOpsSheetSyncColumns() {
  const db = sql();
  await db`ALTER TABLE ops_entries ADD COLUMN IF NOT EXISTS lounge_name TEXT NOT NULL DEFAULT ''`;
  await db`ALTER TABLE ops_entries ADD COLUMN IF NOT EXISTS sheet_sync_status TEXT NOT NULL DEFAULT 'pending'`;
  await db`ALTER TABLE ops_entries ADD COLUMN IF NOT EXISTS sheet_sync_attempts INT NOT NULL DEFAULT 0`;
  await db`ALTER TABLE ops_entries ADD COLUMN IF NOT EXISTS sheet_sync_error TEXT NOT NULL DEFAULT ''`;
  await db`ALTER TABLE ops_entries ADD COLUMN IF NOT EXISTS sheet_synced_at TIMESTAMPTZ`;
  await db`CREATE INDEX IF NOT EXISTS ops_entries_sheet_sync_idx ON ops_entries(sheet_sync_status,created_at)`;
}

export async function prepareOpsEntryForSheet(entryId: number) {
  await ensureOpsSheetSyncColumns();
  const db = sql();
  await db`
    UPDATE ops_entries e
    SET lounge_name = COALESCE(NULLIF(u.lounge_name,''),'لاونج بغداد')
    FROM ops_employees u
    WHERE e.id=${entryId} AND u.id=e.employee_id AND e.lounge_name=''
  `;
  const rows = await db`
    SELECT e.id::int,e.reference,e.passenger_name,e.airline,e.flight_number,e.origin,e.destination,e.seat,
      e.payment_type,e.billing_company,e.amount_iqd,e.entry_source,e.notes,e.boarding_raw,e.created_at,e.lounge_name,
      u.name employee_name,u.username,s.shift_name
    FROM ops_entries e
    JOIN ops_employees u ON u.id=e.employee_id
    JOIN ops_shifts s ON s.id=e.shift_id
    WHERE e.id=${entryId}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function syncOpsEntryToGoogleSheet(entryId: number) {
  const row: any = await prepareOpsEntryForSheet(entryId);
  if (!row) return { status: "missing" as const };

  const webhook = String(process.env.OPS_SHEETS_WEBHOOK_URL || "").trim();
  const token = String(process.env.OPS_SHEETS_WEBHOOK_TOKEN || "").trim();
  const configuration = getOpsSheetSyncConfiguration();
  const db = sql();
  if (!configuration.ready) {
    console.warn("ops sheet sync skipped", { entryId, reason: "sheet_sync_not_configured" });
    await db`UPDATE ops_entries SET sheet_sync_status='pending',sheet_sync_error=${configuration.message} WHERE id=${entryId}`;
    return { status: "pending" as const, message: configuration.message };
  }

  try {
    const created = new Date(String(row.created_at));
    const payload = {
      spreadsheetId: OPS_SPREADSHEET_ID,
      sheetName: OPS_SHEET_NAME,
      token,
      row: [
        String(row.reference || ""),
        created.toLocaleDateString("en-CA", { timeZone: "Asia/Baghdad" }),
        created.toLocaleTimeString("ar-IQ", { timeZone: "Asia/Baghdad", hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        String(row.lounge_name || ""),
        String(row.shift_name || ""),
        String(row.employee_name || ""),
        String(row.username || ""),
        String(row.passenger_name || ""),
        String(row.airline || ""),
        String(row.flight_number || ""),
        String(row.origin || ""),
        String(row.destination || ""),
        String(row.seat || ""),
        String(row.payment_type || ""),
        String(row.billing_company || ""),
        Number(row.amount_iqd || 0),
        String(row.entry_source || ""),
        String(row.notes || ""),
        String(row.boarding_raw || ""),
        created.toISOString(),
      ],
    };
    const res = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": String(row.reference || entryId),
        ...(token ? { "X-Ops-Sync-Token": token } : {}),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Google Sheet sync HTTP ${res.status}`);
    const responseBody = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null;
    if (responseBody?.ok === false) throw new Error(responseBody.error || "Google Sheet رفض المزامنة");
    await db`UPDATE ops_entries SET sheet_sync_status='synced',sheet_sync_attempts=sheet_sync_attempts+1,sheet_sync_error='',sheet_synced_at=NOW() WHERE id=${entryId}`;
    console.info("ops sheet sync completed", { entryId });
    return { status: "synced" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر مزامنة Google Sheet";
    console.error("ops sheet sync failed", { entryId, message });
    await db`UPDATE ops_entries SET sheet_sync_status='failed',sheet_sync_attempts=sheet_sync_attempts+1,sheet_sync_error=${message} WHERE id=${entryId}`;
    return { status: "failed" as const, message };
  }
}
