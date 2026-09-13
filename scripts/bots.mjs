/**
 * Runs both Slack bots as one service, for hosts that give you a single free
 * container with a single port: Tally (apps/listener) and the COCO reply
 * surface (apps/channel).
 *
 * Neither bot needs an inbound port — both hold outbound sockets — but hosts
 * like Render only keep a free service alive while HTTP arrives at it. So this
 * process owns $PORT, answers /healthz with the state of both children, and
 * pings its own public URL every few minutes so the host never puts it to
 * sleep.
 *
 * Children are restarted with backoff. The channel exits on its own when the
 * Intelligence side is not online; that should not take the listener down.
 *
 *   node scripts/bots.mjs
 *
 * Env:  PORT (host's), CHANNEL_PORT (internal, default 3001),
 *       LISTENER_ENABLED / CHANNEL_ENABLED ("0" to skip one),
 *       KEEPALIVE_URL (defaults to RENDER_EXTERNAL_URL when Render sets it).
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? 8080);
const keepaliveUrl = (process.env.KEEPALIVE_URL ?? process.env.RENDER_EXTERNAL_URL ?? "").trim();
const KEEPALIVE_EVERY_MS = 5 * 60_000;

const BOTS = [
  {
    name: "tally",
    entry: "apps/listener/src/server.ts",
    enabled: process.env.LISTENER_ENABLED !== "0",
    env: {},
  },
  {
    name: "coco",
    entry: "apps/channel/src/server.ts",
    enabled: process.env.CHANNEL_ENABLED !== "0",
    // The channel serves CopilotKit's own HTTP on a port nobody outside needs.
    env: { PORT: process.env.CHANNEL_PORT ?? "3001" },
  },
];

const state = new Map();
let stopping = false;

function log(name, line) {
  console.log(`[bots] ${name}: ${line}`);
}

function start(bot, attempt = 0) {
  if (stopping || !bot.enabled) return;
  const child = spawn(
    process.execPath,
    ["--env-file-if-exists=.env", "--import", "tsx", bot.entry],
    { cwd: root, env: { ...process.env, ...bot.env }, stdio: ["ignore", "inherit", "inherit"] },
  );
  const startedAt = Date.now();
  state.set(bot.name, { child, up: true, since: startedAt, restarts: attempt });
  log(bot.name, `started (pid ${child.pid}${attempt ? `, restart ${attempt}` : ""})`);

  child.once("exit", (code, signal) => {
    const ranFor = Date.now() - startedAt;
    state.set(bot.name, { child: null, up: false, since: Date.now(), restarts: attempt, lastExit: code ?? signal });
    if (stopping) return;
    // A child that stayed up a while earned a fresh backoff.
    const next = ranFor > 60_000 ? 1 : attempt + 1;
    const delay = Math.min(60_000, 2_000 * 2 ** Math.min(next, 5));
    log(bot.name, `exited (${code ?? signal}) after ${Math.round(ranFor / 1000)}s; restarting in ${delay / 1000}s`);
    setTimeout(() => start(bot, next), delay);
  });
}

// The host's health check and the keepalive both land here.
const server = createServer((req, res) => {
  const bots = Object.fromEntries(
    BOTS.map((b) => {
      const s = state.get(b.name);
      return [b.name, b.enabled ? { up: Boolean(s?.up), since: s?.since ?? null, restarts: s?.restarts ?? 0, lastExit: s?.lastExit ?? null } : "disabled"];
    }),
  );
  const healthy = BOTS.filter((b) => b.enabled).every((b) => state.get(b.name)?.up);
  const body = JSON.stringify({ ok: healthy, bots, uptime: Math.round(process.uptime()) }, null, 2);
  res.writeHead(req.url === "/healthz" && !healthy ? 503 : 200, { "content-type": "application/json" });
  res.end(body);
});

server.listen(port, () => {
  log("supervisor", `health on :${port}`);
  for (const bot of BOTS) {
    if (bot.enabled) start(bot);
    else log(bot.name, "disabled");
  }
});

if (keepaliveUrl) {
  const ping = async () => {
    try {
      const res = await fetch(new URL("/healthz", keepaliveUrl), { signal: AbortSignal.timeout(20_000) });
      log("keepalive", `${res.status}`);
    } catch (e) {
      log("keepalive", `failed: ${e instanceof Error ? e.message : e}`);
    }
  };
  setInterval(ping, KEEPALIVE_EVERY_MS).unref();
  log("keepalive", `pinging ${keepaliveUrl} every ${KEEPALIVE_EVERY_MS / 60_000} min`);
} else {
  log("keepalive", "off (no KEEPALIVE_URL / RENDER_EXTERNAL_URL)");
}

const shutdown = () => {
  if (stopping) return;
  stopping = true;
  log("supervisor", "stopping");
  for (const s of state.values()) s.child?.kill("SIGTERM");
  server.close();
  setTimeout(() => process.exit(0), 5_000).unref();
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
