import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import {createServer} from 'node:http';
import {WebSocketServer,WebSocket} from 'ws';
import {randomBytes,randomUUID,createHmac,createHash,timingSafeEqual,generateKeyPairSync} from 'node:crypto';
import {readFile,writeFile,mkdir,rename,unlink,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {RoomCreate,RoomJoin,WsMessage,ConsentPost,WithdrawPost,safeName,safeText} from '../../../packages/shared/src/index.js';
const app=express();app.disable('x-powered-by');
const PORT=Number(process.env.PORT||3001);
const origins=[...(process.env.ALLOWED_ORIGINS||'http://localhost:5173,http://127.0.0.1:5173').split(','),process.env.RENDER_EXTERNAL_URL||''].map(x=>x.trim()).filter(Boolean);
const isHosted=process.env.NODE_ENV==='production';
// Research contribution storage is intentionally OFF in hosted hackathon demos.
// Persistent, access-controlled storage and withdrawal assurance require a separate review.
const researchEnabled=!isHosted && process.env.DISABLE_RESEARCH_COLLECTION!=='true';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../data');await mkdir(base,{recursive:true});
const recordsFile=path.join(base,'receipts.json');const contributions=path.join(base,'contributions');await mkdir(contributions,{recursive:true});
let receipts=[];try{receipts=JSON.parse(await readFile(recordsFile,'utf8'));if(!Array.isArray(receipts))receipts=[];}catch{}
const secret=process.env.RECEIPT_SECRET||randomBytes(32).toString('hex');if(!process.env.RECEIPT_SECRET)console.warn('Development: transient signing secret; configure RECEIPT_SECRET in deployment.');
const keyfile=path.join(base,'private-key.pem'), pubfile=path.join(base,'public-key.pem');
let keys;try{keys={privateKey:await readFile(keyfile,'utf8'),publicKey:await readFile(pubfile,'utf8')};}catch{keys=generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});await writeFile(keyfile,keys.privateKey,{mode:0o600});await writeFile(pubfile,keys.publicKey,{mode:0o644});}
const publicJwk=(await import('node:crypto')).createPublicKey(keys.publicKey).export({format:'jwk'});
const sign=s=>createHmac('sha256',secret).update(s).digest('base64url');
const token=(payload)=>{const v=Buffer.from(JSON.stringify({...payload,exp:Date.now()+30*60*1000})).toString('base64url');return v+'.'+sign(v);};
function verify(t){if(typeof t!=='string'||t.length>2000)return null;const [v,s]=t.split('.');if(!v||!s)return null;const expected=sign(v);if(s.length!==expected.length||!timingSafeEqual(Buffer.from(s),Buffer.from(expected)))return null;try{const p=JSON.parse(Buffer.from(v,'base64url').toString());return p.exp>Date.now()?p:null;}catch{return null;}}
async function save(){const temp=recordsFile+'.tmp';await writeFile(temp,JSON.stringify(receipts,null,2));await rename(temp,recordsFile);}
app.use(helmet({contentSecurityPolicy:false,crossOriginResourcePolicy:{policy:'same-site'}}));
// CSP for production assets allows the exact external origins required for first-time MediaPipe model loads.
// Local Vite development continues using its existing HMR headers.
if(isHosted)app.use((req,res,next)=>{if(!req.path.startsWith('/api/'))res.set('Content-Security-Policy',["default-src 'self'","script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net","style-src 'self' 'unsafe-inline'","connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com wss:","img-src 'self' blob: data:","font-src 'self' data:","worker-src 'self' blob:","media-src 'self' blob:","object-src 'none'","base-uri 'self'","frame-ancestors 'none'"].join('; '));next();});
app.use('/api',helmet.contentSecurityPolicy({directives:{defaultSrc:["'none'"],frameAncestors:["'none'"]}}));
app.use(cors({origin:(origin,cb)=>cb(null,!origin||origins.includes(origin)),methods:['GET','POST','DELETE']}));
app.use(express.json({limit:'7mb',strict:true}));
app.use('/api',rateLimit({windowMs:60_000,limit:90,standardHeaders:'draft-7',legacyHeaders:false}));
const rooms=new Map();const publicMember=p=>({id:p.id,name:p.name,ready:p.ready,photoConsent:p.photoConsent,consent:p.consent,pose:p.pose,answer:p.answer,voted:p.voted});
const state=r=>({code:r.code,mode:r.mode,track:r.track,leader:r.leader,members:[...r.members.values()].map(publicMember),question:r.question,poll:r.poll,votes:r.votes,round:r.round,matched:r.matched,created:r.created});
const noCache=(req,res,next)=>{res.set('Cache-Control','no-store');next()};app.use('/api',noCache);
app.get('/api/health',(_,res)=>res.json({ok:true,product:'Avatar Forge',version:'1.0.0'}));
app.get('/api/capabilities',(_,res)=>res.json({rooms:true,researchContributions:researchEnabled,mode:isHosted?'hosted-demo':'local-development'}));
app.get('/api/public-key',(_,res)=>res.json({key:publicJwk}));
function bad(res,error,status=400){res.status(status).json({error});}
function parse(schema,body,res){const out=schema.safeParse(body);if(!out.success){bad(res,'Invalid request');return null;}return out.data;}
function touch(r){r.last=Date.now();}
function makeCode(){let code;do{code=randomBytes(8).toString('base64url').replace(/[-_]/g,'A').toUpperCase().slice(0,10);}while(rooms.has(code));return code;}
app.post('/api/rooms',(req,res)=>{const v=parse(RoomCreate,req.body,res);if(!v)return;const code=makeCode(),id=randomUUID();const r={code,mode:v.mode,track:safeText(v.track||'Best Duos'),leader:id,members:new Map(),created:Date.now(),last:Date.now(),question:0,poll:'Funniest',round:0,matched:0,votes:{}};
 r.members.set(id,{id,name:safeName(v.name),ready:false,photoConsent:v.photoConsent,consent:v.consent,answer:null,voted:null,pose:{yaw:0,progress:0},sockets:new Set()});rooms.set(code,r);res.status(201).json({code,id,token:token({code,id}),state:state(r)});});
