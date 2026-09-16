import type {Metadata} from 'next';
import CategoryPage from '../CategoryPage';
export const revalidate=0;
export const metadata:Metadata={title:'TV',description:'Television, streaming, series news, casting and standout performances.',alternates:{canonical:'/tv'}};
export default function TVPage(){return <CategoryPage category="tv" title="TV" description="Television, streaming, series news, casting and standout performances."/>}
