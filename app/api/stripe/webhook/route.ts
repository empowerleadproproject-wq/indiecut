import {NextResponse} from 'next/server';
import {createClient as service} from '@supabase/supabase-js';
import {verifyStripeWebhook} from '../../../../lib/stripe-connect';

export async function POST(req:Request){
  const raw=await req.text();
  try{
    verifyStripeWebhook(raw,req.headers.get('stripe-signature')||'');
    const event=JSON.parse(raw);
    const db=service(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);
    if(event.type==='account.updated'){
      const a=event.data.object;
      await db.from('cut_host_payment_accounts').update({charges_enabled:!!a.charges_enabled,payouts_enabled:!!a.payouts_enabled,details_submitted:!!a.details_submitted,updated_at:new Date().toISOString()}).eq('stripe_account_id',a.id);
    }
    if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded'){
      const s=event.data.object;
      const shipping=s.collected_information?.shipping_details||s.shipping_details;
      const{data:order}=await db.from('cut_premium_orders').update({
        stripe_payment_intent_id:s.payment_intent||null,payment_status:'paid',access_granted:true,
        customer_email:s.customer_details?.email||s.customer_email||null,shipping_name:shipping?.name||s.metadata?.attendee_name||null,
        shipping_address:shipping?.address||null,updated_at:new Date().toISOString()
      }).eq('stripe_checkout_session_id',s.id).select('id,room_id,host_user_id,buyer_user_id,amount_total_cents,currency,customer_email').maybeSingle();
      if(order){
        const email=String(s.metadata?.attendee_email||order.customer_email||'').trim().toLowerCase();
        const name=String(s.metadata?.attendee_name||shipping?.name||s.customer_details?.name||'Guest').trim();
        if(email){
          const{data:existing}=await db.from('cut_room_contacts').select('id,visit_count').eq('host_user_id',order.host_user_id).eq('room_id',order.room_id).eq('email',email).maybeSingle();
          const payload={
            host_user_id:order.host_user_id,room_id:order.room_id,order_id:order.id,buyer_user_id:order.buyer_user_id||null,
            name,email,phone:s.metadata?.attendee_phone||null,email_marketing_opt_in:s.metadata?.email_marketing_opt_in==='1',
            sms_marketing_opt_in:s.metadata?.sms_marketing_opt_in==='1',amount_paid_cents:order.amount_total_cents,
            currency:order.currency||'usd',last_joined_at:new Date().toISOString(),updated_at:new Date().toISOString(),
            visit_count:(existing?.visit_count||0)+1
          };
          if(existing)await db.from('cut_room_contacts').update(payload).eq('id',existing.id);
          else await db.from('cut_room_contacts').insert(payload);
        }
      }
    }
    if(event.type==='checkout.session.async_payment_failed'){
      const s=event.data.object;
      await db.from('cut_premium_orders').update({payment_status:'failed',access_granted:false,updated_at:new Date().toISOString()}).eq('stripe_checkout_session_id',s.id);
    }
    if(event.type==='charge.refunded'){
      const c=event.data.object;
      if(c.payment_intent)await db.from('cut_premium_orders').update({payment_status:'refunded',access_granted:false,updated_at:new Date().toISOString()}).eq('stripe_payment_intent_id',c.payment_intent);
    }
    return NextResponse.json({received:true});
  }catch(e:any){return NextResponse.json({error:e.message||'Webhook rejected'},{status:400})}
}
