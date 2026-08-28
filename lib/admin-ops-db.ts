import { neon } from "@neondatabase/serverless";

function connectionString() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}
function sql(){ return neon(connectionString()); }

export type OrderPriority = "normal"|"important"|"urgent";

export async function ensureAdminOpsFields(){
  const db=sql();
  await db`ALTER TABLE lounge_bookings ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'`;
  await db`ALTER TABLE lounge_bookings ADD COLUMN IF NOT EXISTS internal_note TEXT NOT NULL DEFAULT ''`;
  await db`ALTER TABLE lounge_bookings ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`;
  await db`ALTER TABLE lounge_bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;

  await db`ALTER TABLE captain_lounge_orders ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'`;
  await db`ALTER TABLE captain_lounge_orders ADD COLUMN IF NOT EXISTS internal_note TEXT NOT NULL DEFAULT ''`;
  await db`ALTER TABLE captain_lounge_orders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`;
  await db`ALTER TABLE captain_lounge_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;

  await db`CREATE TABLE IF NOT EXISTS admin_order_activity (
    id BIGSERIAL PRIMARY KEY,
    order_source TEXT NOT NULL,
    order_id BIGINT NOT NULL,
    reference TEXT NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    actor TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS admin_order_activity_ref_idx ON admin_order_activity(reference,created_at DESC)`;
}

export async function autoArchiveOldOrders(){
  await ensureAdminOpsFields();
  const db=sql();
  await db`UPDATE lounge_bookings SET archived_at=NOW(), updated_at=NOW()
    WHERE archived_at IS NULL AND status IN ('completed','cancelled') AND created_at < NOW()-INTERVAL '7 days'`;
  await db`UPDATE captain_lounge_orders SET archived_at=NOW(), updated_at=NOW()
    WHERE archived_at IS NULL AND status IN ('completed','cancelled') AND created_at < NOW()-INTERVAL '7 days'`;
}

async function logActivity(source:string,id:number,reference:string,action:string,oldValue:string|null,newValue:string|null){
  const db=sql();
  await db`INSERT INTO admin_order_activity(order_source,order_id,reference,action,old_value,new_value)
    VALUES(${source},${id},${reference},${action},${oldValue},${newValue})`;
}

export async function updateOrderOps(input:{id:number;status?:string;priority?:OrderPriority;internalNote?:string;archived?:boolean}){
  await ensureAdminOpsFields();
  const source=input.id<0?"captain":"customer";
  const realId=Math.abs(input.id);
  const db=sql();
  const table=source==="captain"?"captain_lounge_orders":"lounge_bookings";
  const currentRows=source==="captain"
    ? await db`SELECT id,reference,status,priority,internal_note,archived_at FROM captain_lounge_orders WHERE id=${realId} LIMIT 1`
    : await db`SELECT id,reference,status,priority,internal_note,archived_at FROM lounge_bookings WHERE id=${realId} LIMIT 1`;
  const current=currentRows[0] as any;
  if(!current) return undefined;

  let status=String(current.status||"new");
  let priority=String(current.priority||"normal") as OrderPriority;
  let note=String(current.internal_note||"");
  let archivedAt=current.archived_at as string|null;
  if(input.status!==undefined) status=input.status;
  if(input.priority!==undefined) priority=input.priority;
  if(input.internalNote!==undefined) note=input.internalNote.trim().slice(0,2000);
  if(input.archived!==undefined) archivedAt=input.archived?new Date().toISOString():null;

  const rows=source==="captain"
    ? await db`UPDATE captain_lounge_orders SET status=${status},priority=${priority},internal_note=${note},archived_at=${archivedAt},updated_at=NOW() WHERE id=${realId} RETURNING id,reference,status,priority,internal_note,archived_at,updated_at`
    : await db`UPDATE lounge_bookings SET status=${status},priority=${priority},internal_note=${note},archived_at=${archivedAt},updated_at=NOW() WHERE id=${realId} RETURNING id,reference,status,priority,internal_note,archived_at,updated_at`;
  const updated=rows[0] as any;
  if(input.status!==undefined&&input.status!==current.status) await logActivity(source,realId,current.reference,"status",String(current.status||""),status);
  if(input.priority!==undefined&&input.priority!==current.priority) await logActivity(source,realId,current.reference,"priority",String(current.priority||"normal"),priority);
  if(input.internalNote!==undefined&&note!==String(current.internal_note||"")) await logActivity(source,realId,current.reference,"internal_note",String(current.internal_note||""),note);
  if(input.archived!==undefined) await logActivity(source,realId,current.reference,input.archived?"archive":"restore",current.archived_at?"archived":"active",input.archived?"archived":"active");
  return {...updated,id:source==="captain"?-realId:realId,source};
}

export async function listOrderActivity(reference?:string,limit=100){
  await ensureAdminOpsFields();
  const db=sql();
  if(reference){
    return await db`SELECT id,order_source,order_id,reference,action,old_value,new_value,actor,created_at FROM admin_order_activity WHERE reference=${reference} ORDER BY created_at DESC LIMIT ${limit}`;
  }
  return await db`SELECT id,order_source,order_id,reference,action,old_value,new_value,actor,created_at FROM admin_order_activity ORDER BY created_at DESC LIMIT ${limit}`;
}
