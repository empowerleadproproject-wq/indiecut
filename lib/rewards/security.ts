import { createHmac, randomInt, timingSafeEqual } from 'crypto';

function rewardSecret(){
  const secret=process.env.REWARDS_HASH_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.TEXTGRID_AUTH_TOKEN;
  if(!secret)throw new Error('Rewards security secret is not configured');
  return secret;
}

export function normalizeUsPhone(input:string){
  let digits=String(input||'').replace(/\D/g,'');
  if(digits.length===11&&digits.startsWith('1'))digits=digits.slice(1);
  if(digits.length!==10)throw new Error('Enter a valid 10-digit U.S. phone number');
  return `+1${digits}`;
}

export function hashRewardSignal(value:string){
  return createHmac('sha256',rewardSecret()).update(value).digest('hex');
}

export function hashRewardOtp(userId:string,phoneHash:string,code:string){
  return hashRewardSignal(`otp:${userId}:${phoneHash}:${code}`);
}

export function generateRewardOtp(){
  return String(randomInt(100000,1000000));
}

export function secureHashEqual(a:string,b:string){
  const left=Buffer.from(a);
  const right=Buffer.from(b);
  return left.length===right.length&&timingSafeEqual(left,right);
}

export function getClientIp(headers:Headers){
  const forwarded=headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded||headers.get('x-real-ip')||'unknown';
}

export function inferPlatform(userAgent:string){
  const ua=userAgent.toLowerCase();
  if(/iphone|ipad|ios/.test(ua))return 'ios';
  if(/android/.test(ua))return 'android';
  if(/windows/.test(ua))return 'windows';
  if(/macintosh|mac os/.test(ua))return 'macos';
  if(/linux/.test(ua))return 'linux';
  return 'unknown';
}

export const REWARDS_TERMS_VERSION='2026-09-16-v1';
export const REWARDS_PRIVACY_VERSION='2026-09-16-v1';
