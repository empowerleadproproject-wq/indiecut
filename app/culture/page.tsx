import type {Metadata} from 'next';
import CategoryPage from '../CategoryPage';
export const revalidate=0;
export const metadata:Metadata={title:'Culture',description:'The people, moments and conversations shaping entertainment and culture.',alternates:{canonical:'/culture'}};
export default function CulturePage(){return <CategoryPage category="culture" title="Culture" description="The people, moments and conversations shaping entertainment and culture."/>}
