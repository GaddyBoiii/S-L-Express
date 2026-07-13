import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const BENGALURU_EMAIL = "slexpressbng@gmail.com";
const CHENNAI_EMAIL = "slexpress15@gmail.com";

function getRecipients(fields: Record<string, unknown>): string[] {
  const branch = fields["Preferred Branch"];
  if (branch === "Bengaluru") return [BENGALURU_EMAIL];
  if (branch === "Chennai") return [CHENNAI_EMAIL];
  return [BENGALURU_EMAIL, CHENNAI_EMAIL]; 
}
const FROM_EMAIL = "enquiries@slexpress.in"; 

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { type, fields } = body;

    if (!type || !fields || !fields.Name || !fields.Phone) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject = type === "ship"
      ? "Ship a Parcel Enquiry — S.L. Express"
      : "Partner Enquiry — S.L. Express";

    const rows = Object.entries(fields)
      .filter(([, v]) => v)
      .map(([k, v]) => `<p><strong>${k}:</strong> ${escapeHtml(String(v))}</p>`)
      .join("");

    const html = `
      <div style="font-family: sans-serif; font-size: 15px; color: #222;">
        <h2>${type === "ship" ? "New Ship a Parcel enquiry" : "New Partner with Us enquiry"}</h2>
        ${rows}
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: getRecipients(fields),
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("Resend error:", errText);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}