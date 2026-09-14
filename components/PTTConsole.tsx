'use client';
import {useRef,useState} from 'react';
import {transcribePtt} from '../lib/audio/transcribe';
import type {AttemptTelemetry} from '../lib/persistence/sessionStore';

type Props={
  onCapture?:(blob:Blob)=>void;
  onTranscript?:(text:string,telemetry:AttemptTelemetry)=>void;
};
export default function PTTConsole({onCapture,onTranscript}:Props){
 const [recording,setRecording]=useState(false);
 const [status,setStatus]=useState('Ready');
 const [blobUrl,setBlobUrl]=useState<string>();
 const recorder=useRef<MediaRecorder|null>(null);
 const chunks=useRef<Blob[]>([]);
 const started=useRef<number>();

 async function start(){
   if(recording) return;
   try{
     const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
     const preferred=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
     const r=new MediaRecorder(stream,preferred?{mimeType:preferred}:undefined);
     recorder.current=r; chunks.current=[];started.current=performance.now();
     r.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};
     r.onstop=async()=>{
       const captureEndedAt=performance.now();
       const b=new Blob(chunks.current,{type:r.mimeType});
       if(blobUrl) URL.revokeObjectURL(blobUrl);
       const url=URL.createObjectURL(b); setBlobUrl(url);
       stream.getTracks().forEach(t=>t.stop()); onCapture?.(b);
       setStatus('Processing transmission…');
       try{
         const result=await transcribePtt(b);const transcriptReceivedAt=performance.now();
         onTranscript?.(result.text,{captureStartedAt:started.current,captureEndedAt,transcriptReceivedAt,audioDurationMs:started.current?Math.round(captureEndedAt-started.current):undefined,transcriptionLatencyMs:Math.round(transcriptReceivedAt-captureEndedAt)});
         setStatus('Transcript received. Review it, then score the readback.');
       }catch(e){setStatus(e instanceof Error?`${e.message} You can still type the transcript manually.`:'Transcription failed. Type the transcript manually.');}
     };
     r.start(200);setRecording(true);setStatus('TRANSMITTING');
   }catch{setStatus('Microphone permission failed or microphone unavailable.');}
 }
 function stop(){if(recorder.current?.state==='recording')recorder.current.stop();setRecording(false);}
 return <section className="card"><h2>Push-to-Talk</h2><p className="small">Press and hold while speaking. Audio is captured only while keyed. When server STT is configured, the API key remains server-side.</p>
 <button aria-pressed={recording} className={`ptt ${recording?'active':''}`} onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}>{recording?'TRANSMIT':'HOLD PTT'}</button>
 <p className="status" aria-live="polite">{status}</p>{blobUrl&&<audio controls src={blobUrl}/>}</section>;
}
