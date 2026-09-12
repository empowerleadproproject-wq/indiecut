import PublicHeader from '../../PublicHeader';
import PublicFooter from '../../PublicFooter';
import {battleDb} from '../../../lib/battles';
import SubmissionForm from './SubmissionForm';
import styles from '../battles.module.css';

export const dynamic='force-dynamic';
export const revalidate=0;

async function isOpen(){const db=battleDb();const {data}=await db.from('site_settings').select('setting_value').eq('setting_key','admin_battle_landing').maybeSingle();try{return JSON.parse(data?.setting_value||'{}')?.submission_open!==false}catch{return true}}

export default async function SubmitMusicPage(){const open=await isOpen();return <main className={styles.landingPage}><PublicHeader/><div className={styles.submitShell}><a className={styles.submitBack} href="/battles">← LIVE BATTLES</a><header className={styles.submitHero}><div className={styles.landingKicker}>INDIE CUT LIVE BATTLES</div><h1>ENTER PHASE ONE.</h1><p>Submit the song you want Indie Cut to consider. Every submission is reviewed first. If your music is approved, your Phase One fan-voting profile goes live and you receive a shareable link to send to your fans.</p></header><SubmissionForm open={open}/><aside className={styles.phaseNote}><strong>HOW IT WORKS</strong><p><b>1.</b> Upload your song and contact information. <b>2.</b> Indie Cut listens and reviews your submission. <b>3.</b> Approved artists get a public voting profile and shareable fan link. <b>4.</b> Fan voting determines who advances toward the live Indie Battle Room.</p></aside></div><PublicFooter/></main>}
