// Piano JS: fractional-delay strings, nonlinear felt contact, passive unison bridge.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Smoothly interpolate hand-voiced register targets (not a fitted piano).
const registers=[
 {note:21,decay:17,fast:3.8,contact:.0020,cut:.72,disp:-.12,detune:.7,strike:.145,level:.85},
 {note:48,decay:12,fast:2.6,contact:.0015,cut:.77,disp:-.17,detune:1.1,strike:.137,level:1},
 {note:72,decay:8,fast:1.8,contact:.0010,cut:.85,disp:-.23,detune:1.4,strike:.125,level:.95},
 {note:108,decay:3.5,fast:.85,contact:.00025,cut:.95,disp:-.27,detune:.8,strike:.11,level:.78}
];
function voicing(note){
 let i=0;while(i<registers.length-2&&note>registers[i+1].note)i++;
 const a=registers[i],b=registers[i+1],t=clamp((note-a.note)/(b.note-a.note),0,1),p={};
 for(const k of Object.keys(a))p[k]=a[k]+(b[k]-a[k])*t;
 return p;
}
class Hammer {
 reset(sr,velocity,tone,profile,frequency){
  this.dt=1/(sr*4);this.compression=0;this.speed=.35+velocity*1.65;
  const duration=Math.min(profile.contact*(1.2-.35*tone),.42/frequency);
  this.stiffness=3/(duration*duration*duration);
  this.impedance=2/duration;this.age=0;this.maxAge=Math.ceil(sr*.014);this.active=true;
 }
 tick(incoming){
  if(!this.active)return 0;
  let forceSum=0;
  // Implicit contact step: felt compression depends on hammer deceleration AND
  // the string's returning velocity. Solve a monotone equation, avoiding an
  // unstable explicit spring at high notes. No tensile (pulling) hammer force.
  for(let j=0;j<4;j++){
   const dt=this.dt,free=this.compression+dt*(this.speed-incoming);
   const compliance=dt*(dt+1/this.impedance);
   // Quadratic felt law F = k*x² has an exact positive implicit root.
   // Rationalized form avoids cancellation and an expensive iterative solve.
   const compression=free>0?2*free/(1+Math.sqrt(1+4*this.stiffness*compliance*free)):0;
   const force=this.stiffness*compression*compression;
   this.speed-=dt*force;this.compression=free-compliance*force;
   forceSum+=force/(2*this.impedance);
  }
  if((this.compression<=0&&this.speed<=incoming)||++this.age>this.maxAge)this.active=false;
  return forceSum*.25;
 }
}
class StringModel {
 constructor(sr){this.sr=sr;this.buffer=new Float32Array(Math.ceil(sr/24)+32);this.strikeHistory=new Float32Array(Math.ceil(sr/24)+32);}
 tune(f,velocity,tone,decay,profile,index){
  this.buffer.fill(0);this.strikeHistory.fill(0);this.pos=0;this.lp=0;this.xp=0;this.yp=0;
  this.a=profile.disp;
  this.cut=clamp(profile.cut+(tone-.5)*.22+(velocity-.5)*.12,.5,.995);
  const w=2*Math.PI*f/this.sr,a=this.a,b=1-this.cut;
  const lossPhase=-Math.atan2(b*Math.sin(w),1-b*Math.cos(w));
  const dispersionPhase=Math.atan2((a*a-1)*Math.sin(w),2*a+(1+a*a)*Math.cos(w));
  this.delay=clamp((2*Math.PI+lossPhase+dispersionPhase)/w,2,this.buffer.length-3);
  this.gain=Math.exp(-6.9078/(decay*f));this.normalGain=this.gain;
  this.strikeDelay=Math.max(2,Math.round(this.sr/f*profile.strike));
  this.releaseGain=Math.exp(-6.9078/(f*(.085+.14*clamp((72-profile.note)/51,0,1))));
  this.smooth=1-Math.exp(-1/(this.sr*.008));this.index=index;this.output=0;this.filtered=0;
 }
 read(){
  let read=this.pos-this.delay;if(read<0)read+=this.buffer.length;
  const i=Math.floor(read),frac=read-i,size=this.buffer.length;
  const xm=this.buffer[(i+size-1)%size],x0=this.buffer[i],x1=this.buffer[(i+1)%size],x2=this.buffer[(i+2)%size];
  const x=xm*(-frac*(frac-1)*(frac-2)/6)+x0*((frac+1)*(frac-1)*(frac-2)/2)-x1*((frac+1)*frac*(frac-2)/2)+x2*((frac+1)*frac*(frac-1)/6);
  this.lp+=this.cut*(x-this.lp);
  const y=this.a*this.lp+this.xp-this.a*this.yp;this.xp=this.lp;this.yp=y;
  this.output=x;this.filtered=y;
 }
 write(released,excitation,bridge){
  const size=this.buffer.length,reflected=this.strikeHistory[(this.pos-this.strikeDelay+size)%size];
  this.strikeHistory[this.pos]=excitation;
  this.gain+=((released?Math.min(this.normalGain,this.releaseGain):this.normalGain)-this.gain)*this.smooth;
  this.buffer[this.pos]=bridge*this.gain+excitation-reflected;
  if(++this.pos===size)this.pos=0;
 }
}
// Stable complex resonators, excited only from the dry strings (no feedback loop).
export class AcousticResonance {
 constructor(sr){
  this.sr=sr;this.left=0;this.right=0;this.bodyLeft=0;this.bodyRight=0;
  this.smooth=1-Math.exp(-1/(sr*.012));
  const mode=(f,tau,weight,pan)=>{const w=2*Math.PI*f/sr,r=Math.exp(-1/(sr*tau));return {c:Math.cos(w),s:Math.sin(w),r,target:r,open:r,closed:Math.exp(-1/(sr*.018)),drive:2*(1-r),re:0,im:0,weight,pan};};
  this.strings=[];
  for(let note=21;note<=108;note++)for(let harmonic=1;harmonic<=2;harmonic++){
   const f=440*2**((note-69)/12)*harmonic;
   if(f>=sr*.44)continue;
   const q=mode(f,clamp(2.4-(note-21)*.019,.5,2.4)/harmonic,harmonic===1?1:.32,clamp((note-64)/64,-.6,.6));
   q.note=note;q.r=q.target=note>=89?q.open:q.closed;this.strings.push(q);
  }
  this.body=[95,137,191,263,347,463,617,823,1097,1481,1993,2719].map((f,i)=>mode(f,.16/(1+f/650),1/Math.sqrt(12)*(1-i*.035),(i%2?1:-1)*.24));
 }
 dampers(keys,pedal,panic=false){for(const q of this.strings)q.target=!panic&&(pedal||keys[q.note]||q.note>=89)?q.open:q.closed;}
 tick(input){
  let l=0,r=0;
  for(const q of this.strings){
   q.r+=(q.target-q.r)*this.smooth;
   const re=q.r*(q.c*q.re-q.s*q.im)+q.drive*input;
   q.im=q.r*(q.s*q.re+q.c*q.im);q.re=re;
   const x=re*q.weight;l+=x*(1-q.pan);r+=x*(1+q.pan);
  }
  this.left=l*.45;this.right=r*.45;
  l=0;r=0;
  for(const q of this.body){
   const re=q.r*(q.c*q.re-q.s*q.im)+q.drive*input;
   q.im=q.r*(q.s*q.re+q.c*q.im);q.re=re;
   const x=re*q.weight;l+=x*(1-q.pan);r+=x*(1+q.pan);
  }
  this.bodyLeft=l*1.7;this.bodyRight=r*1.7;
 }
}
export class PianoCore {
 constructor(sr,polyphony=40){
  if(!Number.isFinite(sr)||sr<22050||sr>192000)throw new RangeError('Sample rate must be 22050–192000 Hz');
  this.sr=sr;this.pedal=false;this.tone=.5;this.decay=1;this.width=.5;this.counter=0;
  this.voices=Array.from({length:polyphony},()=>({active:false,strings:Array.from({length:3},()=>new StringModel(sr)),hammer:new Hammer(),env:0}));
  this.keys=new Uint8Array(128);this.acoustics=new AcousticResonance(sr);
  this.body=.3;this.resonance=.35;this.bodyMix=.3;this.resonanceMix=.35;
  this.mixSmooth=1-Math.exp(-1/(sr*.025));
  this.left=0;this.right=0;this.seed=91823;
 }
 noteOn(note,velocity=.7){
  if(!Number.isFinite(note)||!Number.isFinite(velocity))return;
  note=clamp(Math.round(note),21,108);velocity=clamp(velocity,.03,1);
  this.keys[note]=1;this.acoustics.dampers(this.keys,this.pedal);
  let v=this.voices.find(v=>!v.active);
  if(!v)v=this.voices.reduce((a,b)=>(a.held===b.held?a.env<b.env:!a.held)?a:b);
  v.note=note;v.active=true;v.held=true;v.released=false;v.age=0;v.id=++this.counter;v.env=0;
  v.count=note<29?1:note<41?2:3;
  const f=440*2**((note-69)/12),p=voicing(note),decay=p.decay*clamp(this.decay,.4,1.7);
  const tone=clamp(this.tone,0,1),width=clamp(this.width,0,1);
  for(let i=0;i<v.count;i++)v.strings[i].tune(f*2**((i-(v.count-1)/2)*p.detune*(.65+width)/1200),velocity,tone,decay,p,i);
  v.hammer.reset(this.sr,velocity,tone,p,f);
  // A passive bridge matrix: common motion loses energy faster than differences.
  // Quarter-strength common loss preserves definition alongside string damping.
  // Eigenvalues 1-loss and 1-mix are both in [0,1]; no energy-adding crossfeed.
  v.bridgeLoss=v.count>1?1-Math.exp(-.25*6.9078/(f*p.fast*clamp(this.decay,.4,1.7))):0;
  v.mix=v.bridgeLoss*.12;
  v.pan=clamp((note-64)/52,-.65,.65)*width;v.level=(.55+velocity*.65)*.32*p.level/v.count;
  v.noise=velocity*velocity*.006;v.noiseLp=0;
 }
 noteOff(note){
  if(Number.isInteger(note)&&note>=0&&note<128)this.keys[note]=0;
  for(const v of this.voices)if(v.active&&v.note===note){v.held=false;if(!this.pedal&&note<89)v.released=true;}
  this.acoustics.dampers(this.keys,this.pedal);
 }
 setPedal(down){this.pedal=!!down;if(!down)for(const v of this.voices)if(v.active&&!v.held&&v.note<89)v.released=true;this.acoustics.dampers(this.keys,this.pedal);}
 stop(){for(const v of this.voices){v.held=false;v.released=true;v.hammer.active=false;}this.pedal=false;this.keys.fill(0);this.acoustics.dampers(this.keys,false,true);}
 tick(){
  let l=0,r=0,send=0;
  for(const v of this.voices){if(!v.active)continue;let x=0,mean=0,incoming=0;
   for(let i=0;i<v.count;i++){const s=v.strings[i];s.read();mean+=s.filtered;incoming+=s.output;}
   mean/=v.count;incoming/=v.count;
   const hammer=v.hammer.tick(incoming*.45);
   for(let i=0;i<v.count;i++){
    const s=v.strings[i];
    s.write(v.released,hammer*(1-i*.035),(1-v.mix)*s.filtered+(v.mix-v.bridgeLoss)*mean);
    x+=s.output*(1-i*.08);
   }
   this.seed=(Math.imul(this.seed,1664525)+1013904223)|0;
   const noise=this.seed/2147483648;v.noiseLp+=.3*(noise-v.noiseLp);
   x=x*v.level+v.noiseLp*v.noise*Math.exp(-v.age/(this.sr*.004));
   v.age++;v.env+=.002*(Math.abs(x)-v.env);
   if((v.age>this.sr*.6&&v.env<.000012)||v.age>this.sr*35){v.active=false;continue;}
   l+=x*(1-v.pan)*.707;r+=x*(1+v.pan)*.707;send+=x;
  }
  this.acoustics.tick(send);
  this.bodyMix+=(clamp(this.body,0,1)-this.bodyMix)*this.mixSmooth;
  this.resonanceMix+=(clamp(this.resonance,0,1)-this.resonanceMix)*this.mixSmooth;
  this.left=l+this.bodyMix*this.acoustics.bodyLeft+this.resonanceMix*this.acoustics.left;
  this.right=r+this.bodyMix*this.acoustics.bodyRight+this.resonanceMix*this.acoustics.right;
 }
}
