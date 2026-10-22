import {sceneSVG,SCENES,EXPORT_PRESETS} from '@avatar/shared';
import {segmenter} from './face';
export type Shot={id:string;target:string;image:string;full:string;quality:number;angles:{yaw:number;pitch:number;roll:number};timestamp:string;consentScope:string};
const loadImage=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});
export async function photoFromVideo(video:HTMLVideoElement,faceBox?:{x:number;y:number;w:number;h:number}){const c=document.createElement('canvas');c.width=720;c.height=900;const ctx=c.getContext('2d')!;const scale=Math.max(c.width/video.videoWidth,c.height/video.videoHeight);ctx.save();ctx.translate(c.width,0);ctx.scale(-1,1);ctx.drawImage(video,(c.width-video.videoWidth*scale)/2,(c.height-video.videoHeight*scale)/2,video.videoWidth*scale,video.videoHeight*scale);ctx.restore();const full=c.toDataURL('image/webp',.86);const crop=document.createElement('canvas');crop.width=400;crop.height=480;const cf=crop.getContext('2d')!;if(faceBox){const x=Math.max(0,Math.floor((1-faceBox.x-faceBox.w)*720-80)),y=Math.max(0,Math.floor(faceBox.y*900-85)),w=Math.min(720-x,Math.round(faceBox.w*720+160)),h=Math.min(900-y,Math.round(faceBox.h*900+170));cf.drawImage(c,x,y,w,h,0,0,400,480);}else{cf.drawImage(c,0,0,720,900,0,0,400,480);}return {full,image:crop.toDataURL('image/webp',.85)};}
/** Offline, purely local cutout when the input photo has a plain backdrop.
 * Flood-fill only pixels connected to the edges and close to the top-corner background.
 * For complex backgrounds, return null and use the honest soft-oval fallback instead. */
function plainBackgroundCutout(image:HTMLImageElement):HTMLCanvasElement|null{
 const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
 const ctx=c.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
 ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,c.width,c.height),d=data.data,w=c.width,h=c.height;
 const color=(x:number,y:number)=>{const i=(y*w+x)*4;return [d[i],d[i+1],d[i+2]];};
 const bg1=color(2,2),bg2=color(w-3,2);
 if(bg1.some((v,i)=>Math.abs(v-bg2[i])>34))return null;
 const bg=bg1.map((v,i)=>(v+bg2[i])/2);
 const diff=(pixel:number)=>Math.max(Math.abs(d[pixel]-bg[0]),Math.abs(d[pixel+1]-bg[1]),Math.abs(d[pixel+2]-bg[2]));
 const size=w*h,seen=new Uint8Array(size),queue=new Uint32Array(size);let head=0,tail=0;
 const add=(n:number)=>{if(n<0||n>=size||seen[n])return;seen[n]=1;if(diff(n*4)<65)queue[tail++]=n;};
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}
 for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
 while(head<tail){const n=queue[head++],i=n*4,delta=diff(i);
  d[i+3]=Math.min(d[i+3],Math.max(0,Math.min(255,Math.round((delta-25)*7.5))));
  const x=n%w,y=(n/w)|0;if(x>0)add(n-1);if(x<w-1)add(n+1);if(y>0)add(n-w);if(y<h-1)add(n+w);
 }
 // A plain backdrop should occupy a meaningful amount of the input image.
 if(tail<size*.03)return null;
 ctx.putImageData(data,0,0);return c;
}
async function personMask(image:HTMLImageElement){try{// The online segmentation model must never indefinitely block artwork generation.
 // If it cannot load promptly (offline / slow Render-style network / blocked CDN),
 // use the local portrait matte fallback below. No photo is uploaded.
 const m=await Promise.race([
  segmenter(),
  new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('Segmentation timed out; use local fallback')),3200))
 ]);const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);const result=m.segment(image);const mask=result.categoryMask;if(!mask)throw new Error('No segmentation output');const weights=mask.getAsUint8Array();const mw=mask.width,mh=mask.height;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const mx=Math.min(mw-1,Math.floor(x*mw/canvas.width)),my=Math.min(mh-1,Math.floor(y*mh/canvas.height)),v=weights[my*mw+mx]; // Selfie segmenter: category 1 is person.
 pixels.data[(y*canvas.width+x)*4+3]=v===1?255:0;}ctx.putImageData(pixels,0,0);mask.close();result.close();return canvas;}catch{ // Offline fallback: softened portrait matte, clearly not a true person segmentation.
 const cutout=plainBackgroundCutout(image);if(cutout)return cutout;const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,c.width,c.height),cx=c.width/2,cy=c.height*.49;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const dist=((x-cx)/(c.width*.43))**2+((y-cy)/(c.height*.54))**2;data.data[(y*c.width+x)*4+3]*=Math.max(0,Math.min(1,(1.08-dist)*8));}ctx.putImageData(data,0,0);return c;}}
