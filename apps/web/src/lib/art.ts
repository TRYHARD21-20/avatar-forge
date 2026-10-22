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
/** MediaPipe can occasionally return a mask with no usable foreground even if no
 * exception was thrown. A zero-alpha canvas must NEVER be treated as finished art. */
function visibleMatte(canvas:HTMLCanvasElement):boolean{
 const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return false;
 const w=canvas.width,h=canvas.height;if(w<1||h<1)return false;
 const pixels=context.getImageData(0,0,w,h).data;
 let total=0,central=0,centralPixels=0,samples=0;
 const step=Math.max(1,Math.floor(Math.min(w,h)/180));
 for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){
  const opaque=pixels[(y*w+x)*4+3]>70;
  total+=Number(opaque);samples++;
  if(x>=w*.22&&x<=w*.78&&y>=h*.12&&y<=h*.75){central+=Number(opaque);centralPixels++;}
 }
 return total/samples>.035 && central/Math.max(centralPixels,1)>.07;
}
/** Always-visible local fallback. Softly feathers the photo's edges rather than
 * accidentally producing a completely transparent subject when ML fails. */
function softPortraitMatte(image:HTMLImageElement):HTMLCanvasElement{
 const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
 const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0);
 const data=ctx.getImageData(0,0,c.width,c.height),cx=c.width*.5,cy=c.height*.52;
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
  const nx=(x-cx)/(c.width*.52),ny=(y-cy)/(c.height*.65);
  const r=Math.sqrt(nx*nx+ny*ny);
  const alpha=r<.84?1:r>=1.03?0:(1.03-r)/.19;
  data.data[(y*c.width+x)*4+3]=Math.round(data.data[(y*c.width+x)*4+3]*alpha);
 }
 ctx.putImageData(data,0,0);
 return c;
}
async function personMask(image:HTMLImageElement):Promise<HTMLCanvasElement>{
 try{
  // Optional model must not block a card on slow/offline connections.
  const model=await Promise.race([
   segmenter(),
   new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('Segmentation timed out')),3200))
  ]);
  const result=model.segment(image);
  try{
   const mask=result.categoryMask;
   if(!mask)throw new Error('Segmentation returned no category mask');
   const mw=mask.width,mh=mask.height,labels=mask.getAsUint8Array();
   if(mw<1||mh<1||labels.length!==mw*mh)throw new Error('Invalid segmentation dimensions');
   // Google's SelfieSegmenter: class 0 = background, class 1 = person.
   let people=0;for(let i=0;i<labels.length;i++)if(labels[i]===1)people++;
   const ratio=people/labels.length;
   if(ratio<.035||ratio>.94)throw new Error('Empty or implausible person mask');
   const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
   const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
   ctx.drawImage(image,0,0);
   const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
   for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
    const mx=Math.min(mw-1,Math.floor(x*mw/canvas.width));
    const my=Math.min(mh-1,Math.floor(y*mh/canvas.height));
    pixels.data[(y*canvas.width+x)*4+3]=labels[my*mw+mx]===1?255:0;
   }
   ctx.putImageData(pixels,0,0);
   if(!visibleMatte(canvas))throw new Error('Person mask was transparent');
   return canvas;
  }finally{result.close();}
 }catch{
  // The cutout is still optional: never discard the actual uploaded portrait.
  const cutout=plainBackgroundCutout(image);
  if(cutout&&visibleMatte(cutout))return cutout;
  return softPortraitMatte(image);
 }
}

