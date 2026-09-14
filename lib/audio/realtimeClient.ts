export type RealtimeStatus='idle'|'connecting'|'connected'|'failed'|'closed';

export type RealtimeCallbacks={
  onStatus?:(status:RealtimeStatus,detail?:string)=>void;
  onTranscript?:(text:string)=>void;
  onEvent?:(event:unknown)=>void;
};

/**
 * Experimental WebRTC transport. Disabled unless NEXT_PUBLIC_AEROCOMM_REALTIME=true.
 * Safety rule: this transport may provide audio/transcript events only. It never
 * decides ATC state transitions or readback pass/fail.
 */
export class RealtimeRadioClient{
  private pc?:RTCPeerConnection;
  private dc?:RTCDataChannel;
  private stream?:MediaStream;
  private callbacks:RealtimeCallbacks;
  constructor(callbacks:RealtimeCallbacks={}){this.callbacks=callbacks}

  async connect(){
    if(process.env.NEXT_PUBLIC_AEROCOMM_REALTIME!=='true') throw new Error('Realtime WebRTC is disabled by configuration.');
    this.callbacks.onStatus?.('connecting');
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    const pc=new RTCPeerConnection();
    this.pc=pc;this.stream=stream;
    for(const track of stream.getAudioTracks()){track.enabled=false;pc.addTrack(track,stream)}
    const dc=pc.createDataChannel('oai-events');this.dc=dc;
    dc.onopen=()=>this.callbacks.onStatus?.('connected');
    dc.onclose=()=>this.callbacks.onStatus?.('closed');
    dc.onerror=()=>this.callbacks.onStatus?.('failed','Realtime data channel error.');
    dc.onmessage=(e)=>{
      try{
        const event=JSON.parse(e.data);this.callbacks.onEvent?.(event);
        const text=extractTranscript(event);if(text)this.callbacks.onTranscript?.(text);
      }catch{/* ignore non-JSON provider events */}
    };
    const offer=await pc.createOffer();await pc.setLocalDescription(offer);
    const response=await fetch('/api/realtime/call',{method:'POST',headers:{'Content-Type':'application/sdp'},body:offer.sdp||''});
    if(!response.ok){const payload=await response.json().catch(()=>({}));this.close();throw new Error(payload.error||`Realtime call failed (${response.status}).`)}
    const answer=await response.text();await pc.setRemoteDescription({type:'answer',sdp:answer});
  }

  setTransmitting(active:boolean){for(const track of this.stream?.getAudioTracks()||[])track.enabled=active;}
  close(){this.stream?.getTracks().forEach(t=>t.stop());this.dc?.close();this.pc?.close();this.callbacks.onStatus?.('closed');}
}

function extractTranscript(event:any):string{
  const candidates=[event?.transcript,event?.text,event?.delta,event?.item?.content?.[0]?.transcript,event?.item?.content?.[0]?.text];
  if(!String(event?.type||'').includes('transcript')&&!String(event?.type||'').includes('transcription')) return '';
  return candidates.find((x:unknown)=>typeof x==='string'&&x.trim())?.trim()||'';
}
