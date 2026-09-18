import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {createClient as service} from '@supabase/supabase-js';
import {stripeGet,stripePost} from '../../../../lib/stripe-connect';

function serviceDb(){
  return service(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function signedInUser(){
  const supabase=createClient();
  const{data:{user}}=await supabase.auth.getUser();
  return user;
}

async function syncAccount(db:ReturnType<typeof serviceDb>,userId:string,accountId:string){
  const account=await stripeGet('/accounts/'+encodeURIComponent(accountId));
  const status={
    hasAccount:true,
    accountId,
    chargesEnabled:!!account.charges_enabled,
    payoutsEnabled:!!account.payouts_enabled,
    detailsSubmitted:!!account.details_submitted,
    connected:!!account.charges_enabled&&!!account.payouts_enabled&&!!account.details_submitted
  };
  await db.from('cut_host_payment_accounts').upsert({
    user_id:userId,
    stripe_account_id:accountId,
    charges_enabled:status.chargesEnabled,
    payouts_enabled:status.payoutsEnabled,
    details_submitted:status.detailsSubmitted,
    updated_at:new Date().toISOString()
  });
  return status;
}

async function accountLink(req:Request,accountId:string){
  const origin=new URL(req.url).origin;
  const params=new URLSearchParams();
  params.set('account',accountId);
  params.set('refresh_url',origin+'/api/the-cut/connect?action=refresh');
  params.set('return_url',origin+'/the-cut?stripe=connected&premium=1');
  params.set('type','account_onboarding');
  return stripePost('/account_links',params);
}

export async function GET(req:Request){
  try{
    const user=await signedInUser();
    if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
    const db=serviceDb();
    const{data:row,error}=await db.from('cut_host_payment_accounts').select('*').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    if(!row?.stripe_account_id){
      if(new URL(req.url).searchParams.get('action')==='refresh')return NextResponse.redirect(new URL('/the-cut?stripe=missing&premium=1',req.url));
      return NextResponse.json({hasAccount:false,connected:false,chargesEnabled:false,payoutsEnabled:false,detailsSubmitted:false});
    }

    const status=await syncAccount(db,user.id,row.stripe_account_id);
    const action=new URL(req.url).searchParams.get('action');

    if(action==='refresh'&&!status.connected){
      const link=await accountLink(req,row.stripe_account_id);
      return NextResponse.redirect(link.url,303);
    }

    if(action==='dashboard'&&status.connected){
      const login=await stripePost('/accounts/'+encodeURIComponent(row.stripe_account_id)+'/login_links',new URLSearchParams());
      return NextResponse.redirect(login.url,303);
    }

    return NextResponse.json(status);
  }catch(e:any){
    return NextResponse.json({error:e.message||'Unable to check Stripe connection'},{status:500});
  }
}

export async function POST(req:Request){
  try{
    const user=await signedInUser();
    if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
    const db=serviceDb();
    let{data:row,error}=await db.from('cut_host_payment_accounts').select('*').eq('user_id',user.id).maybeSingle();
    if(error)throw error;

    let accountId=row?.stripe_account_id as string|undefined;
    if(!accountId){
      const params=new URLSearchParams();
      params.set('type','express');
      params.set('metadata[indiecut_user_id]',user.id);
      params.set('capabilities[card_payments][requested]','true');
      params.set('capabilities[transfers][requested]','true');
      if(user.email)params.set('email',user.email);
      const account=await stripePost('/accounts',params);
      accountId=account.id;
      const{error:saveError}=await db.from('cut_host_payment_accounts').upsert({
        user_id:user.id,
        stripe_account_id:accountId,
        charges_enabled:false,
        payouts_enabled:false,
        details_submitted:false,
        updated_at:new Date().toISOString()
      });
      if(saveError)throw saveError;
    }

    const status=await syncAccount(db,user.id,accountId);
    let action='onboard';
    try{action=String((await req.json())?.action||'onboard')}catch{}

    if(status.connected&&action==='dashboard'){
      const login=await stripePost('/accounts/'+encodeURIComponent(accountId)+'/login_links',new URLSearchParams());
      return NextResponse.json({...status,url:login.url});
    }

    if(status.connected)return NextResponse.json(status);

    const link=await accountLink(req,accountId);
    return NextResponse.json({...status,url:link.url});
  }catch(e:any){
    return NextResponse.json({error:e.message||'Unable to connect Stripe'},{status:500});
  }
}
