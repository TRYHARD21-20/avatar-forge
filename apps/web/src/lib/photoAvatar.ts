/** Creative, local-only portrait styling. No identity recognition, sensitive inferences or network calls. */
export type PhotoAvatarStyle = 'comic'|'studio'|'pop';
export type PhotoAvatarBackdrop = 'sunrise'|'mint'|'cosmos'|'city';
export type PhotoAvatarOptions = {
  style:PhotoAvatarStyle;
  backdrop:PhotoAvatarBackdrop;
  outfit:string;
  accessory:string;
  accessoryOffset:number;
  accessoryScale:number;
};
const W=720,H=840;
function color(hex:string){return /^#[\da-f]{6}$/i.test(hex)?hex:'#ff5a36';}
function imageFrom(source:string):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Portrait could not be opened'));img.src=source;});}
function polygon(c:CanvasRenderingContext2D,pts:number[],fill:string,stroke?:string){c.beginPath();c.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)c.lineTo(pts[i],pts[i+1]);c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=8;c.stroke();}}
function rounded(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,fill:string){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();}
function drawBackdrop(c:CanvasRenderingContext2D,backdrop:PhotoAvatarBackdrop){
  const palettes={sunrise:['#ffc0a7','#ffe2ac','#ff6d6d'],mint:['#74ddc3','#f9e7c5','#218f88'],cosmos:['#30245f','#8d59b9','#f9bdeb'],city:['#7fb8ef','#fee2b0','#3f5a8d']};
  const colors=palettes[backdrop];const gradient=c.createLinearGradient(0,0,W,H);gradient.addColorStop(0,colors[0]);gradient.addColorStop(.58,colors[1]);gradient.addColorStop(1,colors[2]);c.fillStyle=gradient;c.fillRect(0,0,W,H);
  c.fillStyle='rgba(255,255,255,.4)';c.beginPath();c.arc(577,145,96,0,Math.PI*2);c.fill();
  c.lineWidth=17;c.strokeStyle='rgba(255,255,255,.27)';c.beginPath();c.arc(360,399,335,0,Math.PI*2);c.stroke();
  if(backdrop==='city'){
    for(let i=0;i<8;i++){const x=i*102-20;const y=570-(i*57%170);c.fillStyle='#34426e';c.fillRect(x,y,93,H-y);c.fillStyle='#ffd787';for(let j=0;j<4;j++)for(let k=0;k<3;k++)c.fillRect(x+18+k*23,y+20+j*38,10,15);}
  } else if(backdrop==='cosmos'){
    for(let i=0;i<38;i++){const x=(i*149+27)%W,y=(i*89+23)%H;c.fillStyle=i%3?'#fff2bb':'#ffffff';c.beginPath();c.arc(x,y,i%4===0?4:2,0,Math.PI*2);c.fill();}
  } else {
    for(let i=0;i<9;i++){const x=(i*151+39)%W,y=(i*97+21)%H;c.fillStyle='#fff5d4';c.globalAlpha=.43;c.beginPath();c.arc(x,y,8+i%3*4,0,Math.PI*2);c.fill();}c.globalAlpha=1;
  }
}
function stylized(source:HTMLImageElement,style:PhotoAvatarStyle){
 const cn=document.createElement('canvas');cn.width=520;cn.height=630;const c=cn.getContext('2d',{willReadFrequently:true});if(!c)throw new Error('Canvas unavailable');
 // Center-crop to portrait proportions, but keep enough room around the face.
 const width=source.naturalWidth,height=source.naturalHeight,aspect=520/630;
 let sw=width,sh=width/aspect;if(sh>height){sh=height;sw=height*aspect;}
 c.drawImage(source,(width-sw)/2,(height-sh)/2,sw,sh,0,0,520,630);
 if(style==='studio')return cn;
 const data=c.getImageData(0,0,520,630),p=data.data,copy=new Uint8ClampedArray(p);
 const factor=style==='comic'?36:53,contrast=style==='comic'?1.17:1.27;
 // Posterized photographic portrait; likeness is from the image itself, not synthesized biometric guesses.
 for(let i=0;i<p.length;i+=4){
  for(let ch=0;ch<3;ch++){const v=Math.min(255,Math.max(0,(p[i+ch]-128)*contrast+128));p[i+ch]=Math.min(255,Math.round(v/factor)*factor);}
 }
 if(style==='comic'){
  // Subtle ink lines at strong color boundaries, avoids corrupting facial features with heavy edge tracing.
  for(let y=1;y<629;y+=1)for(let x=1;x<519;x+=1){const k=(y*520+x)*4,l=k-4,u=k-520*4;
    const dif=Math.abs(copy[k]-copy[l])+Math.abs(copy[k+1]-copy[l+1])+Math.abs(copy[k+2]-copy[l+2])+Math.abs(copy[k]-copy[u])+Math.abs(copy[k+1]-copy[u+1])+Math.abs(copy[k+2]-copy[u+2]);
    if(dif>245){p[k]=p[k]*.63;p[k+1]=p[k+1]*.63;p[k+2]=p[k+2]*.63;}
  }
 }
 c.putImageData(data,0,0);return cn;
}
export async function renderPhotoAvatar(source:string,opt:PhotoAvatarOptions):Promise<string>{
 if(!source.startsWith('data:image/'))throw new Error('Select a local photo first');
 const photo=await imageFrom(source),cn=document.createElement('canvas');cn.width=W;cn.height=H;
 const c=cn.getContext('2d');if(!c)throw new Error('Canvas unavailable');drawBackdrop(c,opt.backdrop);
 c.save();c.shadowColor='#14110f88';c.shadowBlur=0;c.shadowOffsetX=12;c.shadowOffsetY=16;rounded(c,80,70,560,686,62,'#14110f');c.restore();
 c.save();c.beginPath();c.roundRect(89,79,542,668,48);c.clip();
 c.drawImage(stylized(photo,opt.style),100,88,520,630);
 // Illustration-styled outfit overlay sits low enough to keep the face unobstructed.
 const jacket=color(opt.outfit);polygon(c,[94,710,112,640,210,604,252,660,360,686,468,660,515,606,614,643,630,742,92,742],jacket);
 polygon(c,[252,660,360,730,468,660,424,647,360,683,297,647],'#fff4e0');
 c.lineWidth=7;c.strokeStyle='#14110f';c.beginPath();c.moveTo(360,730);c.lineTo(360,742);c.stroke();
 // User controlled accessories are intentionally placed on approximate coordinates,
 // not claimed as automatically fitted facial landmarks.
 const scale=Math.max(.65,Math.min(1.45,opt.accessoryScale)),off=Math.max(-115,Math.min(115,opt.accessoryOffset));
 c.save();c.translate(360,314+off);c.scale(scale,scale);
 if(opt.accessory==='glasses'){
  c.strokeStyle='#161421';c.lineWidth=11;for(const x of [-99,99]){c.beginPath();c.roundRect(x-83,-45,166,91,21);c.stroke();}c.beginPath();c.moveTo(-16,-10);c.lineTo(16,-10);c.stroke();
 }else if(opt.accessory==='crown'){
  c.translate(0,-275);polygon(c,[-163,39,-140,-75,-60,-20,0,-95,70,-18,147,-79,171,35],'#ffb800','#14110f');
 }else if(opt.accessory==='stars'){
  c.font='72px system-ui';c.textAlign='center';c.fillText('✦',-185,-55);c.fillText('✦',183,-2);
 }
 c.restore();c.restore();
 c.strokeStyle='#14110f';c.lineWidth=11;c.beginPath();c.roundRect(88,78,544,670,48);c.stroke();
 c.fillStyle='#14110f';rounded(c,117,690,486,86,15,'#14110f');c.fillStyle='#fff4e0';c.font='900 36px system-ui';c.textAlign='center';c.fillText('✦ MY AVATAR FORGE ✦',360,742,450);
 c.font='700 17px system-ui';c.fillStyle='#14110f';c.fillText('PHOTO-INSPIRED ART  •  DEVICE ONLY  •  JUST FOR FUN',360,811,675);
 return cn.toDataURL('image/png');
}
