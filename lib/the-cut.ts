export type CutRole='host'|'cohost'|'speaker'|'listener';

export type CutParticipantMeta={
  userId?:string;
  displayName:string;
  avatarUrl?:string|null;
  headline?:string|null;
  industryRole?:string|null;
  role:CutRole;
  authenticated:boolean;
};

export function cutRoomName(roomId:string){
  return `cut_${roomId.replace(/-/g,'')}`;
}

export function cutIdentity(userId:string){
  return `user-${userId}`;
}

export function makeCutSlug(title:string){
  const base=title.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,54)||'the-cut';
  return `${base}-${Math.random().toString(36).slice(2,8)}`;
}

export function safeParticipantMeta(value?:string|null):CutParticipantMeta{
  try{
    const parsed=JSON.parse(value||'{}');
    return {
      userId:parsed.userId,
      displayName:String(parsed.displayName||parsed.name||'Guest'),
      avatarUrl:parsed.avatarUrl||null,
      headline:parsed.headline||null,
      industryRole:parsed.industryRole||null,
      role:(['host','cohost','speaker','listener'].includes(parsed.role)?parsed.role:'listener') as CutRole,
      authenticated:Boolean(parsed.authenticated)
    };
  }catch{
    return {displayName:'Guest',role:'listener',authenticated:false};
  }
}
