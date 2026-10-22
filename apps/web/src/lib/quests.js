/**
 * Local-only daily quests. No pictures, face measurements or server events are stored.
 * Captures count only when an existing live-capture quality gate succeeds.
 * Quiz answers may use the accessibility fallback and earn the same rewards.
 */
const baseKey = 'af-daily-quests-v1';
const key = () => { const uid=localStorage.getItem('af-active-user-id');return uid?`${baseKey}:${uid}`:baseKey;};
export const DAILY_QUESTS = Object.freeze([
  {id:'angle',kind:'capture',emoji:'📸',title:'The First Shard',detail:'Capture one real head angle',goal:1,reward:60,href:'/capture',action:'Capture an angle'},
  {id:'choices',kind:'answer',emoji:'🎮',title:'Decision Dynamo',detail:'Answer 3 game questions — head turns or accessible tapping',goal:3,reward:45,href:'/solo',action:'Play a quiz'},
  {id:'postcard',kind:'export',emoji:'🌍',title:'Postcard Collector',detail:'Export one destination postcard',goal:1,reward:55,href:'/cards',action:'Make a postcard'}
]);
const blank = (day) => ({day, counts:{capture:0,answer:0,export:0},claimed:[],lastDay:'',streak:0});
export function localDay(now=new Date()){
  const n=now instanceof Date?now:new Date(now);
  const yyyy=n.getFullYear(),mm=String(n.getMonth()+1).padStart(2,'0'),dd=String(n.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
export function readDaily(now=new Date()){
  const day=localDay(now);
  let old={};
  try{old=JSON.parse(localStorage.getItem(key())||'{}')||{};}catch{old={};}
  if(typeof old!=='object'||Array.isArray(old))old={};
  const source=old;
  const lastDay=typeof source.lastDay==='string'?source.lastDay:'';
  const previousStreak=Number.isFinite(source.streak)?Math.max(0,Math.min(9999,Math.floor(source.streak))):0;
  const yesterday=new Date(now.getFullYear(),now.getMonth(),now.getDate()-1);
  const isNewVisit=lastDay!==day;
  const streak=isNewVisit?(lastDay===localDay(yesterday)?previousStreak+1:1):Math.max(1,previousStreak);
  const fresh=source.day!==day;
  const counts=fresh?blank(day).counts:{
    capture:positive(source.counts?.capture),answer:positive(source.counts?.answer),export:positive(source.counts?.export)
  };
  const claimed=fresh?[]:Array.isArray(source.claimed)?source.claimed.filter(x=>DAILY_QUESTS.some(q=>q.id===x)):[];
  return {day,counts,claimed,lastDay:day,streak};
}
function positive(n){return Number.isFinite(n)?Math.max(0,Math.min(999,Math.floor(n))):0;}
function save(state){localStorage.setItem(key(),JSON.stringify(state));window.dispatchEvent(new Event('af-quests-changed'));return state;}
export function visitDaily(now=new Date()){
  const next=readDaily(now);
  save(next);
  return next;
}
export function progressDaily(kind,now=new Date()){
  if(!DAILY_QUESTS.some(q=>q.kind===kind))return readDaily(now);
  const state=readDaily(now);
  state.counts[kind]=Math.min(999,state.counts[kind]+1);
  return save(state);
}
/** Returns true exactly when the user has completed and claimed this quest for today. */
export function claimDaily(id,now=new Date()){
  const quest=DAILY_QUESTS.find(q=>q.id===id);
  if(!quest)return false;
  const state=readDaily(now);
  if(state.claimed.includes(id)||state.counts[quest.kind]<quest.goal)return false;
  state.claimed.push(id);
  save(state);
  return true;
}
