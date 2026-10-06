import { NextResponse } from 'next/server';
import { supabaseRpc } from '@/lib/snk-money/_personal-finance-ledger';
export const dynamic='force-dynamic';
export async function GET(){
  try{
    const checks=await supabaseRpc('stark_agent_readiness',{}) as Record<string,any>;
    const modelConfigured=Boolean(process.env.GEMINI_API_KEY);
    const ready=modelConfigured&&checks.context&&checks.write_tools&&checks.backend&&checks.binding;
    return NextResponse.json({system:'snk',scope:'personal',ready:Boolean(ready),modelConfigured,checks,transport:'reply',proactive:false},{status:ready?200:503});
  }catch{return NextResponse.json({system:'snk',ready:false,reason:'snk_backend_unavailable'},{status:503});}
}
