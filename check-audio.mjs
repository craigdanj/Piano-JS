import {PianoCore} from './dist/piano-core.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const notes=[21,33,48,60,69,84,96,108], results=[];
function render(p,seconds,capture=false){
 const count=Math.round(p.sr*seconds),out=capture?new Float32Array(count):null;
 let peak=0,energy=0;
 for(let i=0;i<count;i++){
  p.tick();assert.ok(Number.isFinite(p.left)&&Number.isFinite(p.right),'Non-finite stereo output');
  peak=Math.max(peak,Math.abs(p.left),Math.abs(p.right));energy+=(p.left*p.left+p.right*p.right)*.5;
  if(out)out[i]=(p.left+p.right)*.5;
 }
 assert.ok(peak<4,'Excessive raw output');
 return {peak,rms:Math.sqrt(energy/count),out};
}
for(const sr of [44100,48000,96000]){
 for(const note of notes){
  let softRms=0;
  for(const velocity of [.15,.95]){
   const p=new PianoCore(sr);p.noteOn(note,velocity);
   const r=render(p,1.5,sr===48000);
   assert.ok(r.rms>.000001,`Silent note ${note} at ${sr}`);
   if(velocity===.15)softRms=r.rms;else assert.ok(r.rms>softRms*1.5,`Velocity response ${note}`);
   if(r.out)fs.writeFileSync(`/tmp/piano-js-${note}-${velocity}.f32`,Buffer.from(r.out.buffer));
   results.push({sr,note,velocity,peak:r.peak,rms:r.rms});
   p.noteOff(note);render(p,.8);
   if(note<89)assert.ok(!p.voices.some(v=>v.active),`Damper release ${note}`);
   p.stop();render(p,.8);assert.ok(!p.voices.some(v=>v.active),'All notes off');
  }
 }
 // Sustain, repeated strikes, voice reuse and maximum tone/decay at each rate.
 const p=new PianoCore(sr);p.tone=1;p.decay=1.7;p.setPedal(true);
 for(let i=0;i<56;i++){p.noteOn(35+i%40,1);render(p,.005);p.noteOff(35+i%40);}
 assert.equal(p.voices.filter(v=>v.active).length,40);
 const start=performance.now(),stress=render(p,2);
 results.push({sr,stressPeak:stress.peak,renderSeconds:2,cpuSeconds:(performance.now()-start)/1000});
 p.setPedal(false);render(p,1);assert.ok(!p.voices.some(v=>v.active),'Pedal lift');
}
// Check every key, including unison-count and voicing boundaries.
for(let note=21;note<=108;note++){
 const p=new PianoCore(48000);p.noteOn(note,.7);assert.ok(render(p,.15).rms>.000001,`Silent key ${note}`);
}
console.log(JSON.stringify({status:'passed',results},null,2));
