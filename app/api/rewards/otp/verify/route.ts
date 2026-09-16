import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../../lib/supabase/admin';
import { hashRewardOtp, secureHashEqual } from '../../../../../lib/rewards/security';
import { getAuthenticatedRewardsUser, recordRewardAudit, registerRewardDevice } from '../../../../../lib/rewards/server';

export const runtime='nodejs';

export async function POST(request:Request){
  try{
    const user=await getAuthenticatedRewardsUser();
    if(!user)return NextResponse.json({error:'Sign in to verify your rewards account.'},{status:401});

    const body=await request.json().catch(()=>({}));
    const code=String(body?.code||'').replace(/\D/g,'');
    if(code.length!==6)return NextResponse.json({error:'Enter the 6-digit verification code.'},{status:400});

    const admin=createAdminClient();
    const {data:otp}=await admin.from('reward_phone_otps')
      .select('id,phone_hash,phone_last4,otp_hash,expires_at,attempt_count,max_attempts')
      .eq('user_id',user.id)
      .is('consumed_at',null)
      .order('created_at',{ascending:false})
      .limit(1)
      .maybeSingle();

    if(!otp)return NextResponse.json({error:'No active verification code was found. Request a new code.'},{status:404});
    if(new Date(otp.expires_at).getTime()<Date.now())return NextResponse.json({error:'That code expired. Request a new code.'},{status:410});
    if(otp.attempt_count>=otp.max_attempts)return NextResponse.json({error:'Too many incorrect attempts. Request a new code.'},{status:423});

    const expected=hashRewardOtp(user.id,otp.phone_hash,code);
    if(!secureHashEqual(expected,otp.otp_hash)){
      const nextAttempts=otp.attempt_count+1;
      await admin.from('reward_phone_otps').update({attempt_count:nextAttempts}).eq('id',otp.id);
      await recordRewardAudit(user.id,'rewards.phone.otp_failed',{attempts:nextAttempts});
      return NextResponse.json({error:nextAttempts>=otp.max_attempts?'Too many incorrect attempts. Request a new code.':'That verification code is incorrect.'},{status:400});
    }

    const {data:claimed}=await admin.from('reward_profiles').select('user_id').eq('phone_hash',otp.phone_hash).neq('user_id',user.id).maybeSingle();
    if(claimed)return NextResponse.json({error:'That phone number is already linked to another Watch & Earn profile.'},{status:409});

    const now=new Date().toISOString();
    const {error:profileError}=await admin.from('reward_profiles').update({
      status:'active',
      phone_hash:otp.phone_hash,
      phone_last4:otp.phone_last4,
      phone_verified_at:now
    }).eq('user_id',user.id);
    if(profileError)throw profileError;

    await admin.from('reward_phone_otps').update({consumed_at:now}).eq('user_id',user.id).is('consumed_at',null);

    const userAgent=String(request.headers.get('user-agent')||'unknown');
    await registerRewardDevice(user.id,String(body?.deviceId||''),userAgent);
    await recordRewardAudit(user.id,'rewards.identity.activated',{phone_last4:otp.phone_last4});

    return NextResponse.json({ok:true,status:'active',phoneLast4:otp.phone_last4});
  }catch(error:any){
    return NextResponse.json({error:String(error?.message||'Unable to verify rewards account.')},{status:400});
  }
}