export async function renderCard(sceneId:string,photo:string|undefined,width=900,height=1125,watermark=true,second?:string){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d')!;
 const base=await loadImage('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(sceneSVG(sceneId,width,height)));ctx.drawImage(base,0,0,width,height);
 const drawPerson=async(data:string,x:number,multi=false)=>{const img=await loadImage(data),matte=await personMask(img);const scale=multi?.75:1.10;const targetH=height*.64*scale,targetW=img.width/img.height*targetH,tx=x-targetW/2,ty=height*.75-targetH;
 ctx.save();ctx.shadowColor='#17111a99';ctx.shadowBlur=32*width/900;ctx.shadowOffsetY=20*height/1125;ctx.drawImage(matte,tx,ty,targetW,targetH);ctx.restore();ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.08;ctx.drawImage(matte,tx-2,ty-2,targetW+4,targetH+4);ctx.restore();};
 if(photo){if(second){await drawPerson(photo,width*.32,true);await drawPerson(second,width*.68,true);}else await drawPerson(photo,width*.5);}
 // Film-inspired foreground overlays, graphic details and legible labels.
 const grd=ctx.createLinearGradient(0,height*.64,0,height);grd.addColorStop(0,'#14110f00');grd.addColorStop(1,'#14110fbb');ctx.fillStyle=grd;ctx.fillRect(0,height*.63,width,height*.37);
 ctx.fillStyle='#fff4e0';ctx.font=`900 ${Math.round(width*.048)}px system-ui`;ctx.textAlign='left';ctx.fillText((SCENES.find((s:string[])=>s[0]===sceneId)?.[1]||'AVATAR FORGE').slice(0,24),width*.065,height*.91);ctx.font=`bold ${Math.round(width*.026)}px system-ui`;ctx.fillText('POSTCARD • AN ORIGINAL STORY',width*.067,height*.952);
 if(watermark){ctx.textAlign='right';ctx.font=`600 ${Math.round(width*.019)}px system-ui`;ctx.fillStyle='#fff4e0';ctx.fillText('Made with Avatar Forge · Generated art',width*.955,height*.985);}
 return canvas.toDataURL('image/jpeg',.9);}
export function downloadData(data:string,filename:string){const a=document.createElement('a');a.href=data;a.download=filename;a.click();}
export function exactSize(name:string){return (EXPORT_PRESETS.find((p:(string|number)[])=>p[0]===name)||EXPORT_PRESETS[0]) as [string,number,number];}
export function avatarSVG({skin='#d69a73',hair='#37271d',outfit='#ff5a36',accessory='none',mood=0}:{skin?:string;hair?:string;outfit?:string;accessory?:string;mood?:number}={}){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 460"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#f9d999"/><stop offset="1" stop-color="#f6a8b9"/></linearGradient></defs><rect width="400" height="460" rx="40" fill="url(#g)"/><circle cx="200" cy="202" r="147" fill="#fff4e0" opacity=".38"/><path d="M48 460Q65 329 200 329Q333 329 352 460" fill="${outfit}" stroke="#14110f" stroke-width="9"/><path d="M130 344V290H270V344Q200 396 130 344" fill="${skin}" stroke="#14110f" stroke-width="7"/><ellipse cx="200" cy="210" rx="114" ry="139" fill="${skin}" stroke="#14110f" stroke-width="8"/><path d="M85 179Q65 55 177 52Q316 21 317 188L293 147Q267 118 239 128Q150 160 100 131Z" fill="${hair}" stroke="#14110f" stroke-width="8"/><path d="M130 206q26 -21 48 0M226 206q23 -22 48 0" fill="none" stroke="#14110f" stroke-linecap="round" stroke-width="11"/><path d="M188 211q-20 48 11 47" fill="none" stroke="#a86b56" stroke-width="6" stroke-linecap="round"/><path d="M160 279Q200 ${mood?311:295} 240 279" fill="none" stroke="#7c3145" stroke-width="10" stroke-linecap="round"/>${accessory==='glasses'?'<rect x="114" y="187" width="74" height="48" rx="15" fill="none" stroke="#14110f" stroke-width="9"/><rect x="214" y="187" width="74" height="48" rx="15" fill="none" stroke="#14110f" stroke-width="9"/><path d="M188 209h26" stroke="#14110f" stroke-width="9"/>':''}${accessory==='crown'?'<path d="M103 90L128 23L183 69L222 16L266 67L301 26L315 102Z" fill="#ffb800" stroke="#14110f" stroke-width="8"/>':''}<circle cx="356" cy="66" r="30" fill="#ffb800" stroke="#14110f" stroke-width="6"/><text x="356" y="76" text-anchor="middle" font-size="33" fill="#14110f">✦</text></svg>`;}
