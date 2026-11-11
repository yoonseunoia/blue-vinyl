/* Blue Vinyl · app logic (state, screens, interactions) */
/* =========================================================
   STATE  (IA의 노드 = screen, 함수 = 전환)
   ========================================================= */
const PALETTES=[['#7f9fd1','#e8c39e'],['#9bb7c9','#41557a'],['#e2a97e','#5b4a7a'],['#86b39a','#2d4a5a'],['#d98c8c','#3b3f63'],['#a7a0d8','#24304f'],['#e6cf8a','#4d6a8a']];
const seed=[['New York, USA','2023.11'],['Reykjavik, Iceland','2024.02'],['Bangkok, Thailand','2024.07'],['Paris, France','2024.09'],['Kyoto, Japan','2025.04'],['Lisbon, Portugal','2025.06'],['Jeju, Korea','2025.09']];
const S={
  mode:'Home',            // 'Home' | 'Record'
  screen:'home',
  lps: seed.map(([city,date],i)=>({id:'lp'+i,city,date,name:city,friends:'',from:'',to:'',pal:PALETTES[i%PALETTES.length],
        moments: Array.from({length:i===3?3:2+(i%3)},(_,k)=>({id:'m'+i+k,type:'photo',url:null,note:['A rainy afternoon alley','The bench outside the museum','A late-night walk'][k%3],song:{t:'Paris in the rain',a:'Lauv'}})),
        finished:true})),
  focus:-1,               // 홈에서 펼쳐진 LP (-1 = 모두 닫힘, 처음 열었을 때)
  currentLP:null,         // 지금 만들고 있는 LP
  currentTrack:null,      // 지금 녹음/편집 중인 moment
  recMode:'VIDEO',
  playSel:0,
  logs:[]
};
const app=document.getElementById('app');

function log(msg){S.logs.unshift(new Date().toLocaleTimeString()+'  '+msg);S.logs=S.logs.slice(0,40);renderHud()}
function go(screen,why){ log((why||'go')+' → '+screen); if(screen!=='record'){ stopCamera(); S.recording=false; } S.screen=screen; render(); }

