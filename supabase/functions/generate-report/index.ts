import { withSupabase } from "npm:@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

    const { report } = await req.json();
    if (!report || typeof report !== "string") {
      return Response.json({ error: "Missing factual report" }, { status: 400 });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return Response.json({ error: "Gemini is not configured" }, { status: 503 });

    const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";
    const prompt = `You are an operations reporting assistant for a hospitality operations team.
Use ONLY the factual task data supplied below. Do not invent events, causes, owners, dates, or completion claims.
Write a concise management report with:
1. Executive summary
2. Completed work
3. Outstanding / overdue work
4. Recurring or operational risks visible in the data
5. Items requiring management attention
6. Recommended follow-ups based only on the supplied facts
Clearly say when the data is insufficient for a conclusion.

FACTUAL TASK REPORT:
${report}`;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 }
        })
      }
    );

    const data = await r.json();
    if (!r.ok) return Response.json({ error: data?.error?.message || "Gemini request failed" }, { status: 502 });

    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("").trim();
    if (!text) return Response.json({ error: "Gemini returned no report" }, { status: 502 });

    return Response.json({ report: text, generated_by: ctx.userClaims?.email || ctx.userClaims?.sub });
  })
}
