import PublicHeader from '../../PublicHeader';
import PublicFooter from '../../PublicFooter';
import {battleDb} from '../../../lib/battles';
import SubmissionForm from './SubmissionForm';
import styles from '../battles.module.css';

export const dynamic='force-dynamic';
export const revalidate=0;

async function isOpen(){const db=battleDb();const {data}=await db.from('site_settings').select('setting_value').eq('setting_key','admin_battle_landing').maybeSingle();try{return JSON.parse(data?.setting_value||'{}')?.submission_open!==false}catch{return true}}

export default async function SubmitMusicPage(){const open=await isOpen();return <main className={styles.landingPage}><PublicHeader/><div className={styles.submitShell}><a className={styles.submitBack} href="/battles">← LIVE BATTLES</a><header className={styles.submitHero}><div className={styles.landingKicker}>INDIE CUT LIVE BATTLES</div><h1>ENTER PHASE ONE.</h1><p>Submit the song you want to put in front of the Indie Cut audience. Selected artists receive a shareable fan-voting profile and a shot at advancing to the live Battle Room.</p></header><SubmissionForm open={open}/><aside className={styles.phaseNote}><strong>WHAT HAPPENS NEXT</strong><p>Indie Cut reviews your submission. If accepted, your artist page goes live for Phase One fan voting. The qualifying artists advance to the live head-to-head battle.</p></aside></div><PublicFooter/></main>}
