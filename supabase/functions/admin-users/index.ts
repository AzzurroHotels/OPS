import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(x:any,status=200)=>new Response(JSON.stringify(x),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token=req.headers.get("Authorization")||"";
  const caller=createClient(url,anon,{global:{headers:{Authorization:token}}});
  const {data:{user},error:ue}=await caller.auth.getUser();if(ue||!user)return json({error:"Unauthorized"},401);
  const admin=createClient(url,service);
  const {data:p}=await admin.from("profiles").select("role,is_active").eq("id",user.id).single();
  if(p?.role!=="admin"||p?.is_active!==true)return json({error:"Admin access required"},403);
  const b=await req.json();
  if(b.action==="create"){
   if(!b.display_name||!b.email||!b.password)return json({error:"Name, email and password are required"},400);
   if(!["admin","manager","team_member"].includes(b.role))return json({error:"Invalid role"},400);
   const {data,error}=await admin.auth.admin.createUser({email:b.email,password:b.password,email_confirm:true,user_metadata:{display_name:b.display_name}});
   if(error)return json({error:error.message},400);
   const {error:pe}=await admin.from("profiles").update({display_name:b.display_name,email:b.email,role:b.role,department:b.department||null,is_active:true}).eq("id",data.user.id);
   if(pe)return json({error:pe.message},400); return json({ok:true,id:data.user.id});
  }
  if(b.action==="set_active"){
   if(!b.user_id||b.user_id===user.id)return json({error:"Invalid user"},400);
   const {error}=await admin.from("profiles").update({is_active:!!b.is_active}).eq("id",b.user_id);
   if(error)return json({error:error.message},400);return json({ok:true});
  }
  return json({error:"Unsupported action"},400);
 }catch(e){return json({error:e?.message||String(e)},500)}
});