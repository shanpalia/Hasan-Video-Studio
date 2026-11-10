(()=> {
 const $=id=>document.getElementById(id);
 const canvas=$('previewCanvas'); if(!canvas)return;
 const ctx=canvas.getContext('2d');
 let clips=[],musicUrl='',playing=false,raf=0,selected=0,startedAt=0,pausedAt=0,mediaVideo=null,music=null;
 const status=t=>$('editorStatus').textContent=t;
 const photoDuration=()=>Math.max(1,Math.min(20,Number($('durationInput').value)||4));
 const clipDuration=c=>c.type==='video'?(c.duration||5):photoDuration();
 const totalDuration=()=>clips.reduce((n,c)=>n+clipDuration(c),0);
 function fitDraw(source,alpha=1){
  const W=canvas.width,H=canvas.height,sw=source.videoWidth||source.naturalWidth||W,sh=source.videoHeight||source.naturalHeight||H;
  const scale=Math.max(W/sw,H/sh),dw=sw*scale,dh=sh*scale;
  ctx.save();ctx.globalAlpha=alpha;ctx.filter=$('filterSelect').value;
  ctx.drawImage(source,(W-dw)/2,(H-dh)/2,dw,dh);ctx.restore();
 }
 function overlay(){
  const title=$('titleInput').value.trim(); if(!title)return;
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 42px Arial';ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,.7)';ctx.fillStyle='#fff';ctx.strokeText(title,270,820,480);ctx.fillText(title,270,820,480);ctx.restore();
 }
 function drawPlaceholder(){
  ctx.fillStyle='#102e27';ctx.fillRect(0,0,540,960);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='bold 30px Arial';ctx.fillText('HASAN VIDEO STUDIO',270,450);ctx.font='20px Arial';ctx.fillText('Add photos or videos to start',270,500);
 }
 function renderStatic(){
  if(!clips.length){drawPlaceholder();return;}
  const c=clips[selected];ctx.clearRect(0,0,540,960);
  if(c.type==='image'){const im=new Image();im.onload=()=>{fitDraw(im);overlay()};im.src=c.url;}
  else {const v=document.createElement('video');v.src=c.url;v.muted=true;v.playsInline=true;v.onloadeddata=()=>{fitDraw(v);overlay()};}
 }
 function renderList(){
  $('clipList').innerHTML='';
  clips.forEach((c,i)=>{const b=document.createElement('button');b.className='clip-chip'+(i===selected?' active':'');b.textContent=(i+1)+'. '+c.name;b.onclick=()=>{selected=i;renderList();renderStatic()};$('clipList').appendChild(b)});
 }
 $('mediaInput').addEventListener('change',e=>{
  [...e.target.files].forEach(f=>{const type=f.type.startsWith('video/')?'video':'image';const c={name:f.name,type,url:URL.createObjectURL(f),duration:type==='image'?photoDuration():0};clips.push(c);
   if(type==='video'){const v=document.createElement('video');v.preload='metadata';v.src=c.url;v.onloadedmetadata=()=>{c.duration=Number.isFinite(v.duration)?v.duration:5;renderList()};}
  });selected=0;renderList();renderStatic();status(clips.length+' clip(s) ready. Preview ya Export dabayein.');
 });
 $('musicInput').addEventListener('change',e=>{if(musicUrl)URL.revokeObjectURL(musicUrl);const f=e.target.files[0];musicUrl=f?URL.createObjectURL(f):'';status(f?'Music added: '+f.name:'Music removed');});
 ['titleInput','filterSelect','durationInput'].forEach(id=>$(id).addEventListener('input',renderStatic));
 $('transitionSelect').addEventListener('change',()=>status('Transition: '+$('transitionSelect').value));
 function locate(t){let elapsed=0;for(let i=0;i<clips.length;i++){const d=clipDuration(clips[i]);if(t<elapsed+d)return {i,local:t-elapsed,d};elapsed+=d;}return {i:clips.length-1,local:0,d:1};}
 function stop(){playing=false;cancelAnimationFrame(raf);if(mediaVideo){mediaVideo.pause();mediaVideo=null;}if(music){music.pause();music=null;}renderStatic();$('playBtn').textContent='▶ Preview';}
 function frame(now){
  if(!playing)return;
  const t=Math.min((now-startedAt)/1000,totalDuration());const p=locate(t),c=clips[p.i];
  if(c.type==='image'){
   const im=new Image();im.src=c.url;
   if(im.complete){ctx.clearRect(0,0,540,960);fitDraw(im);overlay();}
  }else{
   if(!mediaVideo||mediaVideo.dataset.clip!==String(p.i)){
    if(mediaVideo)mediaVideo.pause();mediaVideo=document.createElement('video');mediaVideo.src=c.url;mediaVideo.muted=true;mediaVideo.playsInline=true;mediaVideo.dataset.clip=String(p.i);mediaVideo.currentTime=p.local;mediaVideo.play().catch(()=>{}); 
   }
   if(mediaVideo.readyState>=2){ctx.clearRect(0,0,540,960);fitDraw(mediaVideo);overlay();}
  }
  if($('transitionSelect').value==='fade'&&p.local<.35){ctx.fillStyle='rgba(0,0,0,'+(1-p.local/.35)+')';ctx.fillRect(0,0,540,960);}
  if(t>=totalDuration()){stop();status('Preview complete. Export Video par click karke save karein.');return;}
  raf=requestAnimationFrame(frame);
 }
 $('playBtn').onclick=()=>{
  if(!clips.length){status('Pehle photo ya video add karein.');return;}
  stop();playing=true;startedAt=performance.now();$('playBtn').textContent='Playing…';
  if(musicUrl){music=new Audio(musicUrl);music.loop=true;music.play().catch(()=>{});}
  raf=requestAnimationFrame(frame);
 };
 $('stopBtn').onclick=()=>{stop();status('Preview stopped.');};
 $('clearBtn').onclick=()=>{stop();clips.forEach(c=>URL.revokeObjectURL(c.url));clips=[];selected=0;renderList();drawPlaceholder();$('mediaInput').value='';status('Project cleared.');};
 $('exportBtn').onclick=async()=>{
  if(!clips.length){status('Export se pehle photo/video add karein.');return;}
  if(!window.MediaRecorder||!canvas.captureStream){status('Is browser mein video export supported nahi. Chrome/Edge ka latest version use karein.');return;}
  stop();const stream=canvas.captureStream(30);let audioStream=null;
  if(musicUrl){const a=new Audio(musicUrl);a.loop=true;a.volume=1;try{audioStream=a.captureStream();audioStream.getAudioTracks().forEach(t=>stream.addTrack(t));await a.play();music=a;}catch(err){status('Music autoplay block hua; bina music export hoga.');}}
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t))||'';
  let recorder;try{recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});}catch(e){status('Export start nahi hua: '+e.message);return;}
  const chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  recorder.onstop=()=>{const blob=new Blob(chunks,{type:recorder.mimeType||'video/webm'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='HASAN-Video-Studio.webm';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);stream.getTracks().forEach(t=>t.stop());if(music){music.pause();music=null;}status('Video export ready. Download: HASAN-Video-Studio.webm');};
  recorder.start();status('Video export ho raha hai… tab ko open rakhein.');
  const start=performance.now();let v=null,active=-1;
  const exportFrame=async now=>{
   const t=(now-start)/1000;if(t>=totalDuration()){recorder.stop();return;}
   const p=locate(t),c=clips[p.i];
   if(c.type==='image'){const im=new Image();im.src=c.url;try{if(!im.complete)await new Promise((res,rej)=>{im.onload=res;im.onerror=rej});ctx.clearRect(0,0,540,960);fitDraw(im);overlay();}catch(e){}}
   else{
    if(active!==p.i){if(v)v.pause();v=document.createElement('video');v.src=c.url;v.muted=true;v.playsInline=true;v.currentTime=p.local;active=p.i;await new Promise(res=>{v.onloadeddata=res;v.onerror=res});v.play().catch(()=>{});}
    if(v&&v.readyState>=2){ctx.clearRect(0,0,540,960);fitDraw(v);overlay();}
   }
   if($('transitionSelect').value==='fade'&&p.local<.35){ctx.fillStyle='rgba(0,0,0,'+(1-p.local/.35)+')';ctx.fillRect(0,0,540,960);}
   requestAnimationFrame(exportFrame);
  };
  requestAnimationFrame(exportFrame);
 };
 drawPlaceholder();
})();