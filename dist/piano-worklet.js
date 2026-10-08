import {PianoCore} from './piano-core.js';
class PianoProcessor extends AudioWorkletProcessor{
 constructor(){super();this.piano=new PianoCore(sampleRate);this.port.onmessage=({data:d})=>{
 if(d.type==='on')this.piano.noteOn(d.note,d.velocity);
 if(d.type==='off')this.piano.noteOff(d.note);
 if(d.type==='pedal')this.piano.setPedal(d.down);
 if(d.type==='stop')this.piano.stop();
 if(d.type==='params')for(const k of ['tone','decay','width'])if(Number.isFinite(d[k]))this.piano[k]=Math.max(k==='decay'?.4:0,Math.min(k==='decay'?1.7:1,d[k]));
 };}
 process(inputs,outputs){const out=outputs[0];if(!out?.length)return true;for(let i=0;i<out[0].length;i++){this.piano.tick();out[0][i]=this.piano.left;if(out[1])out[1][i]=this.piano.right;}return true;}
}
registerProcessor('grand-piano',PianoProcessor);
