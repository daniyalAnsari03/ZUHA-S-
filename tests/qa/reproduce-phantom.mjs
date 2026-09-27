// Fresh-thread phantom reproduccion: 3 unrelated messages in ONE fresh
// conversation. Reports whether Khirke Jamawar surfaces in mentions/actions.
import {
  chatAdmin,
  queryRows,
  signIn,
  projectRef,
  getFirst,
} from "./lib/harness.mjs";

const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD)
  throw new Error("ADMIN_EMAIL/ADMIN_PASSWORD missing from .env.test");

const auth = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
if (!auth.access_token) throw new Error("admin login failed");
const cookie =
  `sb-${projectRef()}-auth-token=` +
  encodeURIComponent(
    JSON.stringify({
      access_token: auth.access_token,
      refresh_token: auth.refresh_token,
      expires_in: auth.expires_in,
      expires_at: auth.expires_at,
      token_type: "bearer",
      user: auth.user,
    }),
  );

async function hasKhirkeAction(verbose) {
  const logs = await queryRows(
    "ai_audit_logs",
    "",
    "select=tool_name,entity_id,entity_type,summary,status,created_at&order=created_at.desc&limit=40",
  ).catch(() => []);
  const target = Array.isArray(logs)
    ? logs.find(
        (l) =>
          (l.summary ?? "").toLowerCase().includes("khirke") ||
          (l.summary ?? "").toLowerCase().includes("khirke jamawar"),
      )
    : null;
  if (verbose && target)
    console.log(
      "  [audit] khirke-related action in recent logs:",
      JSON.stringify(target),
    );
  return !!target;
}

const thread = [];
for (const [i, msg] of [
  "aaj ki sales batao",
  "mehrab jamawar ka stock 50 kar do",
  "sare orders dikhao",
].entries()) {
  const convId = thread.length
    ? thread[thread.length - 1].conversationId
    : undefined;
  const res = await chatAdmin(
    cookie,
    msg,
    convId ? { conversationId: convId } : {},
  );
  thread.push(res);
  const hasK = /khirke/i.test(res.text);
  console.log(`\n[${i + 1}] "${msg}"`);
  console.log(`  convId=${res.conversationId}`);
  console.log(`  tools=[${res.tools.join(", ")}]`);
  console.log(`  agents=[${res.agents.join(", ")}]`);
  console.log(`  khirkeMention=${hasK}`);
  console.log(`  text=${JSON.stringify(res.text.slice(0, 420))}`);
}

console.log("\n[audit] recent khirke actions (if any):");
const khirkeAction = await hasKhirkeAction(true);

// Khirke + Mehrab stock snapshot now
const khirke = await getFirst("products", "slug=eq.khirke-jamawar");
const mehrab = await getFirst("products", "slug=eq.mehrab-jamawar");
console.log(
  "  khirke stock:",
  khirke?.stock_quantity,
  "| mehrab stock:",
  mehrab?.stock_quantity,
);

const anyMention = thread.some((r) => /khirke/i.test(r.text));
console.log(
  `\nRESULT: khirke mentioned in any reply=${anyMention}; khirke action in audit=${khirkeAction}`,
);
