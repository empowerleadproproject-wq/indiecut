import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { getAuthenticatedRewardsUser } from '../../../../lib/rewards/server';

export const runtime='nodejs';

export async function GET(){
  const user=await getAuthenticatedRewardsUser();
  if(!user)return NextResponse.json({error:'Not signed in.'},{status:401});

  const admin=createAdminClient();
  const {data:profile,error}=await admin.from('reward_profiles')
    .select('id,status,phone_last4,phone_verified_at,age_attested_at,terms_version,terms_accepted_at,privacy_version,privacy_accepted_at,created_at,updated_at')
    .eq('user_id',user.id)
    .maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:500});

  return NextResponse.json({
    user:{
      id:user.id,
      email:user.email||'',
      emailConfirmed:Boolean(user.email_confirmed_at)
    },
    profile:profile||null
  });
}
