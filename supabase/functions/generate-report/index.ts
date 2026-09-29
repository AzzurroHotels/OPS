const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const key=Deno.env.get("GEMINI_API_KEY");if(!key)return json({error:"GEMINI_API_KEY is not configured"},503);
 const {report}=await req.json();if(!report)return json({error:"Missing report"},400);
 const model=Deno.env.get("GEMINI_MODEL")||"gemini-2.5-flash";
 const prompt=`Create a concise operations management report using ONLY the factual data below. Do not invent facts. Cover executive summary, completed work, outstanding/overdue work, recurring risks, management attention, and factual follow-ups.\n\n${report}`;
 const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:.2}})});
 const d=await r.json();if(!r.ok)return json({error:d?.error?.message||"Gemini failed"},502);
 const text=d?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("").trim();return text?json({report:text}):json({error:"No report returned"},502);
});