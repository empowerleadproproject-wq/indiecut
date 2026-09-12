'use client';
import styles from './AutomationBuilder.module.css';

const TRIGGERS={
 'Contact':['Birthday Reminder','Contact Changed','Contact Created','Contact DND','Contact Tag','Custom Date Reminder','Note Added','Note Changed','Task Added','Task Reminder','Task Completed','Contact Engagement Score'],
 'Events':['Inbound Webhook','Scheduler','Call Details','Email Events','Customer Replied','Conversation AI Trigger','Custom Trigger','Form Submitted','Survey Submitted','Trigger Link Clicked','Facebook Lead Form Submitted','TikTok Form Submitted','Video Tracking','Number Validation','Messaging Error – SMS','LinkedIn Lead Form Submitted','Funnel / Website PageView','Quiz Submitted','New Review Received','Prospect Generated','Click To WhatsApp Ads','External Tracking Event'],
 'Appointments':['Appointment Status','Customer Booked Appointment','Service Booking','Rental Booking'],
 'Opportunities':['Opportunity Status Changed','Opportunity Created','Opportunity Changed','Pipeline Stage Changed','Stale Opportunities'],
 'Affiliate':['Affiliate Created','New Affiliate Sales','Affiliate Enrolled In Campaign','Affiliate Lead Created'],
 'Courses':['Category Started','Category Completed','Lesson Started','Lesson Completed','New Signup','Offer Access Granted','Offer Access Removed','Product Access Granted','Product Access Removed','Product Started','Product Completed','User Login'],
 'Payments':['Invoice','Payment Received','Order Form Submission','Order Submitted','Documents & Contracts','Estimates','Subscription','Refund','Coupon Code Applied','Coupon Redemption Limit Reached','Coupon Code Expired','Coupon Code Redeemed'],
 'Ecommerce Stores':['Shopify Abandoned Cart','Shopify Order Placed','Shopify Order Fulfilled','Order Fulfilled','Product Review Submitted','Abandoned Checkout'],
 'IVR':['Start IVR Trigger'],
 'Facebook / Instagram Events':['Facebook – Comments On A Post','Instagram – Comments On A Post'],
 'Communities':['Group Access Granted','Group Access Revoked','Private Channel Access Granted','Private Channel Access Revoked','Community Group Member Leaderboard Level Changed'],
 'Certificates':['Certificate Issued'],
 'Communication':['TikTok – Comments On A Video','Transcript Generated'],
 'Google Ads':['Google Lead Form Submitted'],
 'Indie Cut':['Battle Submission Received','Battle Submission Approved','Battle Submission Rejected','Vote Received','Artist Advanced','Battle Started','Battle Ended','Winner Selected']
};
const ACTIONS={
 'Contact Actions':['Create Contact','Find Contact','Update Contact Field','Add Contact Tag','Remove Contact Tag','Assign to User','Remove Assigned User','Edit Conversation','Disable / Enable DND','Add Note','Add Task','Copy Contact','Delete Contact','Modify Contact Engagement Score','Add / Remove Contact Followers'],
 'Communication Actions':['Send Email','Send SMS','Send Slack Message','Call','Messenger','Instagram DM','Manual Action','GMB Messaging','Send Internal Notification','Send Review Request','Conversation AI','Facebook Interactive Messenger','Instagram Interactive Messenger','Reply in Comments','WhatsApp','Send Live Chat Message'],
 'Send Data':['Webhook / Custom Webhook','Google Sheets'],
 'Internal Tools':['If / Else','Wait Step','Goal Event','Split','Update Custom Value','Go To','Remove from Workflow','Arrays','Drip Mode','Text Formatter','Custom Code'],
 'Workflow AI':['AI Prompt','AI Agent','AI Decision Maker','AI Intent Detection','AI Summarize','AI Translate','AI Extract Data','AI Image Generation','AI Analyze Image','Update Conversation AI Bot and Status','Invoke Agent Studio Agent'],
 'Appointments':['Update Appointment Status','Generate One Time Booking Link'],
 'Opportunities':['Create / Update Opportunity','Remove Opportunity'],
 'Payments':['Stripe One-Time Charge','Send Invoice','Send Documents and Contracts'],
 'Marketing':['Add to Google Analytics','Add to Google Ads','Add to Custom Audience (Facebook)','Remove from Custom Audience (Facebook)','Facebook Conversion API'],
 'Affiliate':['Add to Affiliate Manager','Update Affiliate','Add / Remove from Affiliate Campaign'],
 'Courses':['Course Grant Offer','Course Revoke Offer'],
 'IVR':['Gather Input on Call','Play Message','Connect to Call','End Call','Record Voicemail'],
 'Communities':['Grant Group Access','Revoke Group Access'],
 'Indie Cut Core':['Stop Workflow','Add to Workflow','Remove Tag','Update Status','Wait Until','Internal Email Notification','Outbound Webhook']
};

const LIVE=new Set(['Contact Changed','Contact Created','Contact Tag','Inbound Webhook','Scheduler','Customer Replied','Form Submitted','Payment Received','Refund','Send Email','Send SMS','Send Internal Notification','Webhook / Custom Webhook','If / Else','Wait Step','Go To','Remove from Workflow','Update Contact Field','Add Contact Tag','Remove Contact Tag','Add Note','Add Task','AI Prompt','AI Intent Detection','AI Summarize','AI Translate','AI Extract Data','Battle Submission Received','Battle Submission Approved','Battle Submission Rejected','Vote Received','Artist Advanced','Battle Started','Battle Ended','Winner Selected','Stop Workflow','Add to Workflow','Remove Tag','Update Status','Wait Until','Internal Email Notification','Outbound Webhook']);

function Group({title,items}:{title:string;items:string[]}){return <div style={{marginBottom:18}}><div className={styles.sectionTitle}>{title}</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:8}}>{items.map(name=><div key={name} style={{border:'1px solid #e5e7eb',borderRadius:8,padding:'10px 12px',background:'#fff',display:'flex',gap:9,alignItems:'center'}}><span className={LIVE.has(name)?styles.dotOn:styles.dotOff}/><div><strong style={{fontSize:12}}>{name}</strong><div className={styles.tiny}>{LIVE.has(name)?'INDIE CUT ENGINE READY':'REQUIRES MATCHING MODULE / CONNECTION'}</div></div></div>)}</div></div>}
export default function WorkflowFullCatalog(){return <section className={styles.panel} style={{marginTop:22}}><h2 style={{marginTop:0}}>Complete Workflow Capability Library</h2><p className={styles.muted}>This is the full HighLevel-style workflow surface we are tracking inside Indie Cut. Green items are wired into Indie Cut now. Gray items stay visible until the matching calendar, payments, calling, courses, community, affiliate, social inbox or other module is connected—so there are no fake actions.</p><details><summary style={{cursor:'pointer',fontWeight:900,padding:'10px 0'}}>All Triggers</summary>{Object.entries(TRIGGERS).map(([k,v])=><Group key={k} title={k} items={v}/>)}</details><details style={{marginTop:8}}><summary style={{cursor:'pointer',fontWeight:900,padding:'10px 0'}}>All Actions</summary>{Object.entries(ACTIONS).map(([k,v])=><Group key={k} title={k} items={v}/>)}</details></section>}
