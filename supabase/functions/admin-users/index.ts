import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const authHeader=req.headers.get('Authorization')||''
  const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const caller=createClient(url,anon,{global:{headers:{Authorization:authHeader}}})
  const {data:{user}}=await caller.auth.getUser()
  if(!user) return Response.json({error:'Unauthorized'},{status:401})
  const admin=createClient(url,service)
  const {data:profile}=await admin.from('profiles').select('role,is_active').eq('id',user.id).single()
  if(profile?.role!=='admin'||profile?.is_active===false) return Response.json({error:'Admin access required'},{status:403})
  const body=await req.json()
  if(body.action==='list'){
    const {data:{users},error}=await admin.auth.admin.listUsers({page:1,perPage:1000})
    if(error) return Response.json({error:error.message},{status:400})
    const {data:profiles}=await admin.from('profiles').select('id,display_name,role,department,is_active')
    const pm=new Map((profiles||[]).map(p=>[p.id,p]))
    return Response.json({users:users.map(u=>({id:u.id,email:u.email,...pm.get(u.id)}))})
  }
  if(body.action==='create'){
    if(!body.email||!body.password||!body.display_name) return Response.json({error:'Name, email and password are required'},{status:400})
    const allowedRoles=['admin','manager','team_member']; if(!allowedRoles.includes(body.role)) return Response.json({error:'Invalid role'},{status:400})
    const {data,error}=await admin.auth.admin.createUser({email:body.email,password:body.password,email_confirm:true,user_metadata:{display_name:body.display_name}})
    if(error) return Response.json({error:error.message},{status:400})
    const {error:pe}=await admin.from('profiles').update({display_name:body.display_name,role:body.role,department:body.department,is_active:true}).eq('id',data.user.id)
    if(pe) return Response.json({error:pe.message},{status:400})
    return Response.json({ok:true,user_id:data.user.id})
  }
  return Response.json({error:'Unsupported action'},{status:400})
})
