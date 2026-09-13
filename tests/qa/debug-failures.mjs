import "./load-env.mjs";

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
} = process.env;

async function main() {
  const res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const auth = await res.json();
  const session = { access_token: auth.access_token, refresh_token: auth.refresh_token, expires_in: auth.expires_in, expires_at: auth.expires_at, token_type: "bearer", user: auth.user };
  const cookie = "sb-geturxcylpsubnzweilc-auth-token=" + encodeURIComponent(JSON.stringify(session));

  const tests = [
    { name: "Scenario 1: aaj ki sales batao", msg: "aaj ki sales batao" },
    { name: "Scenario 6: sare customers ki detail do", msg: "sare customers ki detail do" },
    { name: "Scenario 7: product detail", msg: '"Naseem Plain Kurta" ka detail batao' },
    { name: "Scenario 9: order status", msg: "orders ki status batao" },
    { name: "Scenario 10: customer search", msg: "customer search karo" },
    { name: "Scenario 11: analytics report", msg: "Mujhe last 30 days ka sales analytics report do" },
  ];

  for (const t of tests) {
    console.log(`\n=== ${t.name} ===`);
    const r = await fetch("http://localhost:3000/api/ai/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ message: t.msg }),
    });
    const text = await r.text();
    const lines = text.trim().split("\n");
    const events = [];
    let finalText = "";
    let agentName = "";
    const toolCalls = [];
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        events.push(event);
        if (event.type === "text") finalText += event.delta;
        if (event.type === "agent") agentName = event.name;
        if (event.type === "tool") toolCalls.push(`${event.name}(${event.state})`);
      } catch {}
    }
    console.log(`Agent: ${agentName}`);
    console.log(`Tools: ${toolCalls.length > 0 ? toolCalls.join(", ") : "NONE"}`);
    console.log(`Response: ${finalText.substring(0, 300)}`);
  }
}

main().catch(console.error);
