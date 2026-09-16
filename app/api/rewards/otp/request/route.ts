import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../../lib/supabase/admin';
import { sendTextGridSms, textGridConfigured } from '../../../../../lib/textgrid';
import { generateRewardOtp, hashRewardOtp, hashRewardSignal, normalizeUsPhone, REWARDS_PRIVACY_VERSION, REWARDS_TERMS_VERSION } from '../../../../../lib/rewards/security';
import { getAuthenticatedRewardsUser, hashRequestIp, recordRewardAudit, registerRewardDevice } from '../../../../../lib/rewards/server';

export const runtime='nodejs';

export async function POST(request:Request){
  try{
    const user=await getAuthenticatedRewardsUser();
    if(!user)return NextResponse.json({error:'Sign in to activate Watch & Earn.'},{status:401});

    const body=await request.json().catch(()=>({}));
    if(body?.ageConfirmed!==true)return NextResponse.json({error:'You must confirm that you are 18 or older.'},{status:400});
    if(body?.termsAccepted!==true||body?.privacyAccepted!==true)return NextResponse.json({error:'Accept the Watch & Earn Terms and Privacy Notice to continue.'},{status:400});
    if(!textGridConfigured())return NextResponse.json({error:'Phone verification is temporarily unavailable. TextGrid is not connected.'},{status:503});

    const phone=normalizeUsPhone(String(body?.phone||''));
    const phoneHash=hashRewardSignal(`phone:${phone}`);
    const phoneLast4=phone.slice(-4);
    const deviceId=String(body?.deviceId||'');
    const userAgent=String(request.headers.get('user-agent')||'unknown');
    const admin=createAdminClient();

    const {data:profile}=await admin.from('reward_profiles').select('id,status,phone_hash').eq('user_id',user.id).maybeSingle();
    if(profile?.status==='active')return NextResponse.json({error:'This rewards account is already active.'},{status:409});

    const {data:claimed}=await admin.from('reward_profiles').select('user_id').eq('phone_hash',phoneHash).neq('user_id',user.id).maybeSingle();
    if(claimed)return NextResponse.json({error:'That phone number is already linked to another Watch & Earn profile.'},{status:409});

    const oneHourAgo=new Date(Date.now()-60*60*1000).toISOString();
    const {count:hourCount}=await admin.from('reward_phone_otps').select('id',{count:'exact',head:true}).eq('user_id',user.id).gte('created_at',oneHourAgo);
    if((hourCount||0)>=5)return NextResponse.json({error:'Too many verification requests. Try again later.'},{status:429});

    const {data:lastOtp}=await admin.from('reward_phone_otps').select('created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(lastOtp?.created_at&&Date.now()-new Date(lastOtp.created_at).getTime()<60_000){
      return NextResponse.json({error:'Please wait 60 seconds before requesting another code.'},{status:429});
    }

    const now=new Date().toISOString();
    const {data:upserted,error:profileError}=await admin.from('reward_profiles').upsert({
      user_id:user.id,
      status:'phone_pending',
      age_attested_at:now,
      terms_version:REWARDS_TERMS_VERSION,
      terms_accepted_at:now,
      privacy_version:REWARDS_PRIVACY_VERSION,
      privacy_accepted_at:now
    },{onConflict:'user_id'}).select('id').single();
    if(profileError)throw profileError;

    await admin.from('reward_terms_acceptances').upsert({
      user_id:user.id,
      profile_id:upserted.id,
      terms_version:REWARDS_TERMS_VERSION,
      privacy_version:REWARDS_PRIVACY_VERSION,
      accepted_at:now,
      user_agent:userAgent.slice(0,500),
      ip_hash:hashRequestIp(request.headers)
    },{onConflict:'user_id,terms_version,privacy_version',ignoreDuplicates:true});

    await registerRewardDevice(user.id,deviceId,userAgent);

    const code=generateRewardOtp();
    const otpHash=hashRewardOtp(user.id,phoneHash,code);
    const expiresAt=new Date(Date.now()+10*60*1000).toISOString();
    const {data:otp,error:otpError}=await admin.from('reward_phone_otps').insert({
      user_id:user.id,
      phone_hash:phoneHash,
      phone_last4:phoneLast4,
      otp_hash:otpHash,
      expires_at:expiresAt
    }).select('id').single();
    if(otpError)throw otpError;

    try{
      await sendTextGridSms(phone,`Indie Cut verification code: ${code}. It expires in 10 minutes. Do not share this code.`);
    }catch(error){
      await admin.from('reward_phone_otps').delete().eq('id',otp.id);
      throw error;
    }

    await recordRewardAudit(user.id,'rewards.phone.otp_requested',{phone_last4:phoneLast4,terms_version:REWARDS_TERMS_VERSION});
    return NextResponse.json({ok:true,last4:phoneLast4,expiresInSeconds:600});
  }catch(error:any){
    return NextResponse.json({error:String(error?.message||'Unable to send verification code.')},{status:400});
  }
}
