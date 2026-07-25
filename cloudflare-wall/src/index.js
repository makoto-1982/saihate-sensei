const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const MAX_IMAGE_BYTES = 1_500_000;
const PAGE_SIZE = 40;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      let response;
      if (request.method === "GET" && url.pathname === "/posts") {
        response = await listPosts(url, env);
      } else if (request.method === "GET" && url.pathname === "/admin/check") {
        response = checkAdmin(request, env);
      } else if (request.method === "POST" && url.pathname === "/posts") {
        response = await createPost(request, env);
      } else if (request.method === "GET" && /^\/images\/[a-f0-9-]+\.jpg$/.test(url.pathname)) {
        response = await getImage(url.pathname.slice(8), request, env);
      } else if (request.method === "DELETE" && /^\/posts\/[a-f0-9-]+$/.test(url.pathname)) {
        response = await deletePost(url.pathname.slice(7), request, env);
      } else {
        response = json({ error: "Not found" }, 404);
      }
      cors.forEach((value, key) => response.headers.set(key, value));
      return response;
    } catch (error) {
      console.error(error);
      const response = json(
        { error: error instanceof HttpError ? error.message : "サーバーで問題が発生しました" },
        error instanceof HttpError ? error.status : 500
      );
      cors.forEach((value, key) => response.headers.set(key, value));
      return response;
    }
  }
};

async function listPosts(url, env) {
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0);
  const rows = await env.DB.prepare(
    `SELECT id, name, message, created_at
     FROM posts ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
  ).bind(PAGE_SIZE + 1, offset).all();
  const hasMore = rows.results.length > PAGE_SIZE;
  const posts = rows.results.slice(0, PAGE_SIZE).map((row) => ({
    id: row.id,
    name: row.name,
    message: row.message,
    createdAt: row.created_at,
    imageUrl: new URL(`/images/${row.id}.jpg`, url.origin).href
  }));
  return json({ posts, hasMore, nextOffset: offset + posts.length });
}

async function createPost(request, env) {
  assertAllowedOrigin(request, env);
  await enforceRateLimit(request, env);
  const form = await request.formData();
  const image = form.get("image");
  if (!(image instanceof File)) return json({ error: "画像がありません" }, 400);
  if (image.type !== "image/jpeg") return json({ error: "JPEG画像のみ投稿できます" }, 415);
  if (image.size < 1 || image.size > MAX_IMAGE_BYTES) {
    return json({ error: "画像は1.5MB以内にしてください" }, 413);
  }

  const name = cleanText(form.get("name"), 10);
  const message = cleanText(form.get("message"), 16);
  const id = crypto.randomUUID();
  const deleteToken = randomToken();
  const deleteTokenHash = await sha256(deleteToken);
  const objectKey = `${id}.jpg`;
  const createdAt = Date.now();

  await env.IMAGES.put(objectKey, image.stream(), {
    httpMetadata: { contentType: "image/jpeg", cacheControl: "public, max-age=31536000, immutable" }
  });
  try {
    await env.DB.prepare(
      `INSERT INTO posts (id, object_key, delete_token_hash, name, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, objectKey, deleteTokenHash, name, message, createdAt).run();
  } catch (error) {
    await env.IMAGES.delete(objectKey);
    throw error;
  }

  const origin = new URL(request.url).origin;
  return json({
    post: { id, name, message, createdAt, imageUrl: `${origin}/images/${objectKey}` },
    deleteToken
  }, 201);
}

async function getImage(objectKey, request, env) {
  const object = await env.IMAGES.get(objectKey, {
    onlyIf: request.headers
  });
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}

async function deletePost(id, request, env) {
  assertAllowedOrigin(request, env);
  const row = await env.DB.prepare(
    "SELECT object_key, delete_token_hash FROM posts WHERE id = ?"
  ).bind(id).first();
  if (!row) return json({ error: "投稿が見つかりません" }, 404);

  const auth = request.headers.get("authorization") || "";
  const isAdmin = env.ADMIN_TOKEN && auth === `Bearer ${env.ADMIN_TOKEN}`;
  let isOwner = false;
  if (!isAdmin) {
    const body = await request.json().catch(() => ({}));
    if (body.deleteToken) isOwner = await sha256(body.deleteToken) === row.delete_token_hash;
  }
  if (!isAdmin && !isOwner) return json({ error: "削除する権限がありません" }, 403);

  await env.IMAGES.delete(row.object_key);
  await env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
  return json({ deleted: true });
}

function checkAdmin(request, env) {
  const auth = request.headers.get("authorization") || "";
  if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return json({ error: "管理パスワードが違います" }, 403);
  }
  return json({ ok: true });
}

async function enforceRateLimit(request, env) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const max = Math.max(1, Number.parseInt(env.MAX_POSTS_PER_HOUR || "6", 10));
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const clientKey = await sha256(`${env.RATE_LIMIT_SALT || "saihate"}:${ip}`);
  const row = await env.DB.prepare(
    "SELECT window_start, post_count FROM rate_limits WHERE client_key = ?"
  ).bind(clientKey).first();
  if (row && now - row.window_start < windowMs && row.post_count >= max) {
    throw new HttpError("短時間の投稿回数が多すぎます。少し時間をおいてください", 429);
  }
  if (!row || now - row.window_start >= windowMs) {
    await env.DB.prepare(
      `INSERT INTO rate_limits (client_key, window_start, post_count) VALUES (?, ?, 1)
       ON CONFLICT(client_key) DO UPDATE SET window_start = excluded.window_start, post_count = 1`
    ).bind(clientKey, now).run();
  } else {
    await env.DB.prepare(
      "UPDATE rate_limits SET post_count = post_count + 1 WHERE client_key = ?"
    ).bind(clientKey).run();
  }
}

function assertAllowedOrigin(request, env) {
  const origin = request.headers.get("origin");
  const allowed = allowedOrigins(env);
  if (origin && !allowed.includes(origin)) throw new HttpError("許可されていないサイトです", 403);
}

function corsHeaders(request, env) {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  });
  const origin = request.headers.get("origin");
  if (origin && allowedOrigins(env).includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
}

function cleanText(value, max) {
  return String(value || "")
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
    .trim()
    .slice(0, max);
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
