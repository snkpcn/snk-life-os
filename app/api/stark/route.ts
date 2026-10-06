import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { runStark } from '@/lib/stark/agent';
import { createStarkBackend, starkServiceClient, STARK_MODULES } from '@/lib/stark/backend';
import { starkWebFinance } from '@/lib/snk-money/_personal-finance';
import { bangkokToday } from '@/lib/snk-money/_personal-finance-core';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){
  const supabase=createClient();const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Not authenticated'},{status:401});
  let body;try{body=await request.json();}catch{return NextResponse.json({error:'Invalid request'},{status:400});}
  if(typeof body?.message!=='string'||!body.message.trim()||body.message.length>4000)return NextResponse.json({error:'Invalid message'},{status:400});
  if(!process.env.GEMINI_API_KEY)return NextResponse.json({reply:'Stark ยังไม่ได้เชื่อม Gemini บนระบบนี้ครับ'},{status:503});
  const messageId=typeof body.requestId==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(body.requestId)?body.requestId:randomUUID();
  const actor=`web:${user.id}`;const today=bangkokToday(new Date());
  try{
    const db=starkServiceClient();
    const {data:bindings,error}=await db.from('finance_channel_bindings').select('id').eq('owner_id',user.id).eq('system','snk').in('scope',['personal','PERSONAL_FINANCE_PRIVATE']).eq('status','ACTIVE').limit(1);
    if(error)throw new Error('owner_check_failed');
    const casualOwner=process.env.SNK_MONEY_OWNER_ID===user.id||Boolean(bindings?.length);
    const backend=createStarkBackend({owner:user.id,actor,messageId,today,allowed:STARK_MODULES,db,finance:proposal=>starkWebFinance(user.id,actor,messageId,body.message,STARK_MODULES,proposal)});
    const reply=await runStark({message:body.message,today,casualOwner,backend,context:{article:body.article,crypto:body.crypto,stock:body.stock,instrument:body.instrument}});
    return NextResponse.json({reply});
  }catch{return NextResponse.json({reply:'ตอนนี้อ่านข้อมูล SNK ไม่สำเร็จครับ ยังไม่ยืนยันการเปลี่ยนแปลง ลองอีกครั้งได้ครับ'},{status:503});}
}
