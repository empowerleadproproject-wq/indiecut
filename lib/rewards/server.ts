import { createClient as createSessionClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';
import { getClientIp, hashRewardSignal, inferPlatform } from './security';

export async function getAuthenticatedRewardsUser(){
  const supabase=createSessionClient();
  const {data:{user},error}=await supabase.auth.getUser();
  if(error||!user)return null;
  return user;
}

export async function recordRewardAudit(userId:string,eventType:string,metadata:Record<string,unknown>={}){
  const admin=createAdminClient();
  await admin.from('reward_audit_events').insert({user_id:userId,event_type:eventType,metadata});
}

export async function registerRewardDevice(userId:string,deviceId:string,userAgent:string){
  const raw=String(deviceId||'').trim();
  if(raw.length<8||raw.length>256)return null;
  const admin=createAdminClient();
  const deviceHash=hashRewardSignal(`device:${raw}`);
  const now=new Date().toISOString();
  await admin.from('reward_devices').upsert({
    user_id:userId,
    device_token_hash:deviceHash,
    platform:inferPlatform(userAgent),
    user_agent:userAgent.slice(0,500),
    last_seen_at:now
  },{onConflict:'user_id,device_token_hash'});
  return deviceHash;
}

export function hashRequestIp(headers:Headers){
  return hashRewardSignal(`ip:${getClientIp(headers)}`);
}
