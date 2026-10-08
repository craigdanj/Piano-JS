// Digital waveguide piano. Each string is a fractional-delay feedback loop
// with a frequency-dependent loss filter and a dispersive allpass section.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
class StringModel {
 constructor(sr){this.sr=sr;this.buffer=new Float32Array(Math.ceil(sr/24)+32);}
 tune(f,velocity,tone,decay,index){
  this.buffer.fill(0);this.pos=0;this.lp=0;this.xp=0;this.yp=0;
  this.a=-.17-.1*clamp((f-100)/1600,0,1);
  this.cut=clamp(.52+tone*.27+velocity*.12+f/15000,.5,.995);
  // Match loop phase at the fundamental, including the dispersive allpass.
  const w=2*Math.PI*f/this.sr,a=this.a,b=1-this.cut;
  const lossPhase=-Math.atan2(b*Math.sin(w),1-b*Math.cos(w));
  const dispersionPhase=Math.atan2((a*a-1)*Math.sin(w),2*a+(1+a*a)*Math.cos(w));
  this.delay=clamp((2*Math.PI+lossPhase+dispersionPhase)/w,2,this.buffer.length-3);
  this.gain=Math.exp(-6.9078/(decay*f));this.normalGain=this.gain;
  this.hammerLength=Math.max(3,Math.round(Math.min(this.sr/f*.42,this.sr*(.0026-.0017*velocity)*(1-.15*tone))));
  this.strikeDelay=Math.max(2,Math.round(this.sr/f*.137));
  this.age=0;this.velocity=velocity;this.index=index;
 }
 tick(released){
  let read=this.pos-this.delay;if(read<0)read+=this.buffer.length;
  const i=Math.floor(read),frac=read-i;
  const size=this.buffer.length;
  const xm=this.buffer[(i+size-1)%size],x0=this.buffer[i],x1=this.buffer[(i+1)%size],x2=this.buffer[(i+2)%size];
  // Four-point Lagrange interpolation keeps upper strings from dying too quickly.
  const x=xm*(-frac*(frac-1)*(frac-2)/6)+x0*((frac+1)*(frac-1)*(frac-2)/2)-x1*((frac+1)*frac*(frac-2)/2)+x2*((frac+1)*frac*(frac-1)/6);
  this.lp+=this.cut*(x-this.lp);
  const y=this.a*this.lp+this.xp-this.a*this.yp;this.xp=this.lp;this.yp=y;
  const t=this.age,rt=t-this.strikeDelay,len=this.hammerLength;
  const p=t<len?Math.sin(Math.PI*t/len)**2:0;
  const reflected=rt>=0&&rt<len?Math.sin(Math.PI*rt/len)**2:0;
  const excite=(p-reflected)*(.25+.75*this.velocity);
  this.gain+=( (released?Math.min(this.normalGain,.90):this.normalGain)-this.gain)*.002;
  this.buffer[this.pos]=y*this.gain+excite;
  if(++this.pos===this.buffer.length)this.pos=0;this.age++;
  return x;
 }
}
export class PianoCore {
 constructor(sr,polyphony=40){
  this.sr=sr;this.pedal=false;this.tone=.5;this.decay=1;this.width=.5;this.counter=0;
  this.voices=Array.from({length:polyphony},()=>({active:false,strings:Array.from({length:3},()=>new StringModel(sr)),env:0}));
  this.res=Array.from({length:36},(_,i)=>{let f=110*2**(i/12);return {c:2*Math.cos(2*Math.PI*f/sr)*.9993,r:.9993**2,y1:0,y2:0};});
  this.left=0;this.right=0;this.seed=91823;
 }
 noteOn(note,velocity=.7){
  if(!Number.isFinite(note)||!Number.isFinite(velocity))return;
  note=clamp(Math.round(note),21,108);velocity=clamp(velocity,.03,1);
  let v=this.voices.find(v=>!v.active);
  if(!v)v=this.voices.reduce((a,b)=>(a.held===b.held?a.env<b.env:!a.held)?a:b);
  v.note=note;v.active=true;v.held=true;v.released=false;v.age=0;v.id=++this.counter;v.env=0;
  v.count=note<29?1:note<41?2:3;
  const f=440*2**((note-69)/12), decay=(14-9*clamp((note-21)/87,0,1))*this.decay;
  for(let i=0;i<v.count;i++)v.strings[i].tune(f*2**((i-(v.count-1)/2)*(.65+this.width*1.8)/1200),velocity,this.tone,decay,i);
  v.pan=clamp((note-64)/52,-.65,.65)*this.width;v.level=(.55+velocity*.65)*.22/v.count;
  v.noise=velocity*velocity*.008;v.noiseLp=0;
 }
 noteOff(note){for(const v of this.voices)if(v.active&&v.note===note){v.held=false;if(!this.pedal&&note<89)v.released=true;}}
 setPedal(down){this.pedal=!!down;if(!down)for(const v of this.voices)if(v.active&&!v.held&&v.note<89)v.released=true;}
 stop(){for(const v of this.voices){v.held=false;v.released=true;}this.pedal=false;}
 tick(){
  let l=0,r=0,send=0;
  for(const v of this.voices){if(!v.active)continue;let x=0;
   for(let i=0;i<v.count;i++)x+=v.strings[i].tick(v.released);
   this.seed=(Math.imul(this.seed,1664525)+1013904223)|0;
   const noise=this.seed/2147483648;v.noiseLp+=.3*(noise-v.noiseLp);
   x=x*v.level+v.noiseLp*v.noise*Math.exp(-v.age/(this.sr*.004));
   v.age++;v.env+=.002*(Math.abs(x)-v.env);
   if((v.age>this.sr*.6&&v.env<.000012)||v.age>this.sr*28){v.active=false;continue;}
   l+=x*(1-v.pan)*.707;r+=x*(1+v.pan)*.707;send+=x;
  }
  let sympathetic=0;
  for(const q of this.res){const y=q.c*q.y1-q.r*q.y2+(this.pedal?send*.000016:0);q.y2=q.y1;q.y1=y;sympathetic+=y;}
  this.left=l+sympathetic*.25;this.right=r+sympathetic*.28;
 }
}
