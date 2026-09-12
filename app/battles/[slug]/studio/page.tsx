import StudioClient from './StudioClient';

export const dynamic='force-dynamic';
export const metadata={title:'Indie Cut Live Studio'};

export default function BattleStudioPage({params,searchParams}:{params:{slug:string};searchParams:{slot?:string;token?:string}}){
 return <StudioClient slug={params.slug} slot={String(searchParams.slot||'')} accessCode={String(searchParams.token||'')}/>;
}