/* ---- IA functions ---- */
function ChangeMode(from,to,payload){
  log(`ChangeMode(${from}, ${to}, ${payload??'null'})`);
  S.mode=to;
}
function NewLP(){
  const i=S.lps.length;
  S.currentLP={id:'lp'+Date.now(),city:'',date:'',name:'',friends:'',from:'',to:'',pal:PALETTES[i%PALETTES.length],moments:[],finished:false};
  { const d=new Date(); S.currentLP.date=d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0'); }
  S.lps.push(S.currentLP); S.focus=S.lps.length-1;
  S.currentLP.startedAt=now();
  go('newIntro','NewLP');
}
function MakeNewTrack(){
  if(S.mode!=='Record') ChangeMode('Home','Record',null);
  S.currentTrack={id:'m'+Date.now(),type:null,url:null,note:'',song:{t:'Paris in the rain',a:'Lauv'}};
  log('MakeNewTrack');
  go('record','MakeNewTrack');
}
const REC_MODES=['VIDEO']; // 비디오만 남김 (사진·소리 모드 제거)
const PIVOT='50% 518px'; // 원 아래쪽 보이지 않는 축 (원 중심에서 380px 아래)
function switchMode(m,dir){
  if(m===S.recMode||S.recording) return;
  const k=REC_MODES.indexOf(m);
  const L=document.getElementById('rcLbls'); L.querySelectorAll('.rc-lbl').forEach((l,j)=>{l.style.transform=`rotate(${(k-j)*36}deg) translateY(176px)`;l.classList.toggle('on',j===k);l.classList.toggle('far',Math.abs(j-k)>1)});
  // 원과 양옆 판이 아래쪽 축을 중심으로 같이 도는 바퀴처럼 움직임 (아래 글자 곡선과 같은 원운동)
  app.querySelectorAll('.rc-side').forEach(sd=>{ sd.style.transformOrigin=sd.classList.contains('l')?'230px 505px':'20px 505px';
    sd.animate([{transform:'none'},{transform:`rotate(${-dir*14}deg)`,offset:.45},{transform:'none'}],{duration:760,easing:'cubic-bezier(.4,0,.2,1)'}); });
  const v=document.getElementById('rcView'); v.style.transformOrigin=PIVOT; v.style.transition='none';
  v.animate([{transform:v.style.transform||'none',opacity:1},{transform:`rotate(${-dir*34}deg) scale(.82)`,opacity:0}],{duration:380,easing:'cubic-bezier(.5,0,.8,.6)',fill:'forwards'}).onfinish=()=>{
    S.recMode=m; log('mode → '+m); if(navigator.vibrate) navigator.vibrate(6);
    render(); app.querySelector('.screen').style.animation='none';
    const nv=document.getElementById('rcView'); nv.style.transformOrigin=PIVOT;
    nv.animate([{transform:`rotate(${dir*34}deg) scale(.82)`,opacity:0},{transform:'none',opacity:1}],{duration:520,easing:'cubic-bezier(.2,.8,.3,1)'}).onfinish=()=>{nv.style.transformOrigin=''};
  };
}
function captureFeedback(then){
  const v=document.getElementById('rcView'), fl=document.getElementById('rcFlash');
  if(navigator.vibrate) navigator.vibrate(12);
  v.animate([{transform:'none'},{transform:'scale(.9)'},{transform:'scale(1.02)'},{transform:'none'}],{duration:520,easing:'ease-out'});
  fl.animate([{opacity:0},{opacity:.9,offset:.25},{opacity:0}],{duration:600}).onfinish=then;
}
/* 지금 듣는 노래 (실제 앱에서는 Spotify 'currently playing' API 등으로 가져옴 · 여기선 최근 재생 기록 첫 곡) */
function nowPlaying(){ return S.nowPlaying||SONGS.recent[0]; }
function startVideo(){
  if(S.recording) return;
  S.recording=true; S.recStart=Date.now(); S.recChunks=[]; if(navigator.vibrate) navigator.vibrate(10);
  if(S.camStream&&window.MediaRecorder){
    try{ const mime=['video/mp4','video/webm;codecs=vp9','video/webm'].find(t=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t));
      S.recorder=new MediaRecorder(S.camStream,mime?{mimeType:mime}:undefined);
      S.recorder.ondataavailable=e=>{ if(e.data&&e.data.size) S.recChunks.push(e.data) };
      S.recorder.start(250); log('RecordVideo start (live)');
    }catch(e){ S.recorder=null; log('MediaRecorder failed → simulated'); }
  } else log('RecordVideo start (simulated)');
  render(); app.querySelector('.screen').style.animation='none';
}
function stopVideo(){
  if(!S.recording) return; S.recording=false;
  const sec=Math.max(1,Math.round((Date.now()-S.recStart)/1000));
  const finish=(url,type)=>{ S.currentTrack.type=type; S.currentTrack.url=url; S.currentTrack.duration=sec; const np=nowPlaying(); S.currentTrack.song={t:np.t,a:np.a,c:np.c}; log('RecordVideo '+sec+'s'+(type==='video'?'':' (simulated)'));
    const cam=app.querySelector('.rc-cam'); if(cam&&type==='photo') cam.style.backgroundImage=`url(${url})`;
    captureFeedback(()=>{S.fromCapture=true;EndCurrentTrack()}); };
  if(S.recorder){ const r=S.recorder; S.recorder=null;
    r.onstop=()=>{ const blob=new Blob(S.recChunks,{type:r.mimeType||'video/webm'}); finish(URL.createObjectURL(blob),'video'); };
    r.stop();
  } else finish(momentImg(S.currentLP,{},S.currentLP.moments.length+1),'photo');
}
function stopCamera(){ if(S.camStream){ S.camStream.getTracks().forEach(t=>t.stop()); S.camStream=null; } }
function stopAudio(){ if(!S.recording) return; S.recording=false; const sec=Math.max(1,Math.round((Date.now()-S.recStart)/1000)); captureFeedback(()=>{S.fromCapture=true;RecordSound(sec)}); }
function RecordImage(file,type){
  S.currentTrack.type=type; S.currentTrack.url=URL.createObjectURL(file);
  log('Record'+(type==='video'?'Video':'Image')+'('+file.name+')');
  const v=document.getElementById('rcView');
  if(v&&S.screen==='record'){
    const cam=v.querySelector('.rc-cam'); if(cam){ if(type==='photo') cam.style.backgroundImage=`url(${S.currentTrack.url})`; else cam.innerHTML=`<video src="${S.currentTrack.url}" muted playsinline autoplay loop></video>`; }
    captureFeedback(()=>{S.fromCapture=true;EndCurrentTrack()});
  } else EndCurrentTrack();
}
function RecordSound(seconds){
  S.currentTrack.type='audio'; S.currentTrack.duration=seconds;
  log('RecordSound('+seconds+'s, simulated)');
  EndCurrentTrack();
}
function EndCurrentTrack(){ log('EndCurrentTrack'); go('endTrack','EndCurrentTrack'); }
function EditCurrentTrack(patch){ Object.assign(S.currentTrack,patch); }
/* ---------- 음악 고르기 ---------- */
const SONGS={
  recent:[
    {t:'Paris in the rain',a:'Lauv',c:'#f5c518',when:'8 min ago'},
    {t:'La Vie en rose',a:'Édith Piaf',c:'#e58a8a',when:'32 min ago'},
    {t:'Clair de Lune',a:'Debussy',c:'#9fb4e6',when:'1 hr ago'},
    {t:'Golden Hour',a:'JVKE',c:'#f0a35e',when:'This morning'},
    {t:'Sunday Morning',a:'Maroon 5',c:'#8fd1b5',when:'Yesterday'}
  ],
  rec:[
    {t:"Les Champs-Élysées",a:'Joe Dassin',c:'#c9a4f0',why:'Paris · walking'},
    {t:'Je te laisserai des mots',a:'Patrick Watson',c:'#7fa7c9',why:'Rainy afternoon'},
    {t:'Moon River',a:'Audrey Hepburn',c:'#b8c4d9',why:'Slow tempo'},
    {t:'Coffee',a:'beabadoobee',c:'#d6a77a',why:'Recorded at a café'},
    {t:'Riptide',a:'Vance Joy',c:'#86c2a0',why:'Like your recent picks'}
  ]
};
const discBg=song=>`radial-gradient(circle,${song.c||'#f5c518'} 0 18%,#000 19%)`;
function openSongSheet(){
  const scr=document.getElementById('s-end'); if(document.getElementById('songSheet')) return;
  const row=(x,sub,k,i)=>`<button class="srow ${x.t===S.currentTrack.song.t?'sel':''}" data-a="songSet" data-g="${k}" data-i="${i}">
      <span class="sd" style="background:${discBg(x)}"></span><span class="st"><b>${x.t}</b><small>${x.a}</small></span><span class="sw">${sub}</span></button>`;
  const city=(S.currentLP.city||'').split(',')[0]||'This trip';
  const html=`<div class="scrim" data-a="songClose"></div><div class="ssheet" id="songSheet">
    <div class="grab"></div>
    <div class="sh-title">Add a song to this moment</div>
    <div class="ssearch"><input id="songQ" placeholder="Search songs or artists"></div>
    <div class="slist" id="slist">
      <div class="sh-sec">Recently played <span>From your other apps · simulated</span></div>
      ${SONGS.recent.map((x,i)=>row(x,x.when,'recent',i)).join('')}
      <div class="sh-sec">Picked for this moment <span>${city} · time · weather</span></div>
      ${SONGS.rec.map((x,i)=>row(x,x.why,'rec',i)).join('')}
    </div></div>`;
  scr.insertAdjacentHTML('beforeend',html);
  const q=document.getElementById('songQ');
  q.oninput=()=>{const v=q.value.toLowerCase();document.querySelectorAll('#slist .srow').forEach(r=>r.style.display=r.textContent.toLowerCase().includes(v)?'':'none')};
}
function closeSongSheet(){
  const sh=document.getElementById('songSheet'), sc=app.querySelector('.scrim'); if(!sh) return;
  sh.animate([{transform:'none'},{transform:'translateY(100%)'}],{duration:450,easing:'cubic-bezier(.4,0,.6,1)',fill:'forwards'}).onfinish=()=>{sh.remove();sc&&sc.remove()};
  sc&&sc.animate([{opacity:1},{opacity:0}],{duration:450,fill:'forwards'});
}
function setSong(g,i){
  const x=SONGS[g][i]; EditCurrentTrack({song:{t:x.t,a:x.a,c:x.c}}); S.songPlaying=true; log('EditCurrentTrack(song: '+x.t+')');
  closeSongSheet(); etUpdate(false);
  const chip=document.getElementById('songChip'); chip&&chip.animate([{transform:'translateX(-50%) scale(.94)'},{transform:'translateX(-50%) scale(1.03)'},{transform:'translateX(-50%)'}],{duration:500,easing:'ease-out'});
}
/* End track 캐러셀: [지금 만드는 모먼트, 이전 모먼트들(최신순)] */
function etItems(){ return [S.currentTrack,...S.currentLP.moments.slice().reverse()]; }
function etUpdate(anim){
  const lp=S.currentLP, items=etItems(), i=S.etIdx, m=items[i], isCur=i===0;
  const num=isCur?lp.moments.length+1:lp.moments.length-i+1;
  const tr=document.getElementById('etTrack');
  tr.style.transition=anim?'transform .8s cubic-bezier(.22,.9,.25,1)':'none';
  tr.style.transform=`translateX(${-i*300}px)`;
  app.querySelectorAll('.et-c').forEach((c,k)=>c.classList.toggle('on',k===i));
  app.querySelectorAll('.et-dots i').forEach((d,k)=>d.classList.toggle('on',k===i));
  document.getElementById('et-num').textContent='MOMENT '+num;
  document.getElementById('et-info').innerHTML=`
    <div class="song ${S.songPlaying&&isCur?'playing':''}" id="songChip"><div class="d" style="background:${discBg(m.song)}"><i></i></div><div class="t"><div>${m.song.t}</div><div>${m.song.a}</div></div>${isCur?`<button class="sbtn" data-a="songToggle" aria-label="play/pause">${S.songPlaying?'❚❚':'▶'}</button><button class="sbtn" data-a="songPick" aria-label="change song">⇄</button>`:''}</div>
    <div class="note"><label>NOTE${isCur?'':' · PINNED'}</label>${isCur?`<input id="f-note" placeholder="Write this moment briefly..." value="${m.note.replace(/"/g,'&quot;')}">`:`<div class="note-ro">${m.note||'—'}</div>`}</div>`;
  const n=document.getElementById('f-note'); if(n) n.oninput=()=>EditCurrentTrack({note:n.value});
  const btn=document.getElementById('et-btn');
  if(isCur){btn.innerHTML=ico.groove+' CARVE INTO LP';btn.dataset.a='pin';btn.classList.remove('ghosty')}
  else{btn.innerHTML='← BACK TO MOMENT '+(lp.moments.length+1);btn.dataset.a='etHome';btn.classList.add('ghosty')}
}
/* 핀 꽂기: 원이 별 핀으로 줄어들며 판 쪽으로 떨어짐 → 허브에서 핀이 꽂힘 */
function PinMoment(){
  const c=app.querySelector('.et-c.cur'), r=c.getBoundingClientRect(), pr=document.getElementById('phone').getBoundingClientRect();
  if(navigator.vibrate) navigator.vibrate(12);
  const star=document.createElement('div'); star.className='fly-pin'; const lpF=S.currentLP; star.innerHTML=pinThumb(lpF,S.currentTrack,lpF.moments.length);
  star.style.left=((r.left-pr.left+r.width/2)/S.scale-17)+'px'; star.style.top=((r.top-pr.top+r.height/2)/S.scale-17)+'px';
  document.getElementById('phone').appendChild(star);
  c.animate([{transform:'none',opacity:1},{transform:'scale(.12)',opacity:0}],{duration:650,easing:'cubic-bezier(.5,0,.3,1)',fill:'forwards'});
  app.querySelectorAll('#et-info,.press-btn,.et-dots,.et-c:not(.cur)').forEach(el=>el.animate([{opacity:1},{opacity:0}],{duration:400,fill:'forwards'}));
  star.animate([
    {transform:'scale(.2)',opacity:0},
    {transform:'scale(1.4)',opacity:1,offset:.35},
    {transform:'scale(1)',offset:.5},
    {transform:'translateY(520px) scale(.8)',opacity:1,offset:1}
  ],{duration:1300,easing:'cubic-bezier(.5,0,.6,1)',fill:'forwards'}).onfinish=()=>{ star.remove();
    // 판에 새기는 장면으로: 커팅 헤드가 홈을 새긴 뒤 허브로
    S.currentLP.moments.push(S.currentTrack); S.currentTrack=null;
    S.carveK=S.currentLP.moments.length; S.justPinned=true; S.skipCarve=true;
    log('PinMoment → carve moment '+S.carveK); go('carve','Carve into LP'); };
}
function CommitTrack(){
  S.currentLP.moments.push(S.currentTrack); log('PinMoment (moment '+S.currentLP.moments.length+')');
  S.currentTrack=null; go('hub','PinMoment');
}
function FinishJourney(){ S.modal='finish'; render(); }
function StartPressing(){ S.modal=null; go('cover','Finish → ChooseCover'); }
async function initCover(){
  const lp=S.currentLP; const colors=await paletteOf(lp);
  if(!lp.cover) lp.cover={type:'palette',colors};
  S.coverColors=colors;
  if(S.screen==='cover') render();
}
/* ---------- 종이비행기: 근처에서 누군가 공유한 LP ---------- */
const scene=(sky1,sky2,sea,sun)=>`data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${sky1}'/><stop offset='1' stop-color='${sky2}'/></linearGradient></defs><rect width='100' height='100' fill='url(#g)'/><circle cx='70' cy='52' r='9' fill='${sun}' opacity='.9'/><rect y='58' width='100' height='42' fill='${sea}'/><rect y='58' width='100' height='1.2' fill='#fff' opacity='.35'/><path d='M0 74 Q30 70 55 76 T100 73 V100 H0Z' fill='#000' opacity='.18'/></svg>`).replace(/'/g,'%27').replace(/\(/g,'%28').replace(/\)/g,'%29')}`;
const SHARED=[
  {city:'Ttukseom, Seoul',owner:'minji',date:'2026.10',dist:'240m',img:scene('#9fb8e6','#f1c9a8','#5b77a8','#fff3d6'),pal:['#9fb8e6','#f1c9a8'],
   moments:[{note:'Parked the bike and just sat for a while',song:{t:'Sunday Morning',a:'Maroon 5',c:'#8fd1b5'}},{note:'When the lights across the river came on, one by one',song:{t:'Golden Hour',a:'JVKE',c:'#f0a35e'}},{note:'The breeze on the way back',song:{t:'Riptide',a:'Vance Joy',c:'#86c2a0'}}]},
  {city:'Seongsu-dong, Seoul',owner:'jun',date:'2026.09',dist:'1.1km',img:scene('#c7b2e0','#f4d4c4','#7a6a9a','#ffe9d6'),pal:['#c7b2e0','#7a6a9a'],
   moments:[{note:'Watched the rain from a warehouse café',song:{t:'Coffee',a:'beabadoobee',c:'#d6a77a'}},{note:'Every alley smelled different',song:{t:'Moon River',a:'Audrey Hepburn',c:'#b8c4d9'}}]},
  {city:'Bukchon, Seoul',owner:'yeon',date:'2026.08',dist:'3.4km',img:scene('#f2c48a','#f7e3c4','#8a6a52','#fff'),pal:['#f2c48a','#8a6a52'],
   moments:[{note:'The sun set over the hanok roofs',song:{t:'Clair de Lune',a:'Debussy',c:'#9fb4e6'}},{note:'Stayed longer because I was alone',song:{t:'La Vie en rose',a:'Édith Piaf',c:'#e58a8a'}},{note:'Sikhye on the stone steps',song:{t:'Je te laisserai des mots',a:'Patrick Watson',c:'#7fa7c9'}},{note:'The last alley',song:{t:'Paris in the rain',a:'Lauv',c:'#f5c518'}}]}
];
const paperPlaneSVG=`<svg viewBox="0 0 64 44"><polygon points="2,24 62,2 26,32" fill="#f4f0e6"/><polygon points="26,32 62,2 32,42" fill="#d9d3c4"/><polygon points="26,32 32,42 28,30" fill="#bfb8a8"/></svg>`;
function PaperAirplane(){
  if(S.planeAnim) S.planeAnim.pause(); clearTimeout(S.planeT);
  if(document.getElementById('paOv')) return;
  S.shIdx=((S.shIdx??-1)+1)%SHARED.length; const sh=SHARED[S.shIdx];
  S.shared={...sh,id:'sh'+Date.now()+S.shIdx,name:sh.city,finished:true,status:'collection',shared:{owner:sh.owner},
    moments:sh.moments.map((m,k)=>({id:'s'+k,type:'photo',url:k===0?sh.img:null,note:m.note,song:m.song}))};
  log('PaperAirplane → shared LP by @'+sh.owner);
  const scr=app.querySelector('#s-home'), ph=document.getElementById('phone').getBoundingClientRect();
  const pr=app.querySelector('.planes').getBoundingClientRect();
  const sx=(pr.left-ph.left+pr.width/2)/S.scale, sy=(pr.top-ph.top+pr.height/2)/S.scale;
  scr.insertAdjacentHTML('beforeend',`<div class="pa-ov" id="paOv">
    <div class="pa-plane" id="paPlane">${paperPlaneSVG}</div>
    <div class="pa-card" id="paCard">
      <div class="pa-cover" id="paCover" style="background:url(${sh.img}) center/cover"></div>
      <div class="pa-vinyl vinyl" id="paVinyl"><div class="vlabel" style="background:url(${sh.img}) center/cover"></div><div class="hole"></div></div>
    </div>
    <div class="pa-cap" id="paCap"><b>${sh.city}</b><span>@${sh.owner} · ${sh.date} · ${sh.moments.length} moments · ${sh.dist} 근처</span></div>
    <div class="pa-btns" id="paBtns">
      <button class="pa-b play" data-a="paPlay">Play now</button>
      <button class="pa-b add" data-a="paAdd">add to list</button>
      <button class="pa-b dis" data-a="paDiscard">discard</button>
    </div>
  </div>`);
  const ov=document.getElementById('paOv'), pl=document.getElementById('paPlane'), card=document.getElementById('paCard'),
        cov=document.getElementById('paCover'), vin=document.getElementById('paVinyl'), cap=document.getElementById('paCap'), btns=document.getElementById('paBtns');
  app.querySelector('.planes').style.visibility='hidden';
  ov.animate([{background:'rgba(12,13,24,0)'},{background:'rgba(12,13,24,.45)'}],{duration:900,fill:'forwards'});
  // 1. 비행기가 가운데로 날아옴
  pl.animate([
    {transform:`translate(${sx-196}px,${sy-425}px) scale(.5) rotate(-8deg)`},
    {transform:'translate(-20px,30px) scale(2.2) rotate(6deg)',offset:.7},
    {transform:'scale(2.4) rotate(0deg)'}
  ],{duration:1100,easing:'cubic-bezier(.3,.6,.3,1)',fill:'forwards'});
  // 2. 비행기가 펼쳐져 종이가 됨 (그 안에 LP)
  setTimeout(()=>{ if(navigator.vibrate)navigator.vibrate(8);
    pl.animate([{transform:'scale(2.4)',opacity:1},{transform:'scale(3.2,0.4) rotate(-6deg)',opacity:0}],{duration:450,easing:'ease-in',fill:'forwards'});
    card.animate([{transform:'scale(.2,.05) rotate(-12deg)',opacity:0},{transform:'scale(1.06) rotate(1deg)',opacity:1,offset:.7},{transform:'none',opacity:1}],{duration:800,delay:150,easing:'cubic-bezier(.2,.8,.3,1)',fill:'forwards'});
  },1150);
  // 3. 판이 커버에서 빠져나와 앞으로
  setTimeout(()=>{
    cov.animate([{transform:'none'},{transform:'translate(-28px,-34px) scale(.58)'}],{duration:900,easing:'cubic-bezier(.45,0,.2,1)',fill:'forwards'});
    vin.animate([{transform:'none',zIndex:0},{transform:'translate(-56px,-2px) rotate(200deg) scale(1.35)',zIndex:3}],{duration:900,easing:'cubic-bezier(.45,0,.2,1)',fill:'forwards'});
  },2300);
  // 4. 종이가 위로 올라가고 버튼 등장
  setTimeout(()=>{
    card.animate([{transform:'none'},{transform:'translateY(-120px)'}],{duration:800,easing:'cubic-bezier(.45,0,.2,1)',fill:'forwards'});
    cap.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:600,delay:500,fill:'forwards'});
    [...btns.children].forEach((b,k)=>b.animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:500,delay:650+k*120,easing:'cubic-bezier(.2,.8,.3,1)',fill:'forwards'}));
  },3400);
}
function closePaperAirplane(mode){
  const ov=document.getElementById('paOv'); if(!ov) return;
  const card=document.getElementById('paCard'), pl=document.getElementById('paPlane'), cap=document.getElementById('paCap'), btns=document.getElementById('paBtns');
  [cap,btns].forEach(e=>e.animate([{opacity:1},{opacity:0}],{duration:300,fill:'forwards'}));
  const done=()=>{ov.remove(); stopPlane(); const p=app.querySelector('.planes'); if(p) p.style.visibility=''; schedulePlane(6000);};
  ov.animate([{background:'rgba(12,13,24,.45)'},{background:'rgba(12,13,24,0)'}],{duration:900,delay:300,fill:'forwards'});
  if(mode==='discard'){ // 다시 접혀서 비행기가 되어 날아감
    card.animate([{transform:'translateY(-120px)',opacity:1},{transform:'translateY(-120px) scale(.15,.05) rotate(14deg)',opacity:0}],{duration:500,easing:'ease-in',fill:'forwards'});
    pl.animate([{transform:'translateY(-120px) scale(.6)',opacity:0},{transform:'translateY(-120px) scale(1.8)',opacity:1,offset:.35},{transform:'translate(320px,-560px) scale(.8) rotate(-18deg)',opacity:1}],{duration:1300,delay:350,easing:'cubic-bezier(.5,0,.6,1)',fill:'forwards'}).onfinish=done;
  } else if(mode==='add'){ // 스택 쪽으로 내려가 꽂힘
    card.animate([{transform:'translateY(-120px)'},{transform:'translateY(-150px) scale(1.04)',offset:.25},{transform:'translateY(520px) scale(.35) rotate(8deg)',opacity:0}],{duration:1000,easing:'cubic-bezier(.5,0,.7,.4)',fill:'forwards'}).onfinish=()=>{
      done(); const lp=S.shared; S.lps.push(lp); log('add shared LP to list'); S.autoScrolling=true; focusLP(S.lps.length-1); setTimeout(()=>S.autoScrolling=false,1200);
      setTimeout(()=>showToast(`@${lp.shared.owner}의 LP를 리스트에 담았어요`),400);
    };
  }
}
/* ---------- LP 상태: recording → transit → arrived → collection ---------- */
const DAY=864e5;
const now=()=>Date.now()+(S.timeOffset||0);
function status(lp){
  if(!lp.finished) return 'recording';
  if(lp.status==='transit') return now()>=lp.arriveAt?'arrived':'transit';
  return lp.status||'collection';
}
const daysLeft=lp=>Math.max(1,Math.ceil((lp.arriveAt-now())/DAY));
const arriveLabel=lp=>{const d=new Date(lp.arriveAt);return `${d.getMonth()+1}.${d.getDate()} (${['SUN','MON','TUE','WED','THU','FRI','SAT'][d.getDay()]})`};
function showToast(msg){const t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(S.toastT);S.toastT=setTimeout(()=>t.classList.remove('show'),2000)}
function fastForward(){
  S.timeOffset=(S.timeOffset||0)+DAY; log('⏩ +1 day');
  const k=S.lps.findIndex(l=>l.status==='transit'&&status(l)==='arrived');
  if(S.screen==='home'){ if(k>=0){S.focus=-1;S.listed=false;log('Arrived: '+S.lps[k].city)} render(); const hp=document.getElementById('hParcel'); if(hp&&hp.classList.contains('fresh')) heroArrival(S.lps[+hp.dataset.i],hp); }
}
function Delivered(){
  if(S.viewDeliver){ S.viewDeliver=false; S.currentLP=null; go('home','back'); return; }
  const lp=S.currentLP; lp.finished=true; lp.status='transit'; lp.arriveAt=now()+3*DAY;
  if(!lp.city) lp.city='Untitled Trip';
  if(!lp.date){const d=new Date();lp.date=d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0');}
  if(!S.lps.includes(lp)) S.lps.push(lp); S.focus=S.lps.indexOf(lp); S.currentLP=null;
  ChangeMode('Record','Home',null);
  go('home','Delivering → Home');
}

/* =========================================================
   RENDER
   ========================================================= */
const ico={
  back:'<svg width="15" height="21" viewBox="0 0 15 21" fill="none"><path d="M13 2L3 10.5 13 19" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  menu:'<svg width="23" height="16" viewBox="0 0 23 16"><g stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M1 1h21M1 8h21M1 15h21"/></g></svg>',
  close:'<svg width="15" height="15" viewBox="0 0 15 15"><path d="M1 1l13 13M14 1L1 14" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
  play:'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 1.5l11 6.5-11 6.5z" fill="#fff"/></svg>',
  plane:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  groove:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.6" style="margin-right:2px"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6.5" stroke-dasharray="30 11"/><circle cx="12" cy="12" r="2" fill="#111" stroke="none"/></svg>',
  pin:'<svg width="14" height="14" viewBox="0 0 24 24" style="margin-right:2px"><path d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6 5.6 21.1 7 14l-5.3-5 7.2-.9z" fill="#111"/></svg>',
  star:'<svg viewBox="0 0 24 24"><path d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6 5.6 21.1 7 14l-5.3-5 7.2-.9z" fill="#fff"/></svg>'
};
const arcSeg=(a0,a1,r=140,c=303.5)=>{const P=a=>{a=a*Math.PI/180;return (c+r*Math.sin(a)).toFixed(1)+','+(c-r*Math.cos(a)).toFixed(1)};return `M${P(a0)} A${r},${r} 0 0,1 ${P(a1)}`};
const grad=cs=>`linear-gradient(150deg,${cs.join(',')})`;
const coverPhoto=lp=>lp.img?lp.img:lp.cover?(lp.cover.type==='photo'?lp.cover.url:null):(lp.finished?null:(lp.moments.slice().reverse().find(m=>m.url&&m.type==='photo')||{}).url);
/* 사진도, 직접 고른 색 커버도 없는 LP는 모먼트와 같은 풍경 그래픽을 커버로 */
const sceneCover=lp=>!lp.cover&&lp.moments.length?momentImg(lp,{},Math.max(0,S.lps.indexOf(lp))):null;
const cover=lp=>{const u=coverPhoto(lp)||sceneCover(lp);return u?`background-image:url(${u});background-size:cover;background-position:center`:`background:${grad(lp.cover&&lp.cover.colors||lp.pal)}`;};
const coverType=lp=>coverPhoto(lp)?'':`<div class="ctype"><b>${(lp.city||'New Journey').split(',')[0]}</b><span>${lp.date||''}</span></div>`;
/* 라벨(판 가운데): 고른 사진이 있으면 사진, 없으면 여행 색 */
const labelBg=lp=>{const u=lp.img||(lp.cover&&lp.cover.type==='photo'?lp.cover.url:null)||sceneCover(lp);return u?`background:url(${u}) center/cover`:`background:${grad(lp.cover&&lp.cover.colors||lp.pal)}`;};
/* 사진 모먼트들에서 대표 색 뽑기 */
function avgColor(url){return new Promise(res=>{const im=new Image();im.onload=()=>{try{const c=document.createElement('canvas');c.width=c.height=6;const x=c.getContext('2d');x.drawImage(im,0,0,6,6);const d=x.getImageData(0,0,6,6).data;let r=0,g=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2]}const n=d.length/4;res(`rgb(${r/n|0},${g/n|0},${b/n|0})`)}catch(e){res(null)}};im.onerror=()=>res(null);im.src=url})}
async function paletteOf(lp){
  const ps=lp.moments.filter(m=>m.type==='photo'&&m.url).slice(-3);
  const cs=(await Promise.all(ps.map(m=>avgColor(m.url)))).filter(Boolean);
  return cs.length>=2?cs:cs.length===1?[cs[0],lp.pal[1]]:lp.pal;
}
const media=(m,big)=>{
  if(!m) return '';
  if(m.type==='photo'&&m.url) return `<img src="${m.url}">`;
  if(m&&m.type==='video'&&m.url) return `<video src="${m.url}" playsinline muted loop ${big?'autoplay':''}></video>`;
  if(m.type==='audio') return `<div style="position:absolute;inset:0;background:radial-gradient(circle,#2b2f45,#141623)"></div>`;
  return '';
};

