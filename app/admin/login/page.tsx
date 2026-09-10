import Link from 'next/link';
import {Suspense} from 'react';
import LoginForm from './LoginForm';

export const dynamic='force-dynamic';

export default function AdminLoginPage(){
 return <main className="admin"><Suspense fallback={<div className="panel" style={{maxWidth:520,margin:'48px auto'}}>Loading sign in…</div>}><LoginForm/></Suspense><div style={{textAlign:'center'}}><Link href="/">← Back to Indie Cut</Link></div></main>
}
