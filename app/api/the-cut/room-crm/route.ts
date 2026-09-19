import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {createClient as service} from '@supabase/supabase-js';

export async function GET(){
  try{
    const supabase=createClient();
    const{data:{user}}=await supabase.auth.getUser();
    if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
    const db=service(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const{data:membership}=await db.from('cut_host_crm_memberships').select('status,plan_key,current_period_end').eq('host_user_id',user.id).maybeSingle();
    const active=membership?.status==='active'||membership?.status==='trialing';
    if(!active)return NextResponse.json({membership:{active:false,status:membership?.status||'inactive'},contacts:[],summary:{contacts:0,revenueCents:0,visits:0}});
    const{data:contacts,error}=await db.from('cut_room_contacts').select('id,room_id,name,email,phone,email_marketing_opt_in,sms_marketing_opt_in,amount_paid_cents,currency,first_joined_at,last_joined_at,visit_count,cut_rooms(title,slug)').eq('host_user_id',user.id).order('last_joined_at',{ascending:false});
    if(error)throw error;
    const list=contacts||[];
    return NextResponse.json({membership:{active:true,status:membership.status,planKey:membership.plan_key,currentPeriodEnd:membership.current_period_end},contacts:list,summary:{contacts:list.length,revenueCents:list.reduce((n:any,x:any)=>n+Number(x.amount_paid_cents||0),0),visits:list.reduce((n:any,x:any)=>n+Number(x.visit_count||0),0)}});
  }catch(e:any){return NextResponse.json({error:e.message||'Unable to load room CRM'},{status:500})}
}
