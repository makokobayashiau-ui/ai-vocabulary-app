"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function DeleteExpressionDialog({action}:{action:()=>Promise<void>}) {
  const [open,setOpen]=useState(false);
  return <><button className="btn btn-danger" onClick={()=>setOpen(true)}><Trash2 size={17}/>Delete</button>{open&&<div role="dialog" aria-modal="true" aria-labelledby="delete-title" style={{position:"fixed",inset:0,background:"rgba(10,20,15,.45)",display:"grid",placeItems:"center",zIndex:50,padding:20}} onClick={()=>setOpen(false)}><div className="card" style={{padding:28,maxWidth:430,width:"100%"}} onClick={e=>e.stopPropagation()}><h2 id="delete-title" style={{fontSize:"1.3rem",fontWeight:800}}>Delete this memo?</h2><p className="subtitle" style={{margin:"12px 0 24px"}}>It will not show in your list. You cannot restore it from the app now.</p><div style={{display:"flex",justifyContent:"end",gap:10}}><button className="btn" onClick={()=>setOpen(false)}>Cancel</button><form action={action}><button className="btn btn-danger">Delete</button></form></div></div></div>}</>;
}
