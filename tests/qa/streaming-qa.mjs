/**
 * Section D QA — re-verify AI streaming on BOTH chat channels.
 *
 * Parses the raw NDJSON stream from /api/ai/admin and /api/ai/salesman and
 * asserts real incremental streaming: multiple type:"text" delta events
 * delivered over time (not a single blob), a done event, and the concatenated
 * deltas matching done.output.
 */
import "./load-env.mjs";
import {
  APP_URL,
  createDisposableCustomer,
  deleteDisposableCustomer,
  sessionCookie,
  signIn,
  sleep,
} from "./lib/harness.mjs";

const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

function assertStream(events, { textEvents, doneEvents, text }) {
  const deltas = events
    .filter((e) => e?.type === "text")
    .map((e) => e.delta ?? "");
  const concatenated = deltas.join("").trim();
  const done = events.findLast?.((e) => e?.type === "done") ?? null;
  const ok =
    textEvents >= 2 &&
    doneEvents === 1 &&
    concatenated.length > 0 &&
    (done?.output ?? "").trim() === concatenated;
  return {
    ok,
    textEvents,
    doneEvents,
    deltaCount: events.filter((e) => e?.type === "text").length,
    concatenatedLength: concatenated.length,
    matches:
      concatenated.length > 0 && (done?.output ?? "").trim() === concatenated,
  };
}

async function runChannel(label, channel, message, cookie) {
  const t0 = Date.now();
  const res = await fetch(`${APP_URL}/api/ai/${channel}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ message }),
  });

  if (!res.body) {
    return { label, fail: true, note: "no response body", status: res.status };
  }

  const events = [];
  let firstTextAt = null;
  let lastTextAt = null;
  let totalBytes = 0;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n");
    while (boundary !== -1) {
      const line = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 1);
      boundary = buffer.indexOf("\n");
      if (!line.trim()) continue;
      let ev;
      try {
        ev = JSON.parse(line);
      } catch {
        continue;
      }
      events.push(ev);
      if (ev?.type === "text") {
        if (firstTextAt === null) firstTextAt = Date.now();
        lastTextAt = Date.now();
      }
    }
  }

  const textEvents = events.filter((e) => e?.type === "text").length;
  const doneEvents = events.filter((e) => e?.type === "done").length;
  const toolEvents = events.filter((e) => e?.type === "tool").length;
  const agentEvents = events.filter((e) => e?.type === "agent").length;

  const spanMs =
    firstTextAt !== null && lastTextAt !== null ? lastTextAt - firstTextAt : 0;
  const result = assertStream(events, { textEvents, doneEvents });
  const elapsed = Date.now() - t0;

  return {
    label,
    status: res.status,
    ok: res.status === 200 && result.ok,
    textEvents,
    doneEvents,
    toolEvents,
    agentEvents,
    networkBytes: totalBytes,
    deltaSpanMs: spanMs,
    totalMs: elapsed,
    concatenatedLength: result.concatenatedLength,
    matches: result.matches,
    rawStatus: res.statusText,
  };
}

async function main() {
  const summary = [];
  let fails = 0;

  const adminAuth = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
  const adminCookie = sessionCookie(adminAuth);

  const cust = await createDisposableCustomer();

  const adminResult = await runChannel(
    "ADMIN /api/ai/admin",
    "admin",
    "Salam. Storefront ka short overview batao?",
    adminCookie,
  );
  summary.push(adminResult);
  if (!adminResult.ok) fails++;

  await sleep(750);

  const customerResult = await runChannel(
    "CUSTOMER /api/ai/salesman",
    "salesman",
    "Do you have lawn suits in stock? What are the prices?",
    cust.cookie,
  );
  summary.push(customerResult);
  if (!customerResult.ok) fails++;

  console.log("\n===== Streaming QA (Section D) =====");
  for (const r of summary) {
    const verdict = r.ok ? "PASS" : "FAIL";
    console.log(
      `${verdict}  ${r.label}  [http ${r.status}] textEvents=${r.textEvents} doneEvents=${r.doneEvents} tools=${r.toolEvents} agents=${r.agentEvents} deltaSpan=${r.deltaSpanMs}ms total=${r.totalMs}ms bytes=${r.networkBytes} concat=${r.concatenatedLength} matchesDoneOutput=${r.matches}`,
    );
  }
  console.log(
    `Total: ${summary.length} | PASS: ${summary.length - fails} | FAIL: ${fails}`,
  );
  if (fails > 0) process.exitCode = 1;

  await deleteDisposableCustomer(cust.userId).catch(() => {});
}

main().catch((e) => {
  console.error("streaming-qa failed:", e);
  process.exit(1);
});
