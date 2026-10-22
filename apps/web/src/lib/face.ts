import {FaceLandmarker,FilesetResolver,ImageSegmenter} from '@mediapipe/tasks-vision';
import {poseFromMatrix,poseFromLandmarks} from '@avatar/shared';
let landmarkPromise:Promise<FaceLandmarker>|null=null;let segmentPromise:Promise<ImageSegmenter>|null=null;
const wasm='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm';
export function landmarker(){if(!landmarkPromise)landmarkPromise=(async()=>{const files=await FilesetResolver.forVisionTasks(wasm);return FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numFaces:2,outputFaceBlendshapes:true,outputFacialTransformationMatrixes:true});})();return landmarkPromise.catch(e=>{landmarkPromise=null;throw e;});}
export function segmenter(){if(!segmentPromise)segmentPromise=(async()=>{const files=await FilesetResolver.forVisionTasks(wasm);return ImageSegmenter.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite',delegate:'CPU'},runningMode:'IMAGE',outputCategoryMask:true,outputConfidenceMasks:false});})();return segmentPromise.catch(e=>{segmentPromise=null;throw e;});}
export type Observation={faceCount:number;faceArea:number;centerOffset:number;brightness:number;sharpness:number;yaw:number;pitch:number;roll:number;eyesClosed:boolean;smiling:boolean;source:string};
export function frameQuality(video:HTMLVideoElement,landmarks?:{x:number;y:number}[]):{brightness:number;sharpness:number}{const c=document.createElement('canvas');c.width=160;c.height=120;const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(video,0,0,c.width,c.height);const d=ctx.getImageData(0,0,c.width,c.height).data;const lum=new Float32Array(c.width*c.height);let total=0;for(let i=0;i<lum.length;i++){const j=i*4;lum[i]=.2126*d[j]+.7152*d[j+1]+.0722*d[j+2];total+=lum[i];}
 let x0=12,x1=148,y0=10,y1=110;if(landmarks?.length){const xs=landmarks.map(p=>p.x),ys=landmarks.map(p=>p.y);x0=Math.max(2,Math.floor(Math.min(...xs)*160));x1=Math.min(157,Math.ceil(Math.max(...xs)*160));y0=Math.max(2,Math.floor(Math.min(...ys)*120));y1=Math.min(117,Math.ceil(Math.max(...ys)*120));}
 let n=0,sum=0,sq=0;for(let y=y0+1;y<y1-1;y++)for(let x=x0+1;x<x1-1;x++){const i=y*160+x,l=4*lum[i]-lum[i-160]-lum[i+160]-lum[i-1]-lum[i+1];sum+=l;sq+=l*l;n++;}return {brightness:Math.round(total/lum.length),sharpness:n?Math.sqrt(Math.max(0,sq/n-(sum/n)**2)):0};}
export function estimate(result:ReturnType<FaceLandmarker['detectForVideo']>,video:HTMLVideoElement):Observation{const all=result.faceLandmarks,points=all[0];if(!points)return {faceCount:0,faceArea:0,centerOffset:1,brightness:0,sharpness:0,yaw:0,pitch:0,roll:0,eyesClosed:false,smiling:false,source:'none'};
 const xs=points.map(x=>x.x),ys=points.map(x=>x.y),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
 const m=result.facialTransformationMatrixes?.[0],pose=poseFromMatrix(m?.data as number[]||[])||poseFromLandmarks(points)||{yaw:0,pitch:0,roll:0,source:'unknown'};
 const blend=result.faceBlendshapes?.[0]?.categories||[];const weight=(name:string)=>blend.find(x=>x.categoryName===name)?.score||0;
 const q=frameQuality(video,points);return {...q,faceCount:all.length,faceArea:(maxx-minx)*(maxy-miny),centerOffset:(minx+maxx)/2-.5,yaw:pose.yaw,pitch:pose.pitch,roll:pose.roll,eyesClosed:weight('eyeBlinkLeft')>.55&&weight('eyeBlinkRight')>.55,smiling:weight('mouthSmileLeft')>.48&&weight('mouthSmileRight')>.48,source:pose.source};}
// Upload validation runs separately from the real-time (VIDEO) head-turn detector.
// A detection retry is allowed; accepting an unverified face or weakening the
// "exactly one face" rule is not.
let imageLandmarker:Promise<FaceLandmarker>|null=null;
async function uploadLandmarker():Promise<FaceLandmarker>{
 if(!imageLandmarker) imageLandmarker=(async()=>{
  const files=await FilesetResolver.forVisionTasks(wasm);
  return FaceLandmarker.createFromOptions(files,{
   baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',delegate:'CPU'},
   runningMode:'IMAGE',numFaces:2,minFaceDetectionConfidence:.42,minFacePresenceConfidence:.42
  });
 })();
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  return await Promise.race([
   imageLandmarker,
   new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Face detection model timed out')),20000);})
  ]);
 }catch(e){
  imageLandmarker=null;
  throw new Error(`Face scanner could not start. Check your internet connection and retry. (${String(e)})`);
 }finally{if(timer)clearTimeout(timer);}
}

/** Pad a close-up portrait so a face clipped near an image edge can be scanned.
 * Geometry is remapped to the original frame before the size check. */
function paddedPortrait(source:HTMLCanvasElement,margin=.12,brightness=1){
 const canvas=document.createElement('canvas');
 canvas.width=Math.round(source.width/(1-2*margin));
 canvas.height=Math.round(source.height/(1-2*margin));
 const ctx=canvas.getContext('2d')!;
 ctx.fillStyle='#f6f6f6';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.save();ctx.filter=brightness===1?'none':`brightness(${brightness}) contrast(1.05)`;
 ctx.drawImage(source,Math.round(canvas.width*margin),Math.round(canvas.height*margin),Math.round(canvas.width*(1-2*margin)),Math.round(canvas.height*(1-2*margin)));
 ctx.restore();return canvas;
}

export async function checkStillImage(file:File){
 if(file.size>8_000_000)throw new Error('8 MB image limit');
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Upload PNG, JPG or WebP');
 const bmp=await createImageBitmap(file);
 try{
  if(bmp.width<300||bmp.height<300)throw new Error('Use a picture at least 300px wide and tall');
  const scale=Math.min(1,1280/Math.max(bmp.width,bmp.height));
  const c=document.createElement('canvas');c.width=Math.max(1,Math.round(bmp.width*scale));c.height=Math.max(1,Math.round(bmp.height*scale));
  if(c.width<220||c.height<220)throw new Error('Choose a closer portrait; the face is too small after resizing');
  const cx=c.getContext('2d',{willReadFrequently:true})!;
  cx.fillStyle='#f6f6f6';cx.fillRect(0,0,c.width,c.height);
  cx.drawImage(bmp,0,0,c.width,c.height);
  const land=await uploadLandmarker();
  let faces=land.detect(c).faceLandmarks;
  let margin=0;
  // Two genuinely detected faces are always rejected. Retry only on zero faces.
  if(faces.length===0){
   const padded=paddedPortrait(c,.12);
   faces=land.detect(padded).faceLandmarks;
   margin=.12;
  }
  if(faces.length===0){
   const enhanced=paddedPortrait(c,.08,1.12);
   faces=land.detect(enhanced).faceLandmarks;
   margin=.08;
  }
  if(faces.length>1)throw new Error(`Found ${faces.length} faces. Please upload a photo with only one person.`);
  if(faces.length===0)throw new Error('No face detected. Try a clear, front-facing photo with eyes visible, good lighting and some space around the head.');
  const pts=faces[0];
  // Face coordinates from padded retry canvases must be mapped back to the photo.
  const remap=(value:number)=>margin?(value-margin)/(1-2*margin):value;
  const minX=Math.min(...pts.map(p=>remap(p.x))),maxX=Math.max(...pts.map(p=>remap(p.x)));
  const minY=Math.min(...pts.map(p=>remap(p.y))),maxY=Math.max(...pts.map(p=>remap(p.y)));
  if((maxX-minX)*(maxY-minY)<.085)throw new Error('Face detected, but too small. Use a closer head-and-shoulders portrait.');

  const sample=document.createElement('canvas');sample.width=160;sample.height=120;
  const sctx=sample.getContext('2d')!;sctx.drawImage(c,0,0,160,120);
  const data=sctx.getImageData(0,0,160,120).data,luma=new Float32Array(160*120);let total=0;
  for(let i=0;i<luma.length;i++){const j=i*4;luma[i]=.2126*data[j]+.7152*data[j+1]+.0722*data[j+2];total+=luma[i];}
  let mean=0,energy=0,n=0;
  for(let y=3;y<117;y++)for(let x=3;x<157;x++){
   const i=y*160+x,v=4*luma[i]-luma[i-160]-luma[i+160]-luma[i-1]-luma[i+1];
   mean+=v;energy+=v*v;n++;
  }
  const brightness=total/luma.length,sharpness=Math.sqrt(Math.max(0,energy/n-(mean/n)**2));
  if(brightness<53||brightness>218)throw new Error('Face detected, but lighting is too dark or too bright. Please try another photo.');
  if(sharpness<24)throw new Error('Face detected, but the photo looks blurry. Try a sharper image.');
  const blob=await new Promise<Blob>((resolve,reject)=>c.toBlob(x=>x?resolve(x):reject(new Error('Failed to encode image')),'image/png'));
  return {blob,verified:false,faces:1,brightness,sharpness};
 }finally{bmp.close();}
}
