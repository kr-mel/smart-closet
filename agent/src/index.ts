import { extractItemIds, formatCloset, type ClosetItem } from "./closet.ts";
import { buildSystem } from "./prompt.ts";
import { SAMPLE_CLOSET } from "./sample.ts";

interface Env {
  AI: Ai;
  DB: D1Database;
  RATE_LIMITER: RateLimit;
  MODEL: string;
  DAILY_LIMIT: string;
  // موجود بس بـ .dev.vars (npm run dev) — بيسمح بالتجربة على خزانة وهمية بدون تسجيل دخول.
  ALLOW_SAMPLE?: string;
}

interface ChatMessage { role: "user" | "assistant"; content: string }

const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 2000;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_OUTPUT_TOKENS = 700;

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message?: string) {
    super(message ?? code);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status);
      console.error(e);
      return json({ error: "internal", message: e instanceof Error ? e.message : String(e) }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === "/health" && request.method === "GET") return json({ ok: true, model: env.MODEL });
  if (pathname === "/chat" && request.method === "POST") return chat(request, env);
  throw new HttpError(404, "not_found", `${request.method} ${pathname}`);
}

async function chat(request: Request, env: Env): Promise<Response> {
  const sample = env.ALLOW_SAMPLE === "1" && request.headers.get("x-sample-closet") === "1";
  const messages = parseMessages(await readJson(request));

  let items: ClosetItem[];
  let userId: string | null = null;
  if (sample) {
    items = SAMPLE_CLOSET;
  } else {
    userId = await authenticate(request, env);
    const { success } = await env.RATE_LIMITER.limit({ key: userId });
    if (!success) throw new HttpError(429, "rate_limited", "Too many requests, try again in a minute");
    items = await loadCloset(userId, env);
  }

  const limit = Number(env.DAILY_LIMIT) || 20;
  const remaining = userId ? await takeCredit(userId, limit, env) : limit;
  if (remaining < 0) throw new HttpError(429, "agent_quota", `max ${limit} messages a day`);

  const now = new Date();
  const todayEpochDay = Math.floor(now.getTime() / 86_400_000);
  const system = buildSystem(formatCloset(items, todayEpochDay), now.toISOString().slice(0, 10));

  let reply: string;
  try {
    reply = await runModel(env, [{ role: "system", content: system }, ...messages]);
  } catch (e) {
    // الرسالة ما انحسبت عليه إذا الموديل فشل (مثلاً خلصت الحصة المجانية لليوم).
    if (userId) await refundCredit(userId, env);
    console.error(e);
    throw new HttpError(503, "agent_unavailable", "the assistant is unavailable right now, try again later");
  }

  const { text, itemIds } = extractItemIds(reply, new Set(items.map((i) => i.id)));
  return json({ reply: text, itemIds, remaining });
}

async function runModel(env: Env, messages: { role: string; content: string }[]): Promise<string> {
  const result = await env.AI.run(env.MODEL as keyof AiModels, {
    messages,
    max_completion_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.6,
    // تفكير أقل = توكنز أقل = رسائل مجانية أكتر باليوم.
    reasoning_effort: "low",
  } as never) as { response?: string; choices?: { message?: { content?: string } }[] };
  const text = result.choices?.[0]?.message?.content ?? result.response;
  if (typeof text !== "string" || text.trim() === "") throw new Error(`empty model output: ${JSON.stringify(result).slice(0, 300)}`);
  return text;
}

function parseMessages(body: unknown): ChatMessage[] {
  const raw = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(raw) || raw.length === 0) throw new HttpError(400, "missing_messages");
  const messages = raw.slice(-MAX_MESSAGES).map((m, i) => {
    const { role, content } = (m ?? {}) as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") throw new HttpError(400, "bad_message", `messages[${i}]: bad role`);
    if (typeof content !== "string" || content.trim() === "") throw new HttpError(400, "bad_message", `messages[${i}]: empty`);
    return { role, content: content.slice(0, MAX_MESSAGE_CHARS) } as ChatMessage;
  });
  if (messages[messages.length - 1].role !== "user") throw new HttpError(400, "bad_message", "last message must be from the user");
  return messages;
}

// نفس جلسات smart-closet-api: التطبيق بيبعت نفس التوكن اللي بياخده من /auth/google.
async function authenticate(request: Request, env: Env): Promise<string> {
  const match = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(request.headers.get("authorization") ?? "");
  if (!match) throw new HttpError(401, "missing_token");
  const row = await env.DB.prepare("SELECT user_id FROM sessions WHERE token_hash = ?1 AND expires_at > ?2")
    .bind(await sha256Hex(match[1]), Date.now()).first<{ user_id: string }>();
  if (!row) throw new HttpError(401, "invalid_session", "Session expired or signed out");
  return row.user_id;
}

async function loadCloset(userId: string, env: Env): Promise<ClosetItem[]> {
  const { results } = await env.DB.prepare(
    "SELECT id, data FROM records WHERE user_id = ?1 AND kind = 'item' AND deleted = 0",
  ).bind(userId).all<{ id: string; data: string | null }>();
  return results.flatMap((r) => {
    if (!r.data) return [];
    try {
      return [{ ...(JSON.parse(r.data) as ClosetItem), id: r.id }];
    } catch {
      return [];
    }
  });
}

async function takeCredit(userId: string, limit: number, env: Env): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  const row = await env.DB.prepare(
    `INSERT INTO agent_usage (user_id, day, used) VALUES (?1, ?2, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET used = used + 1
     RETURNING used`,
  ).bind(userId, day).first<{ used: number }>();
  const used = row?.used ?? limit + 1;
  return used > limit ? -1 : limit - used;
}

async function refundCredit(userId: string, env: Env): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  await env.DB.prepare("UPDATE agent_usage SET used = MAX(used - 1, 0) WHERE user_id = ?1 AND day = ?2")
    .bind(userId, day).run();
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, "body_too_large");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "bad_json");
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