app.get('/api/rooms/:code',(req,res)=>{const r=rooms.get(req.params.code.toUpperCase());if(!r)return bad(res,'Room unavailable',404);res.json({state:state(r)});});
app.post('/api/rooms/:code/join',(req,res)=>{const v=parse(RoomJoin,req.body,res),r=rooms.get(req.params.code.toUpperCase());if(!v)return;if(!r)return bad(res,'Room unavailable',404);if(r.members.size>=(r.mode==='duo'?2:6))return bad(res,'Room full',409);const id=randomUUID();r.members.set(id,{id,name:safeName(v.name),ready:false,photoConsent:v.photoConsent,consent:v.consent,answer:null,voted:null,pose:{yaw:0,progress:0},sockets:new Set()});touch(r);broadcast(r);res.status(201).json({code:r.code,id,token:token({code:r.code,id}),state:state(r)});});
app.post('/api/contribute',async(req,res)=>{if(!researchEnabled)return bad(res,'Research data collection is disabled in this public demo',403);const v=parse(ConsentPost,req.body,res);if(!v)return;if(!v.scope.includes('research'))return bad(res,'Research consent required');if(v.envelope.ciphertext.length>5_000_000)return bad(res,'Payload too large',413);const receiptId=randomUUID(),createdAt=new Date().toISOString();const rec={receiptId,scope:v.scope,createdAt,hash:v.hash,signature:sign(`${receiptId}.${createdAt}.${v.hash}`)};try{await writeFile(path.join(contributions,receiptId+'.json'),JSON.stringify(v.envelope),{flag:'wx'});receipts.push(rec);await save();res.status(201).json({receipt:rec});}catch{bad(res,'Could not store contribution',500);}});
app.post('/api/withdraw',async(req,res)=>{const v=parse(WithdrawPost,req.body,res);if(!v)return;const i=receipts.findIndex(r=>r.receiptId===v.receiptId);if(i<0)return bad(res,'Receipt not found',404);receipts.splice(i,1);await save();try{await unlink(path.join(contributions,v.receiptId+'.json'));}catch{}res.json({withdrawn:true,receiptId:v.receiptId});});
// One public URL for the React SPA, REST API and real-time WebSocket room events.
const webDist=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../web/dist');
if(isHosted){
  try{await access(path.join(webDist,'index.html'));}
  catch{console.error('Missing built frontend: run npm run build before npm start');process.exit(1);}
  app.use(express.static(webDist,{index:false,maxAge:'1h'}));
  app.get('*',(req,res)=>{if(req.path.startsWith('/api/'))return bad(res,'Unknown API endpoint',404);res.sendFile(path.join(webDist,'index.html'));});
}
const http=createServer(app);const wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
function broadcast(r){const payload=JSON.stringify({type:'room',state:state(r)});for(const member of r.members.values())for(const ws of member.sockets)if(ws.readyState===WebSocket.OPEN)ws.send(payload);}
http.on('upgrade',(request,socket,head)=>{const url=new URL(request.url||'/',`http://${request.headers.host||'localhost'}`);if(url.pathname!=='/ws'||!origins.includes(request.headers.origin||'')){socket.destroy();return;}wss.handleUpgrade(request,socket,head,ws=>wss.emit('connection',ws,request));});
wss.on('connection',ws=>{let r=null,member=null;ws.on('message',chunk=>{let payload;try{payload=JSON.parse(chunk.toString());}catch{ws.close(1003,'Bad JSON');return;}const valid=WsMessage.safeParse(payload);if(!valid.success){ws.send(JSON.stringify({type:'error',message:'Invalid message'}));return;}const v=valid.data;if(v.type==='hello'){const p=verify(v.token);if(!p||p.code!==v.room.toUpperCase()||!rooms.has(p.code)){ws.close(1008,'Invalid token');return;}r=rooms.get(p.code);member=r.members.get(p.id);if(!member){ws.close(1008,'Member missing');return;}member.sockets.add(ws);touch(r);broadcast(r);return;}
 if(!r||!member){ws.close(1008,'Authenticate first');return;}touch(r);
 switch(v.type){case 'ready':member.ready=v.value;break;case 'answer':member.answer={question:v.question,answer:v.answer,verified:v.verified};break;case 'pose':member.pose={yaw:v.yaw,progress:v.progress};break;case 'vote':if(r.mode!=='squad')return;member.voted=v.forId;r.votes[member.id]=v.forId;break;case 'poll':if(member.id!==r.leader)return; r.poll=safeText(v.question,80);r.round++;r.votes={};for(const m of r.members.values())m.voted=null;break;case 'report':ws.send(JSON.stringify({type:'notice',message:'Report received. You can leave this room at any time.'}));break;case 'advance':if(member.id!==r.leader||r.mode!=='duo'||r.question>=8)return;{const answers=[...r.members.values()].map(x=>x.answer).filter(x=>x?.question===r.question);if(answers.length===2&&answers[0].answer===answers[1].answer)r.matched++;r.question++;for(const x of r.members.values())x.answer=null;}break;case 'leave':member.sockets.delete(ws);r.members.delete(member.id);ws.close();break;}broadcast(r);
 });ws.on('close',()=>{if(member&&r){member.sockets.delete(ws);touch(r);broadcast(r);}});});
setInterval(()=>{const now=Date.now();for(const [code,r]of rooms)if(now-r.last>30*60_000){for(const m of r.members.values())for(const ws of m.sockets)ws.close(1001);rooms.delete(code);}},60_000).unref();
http.listen(PORT,'0.0.0.0',()=>console.info(`Avatar Forge ${isHosted?'hosted app':'API'} listening on port ${PORT}`));
