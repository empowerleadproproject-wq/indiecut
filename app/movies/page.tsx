import type {Metadata} from 'next';
import CategoryPage from '../CategoryPage';
export const revalidate=0;
export const metadata:Metadata={title:'Movies',description:'Film news, casting, releases, reviews and the people shaping the movies.',alternates:{canonical:'/movies'}};
export default function MoviesPage(){return <CategoryPage category="movies" title="Movies" description="Film news, casting, releases, reviews and the people shaping the movies."/>}
