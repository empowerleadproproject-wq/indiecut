import PublicHeader from '../../PublicHeader';
import PublicFooter from '../../PublicFooter';
import CutAuthForm from './CutAuthForm';

export const dynamic='force-dynamic';

export default function CutSignIn({searchParams}:{searchParams:{next?:string;error?:string}}){
  const requested=String(searchParams?.next||'/the-cut/profile');
  const next=requested.startsWith('/the-cut')?requested:'/the-cut/profile';
  return <main className="cut-shell"><PublicHeader/><div className="cut-auth-wrap"><CutAuthForm next={next} confirmationError={searchParams?.error==='confirmation'}/></div><PublicFooter/></main>;
}
