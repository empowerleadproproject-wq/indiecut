import { notFound } from 'next/navigation';
import PublicHeader from '../../../../PublicHeader';
import PublicFooter from '../../../../PublicFooter';
import { getBattleBySlug,isQualificationOpen,serializeBattle } from '../../../../../lib/battles';
import ArtistVoteClient from './ArtistVoteClient';
import styles from '../../../battles.module.css';

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
 const rank=data.entries.findIndex((x:any)=>x.id===artist.id)+1;const open=isQualificationOpen(raw.contest);
 return <main className={styles.page}><PublicHeader/><div className={styles.shell}>
  <a className={styles.back} href={`/battles/${params.slug}`}>← {raw.contest.title}</a>
  <section className={styles.profile}><div className={styles.profileArt}>{artist.image_url?<img src={artist.image_url} alt={artist.artist_name}/>:null}</div><div className={styles.profileInfo}><div className={styles.eyebrow}>INDIE CUT ARTIST SPOTLIGHT · CURRENT RANK #{rank}</div><h1>{artist.artist_name}</h1><div className={styles.meta}>{artist.genre&&<span>{artist.genre}</span>}{artist.city&&<span>{artist.city}</span>}<span>{artist.vote_count} fan votes</span></div>{artist.bio&&<p>{artist.bio}</p>}{artist.track_title&&<h2>{artist.track_title}</h2>}{artist.track_url&&<audio className={styles.audio} controls preload="metadata" src={artist.track_url}/>}<p><strong>Fans:</strong> share this page directly. Indie Cut counts one qualifying vote per device and internet connection to keep the competition fair.</p><ArtistVoteClient battleSlug={params.slug} entryId={artist.id} artistName={artist.artist_name} votingOpen={open}/></div></section>
 </div><PublicFooter/></main>
}
