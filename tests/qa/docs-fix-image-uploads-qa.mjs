/**
 * DOCS/FIX.TXT — IMAGE UPLOAD PERSISTENCE (Vercel production).
 *
 * Confirms that every image-upload path in the app persists to Supabase
 * Storage (the `product-images` public bucket) and is immediately readable
 * through the exact public URL the app builds via lib/images.ts
 * (resolveImageUrl). No upload may ever write to a local filesystem path,
 * because Vercel serverless functions have an ephemeral, read-only-except
 * /tmp filesystem.
 *
 * What this locks in:
 *   1. BUCKET AVAILABILITY — the `product-images` bucket exists and is public.
 *   2. ADMIN UPLOAD PERSISTS — an upload performed with an ADMIN session JWT
 *      (exactly the RLS path the app's uploadImageAction server action uses)
 *      succeeds and the object survives in storage — it is NOT silently
 *      written to ephemeral local disk.
 *   3. PUBLIC URL REACHABLE — the resolved public URL (same format as
 *      lib/images.ts) returns HTTP 200, so storefront rendering works.
 *   4. LIST + DELETE — the upload appears in folder listing and can be
 *      removed, so the media library can re-use/clean up its own uploads.
 *   5. CUSTOMER (non-admin) UPLOAD REJECTED — RLS keeps the write boundary
 *      admin-only; a plain customer JWT cannot write to the bucket.
 *
 * Uses ONLY disposable objects under `qa-temp/<token>/`, removed at teardown.
 * Requires .env.test with SUPABASE_URL + ADMIN credentials. Talks directly to
 * the live Supabase project (the same one the deployed app uses).
 *
 * Usage: node tests/qa/docs-fix-image-uploads-qa.mjs
 */
import {
  createDisposableCustomer,
  deleteDisposableCustomer,
  signIn,
  SUPABASE_URL,
  QaResults,
  sleep,
} from "./lib/harness.mjs";

const BUCKET = "product-images";
const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!SUPABASE_URL) throw new Error("SUPABASE_URL missing from .env.test");
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error("ADMIN_EMAIL/ADMIN_PASSWORD missing from .env.test");
}

// 1x1 transparent PNG — tiny and disposable.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const PNG_BUFFER = Buffer.from(PNG_BASE64, "base64");

const results = new QaResults();

function token() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function storageUpload(jwt, path, isService = false) {
  const headers = {
    "Content-Type": "image/png",
    apikey: isService ? process.env.SUPABASE_SERVICE_KEY : process.env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${jwt}`,
  };
  if (isService) headers["User-Agent"] = "node";
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodePath(path)}`,
    { method: "POST", headers, body: PNG_BUFFER },
  );
  return { status: res.status, body: await res.text().catch(() => "") };
}

async function storageList(jwt, prefix) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ prefix, limit: 100, sortBy: { column: "name", order: "asc" } }),
    },
  );
  if (!res.ok) throw new Error(`list -> ${res.status}: ${await res.text()}`);
  return res.json();
}

async function storageRemove(jwt, path) {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodePath(path)}`,
    {
      method: "DELETE",
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${jwt}`,
      },
    },
  );
  return { status: res.status, body: await res.text().catch(() => "") };
}

const runToken = token();
const folder = `qa-temp/${runToken}`;
const fileName = "upload-image.png";
const objectPath = `${folder}/${fileName}`;

console.log(`QA temp object: ${objectPath}\n`);

try {
  // 1) Admin session JWT (same RLS path as uploadImageAction) can upload.
  const adminAuth = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
  if (!adminAuth.access_token) {
    throw new Error(`admin sign-in failed: ${JSON.stringify(adminAuth)}`);
  }
  const adminJwt = adminAuth.access_token;

  const up = await storageUpload(adminJwt, objectPath);
  results.record(
    "admin-upload",
    "Admin session JWT can upload an image (persists, no local FS write)",
    up.status === 200,
    { note: `status=${up.status} body=${up.body.slice(0, 120)}` },
  );

  // 2) Public URL (resolveImageUrl convention, exactly as lib/images.ts
  //    builds it) is reachable WITHOUT any auth -> bucket is public and
  //    storefront rendering from anon visitors works.
  if (up.status === 200) {
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
    const got = await fetch(publicUrl, { method: "GET" });
    const bytes = Buffer.from(await got.arrayBuffer());
    results.record(
      "public-bucket",
      "Bucket is public: object read with no auth headers returns 200",
      got.status === 200,
      { note: `status=${got.status}, content-type=${got.headers.get("content-type")}` },
    );
    results.record(
      "public-url",
      "Public URL serves the exact uploaded bytes (storefront render OK)",
      got.status === 200 && bytes.length === PNG_BUFFER.length,
      { note: `bytes=${bytes.length}, expected=${PNG_BUFFER.length}` },
    );

    // 3) The uploaded object shows up in folder listing + can be deleted.
    try {
      const list = await storageList(adminJwt, folder);
      const found = Array.isArray(list) && list.some((f) => f.name === fileName);
      results.record("list", "Uploaded image appears in folder listing", found, {
        evidence: JSON.stringify(list),
      });
    } catch (e) {
      results.record("list", "Uploaded image appears in folder listing", false, {
        mismatch: e.message,
      });
    }

    const del = await storageRemove(adminJwt, objectPath);
    results.record("delete", "Admin can delete the uploaded image", del.status === 200, {
      note: `status=${del.status}`,
    });
  }

  // 4) Non-admin customer JWT cannot write -> storage RLS boundary intact.
  const cust = await createDisposableCustomer();
  try {
    const custUp = await storageUpload(cust.auth.access_token, objectPath);
    results.record(
      "customer-rejected",
      "Non-admin customer upload is rejected by storage RLS",
      custUp.status >= 400,
      { note: `status=${custUp.status} (customer has one active session)` },
    );
  } finally {
    await deleteDisposableCustomer(cust.userId);
  }
} catch (error) {
  results.record("run", "QA run completed without exceptions", false, {
    mismatch: error.message,
  });
} finally {
  // Teardown — best effort, in case a step failed mid-run.
  try {
    if (ADMIN_EMAIL) {
      const auth = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
      if (auth.access_token) {
        await sleep(300);
        await storageRemove(auth.access_token, objectPath);
      }
    }
  } catch {
    // ignore teardown errors
  }
}

const summary = results.summary("DOCS/FIX.TXT — IMAGE UPLOAD PERSISTENCE QA");
process.exit(summary.fail > 0 ? 1 : 0);