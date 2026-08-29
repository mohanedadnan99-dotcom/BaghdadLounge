import { neon } from "@neondatabase/serverless";

function connectionString(){
  const value=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.NEON_DATABASE_URL;
  if(!value) throw new Error("DATABASE_URL is not configured");
  return value;
}
function sql(){return neon(connectionString())}

export type LoungeSetting={id:string;name:string;active:boolean;price_iqd:number;note:string;sort_order:number};
export type SystemMessage={id:number;text:string;active:boolean;created_at:string};
export type WatchItem={id:number;kind:"phone"|"captain"|"company";value:string;note:string;active:boolean;created_at:string};

let operationsInit:Promise<void>|null=null;
export async function ensureOperationsTables(){
  if(operationsInit)return operationsInit;
  operationsInit=(async()=>{
    const db=sql();
    await db`CREATE TABLE IF NOT EXISTS lounge_settings(
      id TEXT PRIMARY KEY,name TEXT NOT NULL,active BOOLEAN NOT NULL DEFAULT TRUE,price_iqd INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',sort_order INTEGER NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    const defaults=[
      {id:"samarra",name:"صالة سامراء",sort:1},{id:"babylon",name:"صالة بابل",sort:2},{id:"nineveh",name:"صالة نينوى",sort:3}
    ];
    for(const item of defaults){
      await db`INSERT INTO lounge_settings(id,name,sort_order) VALUES(${item.id},${item.name},${item.sort}) ON CONFLICT(id) DO NOTHING`;
    }
    await db`CREATE TABLE IF NOT EXISTS system_messages(
      id BIGSERIAL PRIMARY KEY,text TEXT NOT NULL,active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await db`CREATE TABLE IF NOT EXISTS operations_watchlist(
      id BIGSERIAL PRIMARY KEY,kind TEXT NOT NULL,value TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await db`CREATE INDEX IF NOT EXISTS operations_watchlist_value_idx ON operations_watchlist(value)`;
    await db`CREATE TABLE IF NOT EXISTS company_accounts(
      company_name TEXT PRIMARY KEY,price_per_passenger INTEGER NOT NULL DEFAULT 0,notes TEXT NOT NULL DEFAULT '',updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await db`CREATE TABLE IF NOT EXISTS company_payments(
      id BIGSERIAL PRIMARY KEY,company_name TEXT NOT NULL,amount_iqd BIGINT NOT NULL CHECK(amount_iqd>0),note TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  })();
  try{await operationsInit}catch(error){operationsInit=null;throw error}
}

export async function getPublicCaptainConfig(){
  await ensureOperationsTables();const db=sql();
  const [lounges,messages]=await Promise.all([
    db`SELECT id,name,active,price_iqd,note,sort_order FROM lounge_settings WHERE active=TRUE ORDER BY sort_order,name`,
    db`SELECT id,text,active,created_at FROM system_messages WHERE active=TRUE ORDER BY created_at DESC LIMIT 3`
  ]);
  return {lounges:lounges as LoungeSetting[],messages:messages as SystemMessage[]};
}

export async function getLoungeById(id:string){
  await ensureOperationsTables();const db=sql();
  const rows=await db`SELECT id,name,active,price_iqd,note,sort_order FROM lounge_settings WHERE id=${id} LIMIT 1`;
  return rows[0] as LoungeSetting|undefined;
}

export async function findWatchMatch(input:{phone?:string;captain?:string;company?:string}){
  await ensureOperationsTables();const db=sql();
  const values=[input.phone?.trim(),input.captain?.trim(),input.company?.trim()].filter(Boolean) as string[];
  if(!values.length)return undefined;
  const rows=await db`SELECT id,kind,value,note,active,created_at FROM operations_watchlist WHERE active=TRUE AND value=ANY(${values}) ORDER BY id DESC LIMIT 1`;
  return rows[0] as WatchItem|undefined;
}

export async function getOperationsAdminData(){
  await ensureOperationsTables();const db=sql();
  const [lounges,messages,watchlist,companies,monitor]=await Promise.all([
    db`SELECT id,name,active,price_iqd,note,sort_order FROM lounge_settings ORDER BY sort_order,name`,
    db`SELECT id,text,active,created_at FROM system_messages ORDER BY created_at DESC LIMIT 20`,
    db`SELECT id,kind,value,note,active,created_at FROM operations_watchlist ORDER BY created_at DESC LIMIT 100`,
    db`WITH names AS(
      SELECT company AS name FROM captain_accounts WHERE TRIM(company)<>''
      UNION SELECT captain_company AS name FROM captain_lounge_orders WHERE captain_company IS NOT NULL AND TRIM(captain_company)<>''
      UNION SELECT company_name AS name FROM company_promo_codes WHERE TRIM(company_name)<>''
      UNION SELECT company_name AS name FROM company_accounts
    ), order_stats AS(
      SELECT captain_company name,COUNT(*)::int orders,COALESCE(SUM(passengers),0)::int passengers
      FROM captain_lounge_orders WHERE captain_company IS NOT NULL GROUP BY captain_company
    ), pay_stats AS(
      SELECT company_name name,COALESCE(SUM(amount_iqd),0)::bigint paid_iqd FROM company_payments GROUP BY company_name
    )
    SELECT n.name,COALESCE(a.price_per_passenger,0)::int AS price_per_passenger,COALESCE(a.notes,'') AS notes,
      COALESCE(os.orders,0)::int orders,COALESCE(os.passengers,0)::int passengers,COALESCE(ps.paid_iqd,0)::bigint paid_iqd,
      (COALESCE(os.passengers,0)*COALESCE(a.price_per_passenger,0))::bigint due_iqd
    FROM names n LEFT JOIN company_accounts a ON a.company_name=n.name LEFT JOIN order_stats os ON os.name=n.name LEFT JOIN pay_stats ps ON ps.name=n.name ORDER BY n.name`,
    db`WITH all_orders AS(
      SELECT created_at,status,NULL::text AS lounge,NULL::text AS company FROM lounge_bookings WHERE archived_at IS NULL
      UNION ALL
      SELECT created_at,status,lounge_name AS lounge,captain_company AS company FROM captain_lounge_orders WHERE archived_at IS NULL
    )
    SELECT
      COUNT(*) FILTER(WHERE status='new')::int AS new_orders,
      COUNT(*) FILTER(WHERE status='new' AND created_at<NOW()-INTERVAL '15 minutes')::int AS delayed_orders,
      MIN(created_at) FILTER(WHERE status='new') AS oldest_new,
      (SELECT lounge FROM all_orders WHERE lounge IS NOT NULL GROUP BY lounge ORDER BY COUNT(*) DESC LIMIT 1) AS busiest_lounge,
      (SELECT company FROM all_orders WHERE company IS NOT NULL AND created_at>NOW()-INTERVAL '24 hours' GROUP BY company ORDER BY COUNT(*) DESC LIMIT 1) AS active_company
    FROM all_orders`
  ]);
  return {lounges,messages,watchlist,companies,monitor:monitor[0]};
}

export async function updateLounge(input:{id:string;name:string;active:boolean;priceIqd:number;note:string;sortOrder:number}){
  await ensureOperationsTables();const db=sql();
  const rows=await db`UPDATE lounge_settings SET name=${input.name},active=${input.active},price_iqd=${input.priceIqd},note=${input.note},sort_order=${input.sortOrder},updated_at=NOW() WHERE id=${input.id} RETURNING id,name,active,price_iqd,note,sort_order`;
  return rows[0];
}
export async function createMessage(text:string){await ensureOperationsTables();const db=sql();const rows=await db`INSERT INTO system_messages(text) VALUES(${text}) RETURNING id,text,active,created_at`;return rows[0]}
export async function toggleMessage(id:number,active:boolean){await ensureOperationsTables();const db=sql();const rows=await db`UPDATE system_messages SET active=${active} WHERE id=${id} RETURNING id,text,active,created_at`;return rows[0]}
export async function deleteMessage(id:number){await ensureOperationsTables();const db=sql();await db`DELETE FROM system_messages WHERE id=${id}`}
export async function addWatchItem(input:{kind:string;value:string;note:string}){await ensureOperationsTables();const db=sql();const rows=await db`INSERT INTO operations_watchlist(kind,value,note) VALUES(${input.kind},${input.value},${input.note}) RETURNING id,kind,value,note,active,created_at`;return rows[0]}
export async function toggleWatchItem(id:number,active:boolean){await ensureOperationsTables();const db=sql();const rows=await db`UPDATE operations_watchlist SET active=${active} WHERE id=${id} RETURNING id,kind,value,note,active,created_at`;return rows[0]}
export async function deleteWatchItem(id:number){await ensureOperationsTables();const db=sql();await db`DELETE FROM operations_watchlist WHERE id=${id}`}
export async function saveCompanyAccount(companyName:string,pricePerPassenger:number,notes:string){await ensureOperationsTables();const db=sql();const rows=await db`INSERT INTO company_accounts(company_name,price_per_passenger,notes) VALUES(${companyName},${pricePerPassenger},${notes}) ON CONFLICT(company_name) DO UPDATE SET price_per_passenger=EXCLUDED.price_per_passenger,notes=EXCLUDED.notes,updated_at=NOW() RETURNING company_name,price_per_passenger,notes`;return rows[0]}
export async function addCompanyPayment(companyName:string,amountIqd:number,note:string){await ensureOperationsTables();const db=sql();const rows=await db`INSERT INTO company_payments(company_name,amount_iqd,note) VALUES(${companyName},${amountIqd},${note}) RETURNING id,company_name,amount_iqd,note,created_at`;return rows[0]}
