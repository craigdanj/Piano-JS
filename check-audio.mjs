import {PianoCore} from './dist/piano-core.js';
import fs from 'node:fs';
const sr=48000;
const results=[];
for(const n of [21,33,48,60,69,84,96,108]){
 const p=new PianoCore(sr);p.noteOn(n,.8);const out=new Float32Array(sr*3);let peak=0,square=0;
 for(let i=0;i<out.length;i++){p.tick();out[i]=p.left;if(!Number.isFinite(out[i]))throw Error('Non-finite audio '+n);peak=Math.max(peak,Math.abs(out[i]));square+=out[i]*out[i];}
 fs.writeFileSync('/tmp/piano-'+n+'.f32',Buffer.from(out.buffer));results.push({note:n,peak,rms:Math.sqrt(square/out.length)});
 p.noteOff(n);for(let i=0;i<sr*4;i++)p.tick();if(n<89&&p.voices.some(v=>v.active))throw Error('Release failed '+n);
}
const p=new PianoCore(sr);p.setPedal(true);for(let i=0;i<40;i++)p.noteOn(35+i,.8);const start=performance.now();let peak=0;
for(let i=0;i<sr*3;i++){p.tick();peak=Math.max(peak,Math.abs(p.left));if(!Number.isFinite(p.left))throw Error('Polyphony unstable');}
console.log(JSON.stringify({notes:results,polyphony:{voices:40,renderSeconds:3,cpuSeconds:(performance.now()-start)/1000,peak}},null,2));
p.stop();for(let i=0;i<sr*5;i++)p.tick();if(p.voices.some(v=>v.active))throw Error('Panic failed');
