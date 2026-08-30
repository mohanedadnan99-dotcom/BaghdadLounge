import { neon } from "@neondatabase/serverless";

function connectionString(){const v=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.NEON_DATABASE_URL;if(!v)throw new Error("DATABASE_URL is not configured");return v}
function sql(){return neon(connectionString())}

export async function ensureOpsPricing(){
  const db=sql();
  await db`CREATE TABLE IF NOT EXISTS ops_pricing_settings(
    id INT PRIMARY KEY DEFAULT 1 CHECK(id=1),
    default_price_iqd BIGINT NOT NULL DEFAULT 40000,
    default_payment_type TEXT NOT NULL DEFAULT 'cash',
    allow_manual_override BOOLEAN NOT NULL DEFAULT TRUE,
    require_override_reason BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`INSERT INTO ops_pricing_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING`;
}

export async function getOpsPricingSettings(){
  await ensureOpsPricing();
  const db=sql();
  const rows=await db`SELECT default_price_iqd,default_payment_type,allow_manual_override,require_override_reason,updated_at FROM ops_pricing_settings WHERE id=1`;
  return rows[0];
}

export async function updateOpsPricingSettings(input:{defaultPriceIqd:number;defaultPaymentType:string;allowManualOverride:boolean;requireOverrideReason:boolean}){
  await ensureOpsPricing();
  const db=sql();
  const rows=await db`UPDATE ops_pricing_settings SET default_price_iqd=${Math.max(0,Math.round(input.defaultPriceIqd||0))},default_payment_type=${input.defaultPaymentType||'cash'},allow_manual_override=${input.allowManualOverride},require_override_reason=${input.requireOverrideReason},updated_at=NOW() WHERE id=1 RETURNING default_price_iqd,default_payment_type,allow_manual_override,require_override_reason,updated_at`;
  return rows[0];
}

export async function resolveOpsPassengerPrice(input:{companyName?:string}){
  await ensureOpsPricing();
  const db=sql();
  const settingsRows=await db`SELECT default_price_iqd,default_payment_type,allow_manual_override,require_override_reason FROM ops_pricing_settings WHERE id=1`;
  const settings:any=settingsRows[0]||{default_price_iqd:40000,default_payment_type:'cash',allow_manual_override:true,require_override_reason:true};
  const company=String(input.companyName||'').trim();
  if(company){
    const rows=await db`SELECT id::int,name,price_iqd,billing_type FROM ops_companies WHERE active=TRUE AND LOWER(name)=LOWER(${company}) LIMIT 1`;
    const row:any=rows[0];
    if(row)return {source:'company' as const,companyId:Number(row.id),companyName:String(row.name),priceIqd:Number(row.price_iqd||0),paymentType:String(row.billing_type||'credit'),allowManualOverride:Boolean(settings.allow_manual_override),requireOverrideReason:Boolean(settings.require_override_reason)};
  }
  return {source:'default' as const,companyId:null,companyName:'',priceIqd:Number(settings.default_price_iqd||40000),paymentType:String(settings.default_payment_type||'cash'),allowManualOverride:Boolean(settings.allow_manual_override),requireOverrideReason:Boolean(settings.require_override_reason)};
}
