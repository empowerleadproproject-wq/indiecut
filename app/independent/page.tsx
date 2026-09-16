import type {Metadata} from 'next';
import CategoryPage from '../CategoryPage';
export const revalidate=0;
export const metadata:Metadata={title:'Independent',description:'Independent films, musicians, creators and emerging voices worth discovering.',alternates:{canonical:'/independent'}};
export default function IndependentPage(){return <CategoryPage category="independent" title="Independent" description="Independent films, musicians, creators and emerging voices worth discovering."/>}
