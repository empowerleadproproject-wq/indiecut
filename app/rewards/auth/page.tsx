import type {Metadata} from 'next';
import PublicHeader from '../../PublicHeader';
import PublicFooter from '../../PublicFooter';
import RewardsAuthForm from './RewardsAuthForm';

export const metadata:Metadata={title:'Rewards Sign In',robots:{index:false,follow:false}};

export default function RewardsAuthPage(){
  return <main className="rewards-page"><PublicHeader/><section className="rewards-auth-wrap"><RewardsAuthForm/></section><PublicFooter/></main>;
}
