import type {Metadata} from 'next';
import PublicHeader from '../../PublicHeader';
import PublicFooter from '../../PublicFooter';
import RewardsActivationForm from './RewardsActivationForm';

export const metadata:Metadata={title:'Activate Watch & Earn',robots:{index:false,follow:false}};

export default function RewardsActivationPage(){
  return <main className="rewards-page"><PublicHeader/><section className="rewards-auth-wrap"><RewardsActivationForm/></section><PublicFooter/></main>;
}
