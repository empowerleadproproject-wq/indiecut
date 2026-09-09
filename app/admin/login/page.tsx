import Link from 'next/link';
import LoginForm from './LoginForm';

export default function AdminLoginPage(){
 return <main className="admin"><LoginForm/><div style={{textAlign:'center'}}><Link href="/">← Back to Indie Cut</Link></div></main>
}