const screens={
/* ---------------- HOME / LP list ---------------- */
home(){
  const order=S.lps.map((_,i)=>i).reverse(), fpos=order.indexOf(S.focus);
  const items=order.map((i,dp)=>{ const lp=S.lps[i];
    if(i===S.focus){
      const st=status(lp), wrapped=st==='transit'||st==='arrived', city=(lp.city||'').split(',')[0];
      const pull={recording:['openLP','PULL OUT<br>TO CONTINUE <span>→</span>'],collection:['openLP','PULL OUT<br>TO OPEN <span>→</span>'],
                  transit:['viewDeliver',`IN TRANSIT<br><b>D-${wrapped?daysLeft(lp):''}</b>`],arrived:['tearHint','TEAR TO<br>OPEN <span>→</span>']}[st];
      const line={recording:`<div class="wip road"><em>On the road</em><span>${lp.moments.length} moment${lp.moments.length===1?'':'s'}</span></div>`,
                  transit:`<div class="wip transit">✈ ARRIVES ${wrapped?arriveLabel(lp):''}</div>`,
                  arrived:`<div class="wip arrived">✉ ARRIVED FROM ${city.toUpperCase()} · OPEN ME</div>`,collection:''}[st];
      const parcel=wrapped?parcelHTML(lp,st,'parcel'):'';
      return `
      <div class="focus ${wrapped?'wrapped '+st:''}" data-id="${lp.id}" style="--i:${dp+1}">
        <div class="cover-wrap" id="pullTarget">
          <div class="cover" style="${cover(lp)}">${coverType(lp)}</div>
          <div class="peek vinyl" id="peek"><div class="vlabel" style="${labelBg(lp)}"></div><div class="hole"></div></div>
          ${parcel}
        </div>
        <button class="pull" data-a="${pull[0]}">${pull[1]}</button>
        <div class="title"><div class="serif">${lp.city||'New Journey'}</div><span>${lp.date}</span></div>
        ${lp.shared?`<div class="wip shared">✈ FROM @${lp.shared.owner.toUpperCase()}</div>`:''}
        ${line}
        <button class="lp-del" data-a="askDelete" data-i="${i}" aria-label="Delete this record"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5M10 11v5.5M14 11v5.5"/></svg></button>
      </div>`;}
    const pos=slotDir(dp+1)==='down'?'above':'below';
    const st=status(lp);
    const strip=`<div class="strip">${st==='recording'?'<i class="rec"></i>':st==='transit'?'<span class="tico">✈</span>':st==='arrived'?'<i class="gold"></i>':''}<b>${lp.city||'New Journey'}</b>${lp.date}</div>`;
    const body=st==='recording'?`<div class="body" style="${cover(lp)};background-size:cover;background-position:center"></div>`:'<div class="body"></div>';
    return `<div class="sleeve ${pos} ${st!=='collection'?'w-'+st:''}" data-a="focus" data-i="${i}" data-id="${lp.id}" style="--i:${dp+1}">${pos==='above'?strip+body:body+strip}${st==='arrived'?'<span class="tag">ARRIVED</span>':st==='recording'?'<span class="tag rec">● REC</span>':lp.shared?'<span class="tag sh">✈ SHARED</span>':''}</div>`;
  }).join('');
  if(S.focus>=0) S.listed=true;
  return `<div class="screen ${S.listed?'listed':''}" id="s-home">
    <div class="home-flat"></div>
    <div class="stack ${S.listed?'':'locked'}" id="stack">
      <div class="hero">
        ${(()=>{const ri=S.lps.findIndex(l=>status(l)==='recording'), rl=ri>=0?S.lps[ri]:null;
          return `<div class="tt-vinyl ${rl?'on':''}" id="ttV" ${rl?`data-a="continueRec" data-i="${ri}"`:''}><div class="tt-label" style="${rl?labelBg(rl):''}"></div><div class="tt-hole"></div></div>
        <svg class="tt-arm" viewBox="0 0 393 260"><g class="arm ${(S.armPrev??!!rl)?'down':'up'}" id="ttArm" data-down="${rl?1:0}"><line x1="404" y1="-20" x2="290" y2="160" stroke="#d9d9d9" stroke-width="11"/>
          <rect x="262" y="146" width="36" height="50" fill="#7b7b80" transform="rotate(32 280 171)"/></g></svg>
        ${rl?`<button class="now-rec" data-a="continueRec" data-i="${ri}"><i></i><span><b>NOW RECORDING</b>${rl.city||'New Journey'} · ${rl.moments.length} moment${rl.moments.length===1?'':'s'}</span><em>›</em></button>`:''}`})()}
        <button class="planes" data-a="plane" aria-label="Paper Airplane">
          <svg class="pl p1" viewBox="0 0 64 44"><polygon points="2,24 62,2 26,32" fill="#f4f0e6"/><polygon points="26,32 62,2 32,42" fill="#d9d3c4"/><polygon points="26,32 32,42 28,30" fill="#bfb8a8"/></svg>
          <svg class="pl p2" viewBox="0 0 64 44"><polygon points="2,24 62,2 26,32" fill="#f4f0e6"/><polygon points="26,32 62,2 32,42" fill="#d9d3c4"/><polygon points="26,32 32,42 28,30" fill="#bfb8a8"/></svg>
        </button>
        ${(()=>{const ai=S.lps.findIndex(l=>status(l)==='arrived'); if(ai<0) return '';
          const lp=S.lps[ai];
          return `<button class="hparcel ${lp.heroSeen?'':'fresh'}" data-a="openArrived" data-i="${ai}" id="hParcel"><div class="hp-inner">${parcelHTML(lp,'arrived')}</div><span class="hp-cap">from ${(lp.city||'').split(',')[0]} · tap to open</span></button>`})()}
        ${(()=>{const n=S.lps.filter(l=>status(l)==='arrived').length;return n?`<div class="scroll-hint warm">✉ ${n} ARRIVED · MY RECORDS ↓</div>`:'<div class="scroll-hint">MY RECORDS ↓</div>'})()}
      </div>
      <div class="sleeve above add" data-a="newLP" data-id="add" style="--i:0"><div class="strip"><b>+ Add New Album</b></div><div class="body"><span>+</span></div></div>
      ${items}
    </div>
    <div class="toast" id="toast" style="bottom:120px"></div>
  </div>`;
},

/* ---------------- LP HUB (New LP / Record mode 중심) ---------------- */
hub(){
  const lp=S.currentLP, n=lp.moments.length;
  // 모먼트마다 판의 서로 다른 홈(반지름)에 핀이 꽂히고, 그 홈이 흰 줄로 새겨짐
  const pinPos=k=>({deg:(-55+k*27)%110, r:165+(k%9)*15});
  const fresh=S.justPinned?n-1:-1, carveHere=fresh>=0&&!S.skipCarve; S.skipCarve=false;
  const dots=lp.moments.map((m,k)=>{const {deg,r}=pinPos(k), a=deg*Math.PI/180, foot=r+3;
    return `<div class="hpin ${k===fresh?'drop':''}" style="left:${35.5+foot*Math.cos(a)}px;top:${379.5+foot*Math.sin(a)}px">${pinThumb(lp,m,k)}<div class="stem"></div><div class="foot"></div></div>`}).join('');
  const grooves=`<svg class="hub-grooves" viewBox="0 0 607 607">${lp.moments.map((m,k)=>{const {deg,r}=pinPos(k);
    return `<circle class="groove ${k===fresh&&carveHere?'carve':''}" cx="303.5" cy="303.5" r="${r}" transform="rotate(${deg} 303.5 303.5)" style="--len:${(2*Math.PI*r).toFixed(1)}"/>`}).join('')}</svg>`;
  S.justPinned=false;
  return `<div class="screen" id="s-hub">
    <div class="topbar"><button class="icon-btn" data-a="hubBack">${ico.back}</button><button class="hub-finish ${n?'':'off'}" data-a="${n?'finish':'finishLocked'}">Finish</button></div>
    <div class="vwrap"><div class="vinyl"><div class="hole"></div></div></div>
    ${grooves}
    ${dots}
    <button class="hub-city" data-a="enterInfo">${lp.city||'New Journey'} <span class="edit">✎</span><small>${n} MOMENT${n===1?'':'S'}</small></button>
    <div class="hub-actions">
      <button class="pill hub-cta" data-a="newTrack">+ Record a moment</button>
    </div>
    <div class="toast" id="toast"></div>
    ${S.modal==='finish'?`<div class="modal"><h3>Did you finish your journey?</h3><button data-a="yes">Yes! Press into LP</button><button data-a="no">No...</button></div>`:''}
  </div>`;
},

/* ---------------- NEW LP INTRO: 슬리브에서 판을 꺼내 분리 ---------------- */
newIntro(){
  if(S.introVariant==='split') return `<div class="screen" id="s-intro">
    <div class="i-head" id="iHead"><div class="serif">New Journey</div>${S.introReturn?"<small>Your LP is ready</small>":""}</div>
    <div class="i-vinyl vinyl" id="iV" data-a="introMoment"><div class="hole"></div></div>
    <div class="i-sleeve" id="iS" data-a="introInfo"><b>${S.currentLP.name||S.currentLP.city||'New Journey'}</b><small>${S.currentLP.date||'BLANK LP'} · SIDE A</small></div>
    <button class="i-opt info" id="oInfo" data-a="introInfo"><b>Information</b></button>
    <button class="i-opt mom" id="oMom" data-a="introMoment"><b>Moment</b></button>
  </div>`;
  return `<div class="screen" id="s-intro" data-a="skipIntro">
    <div class="i-vinyl vinyl" id="iV"><div class="hole"></div></div>
    <div class="i-sleeve" id="iS"><b>New Journey</b><small>BLANK LP · SIDE A</small></div>
    <div class="i-skip">TAP TO SKIP</div>
  </div>`;
},

/* ---------------- ENTER INFO ---------------- */
enterInfo(){
  const lp=S.currentLP;
  return `<div class="screen" id="s-info">
    <div class="topbar"><button class="icon-btn" data-a="infoClose">${ico.close}</button><button data-a="infoSave" style="font-size:14px;font-weight:600;margin-top:6px">Save</button></div>
    <div class="disc vinyl"><div class="hole"></div></div>
    <div class="field" style="top:240px"><label>LP Name <span id="cnt">${lp.name.length}/50</span></label><input id="f-name" maxlength="50" placeholder="여행 이름" value="${lp.name}"></div>
    <div class="field" style="top:320px"><label>With</label><input id="f-friends" placeholder="친구1, 친구2, 친구3" value="${lp.friends}"></div>
    <div class="field" style="top:410px"><label>Schedule</label><div class="dates"><input id="f-from" type="date" value="${lp.from}"><span>›</span><input id="f-to" type="date" value="${lp.to}"></div></div>
    <div class="field" style="top:500px"><label>Location</label><input id="f-city" class="line" placeholder="add location" value="${lp.city}"></div>
  </div>`;
},

/* ---------------- RECORD ---------------- */
record(){
  const MS=REC_MODES, k=MS.indexOf(S.recMode), lp=S.currentLP;
  const lbls=MS.map((m,j)=>`<div class="rc-lbl ${j===k?'on':''} ${Math.abs(j-k)>1?'far':''}" data-a="mode" data-m="${m}" style="transform:rotate(${(k-j)*36}deg) translateY(176px)">${m}</div>`).join('');
  const audio=S.recMode==='AUDIO';
  const inner=audio
    ? `<div class="rc-disc"><i class="rc-lab"></i></div><svg class="rc-wave" viewBox="0 0 300 300"><g id="rcBars" stroke="#fff" stroke-width="3.2" stroke-linecap="round">${Array.from({length:64},(_,i)=>{const a=i/64*Math.PI*2,c=Math.cos(a),sn=Math.sin(a);return `<line x1="${(150+60*c).toFixed(1)}" y1="${(150+60*sn).toFixed(1)}" x2="${(150+66*c).toFixed(1)}" y2="${(150+66*sn).toFixed(1)}"/>`}).join('')}</g></svg>`
    : `<div class="rc-cam" style="background-image:url(${momentImg(lp,{},lp.moments.length+1)})"></div><video id="rcLive" class="rc-live ${S.camStream?'on':''}" autoplay muted playsinline></video>
       <div class="rc-cam-hint ${S.camStream||S.recording?'hide':''}" id="rcHint"><b>▶</b>UP TO 15 SECONDS<em>${S.camDenied?'Live camera works in the web app · here it\'s simulated':'Starting camera…'}</em><button class="rc-pick" data-a="pickClip">or choose a clip</button></div>`;
  return `<div class="screen" id="s-record">
    <div class="topbar"><button class="icon-btn" data-a="recBack">${ico.back}</button></div>
    <div class="rc-head"><div class="serif">${lp.city||'New Journey'}</div><div>MOMENT ${lp.moments.length+1}</div></div>
    <div class="rc-np ${S.recording?'live':''}"><i class="d" style="background:${discBg(nowPlaying())}"></i><span><small>NOW PLAYING</small><b>${nowPlaying().t} · ${nowPlaying().a}</b></span></div>
    <div class="rc-take" id="rcTake">${S.recording?'00:00 / 00:15':'TAKE A MOMENT'}</div>
    <svg class="rc-ring" viewBox="0 0 320 320"><circle cx="160" cy="160" r="152" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1"/>
      <circle id="rcProg" cx="160" cy="160" r="152" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="0 955" transform="rotate(-90 160 160)" opacity="${S.recording?1:0}"/>
      <circle id="rcDot" cx="160" cy="8" r="0" fill="#fff"/></svg>
    <div class="rc-view ${audio?'aud':''} ${S.recording?'live':''}" id="rcView">${inner}<div class="rc-flash" id="rcFlash"></div></div>
    <div class="rc-labels" id="rcLbls">${lbls}</div>
    <button class="rc-btn ${S.recording?'recording':''}" data-a="rec"><span class="vinyl"></span><i></i></button>
    <div class="rc-btn-cap">RECORD LP</div>
  </div>`;
},

/* ---------------- END TRACK (edit) ---------------- */
endTrack(){
  const lp=S.currentLP, items=etItems();
  const circles=items.map((m,i)=>`<div class="et-c ${i===0?'cur':''}" data-k="${i}" style="left:calc(50% - 137.5px + ${i*300}px);background:linear-gradient(150deg,${lp.pal[0]},${lp.pal[1]})">${media(m,i===0)}${i===0?`<div class="play">${ico.play}</div>`:''}</div>`).join('');
  return `<div class="screen" id="s-end">
    <div class="et-head"><div class="serif">${lp.city||'New Journey'}</div><span id="et-num"></span></div>
    <div class="et-track" id="etTrack">${circles}</div>
    <div id="et-info"></div>
    ${items.length>1?`<div class="et-dots">${items.map((_,i)=>`<i data-k="${i}"></i>`).join('')}</div>`:''}
    <button class="pill press-btn" id="et-btn" data-a="pin">${ico.groove} CARVE INTO LP</button>
  </div>`;
},

/* ---------------- CHOOSE COVER ---------------- */
cover(){
  const lp=S.currentLP; if(!lp.cover){initCover();lp.cover={type:'palette',colors:lp.pal};}
  const colors=S.coverColors||lp.pal;
  const photos=lp.moments.map((m,k)=>({m,k})).filter(x=>x.m.type==='photo'&&x.m.url);
  const sel=lp.cover;
  const opts=`<button class="copt ${sel.type==='palette'?'on':''}" data-a="coverPick" data-k="-1" style="background:${grad(colors)}"><span>Aa</span></button>`+
    photos.map(x=>`<button class="copt ${sel.type==='photo'&&sel.k===x.k?'on':''}" data-a="coverPick" data-k="${x.k}" style="background:url(${x.m.url}) center/cover"><em>${x.k+1}</em></button>`).join('');
  return `<div class="screen" id="s-cover">
    <div class="topbar"><button class="icon-btn" data-a="coverBack">${ico.back}</button></div>
    <h2 class="cv-h">Choose your cover</h2>
    <div class="cv-sub">이 여행을 담을 재킷을 골라주세요</div>
    <div class="cv-stage">
      <div class="cv-vinyl vinyl"><div class="vlabel" id="cvLabel" style="${labelBg(lp)}"></div><div class="hole"></div></div>
      <div class="cv-jacket" id="cvJacket" style="${sel.type==='photo'?`background:url(${sel.url}) center/cover`:`background:${grad(colors)}`}">${sel.type==='photo'?'':`<div class="ctype big"><b>${(lp.city||'New Journey').split(',')[0]}</b><span>${lp.moments.length} MOMENTS</span></div>`}</div>
    </div>
    <div class="cv-cap">${sel.type==='photo'?`MOMENT ${sel.k+1}의 사진`:'이 여행의 색'}</div>
    <div class="cv-opts">${opts}</div>
    ${photos.length?'':`<div class="cv-note">사진 모먼트가 없어서 이 여행의 색으로 재킷을 만들어요</div>`}
    <button class="pill press-btn" data-a="toPress">PRESS INTO LP</button>
  </div>`;
},

/* ---------------- CARVE: 핀을 꽂으면 커팅 헤드가 판에 홈을 새김 ---------------- */
carve(){
  // 비스듬히 누운 판: 중심 (0,440), 가로 반지름 375, 세로 146 (기울기 0.389)
  const RX=375, RY=146, cx=0, cy=440, R=275, ry=R*RY/RX;
  const pt=t=>[cx+R*Math.cos(t*Math.PI/180), cy+ry*Math.sin(t*Math.PI/180)];
  const [nx,ny]=pt(27), [ex,ey]=pt(178);
  return `<div class="screen" id="s-carve">
    <div class="cv-disc"><div class="cv-edge"></div><div class="cv-top"><div class="cv-lbl"></div><div class="cv-hole"></div><div class="cv-sheen"></div></div></div>
    <svg class="cv-svg" viewBox="0 0 393 852">
      <path id="cvGroove" d="M${nx.toFixed(1)} ${ny.toFixed(1)} A${R} ${ry.toFixed(1)} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="#d8d0c2" stroke-width="2.4" stroke-linecap="round"/>
      <g id="cvArm">
        <line x1="440" y1="396" x2="${(nx+44).toFixed(1)}" y2="${(ny-36).toFixed(1)}" stroke="#d9d9d9" stroke-width="15" stroke-linecap="butt"/>
        <g transform="translate(${(nx-12).toFixed(1)} ${(ny-50).toFixed(1)})">
          <polygon points="0,22 26,0 52,2 30,26" fill="#7a7a7a"/>
          <polygon points="30,26 52,2 62,24 40,50" fill="#4a4a4a"/>
          <polygon points="0,22 30,26 40,50 10,48" fill="#5e5e5e"/>
        </g>
        <line id="cvNeedle" x1="${nx}" y1="${ny-3}" x2="${nx}" y2="${ny+11}" stroke="#d94a3a" stroke-width="2.4"/>
      </g>
    </svg>
    <div class="cv-cap"><span class="reel"><i></i><i></i></span><b>moment${S.carveK||1}</b></div>
  </div>`;
},

/* ---------------- PRESSING (press & hold) ---------------- */
pressing(){
  return `<div class="screen" id="s-pressing">
    <h2>Press!</h2><div class="hint">길게 누르고 있으세요</div>
    <div class="p-glow" id="pGlow"></div>
    <div class="p-vinyl"></div><div class="p-hole"></div>
    <div class="p-label" id="pLabel" style="${labelBg(S.currentLP)}"></div>
    <div class="p-bar"><i id="pBar"></i></div>
    <div class="p-zone" id="pZone"></div>
  </div>`;
},
done(){
  return `<div class="screen" id="s-done" data-a="toDeliver">
    <h2>Completed</h2><div class="vinyl"><div class="vlabel" style="${labelBg(S.currentLP)}"></div><div class="hole"></div></div>
    <div class="city">${S.currentLP.city||'New Journey'}</div>
  </div>`;
},

/* ---------------- DELIVERING ---------------- */
deliver(){
  return `<div class="screen" id="s-deliver">
    <div class="map"><svg viewBox="0 0 393 545">
      <defs><pattern id="dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="rgba(255,255,255,.35)"/></pattern></defs>
      <path d="M20 170c40-40 90-50 120-30s40 60 20 90-10 70-40 80-70-20-90-60-30-50-10-80zM170 120c40-30 120-40 170-10s30 80-10 110-40 70-80 70-60-40-70-80-30-60-10-90zM250 330c30-10 60 10 60 40s-30 50-50 40-30-70-10-80z" fill="url(#dots)"/>
      <path id="route" d="M150 205 Q 230 140 300 215" stroke="#fff" stroke-width="1.6" fill="none" stroke-dasharray="4 5"/>
      <circle cx="150" cy="205" r="5" fill="#fff"/><circle cx="300" cy="215" r="5" fill="#fff"/>
      <g><circle r="14" fill="#1f1f22"/><circle r="4" fill="#c98a86"/>${S.viewDeliver
        ?`<animateMotion dur="1.8s" fill="freeze" calcMode="linear" keyPoints="0;${Math.min(.95,Math.max(.05,1-(S.currentLP.arriveAt-now())/(3*DAY))).toFixed(2)}" keyTimes="0;1"><mpath href="#route"/></animateMotion>`
        :`<animateMotion dur="3s" repeatCount="indefinite"><mpath href="#route"/></animateMotion>`}</g>
    </svg></div>
    <div class="dcard">
      <p>Your LP will be delivered after</p>
      <div class="days">${S.viewDeliver?daysLeft(S.currentLP):3} Day${S.viewDeliver&&daysLeft(S.currentLP)===1?'':'s'}</div>
      <div class="route"><span>${S.currentLP.city||'Here'}</span><i></i><span>Seoul, Korea</span></div>
      <button class="pill home-btn" data-a="delivered">${S.viewDeliver?'Back':'Back to my LPs'}</button>
    </div>
  </div>`;
},

/* ---------------- LISTEN (회고 플레이어) ---------------- */
listen(){
  const L=S.listen, lp=L.lp, ms=lp.moments, m=ms[L.idx];
  return `<div class="screen ${L.mode==='slide'?'slide':''}" id="s-listen">
    <div class="topbar"><button class="icon-btn" data-a="lsBack">${ico.back}</button><div style="width:36px"></div></div>
    <div class="ls-head"><div class="serif">${lp.city}</div><div id="lsNum">MOMENT ${L.idx+1} / ${ms.length}</div></div>
    <div class="ls-vinyl" id="lsV"></div>
    <div class="ls-media" id="lsM">${lsMedia(lp,m,L.idx)}</div>
    <div class="ls-pause" id="lsP">❚❚</div>
    <svg class="ls-arm" viewBox="0 0 393 852"><g id="lsArm"><line x1="430" y1="470" x2="350" y2="610" stroke="#bdbdbd" stroke-width="9" stroke-linecap="round"/>
      <g transform="rotate(32 330 640)"><rect x="306" y="606" width="46" height="62" rx="9" fill="#d9d9d9"/><rect x="326" y="664" width="7" height="16" rx="2" fill="#9a9a9a"/></g></g></svg>
    <div class="ls-note" id="lsN">${lsNote(m)}</div>
    <div class="ls-dots" id="lsD">${ms.map((_,k)=>`<i class="${k===L.idx?'on':''}" data-k="${k}"><b></b></i>`).join('')}</div>
    ${L.ended?`<div class="ls-end"><div class="serif">End of Side A</div><small>${lp.city}</small>
      <button class="pill" data-a="lsAgain">Play again</button><button class="ghost" data-a="lsBack">Back to the LP</button></div>`:''}
  </div>`;
},

/* ---------------- PLAY LP ---------------- */
play(){
  const lp=S.playing||S.lps[S.focus], ms=lp.moments;
  const pos=[[184,344],[145,430],[249,500],[300,420],[90,520],[200,560]];
  const stars=ms.map((m,k)=>{const [x,y]=pos[k%pos.length];return `<div class="star ${k===S.playSel?'on':''}" data-a="sel" data-i="${k}" style="left:${x}px;top:${y+40}px"><div class="thumb" style="background-image:url(${momentImg(lp,m,k)})">${m.type==='video'&&m.url?`<video src="${m.url}" muted playsinline></video>`:''}</div><div class="stem"></div><div class="foot"></div></div>`}).join('');
  const sel=ms[S.playSel];
  return `<div class="screen" id="s-play">
    <div class="topbar"><button class="icon-btn" data-a="playBack">${ico.back}</button></div>
    <div class="head"><div class="serif">${lp.city}</div><div>${lp.shared?`BY @${lp.shared.owner.toUpperCase()} · `:''}${ms.length} MOMENT${ms.length===1?'':'S'}</div></div>
    <div class="pl-vinyl"></div><div class="pl-hole"></div>
    ${stars}
    <div class="pl-actions">
      <button class="pill pl-all" data-a="playAll">${ico.play.replace('#fff','#111')} Play from the start</button>
      <button class="ghost pl-one" data-a="playOne">Play only “${(sel&&sel.note)||`Moment ${S.playSel+1}`}”</button>
    </div>
    ${S.sheet&&sel?`<div class="sheet"><div class="grab" data-a="closeSheet"></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline"><div class="serif" style="font-size:20px;font-weight:600">${lp.city}</div><span style="font-size:12px;letter-spacing:.08em;opacity:.7">MOMENT ${S.playSel+1}</span></div>
      <div class="et-media" style="background:linear-gradient(150deg,${lp.pal[0]},${lp.pal[1]})">${media(sel,true)}</div>
      <div class="n">${sel.note||'—'}<br><span style="font-family:var(--sans);font-size:12px;opacity:.7">♪ ${sel.song.t} · ${sel.song.a}</span></div></div>`:''}
  </div>`;
},

/* ---------------- PAPER AIRPLANE ---------------- */
plane(){
  return `<div class="screen" id="s-plane">
    <div class="topbar"><button class="icon-btn" data-a="planeBack">${ico.back}</button></div>
    <p>Paper Airplane</p><small>IA 상 Home에서 분기되는 노드.<br>아직 세부 인터랙션이 정해지지 않아 자리만 잡아뒀어요.</small>
    <div class="plane"><svg width="80" height="80" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="#fff" stroke-width="1.2" stroke-linejoin="round" fill="rgba(255,255,255,.15)"/></svg></div>
  </div>`;
}
};

