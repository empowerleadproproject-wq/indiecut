import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { isAdminEmail } from '../../lib/admin';
import AdminClient from './AdminClient';

export const dynamic='force-dynamic';

export default async function AdminPage(){
 const supabase=createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/admin/login');
 if(!isAdminEmail(user.email))redirect('/admin/login?error=unauthorized');
 return <AdminClient/>;
}
