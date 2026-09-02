import { neon } from "@neondatabase/serverless";
import { ensureOpsTables } from "@/lib/lounge-ops-db";
import { listOpsAirlineProfiles } from "@/lib/ops-airlines";

function connectionString() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}

function sql() {
  return neon(connectionString());
}

export async function ownerDashboardInsights() {
  await ensureOpsTables();
  const db = sql();

  const [summaryRows, loungeRows, airlineRows, paymentRows, hourlyRows, offlineRows, lastRows, profiles] = await Promise.all([
    db`SELECT
      COUNT(*) FILTER(WHERE created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Baghdad') AT TIME ZONE 'Asia/Baghdad'))::int passengers_today,
      COALESCE(SUM(amount_iqd) FILTER(WHERE created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Baghdad') AT TIME ZONE 'Asia/Baghdad')),0)::bigint revenue_today,
      COUNT(*) FILTER(WHERE created_at >= ((date_trunc('day', now() AT TIME ZONE 'Asia/Baghdad') - INTERVAL '1 day') AT TIME ZONE 'Asia/Baghdad') AND created_at < (date_trunc('day', now() AT TIME ZONE 'Asia/Baghdad') AT TIME ZONE 'Asia/Baghdad'))::int passengers_yesterday,
      COALESCE(SUM(amount_iqd) FILTER(WHERE created_at >= ((date_trunc('day', now() AT TIME ZONE 'Asia/Baghdad') - INTERVAL '1 day') AT TIME ZONE 'Asia/Baghdad') AND created_at < (date_trunc('day', now() AT TIME ZONE 'Asia/Baghdad') AT TIME ZONE 'Asia/Baghdad')),0)::bigint revenue_yesterday
      FROM ops_entries WHERE lounge_status<>'cancelled' AND created_at >= ((date_trunc('day', now() AT TIME ZONE 'Asia/Baghdad') - INTERVAL '1 day') AT TIME ZONE 'Asia/Baghdad')`,
    db`SELECT lounge_name,
      COUNT(*)::int passengers,
      COALESCE(SUM(amount_iqd),0)::bigint total_iqd,
      COUNT(*) FILTER(WHERE payment_type='cash')::int cash,
      COUNT(*) FILTER(WHERE payment_type='electronic')::int electronic,
      COUNT(*) FILTER(WHERE payment_type='credit')::int credit,
      COUNT(*) FILTER(WHERE payment_type='complimentary')::int complimentary
      FROM ops_entries
      WHERE lounge_status<>'cancelled' AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Baghdad') AT TIME ZONE 'Asia/Baghdad')
      GROUP BY lounge_name`,
    db`SELECT COALESCE(NULLIF(airline_code,''),NULLIF(airline,''),'غير محدد') airline_code,
      MAX(NULLIF(airline,'')) airline_name,
      COUNT(*)::int passengers,
      COALESCE(SUM(amount_iqd),0)::bigint total_iqd
      FROM ops_entries
      WHERE lounge_status<>'cancelled' AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Baghdad') AT TIME ZONE 'Asia/Baghdad')
      GROUP BY 1 ORDER BY passengers DESC,total_iqd DESC LIMIT 6`,
    db`SELECT payment_type,COUNT(*)::int passengers,COALESCE(SUM(amount_iqd),0)::bigint amount_iqd
      FROM ops_entries
      WHERE lounge_status<>'cancelled' AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Baghdad') AT TIME ZONE 'Asia/Baghdad')
      GROUP BY payment_type`,
    db`SELECT to_char(created_at AT TIME ZONE 'Asia/Baghdad','HH24:00') hour,
      COUNT(*)::int passengers,COALESCE(SUM(amount_iqd),0)::bigint total_iqd
      FROM ops_entries
      WHERE lounge_status<>'cancelled' AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Baghdad') AT TIME ZONE 'Asia/Baghdad')
      GROUP BY 1 ORDER BY 1`,
    db`SELECT COUNT(*) FILTER(WHERE synced_from_offline=TRUE)::int recovered_today,
      MAX(offline_occurred_at) FILTER(WHERE synced_from_offline=TRUE) last_offline_at
      FROM ops_entries
      WHERE created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Baghdad') AT TIME ZONE 'Asia/Baghdad')`,
    db`SELECT DISTINCT ON(lounge_name) lounge_name,reference,passenger_name,created_at
      FROM ops_entries WHERE lounge_status<>'cancelled'
      ORDER BY lounge_name,created_at DESC`,
    listOpsAirlineProfiles(),
  ]);

  const summary: any = summaryRows[0] || {};
  const offline: any = offlineRows[0] || {};
  const discountedPrices = profiles.flatMap((profile: any) => profile.prices || []).filter((price: any) => price.active && price.discountActive);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      passengersToday: Number(summary.passengers_today || 0),
      revenueToday: String(summary.revenue_today || 0),
      passengersYesterday: Number(summary.passengers_yesterday || 0),
      revenueYesterday: String(summary.revenue_yesterday || 0),
    },
    lounges: loungeRows.map((row: any) => ({
      loungeName: String(row.lounge_name || ""),
      passengers: Number(row.passengers || 0),
      totalIqd: String(row.total_iqd || 0),
      cash: Number(row.cash || 0),
      electronic: Number(row.electronic || 0),
      credit: Number(row.credit || 0),
      complimentary: Number(row.complimentary || 0),
    })),
    airlinesToday: airlineRows.map((row: any) => ({
      code: String(row.airline_code || "غير محدد"),
      name: String(row.airline_name || row.airline_code || "غير محدد"),
      passengers: Number(row.passengers || 0),
      totalIqd: String(row.total_iqd || 0),
    })),
    payments: paymentRows.map((row: any) => ({
      type: String(row.payment_type || ""),
      passengers: Number(row.passengers || 0),
      amountIqd: String(row.amount_iqd || 0),
    })),
    hourly: hourlyRows.map((row: any) => ({
      hour: String(row.hour || ""),
      passengers: Number(row.passengers || 0),
      totalIqd: String(row.total_iqd || 0),
    })),
    offline: {
      recoveredToday: Number(offline.recovered_today || 0),
      lastOfflineAt: offline.last_offline_at ? String(offline.last_offline_at) : null,
    },
    lastByLounge: lastRows.map((row: any) => ({
      loungeName: String(row.lounge_name || ""),
      reference: String(row.reference || ""),
      passengerName: String(row.passenger_name || ""),
      createdAt: String(row.created_at || ""),
    })),
    airlineConfig: {
      total: profiles.length,
      active: profiles.filter((profile: any) => profile.active).length,
      discountsActive: discountedPrices.length,
    },
  };
}
