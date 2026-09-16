export type VisitorGeo={country:string;region:string;city:string;postalCode:string;latitude:number|null;longitude:number|null};
export type AdTargetMode='global'|'local'|'both';
type HeaderLike={get:(name:string)=>string|null};

function clean(v:any){return String(v||'').trim()}
function upper(v:any){return clean(v).toUpperCase()}
function numberOrNull(v:any){const s=clean(v);if(!s)return null;const n=Number(s);return Number.isFinite(n)?n:null}
function decodeCity(v:string){try{return decodeURIComponent(v)}catch{return v}}

export function visitorGeoFromHeaders(h:HeaderLike):VisitorGeo{
 return {
  country:upper(h.get('x-vercel-ip-country')),
  region:upper(h.get('x-vercel-ip-country-region')),
  city:decodeCity(clean(h.get('x-vercel-ip-city'))),
  postalCode:clean(h.get('x-vercel-ip-postal-code')),
  latitude:numberOrNull(h.get('x-vercel-ip-latitude')),
  longitude:numberOrNull(h.get('x-vercel-ip-longitude'))
 };
}
export function visitorGeo(request:Request):VisitorGeo{return visitorGeoFromHeaders(request.headers)}

export function targetMode(row:any):AdTargetMode{
 const value=String(row?.target_mode||'global').toLowerCase();
 return value==='local'||value==='both'?value:'global';
}

export function isLocalTarget(row:any){const mode=targetMode(row);return mode==='local'||mode==='both'}

function milesBetween(lat1:number,lon1:number,lat2:number,lon2:number){
 const r=3958.7613;
 const toRad=(d:number)=>d*Math.PI/180;
 const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
 const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
 return r*(2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}

export function localAreaMatches(row:any,geo:VisitorGeo){
 const radius=Math.max(1,Number(row?.radius_miles)||20);
 const targetLat=numberOrNull(row?.target_latitude),targetLon=numberOrNull(row?.target_longitude);
 if(targetLat!==null&&targetLon!==null&&geo.latitude!==null&&geo.longitude!==null){
  return milesBetween(targetLat,targetLon,geo.latitude,geo.longitude)<=radius;
 }
 const targetZip=clean(row?.target_zip);
 if(targetZip&&geo.postalCode)return targetZip===geo.postalCode;
 const targetRegion=upper(row?.target_region),targetCity=clean(row?.target_city).toLowerCase();
 if(targetCity&&geo.city)return targetCity===geo.city.toLowerCase()&&(!targetRegion||targetRegion===geo.region);
 if(targetRegion&&geo.region)return targetRegion===geo.region;
 return false;
}

export function audienceMatches(row:any,geo:VisitorGeo){
 const mode=targetMode(row);
 if(mode==='global'||mode==='both')return true;
 return localAreaMatches(row,geo);
}

export function effectiveAudienceScope(row:any,geo:VisitorGeo):'local'|'global'{
 const mode=targetMode(row);
 if(mode==='local')return 'local';
 if(mode==='both'&&localAreaMatches(row,geo))return 'local';
 return 'global';
}

export function audienceLabel(row:any){
 const mode=targetMode(row);
 if(mode==='global')return 'Global';
 const place=[clean(row?.target_city),upper(row?.target_region),clean(row?.target_zip)].filter(Boolean).join(' · ');
 const local=`${place||'Local'} · ${Math.max(1,Number(row?.radius_miles)||20)} mi`;
 return mode==='both'?`Both — global + local priority (${local})`:`Local — ${local}`;
}

export function sortLocalFirst<T extends Record<string,any>>(rows:T[],geo?:VisitorGeo){
 const score=(row:T)=>{
  if(geo)return effectiveAudienceScope(row,geo)==='local'?1:0;
  const mode=targetMode(row);return mode==='local'?2:mode==='both'?1:0;
 };
 return [...rows].sort((a,b)=>score(b)-score(a));
}
