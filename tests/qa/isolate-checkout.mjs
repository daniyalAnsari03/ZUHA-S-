/**
 * Isolated repro: two-turn COD checkout via the salesman channel.
 * Turn A: customer gives order request + details, no explicit confirm.
 * Turn B: customer explicitly confirms. Measure whether place_cod_order fires.
 * Usage: node tests/qa/isolate-checkout.mjs
 */
import "./load-env.mjs";

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  APP_URL,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
} = process.env;

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

function sessionCookie(auth) {
  const session = {
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
    expires_in: auth.expires_in,
    expires_at: auth.expires_at,
    token_type: "bearer",
    user: auth.user,
  };
  return "sb-geturxcylpsubnzweilc-auth-token=" + encodeURIComponent(JSON.stringify(session));
}

async function chat(body, cookie) {
  const res = await fetch(`${APP_URL}/api/ai/salesman`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  if (res.status !== 200) return { http: res.status, finalText: "", tools: [], events: [] };
  const text = await res.text();
  let finalText = "";
  const toolCalls = [];
  const events = [];
  for (const line of text.trim().split("\n")) {
    try {
      const ev = JSON.parse(line);
      events.push(ev);
      if (ev.type === "text") finalText += ev.delta;
      if (ev.type === "tool" && ev.state === "end") toolCalls.push(ev.name);
    } catch {}
  }
  return { finalText: finalText.trim(), tools: toolCalls, events };
}

async function main() {
  const authRaw = await signIn(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
  if (!authRaw.access_token) { console.error("signin failed"); process.exit(1); }
  const cookie = sessionCookie(authRaw);
  console.log("customer:", authRaw.user.id, "\n");

  for (let run = 1; run <= 4; run++) {
    console.log(`───── RUN ${run} ─────`);
    const conv = {}; // fresh conversation per run
    const t1 = await chat({ message: "Mujhe Khirke Jamawar order karna hai. Name: QA Customer, Address: Test Address 123, City: Karachi, Phone: 03001234567, Email: qa.customer@dins.test. Payment COD." }, cookie);
    console.log("[A] tools:", t1.tools.join(",") || "(none)");
    console.log("[A] text:", t1.finalText.replace(/\n/g, " | ").substring(0, 220));

    const t2 = await chat({ message: "Haan, main confirm karta hoon. Order place kar do.", conversationId: t1.events.find(e => e.type === "meta")?.conversationId ?? undefined }, cookie);
    console.log("[B] tools:", t2.tools.join(",") || "(none)");
    console.log("[B] text:", t2.finalText.replace(/\n/g, " | ").substring(0, 220));
    console.log("[B] events:", t2.events.map(e => e.type + (e.type === "tool" ? `:${e.name}:${e.state}` : "")).join(" "));
    console.log();
  }
}

main().catch((e) => { console.error("crash", e); process.exit(1); });