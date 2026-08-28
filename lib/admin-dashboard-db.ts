import { neon } from "@neondatabase/serverless";
import { ensureCaptainTable } from "./captain-db";
import { ensurePromoTable } from "./promo-db";
import { ensureCaptainOrdersTable, setCaptainOrderStatus } from "./captain-orders-db";

function connectionString() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}
function sql(){ return neon(connectionString()); }

export type AdminBooking = {
  id:number; reference:string; customer_name:string; phone:string; airline:string|null; flight_number:string;
  trip_type:string; transport:string; booking_date:string; booking_time:string; passengers:number; bags:number;
  payment_method:string; payment_status:string; total_iqd:number; promo_code:string|null; discount_iqd:number;
  status:string; created_at:string; source:"customer"|"captain"; company:string|null; lounge:string|null; carts:number|null;
};

export async function ensureAdminBookingFields(){
  const db=sql();
  await db`CREATE TABLE IF NOT EXISTS lounge_bookings (
    id BIGSERIAL PRIMARY KEY, reference TEXT UNIQUE NOT NULL, customer_name TEXT NOT NULL,
    phone TEXT NOT NULL, airline TEXT, flight_number TEXT NOT NULL, trip_type TEXT NOT NULL,
    transport TEXT NOT NULL, city_side TEXT, address TEXT, landmark TEXT,
    booking_date DATE NOT NULL, booking_time TIME NOT NULL, passengers INTEGER NOT NULL,
    bags INTEGER NOT NULL, notes TEXT, payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending', total_iqd INTEGER NOT NULL,
    promo_code TEXT, discount_iqd INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`ALTER TABLE lounge_bookings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'`;
}

export async function adminOverview(){
  await Promise.all([ensureAdminBookingFields(),ensureCaptainTable(),ensurePromoTable(),ensureCaptainOrdersTable()]);
  const db=sql();
  const stats=await db`
    WITH all_orders AS (
      SELECT created_at,status,passengers,total_iqd FROM lounge_bookings
      UNION ALL
      SELECT created_at,status,passengers,0 AS total_iqd FROM captain_lounge_orders
    )
    SELECT
      COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Baghdad')::date = (NOW() AT TIME ZONE 'Asia/Baghdad')::date)::int AS bookings_today,
      COUNT(*) FILTER (WHERE status='new')::int AS new_bookings,
      COUNT(*) FILTER (WHERE status='completed' AND (created_at AT TIME ZONE 'Asia/Baghdad')::date=(NOW() AT TIME ZONE 'Asia/Baghdad')::date)::int AS completed_today,
      COALESCE(SUM(passengers) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Baghdad')::date=(NOW() AT TIME ZONE 'Asia/Baghdad')::date),0)::int AS passengers_today,
      COALESCE(SUM(total_iqd) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Baghdad')::date=(NOW() AT TIME ZONE 'Asia/Baghdad')::date),0)::bigint AS revenue_today
    FROM all_orders`;
  const captainStats=await db`SELECT COUNT(*)::int AS total, COUNT(*) FILTER(WHERE active)::int AS active FROM captain_accounts`;
  const promoStats=await db`SELECT COUNT(*)::int AS total, COUNT(*) FILTER(WHERE active)::int AS active, COALESCE(SUM(uses_count),0)::int AS uses FROM company_promo_codes`;
  const recent=await db`
    SELECT * FROM (
      SELECT id::bigint AS sort_id,id::int AS id,reference,customer_name,phone,airline,flight_number,trip_type,transport,
        booking_date::text AS booking_date,booking_time::text AS booking_time,passengers,bags,payment_method,payment_status,total_iqd,
        promo_code,discount_iqd,status,created_at,'customer'::text AS source,NULL::text AS company,NULL::text AS lounge,NULL::int AS carts
      FROM lounge_bookings
      UNION ALL
      SELECT id::bigint AS sort_id,(-id)::int AS id,reference,captain_name AS customer_name,passenger_phone AS phone,lounge_name AS airline,
        COALESCE(captain_company,'') AS flight_number,'captain' AS trip_type,'captain' AS transport,
        (created_at AT TIME ZONE 'Asia/Baghdad')::date::text AS booking_date,(created_at AT TIME ZONE 'Asia/Baghdad')::time::text AS booking_time,
        passengers,bags,'captain' AS payment_method,'not_applicable' AS payment_status,0 AS total_iqd,NULL::text AS promo_code,0 AS discount_iqd,
        status,created_at,'captain'::text AS source,captain_company AS company,lounge_name AS lounge,carts
      FROM captain_lounge_orders
    ) q ORDER BY created_at DESC LIMIT 8`;
  const companies=await db`
    WITH names AS (
      SELECT company AS name FROM captain_accounts WHERE TRIM(company)<>''
      UNION SELECT company_name FROM company_promo_codes WHERE TRIM(company_name)<>''
      UNION SELECT captain_company FROM captain_lounge_orders WHERE captain_company IS NOT NULL AND TRIM(captain_company)<>''
    )
    SELECT n.name,
      (SELECT COUNT(*) FROM captain_accounts c WHERE c.company=n.name)::int AS captains,
      (SELECT COUNT(*) FROM company_promo_codes p WHERE p.company_name=n.name)::int AS promos,
      (SELECT COALESCE(SUM(uses_count),0) FROM company_promo_codes p WHERE p.company_name=n.name)::int AS promo_uses
    FROM names n ORDER BY n.name`;
  return { stats:stats[0], captains:captainStats[0], promos:promoStats[0], recent, companies };
}

export async function listAdminBookings(limit=100){
  await Promise.all([ensureAdminBookingFields(),ensureCaptainOrdersTable()]);
  const db=sql();
  return await db`
    SELECT * FROM (
      SELECT id::bigint AS sort_id,id::int AS id,reference,customer_name,phone,airline,flight_number,trip_type,transport,
        booking_date::text AS booking_date,booking_time::text AS booking_time,passengers,bags,payment_method,payment_status,total_iqd,
        promo_code,discount_iqd,status,created_at,'customer'::text AS source,NULL::text AS company,NULL::text AS lounge,NULL::int AS carts
      FROM lounge_bookings
      UNION ALL
      SELECT id::bigint AS sort_id,(-id)::int AS id,reference,captain_name AS customer_name,passenger_phone AS phone,lounge_name AS airline,
        COALESCE(captain_company,'') AS flight_number,'captain' AS trip_type,'captain' AS transport,
        (created_at AT TIME ZONE 'Asia/Baghdad')::date::text AS booking_date,(created_at AT TIME ZONE 'Asia/Baghdad')::time::text AS booking_time,
        passengers,bags,'captain' AS payment_method,'not_applicable' AS payment_status,0 AS total_iqd,NULL::text AS promo_code,0 AS discount_iqd,
        status,created_at,'captain'::text AS source,captain_company AS company,lounge_name AS lounge,carts
      FROM captain_lounge_orders
    ) q ORDER BY created_at DESC LIMIT ${limit}` as AdminBooking[];
}

export async function setBookingStatus(id:number,status:string){
  if(id<0){
    const result=await setCaptainOrderStatus(Math.abs(id),status);
    return result ? {id,status:result.status} : undefined;
  }
  await ensureAdminBookingFields();
  const db=sql();
  const rows=await db`UPDATE lounge_bookings SET status=${status} WHERE id=${id} RETURNING id,status`;
  return rows[0] as {id:number;status:string}|undefined;
}
