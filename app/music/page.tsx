import type {Metadata} from 'next';
import CategoryPage from '../CategoryPage';
export const revalidate=0;
export const metadata:Metadata={title:'Music',description:'Artists, releases, performances, industry moves and the sounds shaping culture.',alternates:{canonical:'/music'}};
export default function MusicPage(){return <CategoryPage category="music" title="Music" description="Artists, releases, performances, industry moves and the sounds shaping culture."/>}
