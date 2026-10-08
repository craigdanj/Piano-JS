import assert from 'node:assert/strict';
import {AcousticResonance,PianoCore} from './dist/piano-core.js';
const reports=[];
for(const sr of [44100,48000,96000]){
 function sympathetic(held,pedal,lift=false){
  const a=new AcousticResonance(sr),keys=new Uint8Array(128);if(held)keys[60]=1;
  a.dampers(keys,pedal);let sum=0,n=0;
  for(let i=0;i<sr*.8;i++){
   if(lift&&i===Math.round(sr*.3)){keys.fill(0);a.dampers(keys,false);}
   a.tick(i<sr*.3?Math.sin(2*Math.PI*261.625565*i/sr)*.1:0);
   assert.ok(Number.isFinite(a.left)&&Number.isFinite(a.bodyLeft));
   if(i>sr*.5){sum+=a.left*a.left;n++;}
  }
  return Math.sqrt(sum/n);
 }
 const closed=sympathetic(false,false),held=sympathetic(true,false),pedal=sympathetic(false,true),lift=sympathetic(false,true,true);
 assert.ok(held>closed*10,'Held key must resonate selectively');
 assert.ok(pedal>closed*10,'Pedal must open resonance');
 assert.ok(lift<pedal*.05,'Pedal lift must damp the tail');
 const a=new AcousticResonance(sr);let early=0,late=0;
 for(let i=0;i<sr;i++){a.tick(i===0?1:0);if(i<sr*.1)early+=a.bodyLeft*a.bodyLeft;if(i>sr*.8)late+=a.bodyLeft*a.bodyLeft;}
 assert.ok(early>0&&late<early*.001,'Soundboard must ring then decay');
 const p=new PianoCore(sr);p.body=p.resonance=1;p.setPedal(true);for(let n=35;n<75;n++)p.noteOn(n,1);
 let peak=0;const start=performance.now();
 for(let i=0;i<sr*2;i++){p.tick();assert.ok(Number.isFinite(p.left)&&Number.isFinite(p.right));peak=Math.max(peak,Math.abs(p.left),Math.abs(p.right));}
 assert.ok(peak<4,'Maximum resonance level');
 const cpuSeconds=(performance.now()-start)/1000;p.stop();
 for(let i=0;i<sr*2;i++)p.tick();assert.ok(Math.abs(p.left)+Math.abs(p.right)<1e-5,'Panic must silence resonant tail');
 reports.push({sr,closed,held,pedal,lift,stressPeak:peak,renderSeconds:2,cpuSeconds});
}
console.log(JSON.stringify({status:'passed',reports},null,2));