export async function renderCard(sceneId:string,photo:string|undefined,width=900,height=1125,watermark=true,second?:string){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d')!;
 const base=await loadImage('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(sceneSVG(sceneId,width,height)));ctx.drawImage(base,0,0,width,height);
 // Checks the actual *rendered canvas*, rather than trusting a segmentation result.
 const subjectScore=(left:number,top:number,w:number,h:number)=>{
  const x0=Math.max(0,Math.floor(left+w*.24)),y0=Math.max(0,Math.floor(top+h*.12));
  const x1=Math.min(width,Math.ceil(left+w*.76)),y1=Math.min(height,Math.ceil(top+h*.75));
  const sample:number[]=[];
  for(let yy=y0;yy<y1;yy+=Math.max(1,Math.floor((y1-y0)/12)))
   for(let xx=x0;xx<x1;xx+=Math.max(1,Math.floor((x1-x0)/12))){
    const p=ctx.getImageData(xx,yy,1,1).data;
    sample.push(p[0],p[1],p[2]);
   }
  return sample;
 };
 const difference=(before:number[],after:number[])=>{
  let delta=0;for(let i=0;i<before.length;i++)delta+=Math.abs(before[i]-after[i]);
  return delta/Math.max(before.length,1);
 };
 const drawPerson=async(data:string,x:number,multi=false)=>{
  const img=await loadImage(data);
  const scale=multi?.75:1.10,targetH=height*.58*scale;
  const targetW=img.width/img.height*targetH,tx=x-targetW/2,ty=height*.80-targetH;
  const reference=subjectScore(tx,ty,targetW,targetH);
  const drawMatte=(matte:HTMLCanvasElement)=>{
   ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
   ctx.shadowColor='#17111a99';ctx.shadowBlur=32*width/900;ctx.shadowOffsetY=20*height/1125;
   ctx.drawImage(matte,tx,ty,targetW,targetH);ctx.restore();
  };
  // Optional person segmentation, with an offline/local fallback.
  const matte=await personMask(img);
  drawMatte(matte);
  let confidence=difference(reference,subjectScore(tx,ty,targetW,targetH));
  if(confidence<12){
   // In case the model returned alpha-only fragments or an empty foreground,
   // retry with a guaranteed-visible cropped portrait instead of silently
   // showing a scene-only postcard.
   drawMatte(softPortraitMatte(img));
   confidence=difference(reference,subjectScore(tx,ty,targetW,targetH));
  }
  if(confidence<12){
   // Last-resort photo tile. Less polished, but honestly keeps the user visible.
   ctx.save();ctx.fillStyle='#fff4e0';ctx.shadowColor='#14110f77';ctx.shadowBlur=10;
   ctx.fillRect(tx-6,ty-6,targetW+12,targetH+12);
   ctx.shadowColor='transparent';ctx.drawImage(img,tx,ty,targetW,targetH);
   ctx.restore();
   confidence=difference(reference,subjectScore(tx,ty,targetW,targetH));
  }
  if(confidence<8)throw new Error('The image was decoded but the portrait was not visible in the card');
  // Subtle rim light only on valid visible subjects.
  ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.055;
  ctx.drawImage(img,tx-2,ty-2,targetW+4,targetH+4);ctx.restore();
 };
 if(photo){if(second){await drawPerson(photo,width*.32,true);await drawPerson(second,width*.68,true);}else await drawPerson(photo,width*.5);}
 // Film-inspired foreground overlays, graphic details and legible labels.
 const grd=ctx.createLinearGradient(0,height*.64,0,height);grd.addColorStop(0,'#14110f00');grd.addColorStop(1,'#14110fbb');ctx.fillStyle=grd;ctx.fillRect(0,height*.63,width,height*.37);
 ctx.fillStyle='#fff4e0';ctx.font=`900 ${Math.round(width*.048)}px system-ui`;ctx.textAlign='left';ctx.fillText((SCENES.find((s:string[])=>s[0]===sceneId)?.[1]||'AVATAR FORGE').slice(0,24),width*.065,height*.91);ctx.font=`bold ${Math.round(width*.026)}px system-ui`;ctx.fillText('POSTCARD • AN ORIGINAL STORY',width*.067,height*.952);
 if(watermark){ctx.textAlign='right';ctx.font=`600 ${Math.round(width*.019)}px system-ui`;ctx.fillStyle='#fff4e0';ctx.fillText('Made with Avatar Forge · Generated art',width*.955,height*.985);}
 return canvas.toDataURL('image/jpeg',.9);}
export function downloadData(data:string,filename:string){const a=document.createElement('a');a.href=data;a.download=filename;a.click();}
export function exactSize(name:string){return (EXPORT_PRESETS.find((p:(string|number)[])=>p[0]===name)||EXPORT_PRESETS[0]) as [string,number,number];}
export function avatarSVG({skin='#d69a73',hair='#37271d',outfit='#ff5a36',accessory='none',mood=0}:{skin?:string;hair?:string;outfit?:string;accessory?:string;mood?:number}={}){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 460"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#f9d999"/><stop offset="1" stop-color="#f6a8b9"/></linearGradient></defs><rect width="400" height="460" rx="40" fill="url(#g)"/><circle cx="200" cy="202" r="147" fill="#fff4e0" opacity=".38"/><path d="M48 460Q65 329 200 329Q333 329 352 460" fill="${outfit}" stroke="#14110f" stroke-width="9"/><path d="M130 344V290H270V344Q200 396 130 344" fill="${skin}" stroke="#14110f" stroke-width="7"/><ellipse cx="200" cy="210" rx="114" ry="139" fill="${skin}" stroke="#14110f" stroke-width="8"/><path d="M85 179Q65 55 177 52Q316 21 317 188L293 147Q267 118 239 128Q150 160 100 131Z" fill="${hair}" stroke="#14110f" stroke-width="8"/><path d="M130 206q26 -21 48 0M226 206q23 -22 48 0" fill="none" stroke="#14110f" stroke-linecap="round" stroke-width="11"/><path d="M188 211q-20 48 11 47" fill="none" stroke="#a86b56" stroke-width="6" stroke-linecap="round"/><path d="M160 279Q200 ${mood?311:295} 240 279" fill="none" stroke="#7c3145" stroke-width="10" stroke-linecap="round"/>${accessory==='glasses'?'<rect x="114" y="187" width="74" height="48" rx="15" fill="none" stroke="#14110f" stroke-width="9"/><rect x="214" y="187" width="74" height="48" rx="15" fill="none" stroke="#14110f" stroke-width="9"/><path d="M188 209h26" stroke="#14110f" stroke-width="9"/>':''}${accessory==='crown'?'<path d="M103 90L128 23L183 69L222 16L266 67L301 26L315 102Z" fill="#ffb800" stroke="#14110f" stroke-width="8"/>':''}<circle cx="356" cy="66" r="30" fill="#ffb800" stroke="#14110f" stroke-width="6"/><text x="356" y="76" text-anchor="middle" font-size="33" fill="#14110f">✦</text></svg>`;}
