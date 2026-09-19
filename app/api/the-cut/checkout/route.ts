import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {createClient as service} from '@supabase/supabase-js';
import {stripePost} from '../../../../lib/stripe-connect';

function clean(v:any,n:number){return String(v||'').trim().slice(0,n)}
function validEmail(v:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)}

export async function POST(req:Request){
  try{
    const supabase=createClient();
    const{data:{user}}=await supabase.auth.getUser();
    const body=await req.json();
    const roomSlug=clean(body.roomSlug,120);
    const choice=body.choice==='product'?'product':'entry';
    const name=clean(body.name,120);
    const email=clean(body.email,254).toLowerCase();
    const phone=clean(body.phone,40);
    const emailOptIn=body.emailMarketingOptIn===true;
    const smsOptIn=body.smsMarketingOptIn===true&&!!phone;
    if(name.length<2)return NextResponse.json({error:'Enter your name.'},{status:400});
    if(!validEmail(email))return NextResponse.json({error:'Enter a valid email address.'},{status:400});
    const db=service(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const{data:room}=await db.from('cut_rooms').select('*').eq('slug',roomSlug).eq('premium',true).maybeSingle();
    if(!room)return NextResponse.json({error:'Premium room not found'},{status:404});
    const{data:host}=await db.from('cut_room_accounts').select('user_id').eq('id',room.host_account_id).maybeSingle();
    if(!host?.user_id)return NextResponse.json({error:'Host account unavailable'},{status:409});
    if(user&&host.user_id===user.id)return NextResponse.json({url:'/the-cut?room='+encodeURIComponent(roomSlug),host:true});
    const{data:pay}=await db.from('cut_host_payment_accounts').select('*').eq('user_id',host.user_id).maybeSingle();
    if(!pay?.stripe_account_id||!pay.charges_enabled)return NextResponse.json({error:'This host has not finished Stripe setup yet.'},{status:409});
    if(choice==='entry'&&room.admission_mode==='purchase_required')return NextResponse.json({error:'A product purchase is required for this room.'},{status:400});
    if(choice==='product'&&room.admission_mode==='entry_fee')return NextResponse.json({error:'This room uses an entry fee.'},{status:400});
    const amount=choice==='product'?Number(room.product_price_cents):Number(room.admission_price_cents);
    if(!Number.isInteger(amount)||amount<50)return NextResponse.json({error:'Invalid room price'},{status:400});
    const{data:setting}=await db.from('cut_platform_settings').select('value').eq('key','premium_room_platform_fee_percent').maybeSingle();
    const pct=Math.min(100,Math.max(0,Number(setting?.value??10)));
    const fee=Math.round(amount*pct/100);
    const origin=new URL(req.url).origin;
    const p=new URLSearchParams();
    p.set('mode','payment');
    p.set('success_url',origin+'/the-cut?room='+encodeURIComponent(roomSlug)+'&paid=1&session_id={CHECKOUT_SESSION_ID}');
    p.set('cancel_url',origin+'/the-cut?room='+encodeURIComponent(roomSlug)+'&payment=cancelled');
    if(user)p.set('client_reference_id',user.id);
    p.set('customer_email',email);
    p.set('line_items[0][price_data][currency]',String(room.currency||'usd'));
    p.set('line_items[0][price_data][unit_amount]',String(amount));
    p.set('line_items[0][price_data][product_data][name]',choice==='product'?String(room.product_name||'Premium room package'):String(room.title)+' — Admission');
    p.set('line_items[0][quantity]','1');
    p.set('payment_intent_data[application_fee_amount]',String(fee));
    p.set('metadata[indiecut_room_id]',room.id);
    if(user)p.set('metadata[indiecut_buyer_id]',user.id);
    p.set('metadata[indiecut_host_id]',host.user_id);
    p.set('metadata[purchase_type]',choice);
    p.set('metadata[platform_fee_cents]',String(fee));
    p.set('metadata[attendee_name]',name);
    p.set('metadata[attendee_email]',email);
    if(phone)p.set('metadata[attendee_phone]',phone);
    p.set('metadata[email_marketing_opt_in]',emailOptIn?'1':'0');
    p.set('metadata[sms_marketing_opt_in]',smsOptIn?'1':'0');
    if(choice==='product'&&room.product_kind==='physical')p.set('shipping_address_collection[allowed_countries][0]','US');
    const session=await stripePost('/checkout/sessions',p,pay.stripe_account_id);
    const{data:order,error:orderError}=await db.from('cut_premium_orders').insert({
      room_id:room.id,buyer_user_id:user?.id||null,host_user_id:host.user_id,stripe_checkout_session_id:session.id,
      amount_total_cents:amount,platform_fee_cents:fee,currency:room.currency||'usd',purchase_type:choice,
      product_kind:choice==='product'?room.product_kind:null,product_name:choice==='product'?room.product_name:null,
      customer_email:email,shipping_name:name,payment_status:'pending',access_granted:false,
      fulfillment_status:choice==='product'&&room.product_kind==='physical'?'pending':'not_required'
    }).select('id').single();
    if(orderError)throw orderError;
    await db.from('cut_room_contacts').upsert({
      host_user_id:host.user_id,room_id:room.id,order_id:order.id,buyer_user_id:user?.id||null,name,email,phone:phone||null,
      email_marketing_opt_in:emailOptIn,sms_marketing_opt_in:smsOptIn,amount_paid_cents:0,currency:room.currency||'usd',updated_at:new Date().toISOString()
    },{onConflict:'host_user_id,room_id,email'});
    return NextResponse.json({url:session.url});
  }catch(e:any){return NextResponse.json({error:e.message||'Unable to start checkout'},{status:500})}
}