function render(){
  S.enteredScreen=S.lastRendered!==S.screen; S.lastRendered=S.screen;
  app.innerHTML=screens[S.screen]();
  after[S.screen]&&after[S.screen]();
  renderHud();
}
function renderHud(){
  document.getElementById('hud').textContent=`mode: ${S.mode} · ${S.screen}`;
  document.getElementById('log').innerHTML=S.logs.join('<br>');
}
document.getElementById('ff').onclick=fastForward;
S.introVariant='split';
/* 인트로는 시안 B(재킷=정보, 판=모먼트)로 고정 */
document.getElementById('hud').onclick=()=>document.getElementById('log').classList.toggle('show');

/* =========================================================
   PER-SCREEN BEHAVIOUR
   ========================================================= */
let timers=[];
function clearTimers(){timers.forEach(t=>{clearInterval(t);cancelAnimationFrame(t)});timers=[]}
const after={
  home(){
    clearTimers();
    const st=document.getElementById('stack'), f=st.querySelector('.focus');
    if(S.layoutFrom) animateFrom(S.layoutFrom); else applyLayout(false); S.layoutFrom=null;
    bindListGesture(st);
    // 펼친 앨범으로 자동 이동할 때는 접힘 판정에서 제외
    S.autoScrolling=true; setTimeout(()=>S.autoScrolling=false,300);
    // PULL OUT TO OPEN: 처음엔 살짝 버티다가 임계점을 넘으면 쑥 빠져나감
    const fe=app.querySelector('.focus'), peek=document.getElementById('peek'), cov=fe&&fe.querySelector('.cover'), pull=fe&&fe.querySelector('.pull');
    const arm=document.getElementById('ttArm');
    if(arm){ const down=arm.dataset.down==='1';
      if(!S.introPlayed){ arm.classList.remove('up','down'); arm.classList.add('off'); }
      else requestAnimationFrame(()=>requestAnimationFrame(()=>{arm.classList.toggle('down',down);arm.classList.toggle('up',!down)}));
      S.armPrev=down; }
    if(!S.introPlayed){ S.introPlayed=true; homeIntro(); }
    else if(S.enteredScreen&&!S.skipPlaneFly&&!S.listed) schedulePlane(1200);
    S.skipPlaneFly=false;
    const hp=document.getElementById('hParcel');
    if(hp&&hp.classList.contains('fresh')&&!S.listed) heroArrival(S.lps[+hp.dataset.i],hp);
    if(!fe) return;
    const stNow=status(S.lps[S.focus]);
    if(stNow==='arrived'&&!S.lps[S.focus].seenArrival) arrivalSequence(S.lps[S.focus]);
    if(stNow==='transit'||stNow==='arrived'){ setupParcel(fe,stNow); return; }
    const TH=70;                                      // 이만큼 끌면 "빠질 준비"
    const ease=raw=>raw<TH?raw*0.55:TH*0.55+(raw-TH)*1.15;   // 고무줄 → 미끄러짐
    let x0=null,y0=0,lock=null,eff=0,ready=false,lastX=0,lastT=0,vel=0;
    const set=e=>{
      peek.style.transform=`translateX(${e}px) rotate(${e*1.1}deg)`;
      cov.style.transform=`translateX(${-e*0.06}px) rotate(${-e*0.02}deg)`;
      pull.style.opacity=Math.max(0,1-e/70);
    };
    fe.onpointerdown=e=>{x0=e.clientX;y0=e.clientY;lock=null;eff=0;ready=false;lastX=x0;lastT=e.timeStamp;vel=0;
      fe.classList.remove('pop'); peek.getAnimations().forEach(a=>a.cancel()); peek.style.transition='none';cov.style.transition='none'};
    fe.onpointermove=e=>{
      if(x0===null) return;
      const dx=(e.clientX-x0)/S.scale, dy=(e.clientY-y0)/S.scale;
      if(!lock){ if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)){lock='x';fe.setPointerCapture(e.pointerId)} else if(Math.abs(dy)>8){lock='y';x0=null;return} else return; }
      eff=ease(Math.max(0,dx)); set(eff);
      vel=(e.clientX-lastX)/Math.max(1,e.timeStamp-lastT); lastX=e.clientX; lastT=e.timeStamp;
      const r=Math.max(0,dx)>TH;
      if(r&&!ready&&navigator.vibrate) navigator.vibrate(12);
      ready=r;
    };
    fe.onpointerup=fe.onpointercancel=()=>{
      if(x0===null||lock!=='x'){x0=null;return}
      x0=null;
      if(ready||vel>0.7) slipOut(eff);
      else{ // 툭 하고 제자리로
        const from=peek.style.transform;
        peek.animate([{transform:from},{transform:'none'}],{duration:650,easing:'cubic-bezier(.3,1.6,.5,1)'});
        cov.animate([{transform:cov.style.transform},{transform:'none'}],{duration:650,easing:'cubic-bezier(.3,1.6,.5,1)'});
        peek.style.transform='';cov.style.transform='';pull.style.opacity='';
      }
    };
    // 가만히 있으면 한 번 살짝 들썩여서 끌 수 있다는 힌트
    timers.push(setTimeout(()=>{ if(S.screen==='home'&&x0===null&&document.body.contains(peek))
      peek.animate([{transform:'none'},{transform:'translateX(16px) rotate(18deg)',offset:.35},{transform:'translateX(4px) rotate(5deg)',offset:.6},{transform:'translateX(10px) rotate(11deg)',offset:.75},{transform:'none'}],{duration:1600,easing:'ease-in-out'});
    },2200));
  },
  newIntro(){
    clearTimers();
    const V=document.getElementById('iV'), Sl=document.getElementById('iS');
    if(S.introVariant==='split'){ if(S.introReturn) returnIntro(V,Sl); else splitIntro(V,Sl); return; }
    // 판 전체(607px)를 기준으로 중심 좌표·지름을 바꿔가며 이동 (허브 화면의 판 위치가 최종 지점)
    const T=(cx,cy,d,r)=>`translate(${cx-35.5}px,${cy-379.5}px) scale(${d/607}) rotate(${r}deg)`;
    const D=4000;
    S.introAnims=[
      V.animate([
        {transform:T(196,400,200,0),opacity:0,offset:0},
        {transform:T(196,400,200,0),opacity:0,offset:.15},
        {transform:T(196,400,200,0),opacity:1,offset:.16},
        {transform:T(196,400,200,0),offset:.2},
        {transform:T(205,400,200,15),offset:.26,easing:'cubic-bezier(.5,0,.2,1)'},   // 살짝 걸렸다가
        {transform:T(330,395,204,230),offset:.48,easing:'cubic-bezier(.4,0,.2,1)'},  // 쑥 빠져나옴
        {transform:T(196,390,270,330),offset:.66,easing:'cubic-bezier(.6,0,.3,1)'},  // 가운데로
        {transform:T(35.5,379.5,607,520),offset:1}                                   // 허브 자리로 확대
      ],{duration:D,fill:'forwards',easing:'linear'}),
      Sl.animate([
        {transform:'translateY(40px) scale(.7)',opacity:0,offset:0},
        {transform:'none',opacity:1,offset:.16,easing:'cubic-bezier(.2,.9,.3,1.2)'},
        {transform:'none',opacity:1,offset:.24},
        {transform:'translateX(-10px) rotate(-2deg)',opacity:1,offset:.4},
        {transform:'translateX(-30px) translateY(560px) rotate(-14deg)',opacity:.9,offset:.62,easing:'cubic-bezier(.6,0,.9,.6)'},
        {transform:'translateX(-30px) translateY(560px) rotate(-14deg)',opacity:0,offset:1}
      ],{duration:D,fill:'forwards',easing:'linear'})
    ];
    timers.push(setTimeout(()=>{if(navigator.vibrate)navigator.vibrate(10)},D*.3));
    S.introAnims[0].onfinish=finishIntro;
  },
  enterInfo(){
    const n=document.getElementById('f-name');
    n.oninput=()=>document.getElementById('cnt').textContent=n.value.length+'/50';
  },
  record(){
    clearTimers();
    const v=document.getElementById('rcView');
    // 원을 좌우로 밀어서 모드 전환 (판이 옆으로 굴러감)
    let x0=null,dx=0;
    v.onpointerdown=e=>{ if(S.recording) return; x0=e.clientX; dx=0; v.style.transformOrigin=PIVOT; v.style.transition='none'; };
    v.onpointermove=e=>{ if(x0===null) return; dx=(e.clientX-x0)/S.scale; v.style.transform=`rotate(${dx*.07}deg)`; };
    v.onpointerup=v.onpointercancel=()=>{ if(x0===null) return; x0=null; v.style.transition=''; v.style.transform='';
      const k=REC_MODES.indexOf(S.recMode); if(dx<-40&&k<2) switchMode(REC_MODES[k+1],1); else if(dx>40&&k>0) switchMode(REC_MODES[k-1],-1); };
    // 실시간 카메라 연결 (아티팩트처럼 막힌 곳에서는 시뮬레이션으로)
    const live=document.getElementById('rcLive');
    if(S.camStream){ live.srcObject=S.camStream; live.play().catch(()=>{}); }
    else if(!S.camDenied&&!S.camTrying){ S.camTrying=true;
      (navigator.mediaDevices&&navigator.mediaDevices.getUserMedia?navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:true}):Promise.reject())
        .then(st=>{ S.camTrying=false; S.camStream=st; log('camera on');
          if(S.screen!=='record'){ st.getTracks().forEach(t=>t.stop()); S.camStream=null; return; }
          const lv=document.getElementById('rcLive'); lv.srcObject=st; lv.classList.add('on'); lv.play().catch(()=>{}); document.getElementById('rcHint').classList.add('hide'); })
        .catch(()=>{ S.camTrying=false; S.camDenied=true; log('camera blocked → simulated');
          const h=document.getElementById('rcHint'); if(h){ const em=h.querySelector('em'); if(em) em.textContent="Live camera works in the web app · here it's simulated"; } });
    }
    if(S.recording){
      const D=15000, prog=document.getElementById('rcProg'), dot=document.getElementById('rcDot'), take=document.getElementById('rcTake'), C=2*Math.PI*152;
      const loop=()=>{ if(S.screen!=='record'||!S.recording) return;
        const t=Date.now()-S.recStart, f=Math.min(1,t/D);
        prog.setAttribute('stroke-dasharray',`${C*f} ${C}`);
        const a=(f*360-90)*Math.PI/180; dot.setAttribute('cx',160+152*Math.cos(a)); dot.setAttribute('cy',160+152*Math.sin(a)); dot.setAttribute('r',5);
        take.textContent=`00:${String(Math.floor(t/1000)).padStart(2,'0')} / 00:15`;
        if(f>=1){ stopVideo(); return; }
        timers.push(requestAnimationFrame(loop)); };
      loop();
    }
  },
  carve(){
    clearTimers();
    const g=document.getElementById('cvGroove'), L=g.getTotalLength(), arm=document.getElementById('cvArm');
    g.style.strokeDasharray=L; g.style.strokeDashoffset=L;
    // 바늘이 내려앉고 → 홈이 바늘 뒤로 새겨지며 길어짐 → 바늘이 들림
    arm.animate([{transform:'translate(70px,-60px)'},{transform:'translate(0,-12px)',offset:.65},{transform:'none'}],{duration:1100,easing:'cubic-bezier(.3,0,.2,1)',fill:'backwards'});
    timers.push(setTimeout(()=>{ if(navigator.vibrate) navigator.vibrate(10); },1100));
    g.animate([{strokeDashoffset:L},{strokeDashoffset:0}],{duration:3200,delay:1100,easing:'cubic-bezier(.3,0,.3,1)',fill:'forwards'});
    const cap=app.querySelector('.cv-cap'); cap.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:800,delay:1400,fill:'backwards'});
    timers.push(setTimeout(()=>{ if(S.screen!=='carve') return;
      arm.animate([{transform:'none'},{transform:'translate(14px,-16px)'}],{duration:700,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
      timers.push(setTimeout(()=>{ if(S.screen==='carve') go('hub','Carved'); },900));
    },1100+3200+500));
  },
  endTrack(){
    clearTimers(); S.etIdx=0; etUpdate(false);
    if(S.fromCapture){ S.fromCapture=false; const scr=app.querySelector('.screen'); scr.style.animation='none';
      const c=app.querySelector('.et-c.cur'); c&&c.animate([{transform:'translateY(118px) scale(1.07)'},{transform:'none'}],{duration:800,easing:'cubic-bezier(.3,0,.2,1)'});
      [...scr.children].forEach(el=>{ if(el.id==='etTrack') return; el.animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:600,delay:300,easing:'ease-out',fill:'backwards'}); }); }
    const tr=document.getElementById('etTrack');
    let x0=null,y0=0,lock=null,dx=0;
    tr.onpointerdown=e=>{x0=e.clientX;y0=e.clientY;lock=null;dx=0};
    tr.onpointermove=e=>{ if(x0===null) return; dx=(e.clientX-x0)/S.scale; const dy=(e.clientY-y0)/S.scale;
      if(!lock){ if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)){lock='x';tr.setPointerCapture(e.pointerId)} else if(Math.abs(dy)>8){x0=null;return} else return }
      const n=etItems().length, edge=(S.etIdx===0&&dx>0)||(S.etIdx===n-1&&dx<0);
      tr.style.transition='none'; tr.style.transform=`translateX(${-S.etIdx*300+dx*(edge?.25:1)}px)`; };
    tr.onpointerup=tr.onpointercancel=()=>{ if(x0===null) return; x0=null; if(lock!=='x') return;
      const n=etItems().length; if(dx<-50&&S.etIdx<n-1)S.etIdx++; else if(dx>50&&S.etIdx>0)S.etIdx--; etUpdate(true); };
    app.querySelectorAll('.et-dots i').forEach(d=>d.onclick=()=>{S.etIdx=+d.dataset.k;etUpdate(true)});
    const v=document.querySelector('.et-c.cur video'); if(v) v.play().catch(()=>{});
  },
  pressing(){
    clearTimers();
    const zone=document.getElementById('pZone'),lab=document.getElementById('pLabel'),bar=document.getElementById('pBar'),glow=document.getElementById('pGlow'),scr=document.getElementById('s-pressing');
    let p=0,down=false,doneFlag=false;
    const mix=(a,b,t)=>a+(b-a)*t;
    const loop=()=>{
      p=Math.max(0,Math.min(1,p+(down?0.008:-0.014)));
      lab.style.top=mix(245,430,p)+'px';
      lab.style.transform=`scale(${mix(1,1.05,p)})`;
      bar.style.width=(p*100)+'%';
      glow.style.opacity=Math.max(0,(p-.4)/.6);
      const c=[mix(84,26,p),mix(92,28,p),mix(134,42,p)].map(Math.round);
      scr.style.background=`rgb(${c})`;
      if(down&&navigator.vibrate&&Math.random()<.04) navigator.vibrate(8);
      if(p>=1&&!doneFlag){doneFlag=true;log('Pressing complete');setTimeout(()=>go('done','Pressed'),600);return}
      timers.push(requestAnimationFrame(loop));
    };
    zone.onpointerdown=e=>{down=true;zone.setPointerCapture(e.pointerId)};
    zone.onpointerup=zone.onpointercancel=()=>{down=false};
    loop();
  },
  done(){ clearTimers(); timers.push(setTimeout(()=>{if(S.screen==='done')go('deliver','auto')},3800)); },
  play(){ clearTimers(); },
  listen(){
    clearTimers(); const L=S.listen, D=6500;
    const M=document.getElementById('lsM');
    let x0=null,dx=0;
    M.onpointerdown=e=>{x0=e.clientX;dx=0};
    M.onpointermove=e=>{if(x0!==null) dx=(e.clientX-x0)/S.scale};
    M.onpointerup=()=>{ if(x0===null) return; x0=null;
      if(Math.abs(dx)<10){ lsToggle(); return; }
      if(dx<-50) lsGo(L.idx+1,1); else if(dx>50) lsGo(L.idx-1,-1); };
    document.querySelectorAll('#lsD i').forEach(d=>d.onclick=()=>lsGo(+d.dataset.k));
    if(L.mode!=='slide'||L.ended) return;
    let last=performance.now();
    const loop=ts=>{
      if(S.screen!=='listen'||S.listen!==L) return;
      const dt=ts-last; last=ts;
      if(L.playing){ L.t+=dt;
        const b=document.querySelector('#lsD i.on b'); if(b) b.style.width=Math.min(100,L.t/D*100)+'%';
        if(L.t>=D){ if(L.idx<L.lp.moments.length-1) lsGo(L.idx+1,1); else { L.ended=true; log('Slideshow ended'); render(); return; } }
      }
      timers.push(requestAnimationFrame(loop));
    };
    timers.push(requestAnimationFrame(loop));
  },
};

