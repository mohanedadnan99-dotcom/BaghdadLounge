import { getPublicCaptainConfig } from "@/lib/operations-db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
  try{return Response.json(await getPublicCaptainConfig(),{headers:{"Cache-Control":"no-store"}})}catch(error){console.error(error);return Response.json({lounges:[],messages:[]},{status:500})}
}
