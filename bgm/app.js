'use strict';
const keys=['Q','W','E','A','S','D','Z','X','C'],hues=[155,180,210,105,48,28,180,238,320];
const $=id=>document.getElementById(id), pads=[];
keys.forEach((key,i)=>{const b=document.createElement('button');b.className='pad';b.style.setProperty('--h',hues[i]);b.setAttribute('aria-label',`音声 ${i+1}、キー ${key}`);b.innerHTML=`<span class="orbit"></span><span class="key">${key}</span>`;b.addEventListener('click',()=>trigger(i));$('pads').append(b);pads.push(b)});
let ctx,master,musicBus,voiceBus,send,delay,feedback,wet,reverb,reverbGain,buffers=[],playing=false,loading=false,timer,next=0,step=0,origin=0,nextWander=Infinity,lastTap=-Infinity,lastWander=-1;
let beat=60/69.75,tick=beat/4,analysis=null,bgm=null;
const loops=new Map(),sources=new Set(),visuals=[];
const slots=[0,1,2,3,4,5,6,7,8],poolSize=17;
function shuffleSlots(){const pool=Array.from({length:poolSize},(_,i)=>i);for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}slots.splice(0,9,...pool.slice(0,9))}
function replacePad(i){const unused=Array.from({length:poolSize},(_,n)=>n).filter(n=>!slots.includes(n));if(!unused.length)return;slots[i]=unused[Math.floor(Math.random()*unused.length)];pads[i].classList.add('shifting');setTimeout(()=>pads[i].classList.remove('shifting'),900)}
let idleSwapTimer;
function scheduleIdleSwap(){clearTimeout(idleSwapTimer);idleSwapTimer=setTimeout(()=>{if(playing&&buffers.length===poolSize&&ctx.currentTime-lastTap>6){const idle=slots.map((_,i)=>i).filter(i=>!loops.has(i));if(idle.length)replacePad(idle[Math.floor(Math.random()*idle.length)])}scheduleIdleSwap()},12000+Math.random()*9000)}
scheduleIdleSwap();
function track(s){sources.add(s);s.onended=()=>{sources.delete(s);s.disconnect()};return s}
function init(){ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=Number($('volume').value)/100*.9;const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=8;limiter.ratio.value=12;limiter.attack.value=.003;limiter.release.value=.18;master.connect(limiter).connect(ctx.destination);
 musicBus=ctx.createGain();musicBus.gain.value=.6;musicBus.connect(master);voiceBus=ctx.createGain();voiceBus.gain.value=.75;voiceBus.connect(master);send=ctx.createGain();send.gain.value=.36;voiceBus.connect(send);delay=ctx.createDelay(3);delay.delayTime.value=beat*.75;feedback=ctx.createGain();feedback.gain.value=.3;wet=ctx.createGain();wet.gain.value=.5;const low=ctx.createBiquadFilter();low.frequency.value=2200;send.connect(delay);delay.connect(low).connect(feedback).connect(delay);low.connect(wet).connect(master);
 reverb=ctx.createConvolver();const impulse=ctx.createBuffer(2,ctx.sampleRate*3,ctx.sampleRate);for(let c=0;c<2;c++){const d=impulse.getChannelData(c);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3)}reverb.buffer=impulse;reverbGain=ctx.createGain();reverbGain.gain.value=.27;send.connect(reverb).connect(reverbGain).connect(master);
}
function queueVisual(v){if(!document.hidden)visuals.push(v)}
async function loadAssets(){
 const response=await fetch('music/analysis.json');if(!response.ok)throw Error('Music analysis unavailable');analysis=await response.json();beat=60/analysis.bpm;tick=beat/4;delay.delayTime.value=beat*.75;
 buffers=await Promise.all(Array.from({length:poolSize},async(_,i)=>{const r=await fetch(`sounds/sound${i+1}.mp3`);if(!r.ok)throw Error('Voice unavailable');return ctx.decodeAudioData(await r.arrayBuffer())}));

}
function initMusic(){bgm=new Audio('music/autumn-original.mp3');bgm.loop=true;bgm.preload='auto';bgm.setAttribute('playsinline','');ctx.createMediaElementSource(bgm).connect(musicBus);
 bgm.addEventListener('error',()=>{playing=false;clearInterval(timer);ctx.suspend();renderTransport();$('status').textContent='BGMを読み込めませんでした。通信を確認して再度お試しください。'});
 if('mediaSession' in navigator){try{navigator.mediaSession.metadata=new MediaMetadata({title:'静かな秋の午後',artist:'最果てのBGM'});navigator.mediaSession.setActionHandler('play',()=>{if(!playing)toggle()});navigator.mediaSession.setActionHandler('pause',()=>{if(playing)toggle()})}catch{}}
}
async function toggle(){
 if(loading)return;$('status').classList.remove('error');loading=true;$('transport').disabled=true;$('transport').setAttribute('aria-busy','true');
 try{
  if(playing){playing=false;clearInterval(timer);bgm.pause();await ctx.suspend();renderTransport();$('status').textContent='ひと休み。もう一度ひらくと、続きから。';if(navigator.mediaSession)navigator.mediaSession.playbackState='paused';return}
  if(!ctx){init();initMusic()}
  await ctx.resume();
  if(!analysis||buffers.length!==poolSize){$('status').textContent='音庭を準備しています…';await loadAssets();shuffleSlots();origin=ctx.currentTime;nextWander=origin+3+Math.random()*3}
  await bgm.play();playing=true;next=ctx.currentTime+.06;step=0;
  renderTransport();$('status').textContent='静かな秋の午後。触れても、聴いているだけでも。';
  if(navigator.mediaSession)navigator.mediaSession.playbackState='playing';
  timer=setInterval(schedule,50);schedule();
 }catch(e){playing=false;clearInterval(timer);if(bgm)bgm.pause();if(ctx)await ctx.suspend();$('status').classList.add('error');$('status').textContent='再生できませんでした。もう一度お試しください。';renderTransport()}
 finally{loading=false;$('transport').disabled=false;$('transport').setAttribute('aria-busy','false')}
}
function renderTransport(){const b=$('transport');b.setAttribute('aria-label',playing?'一時停止':'再生');b.setAttribute('aria-pressed',String(playing));b.innerHTML=playing?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4l13 8-13 8z" fill="currentColor"/></svg>'}
$('transport').addEventListener('click',toggle);renderTransport();
function schedule(){
 if(!playing||ctx.state!=='running'||bgm.paused)return;
 const now=ctx.currentTime,horizon=now+(document.hidden?3:.25);
 for(const [i,l]of loops){if(l.next<now-.15){loops.delete(i);continue}if(l.next<horizon){playVoice(i,Math.max(l.next,now+.005),l.round,false,l.sample);l.round++;l.next+=beat*8;if(l.round>=4)loops.delete(i)}}
 if(nextWander<horizon){if(now-lastTap>1.8){let i;do{i=Math.floor(Math.random()*9)}while(i===lastWander);lastWander=i;playVoice(i,Math.max(nextWander,now+.02),0,true);if(Math.random()<.18){const reply=(i+1+Math.floor(Math.random()*8))%9;playVoice(reply,Math.max(nextWander,now+.02)+.7+Math.random()*1.5,0,true)}}nextWander=now+4+Math.random()*5}
}
function playVoice(i,t,round,distant=false,sample=slots[i]){const buffer=buffers[sample],s=track(ctx.createBufferSource()),g=ctx.createGain(),f=ctx.createBiquadFilter(),p=ctx.createStereoPanner();s.buffer=buffer;const dur=round===0?Math.min(buffer.duration,5):Math.min(buffer.duration,1.2);const offset=round===0?0:Math.max(0,buffer.duration-dur);f.frequency.value=distant?1750:round===0?2600:Math.max(900,3200-round*650);p.pan.value=round===0?0:Math.sin(i+round)*.55;if(distant){const side=Math.random()<.5?-1:1;p.pan.setValueAtTime(side*.85,t);p.pan.linearRampToValueAtTime(-side*.75,t+dur)}const amp=distant?.189:.29*Math.pow(.60,round);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(amp,t+(distant?.12:.065));g.gain.setValueAtTime(amp,t+Math.max(distant?.13:.07,dur-.12));g.gain.linearRampToValueAtTime(0,t+dur);const echo=ctx.createDelay(3),echoFb=ctx.createGain(),echoWet=ctx.createGain(),echoFilter=ctx.createBiquadFilter();
 const echoTimes=[.18,.27,.36,.48,.62,.76,.31,.55,.88]; echo.delayTime.value=echoTimes[i]; echoFb.gain.value=.16; echoWet.gain.value=.24; echoFilter.frequency.value=2600-i*120;
 s.connect(f).connect(g).connect(p); p.connect(voiceBus); p.connect(echo).connect(echoFilter).connect(echoWet).connect(master); echoFilter.connect(echoFb).connect(echo); s.start(t,offset,dur);s.addEventListener('ended',()=>{f.disconnect();g.disconnect();p.disconnect();try{echo.disconnect();echoFb.disconnect();echoWet.disconnect();echoFilter.disconnect()}catch{}});s.isVoice=true;queueVisual({t,i,round,distant})}
function trigger(i){scheduleIdleSwap();if(!playing){$('status').textContent='まず「音庭をひらく」を押してください。';return}const t=ctx.currentTime+.012,sample=slots[i];lastTap=ctx.currentTime;playVoice(i,t,0,false,sample);loops.delete(i);while(loops.size>=3)loops.delete(loops.keys().next().value);loops.set(i,{round:1,next:t+beat*5.5,sample});setTimeout(()=>{if(slots[i]===sample)replacePad(i)},1000+Math.random()*2000);$('status').textContent=`VOICE 0${i+1} を置きました。そのタイミングから、余韻が巡ります。`}
function clearVoices(){loops.clear();if(ctx)nextWander=ctx.currentTime+15+Math.random()*10;for(const s of sources)if(s.isVoice){try{s.stop()}catch{}}for(let i=visuals.length-1;i>=0;i--)if('i'in visuals[i])visuals.splice(i,1);pads.forEach(p=>p.classList.remove('alive','active'));if(ctx){send.disconnect();delay.disconnect();feedback.disconnect();wet.disconnect();reverb.disconnect();reverbGain.disconnect();const low=ctx.createBiquadFilter();low.frequency.value=2200;delay=ctx.createDelay(3);delay.delayTime.value=beat*.75;feedback=ctx.createGain();feedback.gain.value=.3;send.connect(delay);delay.connect(low).connect(feedback).connect(delay);low.connect(wet).connect(master);reverb=ctx.createConvolver();const impulse=ctx.createBuffer(2,ctx.sampleRate*2,ctx.sampleRate);for(let c=0;c<2;c++){const d=impulse.getChannelData(c);for(let j=0;j<d.length;j++)d[j]=(Math.random()*2-1)*Math.pow(1-j/d.length,3)}reverb.buffer=impulse;send.connect(reverb).connect(reverbGain).connect(master)}$('status').textContent='声を消しました。新しい組み合わせをどうぞ。'}

function setVolume(value){if(!Number.isFinite(value)||value<0||value>100)throw Error('Volume must be 0–100');$('volume').value=value;if(ctx)master.gain.setTargetAtTime(value/100*.9,ctx.currentTime,.035);return {volume:value}}
$('volume').addEventListener('input',e=>setVolume(Number(e.target.value)));


document.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;const interactive=/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(e.target.tagName);if(e.code==='Space'&&!interactive){e.preventDefault();toggle();return}if(interactive)return;const i=keys.indexOf(e.key.toUpperCase());if(i>=0){e.preventDefault();trigger(i)}});
document.addEventListener('visibilitychange',()=>{visuals.length=0;rings.length=0;if(playing)schedule()});
const canvas=$('garden'),paint=canvas.getContext('2d'),rings=[];let w,h;function resize(){w=innerWidth;h=innerHeight;canvas.width=w*devicePixelRatio;canvas.height=h*devicePixelRatio;paint.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}addEventListener('resize',resize);resize();
function paintAtmosphere(ms){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const t=ms/1000,x=w*(.28+.12*Math.sin(t/17)),y=h*(.3+.1*Math.cos(t/23)),r=Math.max(w,h)*.58;paint.save();paint.globalCompositeOperation='screen';let g=paint.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(198,220,207,.075)');g.addColorStop(1,'rgba(198,220,207,0)');paint.fillStyle=g;paint.fillRect(0,0,w,h);paint.globalCompositeOperation='multiply';const dx=w*(.72+.08*Math.cos(t/29)),dy=h*(.62+.12*Math.sin(t/19));g=paint.createRadialGradient(dx,dy,0,dx,dy,r*.9);g.addColorStop(0,'rgba(20,38,40,.08)');g.addColorStop(1,'rgba(20,38,40,0)');paint.fillStyle=g;paint.fillRect(0,0,w,h);paint.restore()}
function animate(ms){requestAnimationFrame(animate);paint.clearRect(0,0,w,h);paintAtmosphere(ms||0);if(!ctx)return;const now=ctx.currentTime;for(let j=visuals.length-1;j>=0;j--){const v=visuals[j];if(v.t>now)continue;visuals.splice(j,1);const b=pads[v.i],r=b.getBoundingClientRect();b.classList.add('active');setTimeout(()=>b.classList.remove('active'),250);if(!matchMedia('(prefers-reduced-motion: reduce)').matches)rings.push({x:r.x+r.width/2,y:r.y+r.height/2,start:now,hue:hues[v.i],radius:r.width*.38,distant:v.distant})}pads.forEach((p,i)=>p.classList.toggle('alive',loops.has(i)));for(let j=rings.length-1;j>=0;j--){const r=rings[j],age=now-r.start;if(age>6){rings.splice(j,1);continue}paint.beginPath();paint.arc(r.x,r.y,r.radius+age*28,0,Math.PI*2);paint.strokeStyle=`hsla(${r.hue},45%,75%,${(r.distant?.1:.24)*(1-age/6)})`;paint.lineWidth=1;paint.stroke()}}
animate();
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'clear_voice_loops',description:'Clear the sampler voice loops and echoes while keeping background music.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||typeof input!=='object'||Object.keys(input).length)throw Error('Expected an empty object');clearVoices();return {activeVoiceLoops:loops.size}}})).catch(()=>{})}catch{}}

if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'set_master_volume',description:'Set the overall volume of music and voices from 0 to 100.',inputSchema:{type:'object',properties:{volume:{type:'number',minimum:0,maximum:100}},required:['volume'],additionalProperties:false},execute(input){if(!input||Object.keys(input).length!==1)throw Error('Expected volume');return setVolume(input.volume)}})).catch(()=>{})}catch{}}
