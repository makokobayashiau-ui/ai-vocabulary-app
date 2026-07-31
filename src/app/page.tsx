import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookMarked, Clock3, Plus, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { categoryLabel } from "@/lib/constants";
import type { Expression } from "@/types/database";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{count:total},{count:unreviewed},{data:recent}] = await Promise.all([
    supabase.from("expressions").select("id",{count:"exact",head:true}).eq("user_id",user.id).is("deleted_at",null),
    supabase.from("expressions").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("learning_status","unreviewed").is("deleted_at",null),
    supabase.from("expressions").select("*").eq("user_id",user.id).is("deleted_at",null).order("created_at",{ascending:false}).limit(5),
  ]);
  const items=(recent??[]) as Expression[];
  return <AppShell><div className="shell page">
    <section style={{display:"grid",gridTemplateColumns:"minmax(0,1.3fr) minmax(280px,.7fr)",gap:24,alignItems:"stretch"}} className="dashboard-hero">
      <div className="card" style={{padding:"clamp(26px,5vw,56px)",background:"var(--green)",color:"white",border:0,position:"relative",overflow:"hidden"}}><p className="eyebrow" style={{color:"#bfe0cc"}}>Quick capture, deeper learning</p><h1 className="title" style={{margin:"14px 0 18px",maxWidth:620}}>Save the context<br/>before you check the meaning.</h1><p style={{lineHeight:1.8,color:"#dcebe2",maxWidth:580}}>Keep reading. Save unknown words and phrases in a few seconds, with the sentence around them.</p><Link className="btn" href="/memo/new" style={{marginTop:26,background:"white",color:"var(--green)",border:0}}><Plus size={18}/>Add a word</Link><Sparkles size={150} strokeWidth={.7} style={{position:"absolute",right:-18,bottom:-30,opacity:.13}}/></div>
      <div style={{display:"grid",gap:16}}><div className="card" style={{padding:25}}><Clock3 color="var(--amber)"/><p style={{fontSize:"2.5rem",fontFamily:"Georgia,serif",margin:"20px 0 4px"}}>{unreviewed??0}</p><p style={{color:"var(--muted)"}}>Not started</p></div><div className="card" style={{padding:25}}><BookMarked color="var(--green)"/><p style={{fontSize:"2.5rem",fontFamily:"Georgia,serif",margin:"20px 0 4px"}}>{total??0}</p><p style={{color:"var(--muted)"}}>Saved expressions</p></div></div>
    </section>
    <section style={{marginTop:42}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"end",gap:16,marginBottom:16}}><div><p className="eyebrow">Recently saved</p><h2 style={{fontFamily:"Georgia,serif",fontSize:"1.8rem",marginTop:8}}>Recent memos</h2></div><Link href="/expressions" style={{color:"var(--green)",fontWeight:800,display:"flex",gap:6,alignItems:"center"}}>View all <ArrowRight size={17}/></Link></div>
      <div className="card" style={{overflow:"hidden"}}>{items.length?items.map((item,index)=><Link href={`/expressions/${item.id}`} key={item.id} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:16,padding:"18px 22px",borderTop:index?"1px solid var(--line)":"none"}}><div><strong style={{fontSize:"1.1rem"}}>{item.target_expression}</strong><p style={{color:"var(--muted)",fontSize:14,marginTop:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.source_sentence||"No sentence yet."}</p></div><span className="hint">{categoryLabel(item.category)}</span></Link>):<div style={{padding:32,textAlign:"center",color:"var(--muted)"}}>Add your first expression.</div>}</div>
    </section>
  </div></AppShell>;
}
