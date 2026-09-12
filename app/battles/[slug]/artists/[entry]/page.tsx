import { notFound } from 'next/navigation';
import PublicHeader from '../../../../PublicHeader';
import PublicFooter from '../../../../PublicFooter';
import { getBattleBySlug,isQualificationOpen,serializeBattle } from '../../../../../lib/battles';
import ArtistVoteClient from './ArtistVoteClient';
import PremiumAudioPlayer from './PremiumAudioPlayer';
import BattleProfileAds from './BattleProfileAds';
import styles from './ArtistProfile.module.css';

export const dynamic='force-dynamic';
export const revalidate=0;

export async function generateMetadata({params}:{params:{slug:string;entry:string}}){
 const raw=await getBattleBySlug(params.slug);const artist=raw.entries.find((x:any)=>x.slug===params.entry);
 if(!raw.contest||!artist)return {title:'Indie Cut Artist'};
 return {title:`Vote for ${artist.artist_name} | Indie Cut Live`,description:`Hear ${artist.artist_name} and vote in ${raw.contest.title}.`,openGraph:{title:`Vote for ${artist.artist_name}`,description:`Help ${artist.artist_name} advance on Indie Cut Live.`,images:artist.image_url?[artist.image_url]:undefined}};
}

export default async function ArtistBattleProfile({params}:{params:{slug:string;entry:string}}){
 const raw=await getBattleBySlug(params.slug);if(!raw.contest||raw.contest.status==='draft')notFound();
 const data=serializeBattle(raw);const artist=data.entries.find((x:any)=>x.slug===params.entry);if(!artist)notFound();
 const rank=data.entries.findIndex((x:any)=>x.id===artist.id)+1;const open=isQualificationOpen(raw.contest);const voteCount=Number(artist.vote_count||0);
 return <main className={styles.page}>
  <PublicHeader/>
  <div className={styles.wrap}>
   <a className={styles.back} href={`/battles/${params.slug}`}>← BACK TO {raw.contest.title.toUpperCase()}</a>
   <section className={styles.hero}>
    <div className={styles.photoFrame}>{artist.image_url?<img src={artist.image_url} alt={artist.artist_name}/>:<div className={styles.photoFallback}>INDIE CUT ARTIST</div>}</div>
    <div className={styles.content}>
     <div className={styles.kicker}>INDIE CUT ARTIST SPOTLIGHT</div>
     <h1 className={styles.name}>{artist.artist_name}</h1>
     <div className={styles.meta}>{artist.genre&&<span>{artist.genre}</span>}{artist.city&&<span>{artist.city}</span>}<span>Phase One</span></div>
     {artist.bio&&<p className={styles.bio}>{artist.bio}</p>}
     <div className={styles.trackBlock}>
      <span className={styles.overline}>NOW PLAYING</span>
      <h2 className={styles.trackTitle}>{artist.track_title||'Submitted track'}</h2>
      {artist.track_url?<PremiumAudioPlayer src={artist.track_url}/>:<p className={styles.bio}>Audio preview unavailable.</p>}
     </div>
     <ArtistVoteClient battleSlug={params.slug} entryId={artist.id} artistName={artist.artist_name} votingOpen={open} initialVotes={voteCount} rank={rank}/>
    </div>
   </section>
   <div className={styles.ads}><div className={styles.adDivider}>ADVERTISEMENT</div><BattleProfileAds/></div>
  </div>
  <PublicFooter/>
 </main>
}
