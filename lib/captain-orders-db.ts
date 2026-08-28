import { neon } from "@neondatabase/serverless";

function connectionString() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}
function sql(){ return neon(connectionString()); }

export async function ensureCaptainOrdersTable(){
  const db=sql();
  await db`CREATE TABLE IF NOT EXISTS captain_lounge_orders (
    id BIGSERIAL PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    captain_name TEXT NOT NULL,
    captain_company TEXT,
    captain_phone TEXT,
    lounge_name TEXT NOT NULL,
    passengers INTEGER NOT NULL,
    bags INTEGER NOT NULL,
    carts INTEGER NOT NULL DEFAULT 0,
    passenger_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS captain_lounge_orders_created_idx ON captain_lounge_orders(created_at DESC)`;
}

export async function saveCaptainOrder(input:{reference:string;captainName:string;captainCompany:string;captainPhone:string;loungeName:string;passengers:number;bags:number;carts:number;passengerPhone:string}){
  await ensureCaptainOrdersTable();
  const db=sql();
  const rows=await db`INSERT INTO captain_lounge_orders
    (reference,captain_name,captain_company,captain_phone,lounge_name,passengers,bags,carts,passenger_phone)
    VALUES (${input.reference},${input.captainName},${input.captainCompany||null},${input.captainPhone||null},${input.loungeName},${input.passengers},${input.bags},${input.carts},${input.passengerPhone})
    RETURNING id,reference,status,created_at`;
  return rows[0];
}

export async function setCaptainOrderStatus(id:number,status:string){
  await ensureCaptainOrdersTable();
  const db=sql();
  const rows=await db`UPDATE captain_lounge_orders SET status=${status} WHERE id=${id} RETURNING id,status`;
  return rows[0] as {id:number;status:string}|undefined;
}
