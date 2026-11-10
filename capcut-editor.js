(()=>{const $=id=>document.getElementById(id),canvas=$('preview'),ctx=canvas.getContext('2d');let clips=[],audioUrl='',audio=null,playing=false,recorder=null,raf=0;const params=new URLSearchParams(location.search),template=params.get('template')||'Custom Edit';$('templateName').value=template;$('projectName').textContent=template+' Project';
const presets={'Hero Entry':['THE HERO','contrast(1.35) saturate(1.25)'],'Love Story':['FOREVER ♥','sepia(.15) saturate(1.2)'],'Cinematic Ride':['CINEMATIC','contrast(1.35) saturate(1.25)'],'Portrait Glow':['GLOW UP','brightness(1.15) saturate(1.4)']};const preset=presets[template];if(preset){$('overlayText').value=preset[0];$('filter').value=preset[1];}

const templateImages={
 'Hero Entry':'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=85',
 'Love Story':'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=900&q=85',
 'Cinematic Ride':'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=85',
 'Portrait Glow':'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=85'
};
const previewBtn=$('previewTemplate'),templateVideo=$('templateVideo');
if(templateVideo){templateVideo.poster=templateImages[template]||templateImages['Hero Entry'];}
let templatePlaying=false,templateStart=0,templateImage=new Image();
templateImage.crossOrigin='anonymous';templateImage.src=templateImages[template]||templateImages['Hero Entry'];
function paintTemplate(progress){
 const p=Math.max(0,Math.min(1,progress)),ease=1-Math.pow(1-p,3);
 ctx.clearRect(0,0,540,960);
 const scale=Math.max(540/(templateImage.naturalWidth||540),960/(templateImage.naturalHeight||960))*(1+ease*.16);
 const w=(templateImage.naturalWidth||540)*scale,h=(templateImage.naturalHeight||960)*scale;
 if(templateImage.complete&&templateImage.naturalWidth){ctx.save();ctx.filter=$('filter').value;ctx.drawImage(templateImage,(540-w)/2,(960-h)/2,w,h);ctx.restore();}
 else{ctx.fillStyle='#102b24';ctx.fillRect(0,0,540,960);}
 const title=$('overlayText').value||template.toUpperCase();
 ctx.save();ctx.textAlign='center';ctx.lineCap='round';
 if(template==='Love Story'){
  const g=ctx.createLinearGradient(0,0,540,960);g.addColorStop(0,'rgba(94,10,48,.12)');g.addColorStop(1,'rgba(255,72,132,.48)');ctx.fillStyle=g;ctx.fillRect(0,0,540,960);
  for(let i=0;i<9;i++){const x=(i*83+35)%540,y=960-((p*760+i*117)%1050);ctx.globalAlpha=.2+Math.sin(p*8+i)*.12;ctx.fillStyle='#ffd4e4';ctx.font='30px Arial';ctx.fillText('♥',x,y);}
  ctx.globalAlpha=1;ctx.fillStyle='#fff0f5';ctx.shadowColor='#ff4c91';ctx.shadowBlur=28;ctx.font='italic 900 58px Georgia';ctx.fillText(title,270,760,480);
  ctx.font='20px Arial';ctx.fillText('A STORY OF LOVE',270,815);
 }else if(template==='Cinematic Ride'){
  const shade=ctx.createLinearGradient(0,0,0,960);shade.addColorStop(0,'rgba(0,12,25,.1)');shade.addColorStop(1,'rgba(0,8,18,.78)');ctx.fillStyle=shade;ctx.fillRect(0,0,540,960);
  ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(270,540);ctx.lineTo(270,960);ctx.stroke();
  for(let i=0;i<7;i++){const y=560+((i*95+p*420)%390);ctx.globalAlpha=.2;ctx.fillStyle='#fff';ctx.fillRect(265-(y-540)*.22,y,5+(y-540)*.015,3);}
  ctx.globalAlpha=1;ctx.fillStyle='#fff';ctx.shadowColor='#00d8ff';ctx.shadowBlur=20;ctx.font='900 48px Arial';ctx.fillText(title,270,790,490);ctx.font='18px Arial';ctx.fillText('RIDE • SPEED • FREEDOM',270,840);
 }else if(template==='Portrait Glow'){
  const glow=ctx.createRadialGradient(270,420,35,270,420,500);glow.addColorStop(0,'rgba(255,245,190,.22)');glow.addColorStop(1,'rgba(100,40,180,.36)');ctx.fillStyle=glow;ctx.fillRect(0,0,540,960);
  ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(270,420,210+Math.sin(p*6)*14,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#fff';ctx.shadowColor='#ffd66b';ctx.shadowBlur=30;ctx.font='900 54px Arial';ctx.fillText(title,270,790,480);ctx.font='18px Arial';ctx.fillText('GLOW • BEAUTY • STYLE',270,840);
 }else{
  const shade=ctx.createLinearGradient(0,0,0,960);shade.addColorStop(0,'rgba(0,0,0,.05)');shade.addColorStop(1,'rgba(0,0,0,.7)');ctx.fillStyle=shade;ctx.fillRect(0,0,540,960);
  ctx.save();ctx.translate(270,390);ctx.rotate((p-.5)*.05);ctx.strokeStyle='rgba(255,255,255,.32)';ctx.lineWidth=3;for(let i=0;i<18;i++){ctx.rotate(Math.PI/9);ctx.beginPath();ctx.moveTo(0,-100);ctx.lineTo(0,-470);ctx.stroke();}ctx.restore();
  ctx.globalAlpha=Math.min(1,p*5);ctx.fillStyle='#fff';ctx.shadowColor='#000';ctx.shadowBlur=25;ctx.font='italic 900 64px Arial';ctx.fillText(title,270,770,490);ctx.font='bold 18px Arial';ctx.fillText('MAKE YOUR ENTRANCE',270,825);
 }
 ctx.restore();
}
function playTemplatePreview(){
 if(templatePlaying)return;
 if(templateVideo){templateVideo.pause();templateVideo.classList.add('hidden');}
 canvas.classList.remove('hidden');templatePlaying=true;playing=false;templateStart=performance.now();
 if(previewBtn)previewBtn.textContent='❚❚ Playing Preview';
 function frame(now){if(!templatePlaying)return;const p=Math.min(1,(now-templateStart)/5000);paintTemplate(p);$('timecode').textContent=(p*5).toFixed(1)+' / 5.0';if(p<1)raf=requestAnimationFrame(frame);else stop();}
 raf=requestAnimationFrame(frame);
}
if(previewBtn)previewBtn.onclick=playTemplatePreview;

function duration(c){return c.type==='video'?(c.duration||5):Math.max(1,Number($('duration').value)||4)}function total(){return clips.reduce((s,c)=>s+duration(c),0)}function text(){let t=$('overlayText').value;if(t){ctx.save();ctx.textAlign='center';ctx.font='bold 42px Arial';ctx.lineWidth=5;ctx.strokeStyle='#000b';ctx.fillStyle='white';ctx.strokeText(t,270,830,480);ctx.fillText(t,270,830,480);ctx.restore();}}
function draw(src){let sw=src.videoWidth||src.naturalWidth||540,sh=src.videoHeight||src.naturalHeight||960,scale=Math.max(540/sw,960/sh),w=sw*scale,h=sh*scale;ctx.save();ctx.filter=$('filter').value;ctx.drawImage(src,(540-w)/2,(960-h)/2,w,h);ctx.restore();text();}
function placeholder(){ctx.fillStyle='#142c25';ctx.fillRect(0,0,540,960);ctx.fillStyle='white';ctx.textAlign='center';ctx.font='bold 32px Arial';ctx.fillText('HASAN VIDEO STUDIO',270,460);ctx.font='20px Arial';ctx.fillText('Import media to start',270,510);}
function render(c=clips[0]){ctx.clearRect(0,0,540,960);if(!c){placeholder();return;}if(c.type==='image'){let im=new Image();im.onload=()=>{ctx.clearRect(0,0,540,960);draw(im)};im.src=c.url;}else{let v=document.createElement('video');v.src=c.url;v.muted=true;v.onloadeddata=()=>{ctx.clearRect(0,0,540,960);draw(v)};}}
function timeline(){const v=$('videoTrack');v.innerHTML='';clips.forEach((c,i)=>{let b=document.createElement('button');b.className='clip';b.textContent=(i+1)+' · '+c.name;b.onclick=()=>render(c);v.append(b)});$('mediaCount').textContent=clips.length+' clips · '+total().toFixed(1)+'s';$('textTrack').innerHTML=$('overlayText').value?'<span class="clip">Text: '+$('overlayText').value+'</span>':'<span class="empty">Text overlays appear here</span>';if(audioUrl)$('audioTrack').innerHTML='<span class="clip">♫ Background music</span>';}
$('addMedia').onclick=()=>$('mediaFiles').click();$('addAudio').onclick=()=>$('audioFile').click();$('addText').onclick=()=>{$('overlayText').focus();$('propTitle').textContent='Text settings';};$('filters').onclick=()=>{$('filter').focus();$('propTitle').textContent='Filter settings';};$('transitions').onclick=()=>{$('transition').focus();$('propTitle').textContent='Transition settings';};
$('mediaFiles').onchange=e=>{if(templateVideo){templateVideo.pause();templateVideo.classList.add('hidden');canvas.classList.remove('hidden');}templatePlaying=false;if(previewBtn)previewBtn.textContent='▶ Play Template Preview';[...e.target.files].forEach(f=>{let c={name:f.name,type:f.type.startsWith('video/')?'video':'image',url:URL.createObjectURL(f),duration:4};if(c.type==='video'){let v=document.createElement('video');v.preload='metadata';v.src=c.url;v.onloadedmetadata=()=>{c.duration=v.duration||5;timeline()};}clips.push(c)});timeline();render();};
$('audioFile').onchange=e=>{let f=e.target.files[0];if(f){audioUrl=URL.createObjectURL(f);timeline();}};
$('overlayText').oninput=()=>{timeline();render();};$('filter').onchange=()=>render();$('duration').onchange=()=>timeline();
$('playBtn').onclick=()=>{if(!clips.length){playTemplatePreview();return;}templatePlaying=false;if(previewBtn)previewBtn.textContent='▶ Play Template Preview';playing=true;let start=performance.now();if(audioUrl){audio=new Audio(audioUrl);audio.play().catch(()=>{});}function tick(now){if(!playing)return;let t=(now-start)/1000;if(t>=total()){stop();return;}let pos=0,c=clips[0],local=0;for(let x of clips){if(t<pos+duration(x)){c=x;local=t-pos;break;}pos+=duration(x);}if(c.type==='image'){let im=new Image();im.src=c.url;if(im.complete){ctx.clearRect(0,0,540,960);draw(im)}}else{if(!window.currentVid||window.currentVid.src!==c.url){window.currentVid=document.createElement('video');window.currentVid.src=c.url;window.currentVid.muted=true;window.currentVid.play().catch(()=>{});}if(window.currentVid.readyState>1){ctx.clearRect(0,0,540,960);draw(window.currentVid)}}$('timecode').textContent=t.toFixed(1)+' / '+total().toFixed(1);raf=requestAnimationFrame(tick);}raf=requestAnimationFrame(tick);};
function stop(){playing=false;templatePlaying=false;cancelAnimationFrame(raf);if(previewBtn)previewBtn.textContent='▶ Play Template Preview';if(audio){audio.pause();audio=null;}if(window.currentVid)window.currentVid.pause();$('timecode').textContent='00:00 / '+total().toFixed(1);} $('stopBtn').onclick=stop;
$('exportBtn').onclick=()=>{if(!clips.length)return alert('Pehle media import karein');if(!canvas.captureStream||!window.MediaRecorder)return alert('Latest Chrome/Edge use karein.');stop();let stream=canvas.captureStream(30);let mime=['video/webm;codecs=vp9','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});let chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=()=>{let u=URL.createObjectURL(new Blob(chunks,{type:recorder.mimeType}));let a=document.createElement('a');a.href=u;a.download='HASAN-Video.webm';a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);};recorder.start();let start=performance.now();const capture=now=>{let t=(now-start)/1000;if(t>=total()){recorder.stop();stream.getTracks().forEach(x=>x.stop());return;}let pos=0,c=clips[0];for(let x of clips){if(t<pos+duration(x)){c=x;break;}pos+=duration(x);}if(c.type==='image'){let im=new Image();im.src=c.url;if(im.complete){ctx.clearRect(0,0,540,960);draw(im)}}else{if(!window.exportVid||window.exportVid.src!==c.url){window.exportVid=document.createElement('video');window.exportVid.src=c.url;window.exportVid.muted=true;window.exportVid.play().catch(()=>{});}if(window.exportVid.readyState>1){ctx.clearRect(0,0,540,960);draw(window.exportVid)}}requestAnimationFrame(capture)};requestAnimationFrame(capture);};placeholder();
})();