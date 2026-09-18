import crypto from 'crypto';

const api='https://api.stripe.com/v1';

export function stripeSecret(){
  const value=process.env.STRIPE_SECRET_KEY;
  if(!value)throw new Error('STRIPE_SECRET_KEY is not configured');
  return value;
}

async function parseStripeResponse(response:Response){
  const payload=await response.json();
  if(!response.ok)throw new Error(payload?.error?.message||'Stripe request failed');
  return payload;
}

export async function stripeGet(path:string,account?:string){
  const response=await fetch(api+path,{
    method:'GET',
    headers:{
      Authorization:'Bearer '+stripeSecret(),
      ...(account?{'Stripe-Account':account}:{})
    },
    cache:'no-store'
  });
  return parseStripeResponse(response);
}

export async function stripePost(path:string,params:URLSearchParams,account?:string){
  const response=await fetch(api+path,{
    method:'POST',
    headers:{
      Authorization:'Bearer '+stripeSecret(),
      'Content-Type':'application/x-www-form-urlencoded',
      ...(account?{'Stripe-Account':account}:{})
    },
    body:params.toString(),
    cache:'no-store'
  });
  return parseStripeResponse(response);
}

export function verifyStripeWebhook(raw:string,sig:string){
  const secret=process.env.STRIPE_WEBHOOK_SECRET;
  if(!secret)throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  const parts=Object.fromEntries(sig.split(',').map(x=>x.split('=')));
  const t=parts.t,v1=parts.v1;
  if(!t||!v1)throw new Error('Invalid Stripe signature');
  if(Math.abs(Date.now()/1000-Number(t))>300)throw new Error('Expired Stripe signature');
  const expected=crypto.createHmac('sha256',secret).update(t+'.'+raw).digest('hex');
  if(expected.length!==v1.length||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(v1)))throw new Error('Invalid Stripe signature');
}
