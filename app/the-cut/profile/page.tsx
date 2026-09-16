import {redirect} from 'next/navigation';
import PublicHeader from '../../PublicHeader';
import PublicFooter from '../../PublicFooter';
import {createClient} from '../../../lib/supabase/server';
import {createAdminClient} from '../../../lib/supabase/admin';
import CutProfileForm from './CutProfileForm';

export const dynamic='force-dynamic';

export default async function CutProfilePage(){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/the-cut/sign-in?next=/the-cut/profile');
  const admin=createAdminClient();
  const {data:profile}=await admin.from('cut_profiles').select('*').eq('id',user.id).maybeSingle();
  const initial=profile||{display_name:user.user_metadata?.display_name||user.email?.split('@')[0]||'',avatar_url:null,headline:'',industry_role:'Artist / Musician'};
  return <main className="cut-shell"><PublicHeader/><div className="cut-container"><CutProfileForm initial={initial}/></div><PublicFooter/></main>;
}