/* =========================================================
   ACTIONS (event delegation)
   ========================================================= */
/* 홈: 앨범 탭 → 주변이 밀려나고 선택한 앨범이 가운데로 (FLIP 애니메이션) */
function focusLP(i){
  if(i===S.focus) return;
  const prevId=S.focus>=0?S.lps[S.focus].id:null, nextId=i>=0?S.lps[i].id:null;
  if(i>=0) S.listed=true;
  S.layoutFrom=snapLayout(); S.focus=i; log(i>=0?'focus LP '+S.lps[i].city:'collapse');
  render(); app.querySelector('.screen').style.animation='none';
  app.querySelectorAll('#stack [data-id]').forEach(el=>{ if(el.dataset.id===nextId) el.classList.add('pop'); if(el.dataset.id===prevId) el.classList.add('shrink'); });
}
function slipOut(from=0){
  const peek=document.getElementById('peek'); S.playSel=0;S.sheet=false;
  if(!peek){go('play','PULL OUT');return}
  if(navigator.vibrate) navigator.vibrate([8,30,8]);
  const pull=app.querySelector('.focus .pull'); if(pull) pull.style.opacity=0;
  const a=peek.animate([{transform:`translateX(${from}px) rotate(${from*1.1}deg)`},{transform:`translateX(${from+470}px) rotate(${from*1.1+620}deg)`}],{duration:800,easing:'cubic-bezier(.25,.6,.3,1)',fill:'forwards'});
  const lp=S.lps[S.focus];
  a.onfinish=()=>{ if(lp.finished) go('play','PULL OUT'); else { S.currentLP=lp; go('hub','Continue journey'); } };
}
function openLP(){ slipOut(0); }
/* 허브 판 가운데: 마지막 모먼트가 사진/영상이면 그 장면, 소리면 그 소리의 원형 파형 */
/* 핀 머리 = 그 모먼트의 영상/사진을 담은 동그라미 */
function pinThumb(lp,m,k){
  if(m.type==='video'&&m.url) return `<div class="hthumb"><video src="${m.url}" muted playsinline autoplay loop></video></div>`;
  return `<div class="hthumb" style="background-image:url(${momentImg(lp,m,k)})"></div>`;
}
function hubLabel(lp){
  const m=lp.moments[lp.moments.length-1]; if(!m) return '';
  if(m.type==='video'&&m.url) return `<div class="hub-lbl"><video src="${m.url}" muted playsinline autoplay loop></video></div>`;
  if(m.type==='audio'){
    let seed=0; for(const ch of m.id) seed=(seed*31+ch.charCodeAt(0))%9973;
    const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
    const N=72, bars=[];
    for(let i=0;i<N;i++){ const a=i/N*Math.PI*2, env=.35+.65*Math.abs(Math.sin(i/N*Math.PI*3+seed)), h=10+rnd()*34*env;
      const x1=150+64*Math.cos(a), y1=150+64*Math.sin(a), x2=150+(64+h)*Math.cos(a), y2=150+(64+h)*Math.sin(a);
      bars.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`); }
    return `<div class="hub-lbl snd"><svg viewBox="0 0 300 300"><g stroke="#f3d36b" stroke-width="3" stroke-linecap="round">${bars.join('')}</g>
      <circle cx="150" cy="150" r="54" fill="none" stroke="rgba(243,211,107,.35)" stroke-width="1"/></svg><span>♪ ${m.duration||''}${m.duration?'s':''}</span></div>`;
  }
  return `<div class="hub-lbl" style="background-image:url(${momentImg(lp,m,lp.moments.length-1)})"></div>`;
}
/* ---------- 회고 플레이어 ---------- */
function momentImg(lp,m,k){
  if(m.url&&m.type==='photo') return m.url;
  const P=[[lp.pal[0],'#f3d9c0',lp.pal[1],'#fff3d6'],['#2c3560',lp.pal[0],'#1d2340','#f6e7b0'],[lp.pal[1],lp.pal[0],'#3b4a6a','#ffffff']][k%3];
  return scene(...P);
}
function lsMedia(lp,m,k){
  if(m.type==='video'&&m.url) return `<video src="${m.url}" playsinline muted loop autoplay></video>`;
  return `<div class="lsimg" style="background-image:url(${momentImg(lp,m,k)})"></div>${m.type==='audio'?'<span class="ls-badge">♪ SOUND</span>':''}`;
}
const lsNote=m=>`<p>${m.note||'&nbsp;'}</p><span>♪ ${m.song.t} · ${m.song.a}</span>`;
function startListen(mode,idx){
  const lp=S.playing||S.lps[S.focus];
  S.listen={lp,mode,idx,t:0,playing:true,ended:false};
  log(mode==='slide'?'Slideshow from moment 1':'Play moment '+(idx+1));
  go('listen',mode==='slide'?'PlayAll':'PlayOne');
}
function lsGo(k,dir){
  const L=S.listen, ms=L.lp.moments; if(k<0||k>=ms.length||k===L.idx) return;
  dir=dir||(k>L.idx?1:-1);
  const box=document.getElementById('lsM'), old=box.firstElementChild;
  L.idx=k; L.t=0;
  const wrap=document.createElement('div'); wrap.className='ls-layer'; wrap.innerHTML=lsMedia(L.lp,ms[k],k);
  [...box.children].forEach(c=>{ if(!c.classList.contains('ls-layer')){ const w=document.createElement('div'); w.className='ls-layer'; box.insertBefore(w,c); w.appendChild(c);} });
  const prev=[...box.children]; box.appendChild(wrap);
  prev.forEach(p=>p.animate([{transform:'none',opacity:1},{transform:`rotate(${-70*dir}deg) scale(.9)`,opacity:0}],{duration:900,easing:'cubic-bezier(.5,0,.3,1)',fill:'forwards'}).onfinish=()=>p.remove());
  wrap.animate([{transform:`rotate(${70*dir}deg) scale(.9)`,opacity:0},{transform:'none',opacity:1}],{duration:900,easing:'cubic-bezier(.3,0,.2,1)'});
  // 바늘이 살짝 들렸다 다시 내려앉음
  const arm=document.getElementById('lsArm'); arm&&arm.animate([{transform:'none'},{transform:'rotate(-6deg)'},{transform:'none'}],{duration:900,easing:'ease-in-out'});
  const v=document.getElementById('lsV'); v&&v.animate([{transform:'rotate(0)'},{transform:`rotate(${dir*120}deg)`}],{duration:900,easing:'cubic-bezier(.4,0,.2,1)',composite:'add'});
  const n=document.getElementById('lsN'); n.animate([{opacity:1},{opacity:0}],{duration:300,fill:'forwards'}).onfinish=()=>{n.innerHTML=lsNote(ms[k]);n.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:600,fill:'forwards'})};
  document.getElementById('lsNum').textContent=`MOMENT ${k+1} / ${ms.length}`;
  document.querySelectorAll('#lsD i').forEach((d,j)=>{d.classList.toggle('on',j===k);d.querySelector('b').style.width='0%'});
  if(navigator.vibrate) navigator.vibrate(6);
}
function lsToggle(){
  const L=S.listen; L.playing=!L.playing;
  const scr=document.getElementById('s-listen'); scr.classList.toggle('paused',!L.playing);
  document.querySelectorAll('#lsM video').forEach(v=>L.playing?v.play().catch(()=>{}):v.pause());
  const p=document.getElementById('lsP'); p.textContent=L.playing?'▶':'❚❚';
  p.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.7)'},{opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.3},{opacity:0,transform:'translate(-50%,-50%) scale(1.2)'}],{duration:900});
}
/* 배송 중: 살짝 끌리다 툭 걸림 / 도착: 끌어서 포장 뜯기 */
function parcelHTML(lp,st,id){
  const city=(lp.city||'').split(',')[0];
  return `<div class="parcel ${st}" ${id?`id="${id}"`:''}>
    <i class="tw v"></i><i class="tw h"></i>
    <div class="stamp"><div style="${cover(lp)};background-size:cover;background-position:center"></div></div>
    <div class="pm"><span>${city.toUpperCase()}</span><b>${lp.date}</b><span>SEOUL</span></div>
    <div class="addr">to. me<br>from. ${lp.city}</div>
    ${st==='arrived'?'<div class="arr">ARRIVED</div>':''}
  </div>`;
}
const tear=p=>{const a=Math.min(4,p),pts=[];for(let i=0;i<=12;i++)pts.push(`${p+(i%2?a:0)}% ${(i*100/12).toFixed(1)}%`);return `polygon(${pts.join(',')},100% 100%,100% 0%)`};
/* 도착 연출: 알림 배너 → 소포가 떨어져 쿵 → 도장이 쾅 */
function arrivalSequence(lp){
  lp.seenArrival=true; log('Arrival sequence '+lp.city);
  const ph=document.getElementById('phone'), wrap=document.getElementById('pullTarget'), stamp=app.querySelector('.parcel .arr'), stack=document.getElementById('stack'), f=app.querySelector('.focus');
  const line=f.querySelector('.wip'), title=f.querySelector('.title'), pull=f.querySelector('.pull');
  // 1. 알림 배너
  const sentDays=Math.max(3,Math.round((now()-(lp.arriveAt-3*DAY))/DAY));
  const n=document.createElement('div'); n.className='notif';
  n.innerHTML=`<div class="ni" style="${cover(lp)};background-size:cover"></div><div class="nt"><b>${(lp.city||'').split(',')[0]}에서 LP가 도착했어요</b><span>${sentDays}일 전의 내가 보낸 여행이에요</span></div><div class="nw">지금</div>`;
  ph.appendChild(n);
  n.animate([{transform:'translateY(-120%)'},{transform:'translateY(0)'}],{duration:700,easing:'cubic-bezier(.2,1.2,.4,1)',fill:'forwards'});
  setTimeout(()=>n.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY(-120%)',opacity:.6}],{duration:600,easing:'ease-in',fill:'forwards'}).onfinish=()=>n.remove(),4200);
  // 2. 소포 낙하
  [line,title,pull].forEach(el=>el&&(el.style.opacity=0));
  if(stamp) stamp.style.opacity=0;
  wrap.animate([
    {transform:'translateY(-460px) rotate(-10deg)',offset:0},
    {transform:'translateY(0) rotate(2deg) scaleY(.9) scaleX(1.05)',offset:.62,easing:'cubic-bezier(.2,.8,.3,1)'},
    {transform:'translateY(-26px) rotate(-1deg)',offset:.8,easing:'ease-in'},
    {transform:'none',offset:1}
  ],{duration:1300,delay:500,easing:'cubic-bezier(.55,0,1,.6)',fill:'backwards'});
  // 3. 착지: 진동, 화면 흔들림, 먼지
  setTimeout(()=>{
    if(navigator.vibrate) navigator.vibrate([25,40,12]);
    stack.animate([{transform:'none'},{transform:'translateY(5px)'},{transform:'translateY(-2px)'},{transform:'none'}],{duration:320});
    const r=f.querySelector('.cover-wrap');
    for(let i=0;i<9;i++){const d=document.createElement('i');d.className='dust';d.style.left=(30+i*24)+'px';r.appendChild(d);
      const dx=(i-4)*14, dy=-10-Math.random()*20;
      d.animate([{transform:'translate(0,0) scale(.4)',opacity:.8},{transform:`translate(${dx}px,${dy}px) scale(1.6)`,opacity:0}],{duration:900+Math.random()*300,easing:'cubic-bezier(.2,.8,.3,1)',fill:'forwards'}).onfinish=()=>d.remove();}
  },500+1300*.62);
  // 4. 도장 쾅
  setTimeout(()=>{
    if(!stamp) return; stamp.style.opacity='';
    stamp.animate([{transform:'scale(2.8) rotate(-24deg)',opacity:0},{transform:'scale(.92) rotate(-5deg)',opacity:1,offset:.7},{transform:'rotate(-6deg)',opacity:1}],{duration:420,easing:'cubic-bezier(.6,0,.9,.5)'});
    setTimeout(()=>{ if(navigator.vibrate) navigator.vibrate(18);
      wrap.animate([{transform:'none'},{transform:'scale(.985)'},{transform:'none'}],{duration:220});
      const ink=document.createElement('i');ink.className='ink';stamp.parentNode.appendChild(ink);
      ink.animate([{transform:'scale(.6)',opacity:.5},{transform:'scale(1.8)',opacity:0}],{duration:600,fill:'forwards'}).onfinish=()=>ink.remove();
    },300);
  },500+1300+350);
  // 5. 글자들 떠오름
  setTimeout(()=>[title,line,pull].forEach((el,k)=>{ if(!el) return; el.style.opacity='';
    el.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:600,delay:k*160,fill:'backwards',easing:'ease-out'}); }),500+1300+800);
}
/* 홈 ↔ LP 리스트: 스크롤(휠/드래그) 한 번에 두 상태 사이를 넘어감
   턴테이블은 위로 날아가며 사라지고, 배경이 어두워지고, 슬리브들이 38ms씩 시차를 두고 올라옴 */
/* 슬리브 자리표: 위쪽 4칸은 라벨이 위(down), 아래는 라벨이 아래(up). 가운데로 갈수록 얇아져 상자 속 레코드처럼 보임 */
const SLOTS=[{top:6,h:71,dir:'down'},{top:95,h:67,dir:'down'},{top:177,h:44,dir:'down'},{top:259,h:15,dir:'down'},{top:332,h:10,dir:'up'},
  {top:385,h:37,dir:'up'},{top:443,h:61,dir:'up'},{top:516,h:68,dir:'up'},{top:596,h:69,dir:'up'},{top:676,h:58,dir:'up'}];
// 칸 높이는 그대로 두고, 슬리브 사이 틈을 모두 같게 다시 배치 (전체 길이는 유지)
(()=>{ const start=SLOTS[0].top, last=SLOTS[SLOTS.length-1], end=last.top+last.h+12;
  const gap=(end-start-SLOTS.reduce((a,n)=>a+n.h+12,0))/(SLOTS.length-1); let y=start;
  SLOTS.forEach(n=>{ n.top=Math.round(y); y+=n.h+12+gap; }); })();
const slotDir=k=>SLOTS[Math.min(k,SLOTS.length-1)].dir;
const FOC={h:200,c:52};
function homeG(){ const ph=document.getElementById('phone'); return Math.max(560,Math.min(1000,(ph&&ph.offsetHeight)||852)); }
function slotPos(k,off){ const n=SLOTS[Math.min(k,SLOTS.length-1)], r=homeG()/799; return {top:n.top*r+off,h:Math.max(8,Math.round(n.h*r)),dir:n.dir,hidden:k>=SLOTS.length}; }
function focusTop(k,off=43){ const n=slotPos(k,off), g=homeG(), c=n.top+(n.h+11)/2; return Math.max(70,Math.min(g-FOC.h-FOC.c-24,c-FOC.h/2)); }
function homeLayout(count){
  const off=S.listed?43:homeOff(), base=Array.from({length:count},(_,k)=>slotPos(k,off));
  const fk=S.focus>=0?S.lps.length-S.focus:-1;           // 펼친 LP의 칸 번호 (0번은 Add)
  if(fk<0||!S.listed) return base;
  const flp=S.lps[S.focus], extra=(status(flp)!=='collection'||flp.shared)?24:0;  // 제목 아래 상태 줄이 있으면 그만큼 더 띄움
  const g=homeG(), sel=base[fk], a=focusTop(fk), up=Math.max(0,sel.top-a)+10, dn=Math.max(0,a+FOC.h+FOC.c+extra-(sel.top+sel.h+11))+10;
  return base.map((p,k)=>{ if(k===fk) return {...p,top:a,focus:true};
    const t=k<fk?p.top-up:p.top+dn; return {...p,top:t,hidden:p.hidden||t+p.h+11<0||t>g}; });
}
function homeOff(){ return document.getElementById('hParcel')?508:350; }   // 도착 소포가 있을 때만 자리를 넓게
function homeEls(){ return [...app.querySelectorAll('#stack > .sleeve, #stack > .focus')]; }
function applyLayout(anim=true){
  const st=document.getElementById('stack'); if(!st) return;
  const els=homeEls(), L=homeLayout(els.length);
  if(!anim) st.classList.add('noanim');
  const hero=st.querySelector('.hero'); if(hero) hero.style.height=(homeOff()-8)+'px';
  els.forEach((el,k)=>{ const p=L[k];
    el.style.top=(el.classList.contains('focus')?p.top-10:p.top)+'px';
    el.style.opacity=p.hidden?0:''; el.style.pointerEvents=p.hidden?'none':'';
    const b=el.querySelector(':scope > .body'); if(b) b.style.height=p.h+'px'; });
  if(!anim){ st.offsetHeight; st.classList.remove('noanim'); }
}
function snapLayout(){ const o={}; homeEls().forEach(el=>{ const b=el.querySelector(':scope > .body'); o[el.dataset.id]={top:el.style.top,h:b?b.style.height:'',focus:el.classList.contains('focus')}; }); return o; }
function animateFrom(prev){
  const st=document.getElementById('stack'); st.classList.add('noanim');
  homeEls().forEach(el=>{ const p=prev[el.dataset.id]; if(!p) return;
    const nowFocus=el.classList.contains('focus');
    el.style.top=(nowFocus&&!p.focus)?(parseFloat(p.top)-10)+'px':(!nowFocus&&p.focus)?(parseFloat(p.top)+10)+'px':p.top;
    const b=el.querySelector(':scope > .body'); if(b&&p.h) b.style.height=p.h; });
  st.offsetHeight; st.classList.remove('noanim'); applyLayout(true);
}
function switchList(on){
  const scr=document.getElementById('s-home'); if(!scr||S.switching||S.listed===on) return;
  S.switching=true; setTimeout(()=>S.switching=false,900);
  if(!on&&S.focus>=0){ // 펼친 LP는 접히면서 그대로 같이 내려감 (턴테이블도 위에서 날아 내려오도록 리스트 상태에서 출발)
    S.layoutFrom=snapLayout(); S.focus=-1; render(); app.querySelector('.screen').style.animation='none'; }
  const els=homeEls(), n=els.length;
  // 내려갈 땐 위에서부터, 올라올 땐 아래에서부터 차례로 움직여야 서로 겹치지 않음
  els.forEach((e,k)=>e.style.setProperty('--i',on?k:n-1-k));
  clearTimeout(S.orderT); S.orderT=setTimeout(()=>homeEls().forEach((e,k)=>e.style.setProperty('--i',k)),1400);
  S.listed=on; document.getElementById('s-home').classList.toggle('listed',on); applyLayout(true);
  if(on) stopPlane(); else schedulePlane(1500);
  if(navigator.vibrate) navigator.vibrate(6);
  log(on?'scroll → LP list':'back to turntable');
}
const enterList=()=>switchList(true), exitList=()=>switchList(false);
function bindListGesture(st){
  let y0=null, x0=0, lastWheel=0;
  st.addEventListener('wheel',e=>{ e.preventDefault(); if(Math.abs(e.deltaY)<8||performance.now()-lastWheel<900) return;
    lastWheel=performance.now(); if(e.deltaY>0&&!S.listed) enterList(); else if(e.deltaY<0&&S.listed) exitList(); },{passive:false});
  const skip=t=>t.closest&&t.closest('.cover-wrap,.pull,.del-ov,.lp-del');
  const start=(e,y,x)=>{ y0=skip(e.target)?null:y; x0=x; }, move=(y,x)=>{ if(y0===null) return;
    const dy=(y-y0)/S.scale, dx=(x-x0)/S.scale; if(Math.abs(dx)>Math.abs(dy)) return;
    if(!S.listed&&dy<-36){ y0=null; enterList(); } else if(S.listed&&dy>36){ y0=null; exitList(); } };
  st.addEventListener('touchstart',e=>start(e,e.touches[0].clientY,e.touches[0].clientX),{passive:true});
  st.addEventListener('touchmove',e=>{ if(y0!==null) e.preventDefault(); move(e.touches[0].clientY,e.touches[0].clientX); },{passive:false});
  st.addEventListener('touchend',()=>y0=null);
  st.addEventListener('pointerdown',e=>{ if(e.pointerType==='mouse') start(e,e.clientY,e.clientX); });
  st.addEventListener('pointermove',e=>{ if(e.pointerType==='mouse'&&e.buttons) move(e.clientY,e.clientX); });
  st.addEventListener('pointerup',()=>y0=null);
}
/* 종이비행기 두 대가 화면 밖에서 곡선을 그리며 날아와 자리에 내려앉음 (코 방향으로 진행) */
/* 종이비행기: 가끔 화면을 가로질러 날아가고, 그 사이에 잡지(탭하지) 못하면 그냥 지나가 버림 */
function flyInPlanes(delay=0){ schedulePlane(delay); return []; }
function schedulePlane(delay){
  clearTimeout(S.planeT); S.planeT=setTimeout(flyAcross,delay);
}
function stopPlane(){ clearTimeout(S.planeT); if(S.planeAnim){ S.planeAnim.cancel(); S.planeAnim=null; } const p=app.querySelector('.planes'); if(p) p.classList.remove('flying'); }
function flyAcross(){
  const pl=app.querySelector('.planes');
  if(!pl||S.screen!=='home'||S.listed||document.getElementById('paOv')) return;
  const ltr=Math.random()<.5, y0=180+Math.random()*120, rise=60+Math.random()*80;   // 방향과 높이를 매번 조금씩 다르게
  const X=ltr?[-170,40,230,430]:[430,230,40,-170], f=ltr?'':' scaleX(-1)';
  pl.classList.add('flying');
  S.planeAnim=pl.animate([
    {transform:`translate(${X[0]}px,${y0}px)${f} rotate(4deg)`},
    {transform:`translate(${X[1]}px,${y0-rise*.45}px)${f} rotate(-8deg)`,offset:.33},
    {transform:`translate(${X[2]}px,${y0-rise*.55}px)${f} rotate(2deg)`,offset:.66},
    {transform:`translate(${X[3]}px,${y0-rise}px)${f} rotate(-10deg)`}
  ],{duration:7200,easing:'linear'});
  S.planeAnim.onfinish=()=>{ pl.classList.remove('flying'); S.planeAnim=null; log('paper airplane flew away'); schedulePlane(9000+Math.random()*7000); };
  log('paper airplane passing by');
}
/* 앱을 열 때: 어둠 속 워드마크 → 파란 판이 드러남 → 톤암이 스윙해 들어옴 → 비행기, 인사, 슬리브 */
function homeIntro(){
  const scr=app.querySelector('#s-home'); scr.style.animation='none';
  const boot=document.createElement('div'); boot.className='boot'; boot.innerHTML='<b>Blue Vinyl</b><span>TRAVEL RECORDS</span>';
  scr.appendChild(boot);
  const V=document.getElementById('ttV'), arm=document.getElementById('ttArm'), pl=app.querySelector('.planes'), gr=document.getElementById('greet'),
        hint=app.querySelector('.scroll-hint'), sl=[...app.querySelectorAll('#stack > .sleeve, #stack > .focus')].slice(0,6), extra=[...app.querySelectorAll('.now-rec,.hparcel:not(.fresh)')];
  const anims=[];
  const A=(el,k,o)=>{ if(el) anims.push(el.animate(k,o)); };
  A(boot.firstChild,[{opacity:0,transform:'translateY(8px)',letterSpacing:'.2em'},{opacity:1,transform:'none',letterSpacing:'.01em'}],{duration:700,easing:'ease-out',fill:'backwards'});
  A(boot.lastChild,[{opacity:0},{opacity:1}],{duration:600,delay:250,fill:'backwards'});
  A(boot,[{opacity:1},{opacity:1,offset:.45},{opacity:0}],{duration:1500,easing:'ease-in-out',fill:'forwards'});
  A(V,[{opacity:0,transform:'scale(.9) rotate(-30deg)'},{opacity:1,transform:'none'}],{duration:1300,delay:700,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'});
  const down=arm&&arm.dataset.down==='1';
  const t1=setTimeout(()=>{ if(!arm) return; arm.classList.remove('off'); arm.classList.add(down?'down':'up'); },1300);
  const t2=setTimeout(()=>{ if(navigator.vibrate) navigator.vibrate(down?[12,30,8]:8); },1300+1100);
  flyInPlanes(1700).forEach(a=>anims.push(a));
  extra.forEach(e=>A(e,[{opacity:0},{opacity:1}],{duration:600,delay:2100,fill:'backwards'}));
  A(gr,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:800,delay:2100,easing:'ease-out',fill:'backwards'});
  A(hint,[{opacity:0},{opacity:.45}],{duration:600,delay:2400,fill:'backwards'});
  sl.forEach((e,k)=>A(e,[{opacity:0,transform:'translateY(40px)'},{opacity:1,transform:'none'}],{duration:700,delay:2300+k*90,easing:'cubic-bezier(.2,.8,.3,1)',fill:'backwards'}));
  const end=()=>{boot.remove()}; anims[2].onfinish=end;
  boot.onclick=()=>{ clearTimeout(t1);clearTimeout(t2); if(arm){arm.classList.remove('off');arm.classList.add(down?'down':'up')} anims.forEach(a=>a.finish()); end(); log('intro skipped'); };
  log('App open (intro)');
}
/* 첫 화면(턴테이블 옆)에 소포가 떨어지는 도착 연출 */
function heroArrival(lp,hp){
  lp.heroSeen=true; lp.seenArrival=true; hp.classList.remove('fresh'); log('Hero arrival '+lp.city);
  const ph=document.getElementById('phone'), inner=hp.querySelector('.hp-inner'), stamp=hp.querySelector('.arr'), cap=hp.querySelector('.hp-cap'), st=document.getElementById('stack');
  const sentDays=Math.max(3,Math.round((now()-(lp.arriveAt-3*DAY))/DAY));
  const n=document.createElement('div'); n.className='notif';
  n.innerHTML=`<div class="ni" style="${cover(lp)};background-size:cover"></div><div class="nt"><b>${(lp.city||'').split(',')[0]}에서 LP가 도착했어요</b><span>${sentDays}일 전의 내가 보낸 여행이에요</span></div><div class="nw">지금</div>`;
  ph.appendChild(n);
  n.animate([{transform:'translateY(-120%)'},{transform:'translateY(0)'}],{duration:700,delay:1900,easing:'cubic-bezier(.2,1.2,.4,1)',fill:'forwards'});
  setTimeout(()=>n.animate([{transform:'translateY(0)'},{transform:'translateY(-120%)'}],{duration:600,easing:'ease-in',fill:'forwards'}).onfinish=()=>n.remove(),6200);
  if(stamp) stamp.style.opacity=0; cap.style.opacity=0;
  // 종이비행기가 먼저 휙 날아와서 놓고 감
  const pls=hp.parentNode.querySelector('.planes');
  pls&&pls.animate([{transform:'translate(260px,-260px) rotate(-20deg)'},{transform:'none'}],{duration:1000,easing:'cubic-bezier(.2,.8,.3,1)'});
  hp.animate([
    {transform:'translate(120px,-520px) rotate(-30deg)',offset:0},
    {transform:'translate(0,0) rotate(-3deg) scaleY(.88) scaleX(1.06)',offset:.62,easing:'cubic-bezier(.2,.8,.3,1)'},
    {transform:'translateY(-30px) rotate(-7deg)',offset:.8,easing:'ease-in'},
    {transform:'rotate(-5deg)',offset:1}
  ],{duration:1300,delay:450,easing:'cubic-bezier(.55,0,1,.6)',fill:'backwards'});
  setTimeout(()=>{
    if(navigator.vibrate) navigator.vibrate([25,40,12]);
    st.animate([{transform:'none'},{transform:'translateY(6px)'},{transform:'translateY(-2px)'},{transform:'none'}],{duration:340});
    for(let i=0;i<9;i++){const d=document.createElement('i');d.className='dust';d.style.left=(10+i*17)+'px';hp.appendChild(d);
      d.animate([{transform:'scale(.4)',opacity:.8},{transform:`translate(${(i-4)*13}px,${-10-Math.random()*22}px) scale(1.7)`,opacity:0}],{duration:1000,easing:'cubic-bezier(.2,.8,.3,1)',fill:'forwards'}).onfinish=()=>d.remove();}
  },450+1300*.62);
  setTimeout(()=>{ if(!stamp) return; stamp.style.opacity='';
    stamp.animate([{transform:'scale(2.8) rotate(-24deg)',opacity:0},{transform:'scale(.92) rotate(-5deg)',opacity:1,offset:.7},{transform:'rotate(-6deg)',opacity:1}],{duration:420,easing:'cubic-bezier(.6,0,.9,.5)'});
    setTimeout(()=>{ if(navigator.vibrate) navigator.vibrate(18); inner.animate([{transform:'scale(.72)'},{transform:'scale(.70)'},{transform:'scale(.72)'}],{duration:220}); },300);
  },450+1300+300);
  setTimeout(()=>{cap.style.opacity='';cap.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:600,fill:'backwards'})},450+1300+900);
}
function setupParcel(fe,st){
  const lp=S.lps[S.focus], parcel=document.getElementById('parcel'), wrap=document.getElementById('pullTarget');
  let x0=null,y0=0,lock=null,dx=0,p=0;
  fe.onpointerdown=e=>{x0=e.clientX;y0=e.clientY;lock=null;dx=0;fe.classList.remove('pop');parcel.getAnimations().forEach(a=>a.cancel())};
  fe.onpointermove=e=>{
    if(x0===null) return; dx=(e.clientX-x0)/S.scale; const dy=(e.clientY-y0)/S.scale;
    if(!lock){ if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)){lock='x';fe.setPointerCapture(e.pointerId)} else if(Math.abs(dy)>8){x0=null;return} else return }
    if(st==='transit'){ const m=Math.min(20,Math.max(0,dx)*.22); wrap.style.transform=`translateX(${m}px) rotate(${m*.12}deg)`; }
    else { p=Math.max(0,Math.min(100,dx/2)); parcel.style.clipPath=tear(p); }
  };
  fe.onpointerup=fe.onpointercancel=()=>{
    if(x0===null||lock!=='x'){x0=null;return} x0=null;
    if(st==='transit'){
      wrap.animate([{transform:wrap.style.transform},{transform:'translateX(-4px)'},{transform:'none'}],{duration:500,easing:'cubic-bezier(.3,1.5,.5,1)'});
      wrap.style.transform=''; if(navigator.vibrate)navigator.vibrate([6,40,6]);
      showToast(`아직 배송 중이에요 · ${daysLeft(lp)}일 뒤 도착`);
    } else if(p>50){ unbox(parcel,p); }
    else { parcel.animate([{clipPath:tear(p)},{clipPath:tear(0)}],{duration:500,easing:'cubic-bezier(.3,1.3,.5,1)'}); parcel.style.clipPath=''; }
  };
}
function unbox(parcel,p){
  const lp=S.lps[S.focus]; if(navigator.vibrate)navigator.vibrate([10,30,14]);
  parcel.style.clipPath=tear(p);
  parcel.animate([{transform:'none',opacity:1},{transform:'translate(220px,-40px) rotate(24deg)',opacity:0}],{duration:800,easing:'cubic-bezier(.4,0,.6,1)',fill:'forwards'}).onfinish=()=>{
    lp.status='collection'; log('Unboxed '+lp.city);
    render(); app.querySelector('.screen').style.animation='none';
    const f=app.querySelector('.focus'); f&&f.classList.add('pop');
  };
}
/* 허브 원형 버튼: 눌린 트랙이 밝아지고, 판이 그 트랙 쪽으로 살짝 돌아간 뒤 이동 */
function trackTap(el,next){
  if(navigator.vibrate) navigator.vibrate(10);
  const v=app.querySelector('#s-hub .vwrap');
  if(v) v.animate([{transform:'none'},{transform:'rotate(-24deg)'}],{duration:550,easing:'cubic-bezier(.3,0,.2,1)',fill:'forwards'});
  setTimeout(next,450);
}
/* 시안 B: 판을 꺼낸 뒤 둘로 나눠 멈춤 → 재킷(커버) = Information, 판 = Moment */
const TV=(cx,cy,d,r)=>`translate(${cx-35.5}px,${cy-379.5}px) scale(${d/607}) rotate(${r}deg)`;
function splitIntro(V,Sl){
  const D=2600, ease='cubic-bezier(.45,0,.2,1)';
  S.introAnims=[
    V.animate([
      {transform:TV(196,400,200,0),opacity:0,offset:0},{transform:TV(196,400,200,0),opacity:0,offset:.18},
      {transform:TV(196,400,200,0),opacity:1,offset:.19},{transform:TV(206,400,200,15),offset:.28,easing:ease},
      {transform:TV(286,388,180,250),offset:.62,easing:ease},{transform:TV(286,388,180,250),offset:1}
    ],{duration:D,fill:'forwards'}),
    Sl.animate([
      {transform:'translateY(40px) scale(.7)',opacity:0,offset:0},{transform:'none',opacity:1,offset:.18,easing:'cubic-bezier(.2,.9,.3,1.2)'},
      {transform:'none',offset:.3},{transform:'translate(-84px,-12px) scale(.8) rotate(-4deg)',offset:.62,easing:ease},{transform:'translate(-84px,-12px) scale(.8) rotate(-4deg)',offset:1}
    ],{duration:D,fill:'forwards'})
  ];
  timers.push(setTimeout(()=>{if(navigator.vibrate)navigator.vibrate(10)},D*.3));
  const fade=(id,d)=>{const e=document.getElementById(id);e&&e.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:700,delay:d,fill:'both',easing:'ease-out'})};
  fade('iHead',200); fade('oInfo',D*.62+100); fade('oMom',D*.62+250);
  // 보여주기만 하고 곧바로 정보 입력으로 (재킷 = Information)
  timers.push(setTimeout(()=>{ if(S.screen==='newIntro') introPick('info'); },D+1300));
  // 다 나온 뒤에는 둘이 번갈아 살짝 숨 쉬어서 '고를 수 있다'는 신호
  timers.push(setTimeout(()=>{ if(S.screen!=='newIntro') return;
    Sl.animate([{transform:'translate(-84px,-12px) scale(.8) rotate(-4deg)'},{transform:'translate(-84px,-18px) scale(.82) rotate(-4deg)'},{transform:'translate(-84px,-12px) scale(.8) rotate(-4deg)'}],{duration:2400,iterations:Infinity,easing:'ease-in-out'});
    V.animate([{transform:TV(286,388,180,250)},{transform:TV(286,388,180,430)}],{duration:6000,iterations:Infinity});
  },D+200));
  log('NewLP intro (split: cover=Information, vinyl=Moment)');
}
function introPick(which){
  if(S.screen!=='newIntro'||S.picking) return; S.picking=true;
  const V=document.getElementById('iV'), Sl=document.getElementById('iS'); if(navigator.vibrate) navigator.vibrate(10);
  [V,Sl].forEach(e=>e.getAnimations().forEach(a=>a.pause()));
  app.querySelectorAll('.i-opt,.i-later,.i-head').forEach(e=>e.animate([{opacity:1},{opacity:0}],{duration:300,fill:'forwards'}));
  if(which==='info'){
    V.animate([{opacity:1},{opacity:0,transform:TV(330,388,150,300)}],{duration:400,fill:'forwards'});
    Sl.animate([{transform:'translate(-84px,-12px) scale(.8) rotate(-4deg)'},{transform:'translate(0,-190px) scale(.57) rotate(0)'}],{duration:650,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'}).onfinish=()=>{S.picking=false;S.fromIntroInfo=true;go('enterInfo','Intro → Information')};
  } else {
    Sl.animate([{opacity:1},{opacity:0,transform:'translate(-140px,0) scale(.7)'}],{duration:400,fill:'forwards'});
    V.animate([{transform:TV(286,388,180,250)},{transform:TV(196,360,277,420)}],{duration:700,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'}).onfinish=()=>{S.picking=false;MakeNewTrack()};
  }
}
function returnIntro(V,Sl){
  S.introReturn=false; log('Info done → vinyl enlarges');
  app.querySelector('.screen').style.animation='none';
  app.querySelectorAll('.i-opt').forEach(e=>e.style.display='none');
  const head=document.getElementById('iHead'); head&&head.animate([{opacity:0},{opacity:1}],{duration:500,fill:'both'});
  // 재킷이 정보 화면 자리에서 내려와 왼쪽에 놓이고, 판이 커지며 허브 자리로
  // 재킷은 판이 커지기 전에 화면 밖으로 확실히 빠져나감 (잔상 없이)
  Sl.style.zIndex=1; V.style.zIndex=2;
  Sl.animate([{transform:'translate(0,-190px) scale(.57)',opacity:1,easing:'cubic-bezier(.4,0,.2,1)'},
              {transform:'translate(-84px,-12px) scale(.8) rotate(-4deg)',opacity:1,offset:.22},
              {transform:'translate(-84px,-12px) scale(.8) rotate(-4deg)',opacity:1,offset:.42,easing:'cubic-bezier(.45,0,.55,1)'},
              {transform:'translate(-330px,10px) scale(.75) rotate(-16deg)',opacity:0,offset:.72},
              {transform:'translate(-330px,10px) scale(.75) rotate(-16deg)',opacity:0,offset:1}],{duration:4800,fill:'forwards'});
  const a=V.animate([{transform:TV(286,388,180,250),offset:0},{transform:TV(286,388,180,340),offset:.55,easing:'cubic-bezier(.45,0,.2,1)'},{transform:TV(35.5,379.5,607,520),offset:1}],{duration:4800,fill:'forwards'});
  head&&head.animate([{opacity:1},{opacity:1,offset:.6},{opacity:0}],{duration:4800,fill:'forwards'});
  a.onfinish=finishIntro;
}
function finishIntro(){
  if(S.screen!=='newIntro') return;
  (S.introAnims||[]).forEach(a=>{a.onfinish=null});
  go('hub','intro done');
  const scr=app.querySelector('.screen'); scr.style.animation='none';
  [...scr.children].forEach(el=>{
    if(el.classList.contains('vwrap')) return;
    if(el.classList.contains('ring')) el.animate([{transform:'rotate(-50deg)',opacity:0},{transform:'none',opacity:1}],{duration:1100,easing:'cubic-bezier(.2,.8,.2,1)'});
    else el.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:800,delay:300,easing:'ease',fill:'backwards'});
  });
}
function saveInfo(){
  const lp=S.currentLP,v=id=>document.getElementById(id).value.trim();
  lp.name=v('f-name');lp.friends=v('f-friends');lp.from=v('f-from');lp.to=v('f-to');lp.city=v('f-city')||lp.name;
  if(lp.from) lp.date=lp.from.slice(0,7).replace('-','.');
  log('EnterInfo saved');
}
const A={
  focus:el=>{ if(!S.listed) return enterList(); focusLP(+el.dataset.i) },
  askDelete:el=>{ const i=+el.dataset.i, lp=S.lps[i]; if(!lp) return;
    const ov=document.createElement('div'); ov.className='del-ov'; ov.id='delOv';
    ov.innerHTML=`<div class="del-card"><b>Delete “${lp.city||'New Journey'}”?</b><p>${lp.moments.length} moment${lp.moments.length===1?'':'s'} will be removed. This can’t be undone.</p>
      <div class="del-btns"><button data-a="cancelDelete">Cancel</button><button class="danger" data-a="confirmDelete" data-i="${i}">Delete</button></div></div>`;
    app.querySelector('.screen').appendChild(ov); requestAnimationFrame(()=>ov.classList.add('show')); },
  cancelDelete:()=>{ const ov=document.getElementById('delOv'); if(!ov) return; ov.classList.remove('show'); setTimeout(()=>ov.remove(),250) },
  confirmDelete:el=>{ const i=+el.dataset.i, lp=S.lps[i]; const ov=document.getElementById('delOv'); ov&&ov.classList.remove('show');
    const f=app.querySelector('.focus');
    const finish=()=>{ S.lps.splice(i,1); if(S.currentLP===lp) S.currentLP=null; if(S.playing===lp) S.playing=null;
      S.focus=-1; log('delete LP '+(lp.city||'New Journey')); render(); };
    if(f) f.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.9) translateY(20px)'}],{duration:450,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'}).onfinish=finish;
    else finish(); },
  openLP,
  newLP:NewLP,
  skipIntro:finishIntro,
  introInfo:()=>introPick('info'),
  introMoment:()=>introPick('moment'),
  introLater:()=>{S.picking=false;finishIntro()},
  plane:PaperAirplane,
  paDiscard:()=>closePaperAirplane('discard'),
  paAdd:()=>closePaperAirplane('add'),
  paPlay:()=>{S.playing=S.shared;S.playSel=0;S.sheet=false;log('Play shared LP');go('play','Play now (shared)')},
  planeBack:()=>go('home','back'),
  hubBack:()=>{ const lp=S.currentLP; if(lp&&!S.lps.includes(lp)) S.lps.push(lp); S.focus=S.lps.indexOf(lp);
    if(S.mode==='Record') ChangeMode('Record','Home','in progress'); S.currentLP=null; S.cameBack=lp.id; go('home','back (journey kept)'); },
  enterInfo:el=>trackTap(el,()=>go('enterInfo','EnterInfo')),
  infoClose:()=>{ if(S.fromIntroInfo){S.fromIntroInfo=false;S.introReturn=true;go('newIntro','Info → back to LP');} else go('hub','close'); },
  infoSave:()=>{saveInfo(); if(S.fromIntroInfo){S.fromIntroInfo=false;S.introReturn=true;go('newIntro','Info saved → back to LP');} else go('hub','Save'); },
  newTrack:MakeNewTrack,
  finish:el=>trackTap(el,FinishJourney),
  finishLocked:()=>{const t=document.getElementById('toast');t.textContent='Record at least one moment first';t.classList.add('show');clearTimeout(S.toastT);S.toastT=setTimeout(()=>t.classList.remove('show'),1800)},
  yes:StartPressing,
  no:()=>{S.modal=null;render()},
  recBack:()=>{S.recording=false;S.currentTrack=null;go('hub','cancel record')},
  mode:el=>{ const k=REC_MODES.indexOf(el.dataset.m), c=REC_MODES.indexOf(S.recMode); switchMode(el.dataset.m,k>c?1:-1); },
  rec:()=>{
    if(S.recMode==='VIDEO'){ if(!S.recording) startVideo(); else stopVideo(); return; }
    if(S.recMode==='PHOTO') document.getElementById('filePhoto').click();
    else if(!S.recording){S.recording=true;S.recStart=Date.now();log('RecordSound start');if(navigator.vibrate)navigator.vibrate(10);render();app.querySelector('.screen').style.animation='none'}
    else stopAudio();
  },
  pin:PinMoment,
  pickClip:()=>document.getElementById('fileVideo').click(),
  coverPick:el=>{
    const lp=S.currentLP,k=+el.dataset.k;
    lp.cover=k<0?{type:'palette',colors:S.coverColors||lp.pal}:{type:'photo',k,url:lp.moments[k].url};
    log('ChooseCover('+(k<0?'palette':'moment '+(k+1))+')'); if(navigator.vibrate)navigator.vibrate(8);
    const j=document.getElementById('cvJacket'), l=document.getElementById('cvLabel');
    j.animate([{transform:'none'},{transform:'translateX(-24px) rotate(-3deg)',opacity:.3}],{duration:280,easing:'ease-in',fill:'forwards'}).onfinish=()=>{
      app.querySelector('.screen').style.animation='none'; render(); app.querySelector('.screen').style.animation='none';
      const j2=document.getElementById('cvJacket'), l2=document.getElementById('cvLabel');
      j2.animate([{transform:'translateX(24px) rotate(3deg)',opacity:.3},{transform:'none',opacity:1}],{duration:520,easing:'cubic-bezier(.2,.9,.3,1.1)'});
      l2.animate([{transform:'rotate(-90deg) scale(.8)',opacity:.4},{transform:'none',opacity:1}],{duration:700,easing:'cubic-bezier(.2,.8,.2,1)'});
    };
  },
  coverBack:()=>{S.modal=null;go('hub','back')},
  toPress:()=>go('pressing','PressIntoLP'),
  songPick:openSongSheet,
  songClose:closeSongSheet,
  songSet:el=>setSong(el.dataset.g,+el.dataset.i),
  songToggle:()=>{S.songPlaying=!S.songPlaying;etUpdate(false)},
  etHome:()=>{S.etIdx=0;etUpdate(true)},
  toDeliver:()=>{S.viewDeliver=false;go('deliver','tap')},
  delivered:Delivered,
  continueRec:el=>{ const lp=S.lps[+el.dataset.i]; S.focus=+el.dataset.i; S.currentLP=lp;
    const v=document.getElementById('ttV'); if(navigator.vibrate) navigator.vibrate(10);
    v&&v.animate([{transform:'none'},{transform:'scale(1.04)'}],{duration:350,easing:'ease-out',fill:'forwards'});
    setTimeout(()=>go('hub','Continue from turntable'),320); },
  openArrived:el=>{ const i=+el.dataset.i; if(S.focus===i) return;
    S.autoScrolling=true; focusLP(i); setTimeout(()=>S.autoScrolling=false,1200); },
  viewDeliver:()=>{S.currentLP=S.lps[S.focus];S.viewDeliver=true;go('deliver','view delivery')},
  tearHint:()=>{const pc=document.getElementById('parcel');pc&&pc.animate([{clipPath:tear(0)},{clipPath:tear(14)},{clipPath:tear(0)}],{duration:900,easing:'ease-in-out'});showToast('포장을 오른쪽으로 끌어서 뜯어주세요')},
  playBack:()=>{S.sheet=false;S.playing=null;go('home','back')},
  sel:el=>{ // 화면 전체를 다시 그리지 않고, 고른 모먼트만 커지고 나머지는 작아지게
    const k=+el.dataset.i; if(k===S.playSel) return; S.playSel=k; S.sheet=false;
    app.querySelectorAll('#s-play .star').forEach(st=>st.classList.toggle('on',+st.dataset.i===k));
    const lp=S.playing||S.lps[S.focus], m=lp.moments[k], btn=app.querySelector('.pl-one');
    if(btn) btn.textContent=`Play only “${(m&&m.note)||`Moment ${k+1}`}”`;
    if(navigator.vibrate) navigator.vibrate(6); },
  playMoment:()=>startListen('single',S.playSel),
  playAll:()=>startListen('slide',0),
  playOne:()=>startListen('single',S.playSel),
  lsBack:()=>{S.listen=null;go('play','back to LP')},
  lsAgain:()=>{S.listen.idx=0;S.listen.t=0;S.listen.ended=false;render()},
  closeSheet:()=>{S.sheet=false;render()}
};
app.addEventListener('pointerdown',e=>{const h=e.target.closest('.hit');if(h){const g=document.getElementById(h.dataset.seg);g&&g.classList.add('pressed')}});
app.addEventListener('pointerup',()=>setTimeout(()=>app.querySelectorAll('.seg.pressed').forEach(g=>{if(S.screen==='hub'&&!g.dataset.keep)g.classList.remove('pressed')}),700));
app.addEventListener('click',e=>{
  const el=e.target.closest('[data-a]'); if(!el) return;
  const a=el.dataset.a; if(a&&A[a]) A[a](el);
});
document.getElementById('filePhoto').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)RecordImage(f,'photo')};
document.getElementById('fileVideo').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)RecordImage(f,'video')};

/* 폰에서는 393px 디자인을 화면 폭에 맞춰 통째로 스케일 → 어느 기기에서도 Figma 비율 그대로 */
S.scale=1; S.introPlayed=true; /* 인트로(부팅 화면) 사용 안 함 */
function fit(){
  const ph=document.getElementById('phone'), W=window.innerWidth, H=window.innerHeight;
  if(W<=520){
    /* 폭에 맞추되, 세로가 너무 짧은 폰(주소창 있는 SE 등)은 화면 전체가 들어오도록 조금 더 줄이고 가운데 정렬 */
    const MIN_H=700; let sc=W/393, left=0;
    if(H/sc<MIN_H){ sc=H/MIN_H; left=(W-393*sc)/2; }
    S.scale=sc; ph.style.width='393px'; ph.style.height=(H/sc)+'px'; ph.style.left=left+'px'; ph.style.transform=`scale(${sc})`; }
  else { S.scale=1; ph.style.width=ph.style.height=ph.style.transform=ph.style.left=''; }
}
fit(); window.addEventListener('resize',fit);
render();
