export type VisitorGeo={country:string;region:string;city:string;postalCode:string;latitude:number|null;longitude:number|null};
type HeaderLike={get:(name:string)=>string|null};

function clean(v:any){return String(v||'').trim()}
function upper(v:any){return clean(v).toUpperCase()}
function numberOrNull(v:any){const n=Number(v);return Number.isFinite(n)?n:null}
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

export function isLocalTarget(row:any){return String(row?.target_mode||'global').toLowerCase()==='local'}

function milesBetween(lat1:number,lon1:number,lat2:number,lon2:number){
 const r=3958.7613;
 const toRad=(d:number)=>d*Math.PI/180;
 const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
 const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
 return r*(2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}

export function audienceMatches(row:any,geo:VisitorGeo){
 if(!isLocalTarget(row))return true;
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

export function audienceLabel(row:any){
 if(!isLocalTarget(row))return 'Global';
 const place=[clean(row?.target_zip),clean(row?.target_city),upper(row?.target_region)].filter(Boolean).join(' · ');
 return `${place||'Local'} +${Math.max(1,Number(row?.radius_miles)||20)} mi`;
}

export function sortLocalFirst<T extends Record<string,any>>(rows:T[]){
 return [...rows].sort((a,b)=>Number(isLocalTarget(b))-Number(isLocalTarget(a)));
}
