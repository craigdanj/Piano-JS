const $=id=>document.getElementById(id);
const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const keyMap={a:0,w:1,s:2,e:3,d:4,f:5,t:6,g:7,y:8,h:9,u:10,j:11,k:12,o:13,l:14,p:15,';':16};
const held=new Map(),pointers=new Map(),pressed=new Map();let base=60,ctx,node,master,wet,analyser,initPromise,pedalLatch=false,spaceHeld=false,demoTimers=[],demoPlaying=false,generation=0;
const noteName=n=>names[n%12]+(Math.floor(n/12)-1);
const keyElements=new Map();let whiteIndex=0;
for(let n=48;n<=84;n++){
 const black=[1,3,6,8,10].includes(n%12),el=document.createElement('button');
 el.className='key '+(black?'black':'white');el.dataset.note=n;el.setAttribute('aria-label',noteName(n));el.setAttribute('aria-pressed','false');
 if(black)el.style.left=`${whiteIndex/22*100-1.35}%`;else whiteIndex++;
 el.innerHTML=`<span>${n%12===0?`<small>${noteName(n)}</small>`:''}<b></b></span>`;
 $('keyboard').appendChild(el);keyElements.set(n,el);
}
function labels(){for(const[n,e]of keyElements){const k=Object.keys(keyMap).find(k=>base+keyMap[k]===n);e.querySelector('b').textContent=k?k.toUpperCase():'';}$('octave').textContent=noteName(base);$('octDown').disabled=base<=48;$('octUp').disabled=base>=72;}
labels();
function params(){node?.port.postMessage({type:'params',tone:+$('tone').value/100,decay:+$('decay').value/100,width:.55,body:+$('body').value/100,resonance:+$('resonance').value/100});if(master)master.gain.setTargetAtTime(+$('volume').value/100*.75,ctx.currentTime,.03);if(wet)wet.gain.setTargetAtTime(+$('room').value/100*.65,ctx.currentTime,.03);}
function send(d){node?.port.postMessage(d);}
async function enable(){
 if(ctx&&node){await ctx.resume();return;}
 if(initPromise)return initPromise;
 initPromise=(async()=>{const power=$('power');power.disabled=true;power.textContent='Preparing piano…';
 try{
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('This browser does not support Web Audio.');
  ctx=new AC({latencyHint:'interactive'});await ctx.resume();
  await ctx.audioWorklet.addModule('./piano-worklet.js');
  node=new AudioWorkletNode(ctx,'grand-piano',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});
  // Gentle radiation/body shaping; a room response is separate from the strings.
  const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=32;hp.Q.value=.5;
  const body=ctx.createBiquadFilter();body.type='peaking';body.frequency.value=230;body.Q.value=.65;body.gain.value=3;
  const presence=ctx.createBiquadFilter();presence.type='peaking';presence.frequency.value=2200;presence.Q.value=.7;presence.gain.value=-2;
  const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=10500;lp.Q.value=.5;
  master=ctx.createGain();wet=ctx.createGain();const room=ctx.createConvolver();
  const ir=ctx.createBuffer(2,Math.round(ctx.sampleRate*2.5),ctx.sampleRate);
  let seed=24;for(let ch=0;ch<2;ch++){const a=ir.getChannelData(ch);let last=0;for(let i=0;i<a.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;last=.68*last+.32*(seed/2147483648);const t=i/ctx.sampleRate;a[i]=t<.018?0:last*Math.exp(-t*3.3)*Math.min(1,(t-.018)*40);}}
  room.buffer=ir;
  const safety=ctx.createDynamicsCompressor();safety.threshold.value=-9;safety.knee.value=9;safety.ratio.value=8;safety.attack.value=.003;safety.release.value=.2;
  analyser=ctx.createAnalyser();analyser.fftSize=1024;
  node.connect(hp).connect(body).connect(presence).connect(lp);lp.connect(master);lp.connect(room).connect(wet).connect(master);master.connect(safety).connect(analyser).connect(ctx.destination);
  params();ctx.onstatechange=()=>{$('status').textContent=ctx.state==='running'?'Ready to play':'Sound paused';};
  document.body.classList.add('enabled');power.disabled=false;power.innerHTML='Sound enabled <span>◉</span>';$('status').textContent='Ready to play';
 }catch(e){if(ctx)await ctx.close().catch(()=>{});ctx=null;node=null;initPromise=null;power.disabled=false;power.textContent='Retry sound';$('status').textContent='Audio unavailable';$('noteReadout').textContent='ENABLE SOUND TO RETRY';throw e;}
 })();return initPromise;
}
function showNote(note,on){const e=keyElements.get(note);e?.classList.toggle('active',on);e?.setAttribute('aria-pressed',String(on));}
function on(note,velocity){held.set(note,(held.get(note)||0)+1);send({type:'on',note,velocity});showNote(note,true);$('noteReadout').textContent=[...held.keys()].map(noteName).join(' · ');}
function off(note){const count=held.get(note)||0;if(count>1){held.set(note,count-1);return;}held.delete(note);send({type:'off',note});showNote(note,false);$('noteReadout').textContent=held.size?[...held.keys()].map(noteName).join(' · '):'LISTEN TO THE DECAY';}
function pedal(){const down=pedalLatch||spaceHeld;send({type:'pedal',down});$('sustain').setAttribute('aria-pressed',String(down));}
function stopDemo(){for(const t of demoTimers)clearTimeout(t);demoTimers=[];demoPlaying=false;$('demo').innerHTML='<span>▷</span> Play a little nocturne';$('demo').setAttribute('aria-pressed','false');}
function stop(){generation++;stopDemo();pressed.clear();pointers.clear();held.clear();pedalLatch=false;spaceHeld=false;pedal();send({type:'stop'});for(const[n]of keyElements)showNote(n,false);$('noteReadout').textContent='ALL NOTES RELEASED';}
$('power').onclick=()=>enable().catch(console.error);
$('stop').onclick=stop;$('sustain').onclick=async()=>{try{await enable();pedalLatch=!pedalLatch;pedal();}catch(e){console.error(e);}};
for(const id of ['tone','decay','room','volume','body','resonance'])$(id).oninput=()=>{$(id+'Out').textContent=$(id).value+'%';params();};
const presets={grand:[50,100,24,'Clear attack. Warm, lingering strings.',30,35],felt:[15,80,30,'A softer strike. Close and unhurried.',22,25],bright:[90,90,17,'Crisp hammers. A more forward voice.',20,25]};
$('preset').onchange=()=>{const p=presets[$('preset').value];['tone','decay','room'].forEach((id,i)=>{$(id).value=p[i];$(id+'Out').textContent=p[i]+'%';});['body','resonance'].forEach((id,i)=>{$(id).value=p[4+i];$(id+'Out').textContent=p[4+i]+'%';});$('presetDesc').textContent=p[3];params();};
function octave(delta){base=Math.max(48,Math.min(72,base+delta));labels();}
$('octDown').onclick=()=>octave(-12);$('octUp').onclick=()=>octave(12);
function touchVelocity(e,el){const r=el.getBoundingClientRect();return Math.max(.18,Math.min(1,.28+.72*(e.clientY-r.top)/r.height))*(+$('velocity').value/.72);}
$('keyboard').addEventListener('pointerdown',async e=>{
 const el=e.target.closest('.key');if(!el)return;e.preventDefault();const n=+el.dataset.note;
 const state={note:n,started:false};pointers.set(e.pointerId,state);el.setPointerCapture(e.pointerId);const g=generation;
 try{await enable();if(g!==generation||pointers.get(e.pointerId)!==state)return;state.started=true;on(n,Math.min(1,touchVelocity(e,el)));}catch(err){pointers.delete(e.pointerId);console.error(err);}
});
function pointerEnd(e){const p=pointers.get(e.pointerId);if(p?.started)off(p.note);pointers.delete(e.pointerId);}
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('keyboard').addEventListener(name,pointerEnd);
// Focusable keys support Enter for keyboard and assistive technology users.
$('keyboard').addEventListener('keydown',async e=>{if(e.key!=='Enter'||e.repeat)return;const el=e.target.closest('.key');if(!el)return;e.preventDefault();try{await enable();const n=+el.dataset.note;on(n,+$('velocity').value);setTimeout(()=>off(n),450);}catch(err){console.error(err);}});
window.addEventListener('keydown',async e=>{
 if(e.key==='Escape'){stop();return;}
 if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
 const k=e.key.toLowerCase();if(!(k in keyMap)&&e.code!=='Space')return;
 if(e.code==='Space'&&e.target.tagName==='BUTTON')return;
 e.preventDefault();if(e.repeat)return;
 if(e.code==='Space'){spaceHeld=true;try{await enable();pedal();}catch(err){console.error(err);}return;}
 const n=base+keyMap[k],state={note:n,started:false},g=generation;pressed.set(e.code,state);
 try{await enable();if(g!==generation||pressed.get(e.code)!==state)return;state.started=true;on(n,+$('velocity').value);}catch(err){pressed.delete(e.code);console.error(err);}
});
window.addEventListener('keyup',e=>{if(e.code==='Space'){spaceHeld=false;pedal();}const p=pressed.get(e.code);if(p?.started)off(p.note);pressed.delete(e.code);});
window.addEventListener('blur',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
$('demo').onclick=async()=>{if(demoPlaying){stop();return;}try{await enable();stop();demoPlaying=true;$('demo').innerHTML='<span>Ⅱ</span> Stop nocturne';$('demo').setAttribute('aria-pressed','true');pedalLatch=true;pedal();
 const chords=[[48,55,60,64,67,72],[45,52,57,60,64,69],[41,48,53,57,60,65],[43,50,55,59,62,67],[48,55,60,64,67,76],[45,52,57,60,64,72],[41,48,53,57,60,69],[43,50,55,59,62,71]];
 const schedule=(fn,ms)=>demoTimers.push(setTimeout(fn,ms));
 chords.forEach((ch,bar)=>{schedule(()=>{pedalLatch=false;pedal();},bar*2100);schedule(()=>{pedalLatch=true;pedal();},bar*2100+70);ch.forEach((n,j)=>{const t=bar*2100+j*285;schedule(()=>on(n,j===5?.72:.48+j*.025),t);schedule(()=>off(n),t+550);});});
 schedule(()=>{[48,55,60,64,67,72].forEach(n=>on(n,.57));},16800);schedule(()=>{[48,55,60,64,67,72].forEach(off);},18200);schedule(()=>{pedalLatch=false;pedal();stopDemo();},20500);
 }catch(err){console.error(err);}};
// Lightweight waveform display, using one reused sample array.
const canvas=$('scope'),g=canvas.getContext('2d'),data=new Float32Array(1024);let lastFrame=0;
function draw(now){requestAnimationFrame(draw);if(now-lastFrame<45||document.hidden)return;lastFrame=now;const w=Math.round(canvas.clientWidth*devicePixelRatio),h=Math.round(canvas.clientHeight*devicePixelRatio);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}g.clearRect(0,0,w,h);g.strokeStyle='#b99b68';g.lineWidth=devicePixelRatio;g.beginPath();if(analyser)analyser.getFloatTimeDomainData(data);for(let i=0;i<512;i++){const x=i/511*w,y=h/2+(analyser?data[i]*h*2:0);if(i)g.lineTo(x,y);else g.moveTo(x,y);}g.stroke();}
requestAnimationFrame(draw);
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'set_piano_voicing',description:'Select the visible piano voicing. Does not start audio.',inputSchema:{type:'object',properties:{voicing:{type:'string',enum:['grand','felt','bright']}},required:['voicing'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||!Object.hasOwn(presets,input.voicing))throw new Error('Unknown voicing');$('preset').value=input.voicing;$('preset').onchange();return {voicing:$('preset').value,hammer:+$('tone').value,decay:+$('decay').value,room:+$('room').value};}})).catch(console.warn);}catch(e){console.warn(e);}}
