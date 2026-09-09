export default function PublicHeader(){
 const links=[['/','HOME'],['/movies','MOVIES'],['/tv','TV'],['/music','MUSIC'],['/culture','CULTURE'],['/independent','INDEPENDENT'],['/articles','LATEST'],['/admin','BACK OFFICE']];
 return <header className="ic-public-header">
  <div className="ic-public-masthead">
   <a className="ic-public-brand" href="/">INDIE CUT</a>
   <details className="ic-mobile-menu">
    <summary aria-label="Open menu"><span></span><span></span><span></span></summary>
    <nav>{links.map(([href,label])=><a key={href} href={href}>{label}</a>)}</nav>
   </details>
  </div>
  <nav className="ic-public-nav">{links.map(([href,label])=><a key={href} href={href}>{label}</a>)}</nav>
 </header>
}
