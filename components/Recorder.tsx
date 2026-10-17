'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Download } from 'lucide-react';
export default function Recorder() {
 const [recording,setRecording]=useState(false);
 const [url,setUrl]=useState<string | null>(null);
 const [error,setError]=useState('');
 const mediaRef=useRef<MediaRecorder | null>(null);
 const streamRef=useRef<MediaStream | null>(null);
 const urlRef=useRef<string | null>(null);
 useEffect(()=>()=>{ streamRef.current?.getTracks().forEach(t=>t.stop()); if(urlRef.current) URL.revokeObjectURL(urlRef.current); },[]);
 const start=async()=>{
  setError('');
  try {
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});streamRef.current=stream;
   const parts:BlobPart[]=[];const recorder=new MediaRecorder(stream);
   recorder.ondataavailable=(e)=>{if(e.data.size) parts.push(e.data)};
   recorder.onstop=()=>{
    if(urlRef.current) URL.revokeObjectURL(urlRef.current);
    const output=URL.createObjectURL(new Blob(parts,{type:recorder.mimeType || 'audio/webm'}));
    urlRef.current=output;setUrl(output);stream.getTracks().forEach(t=>t.stop());streamRef.current=null;
   };
   mediaRef.current=recorder;recorder.start();setRecording(true);
  } catch {setError('Microphone access was denied or is unavailable. Use HTTPS or localhost.');}
 };
 const stop=()=>{if(mediaRef.current?.state==='recording'){mediaRef.current.stop();setRecording(false)}};
 return <div className="panel p-6"><div className="mb-5"><h2 className="text-lg font-semibold">Quick capture</h2><p className="text-sm text-slate-400 mt-1">Browser-only demo — files stay on this device until you download them.</p></div><div className="flex flex-wrap items-center gap-3"><button onClick={recording?stop:start} className={'btn '+(recording?'bg-red-500 hover:bg-red-400 text-white':'bg-cyan-400 hover:bg-cyan-300 text-slate-950')}>{recording?<><Square size={18}/> Stop recording</>:<><Mic size={18}/> Start recording</>}</button>{url&&<a href={url} download="echo-recording.webm" className="btn border border-slate-600 hover:bg-slate-800"><Download size={18}/> Download recording</a>}</div>{recording&&<p role="status" className="mt-4 text-red-300">● Recording in progress</p>}{error&&<p role="alert" className="mt-4 text-amber-300">{error}</p>}{url&&!recording&&<audio controls src={url} className="mt-5 w-full" />}</div>;
}
