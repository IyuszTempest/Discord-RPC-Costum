const { Client } = require("@xhayper/discord-rpc");
const fs   = require("fs");
const path = require("path");

const CONFIG_FILE = path.join(__dirname, "config.json");
const LOG_FILE    = path.join(__dirname, "rpc.log");
const PID_FILE    = path.join(__dirname, "rpc.pid");

// ─── Default Configuration ───────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  clientId: "Your_Application_Id",
  enabled: true,
  autoStart: true,
  time: {
    random: true,
    minHours: 40,
    maxHours: 70,
    customTime: { hours: 58, minutes: 45, seconds: 10 },
  },
  presence: {
    name: "Menikahi Anna Yanami",
    details: "Tes",
    state: "Tes",
    largeImage: "https://i.pinimg.com/736x/3b/21/88/3b218853f0334650ee60c6d4b986621f.jpg",
    largeImageText: "Yanami Anna Best Girl",
    smallImage: "",
    smallImageText: "",
    buttons: [
      { label: "MyWebsite", url: "https://iyusztempest.web.id" },
    ],
  },
};

// ─── Logging ─────────────────────────────────────────────────────────────────
function log(msg) {
  const now     = new Date();
  const timeStr = now.toLocaleDateString("id-ID") + " " + now.toLocaleTimeString("id-ID");
  const line    = `[${timeStr}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + "\n", "utf8"); } catch {}
}

function checkLogSize() {
  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 500 * 1024) {
      fs.writeFileSync(LOG_FILE, `--- Log direset pada ${new Date().toLocaleString("id-ID")} ---\n`, "utf8");
    }
  } catch {}
}

// ─── Config I/O ──────────────────────────────────────────────────────────────
let config = loadConfig();

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw    = fs.readFileSync(CONFIG_FILE, "utf8");
      const parsed = JSON.parse(raw);

      // Deep merge: presence harus gabungan default + file
      const merged = {
        ...DEFAULT_CONFIG,
        ...parsed,
        presence: {
          ...DEFAULT_CONFIG.presence,
          ...(parsed.presence || {}),
        },
        time: {
          ...DEFAULT_CONFIG.time,
          ...(parsed.time || {}),
          customTime: {
            ...DEFAULT_CONFIG.time.customTime,
            ...((parsed.time || {}).customTime || {}),
          },
        },
      };

      return merged;
    }
  } catch (err) {
    log(`[RPC] Gagal baca config.json (${err.message}), memakai default.`);
  }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
  } catch (err) {
    log(`[RPC] Gagal simpan config.json: ${err.message}`);
  }
}

// ─── Auto-reload config.json saat di-save ────────────────────────────────────
let lastMtime     = 0;
let reloadTimeout = null;

function watchConfig() {
  // fs.watchFile lebih stabil dari fs.watch di Windows
  fs.watchFile(CONFIG_FILE, { persistent: false, interval: 500 }, (curr) => {
    if (curr.mtimeMs === lastMtime) return; // tidak ada perubahan
    lastMtime = curr.mtimeMs;

    // Debounce — beberapa editor tulis 2× saat save
    clearTimeout(reloadTimeout);
    reloadTimeout = setTimeout(async () => {
      const prevClientId        = config.clientId;
      const prevPresenceStr     = JSON.stringify(config.presence);
      const prevEnabled         = config.enabled;

      const newConfig = loadConfig();
      if (!newConfig) return;

      config = newConfig;

      const presenceChanged = JSON.stringify(config.presence) !== prevPresenceStr;
      const enabledChanged  = config.enabled !== prevEnabled;
      const clientIdChanged = config.clientId !== prevClientId;

      if (clientIdChanged) {
        log(`[RPC] ✅ config.json berubah — Client ID baru: ${config.clientId}, reconnect...`);
        await reconnectWithNewClientId();
        return;
      }

      if (presenceChanged || enabledChanged) {
        log("[RPC] ✅ config.json berubah — menerapkan presence baru...");
        await applyPresenceToDiscord();
      }
    }, 400);
  });

  log("[RPC] Memantau config.json — edit & Save untuk ubah presence secara langsung.");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getUserAvatarUrl(user) {
  if (!user) return null;
  try {
    if (user.avatar) return user.avatarUrl;
    if (user.discriminator && user.discriminator !== "0") {
      return `https://cdn.discordapp.com/embed/avatars/${(parseInt(user.discriminator, 10) || 0) % 5}.png`;
    }
    if (user.id) {
      return `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`;
    }
  } catch {}
  return "https://cdn.discordapp.com/embed/avatars/0.png";
}

function replacePlaceholders(str, user) {
  if (!str || typeof str !== "string") return str;
  const username    = user?.username || "Discord User";
  const displayName = user?.global_name || user?.username || "Discord User";
  const avatarUrl   = getUserAvatarUrl(user) || "";
  return str
    .replace(/\{user\}/gi,        displayName)
    .replace(/\{username\}/gi,    username)
    .replace(/\{user_avatar\}/gi, avatarUrl);
}

function formatActivity(p, startTs) {
  const user       = client?.user;
  const userAvatar = getUserAvatarUrl(user);

  let largeImg = p.largeImage || p.largeImageKey || undefined;
  let smallImg = p.smallImage || p.smallImageKey || undefined;

  if (largeImg === "{user_avatar}" || largeImg === "user_avatar") largeImg = userAvatar || undefined;
  if (smallImg === "{user_avatar}" || smallImg === "user_avatar") smallImg = userAvatar || undefined;
  if (!largeImg || largeImg === "-") largeImg = undefined;
  if (!smallImg || smallImg === "-") smallImg = undefined;

  let largeText = replacePlaceholders(p.largeImageText, user) || undefined;
  let smallText = replacePlaceholders(p.smallImageText, user) || undefined;

  if (!largeImg) largeText = undefined;
  if (largeText && largeText.length < 2) largeText = undefined;
  if (!smallImg) smallText = undefined;
  if (smallText && smallText.length < 2) smallText = undefined;

  const activity = {
    details:        replacePlaceholders(p.details, user) || undefined,
    state:          replacePlaceholders(p.state,   user) || undefined,
    largeImageKey:  largeImg,
    largeImageText: largeText,
    smallImageKey:  smallImg,
    smallImageText: smallText,
    startTimestamp: startTs,
    instance:       false,
  };

  // Nama / app name — wajib ada agar presence tampil
  const appName = replacePlaceholders(p.name, user) || DEFAULT_CONFIG.presence.name;
  activity.name = appName;

  if (p.type !== undefined) activity.type = p.type;

  if (Array.isArray(p.buttons) && p.buttons.length > 0) {
    const valid = p.buttons
      .filter((b) => b && b.label && b.url && b.url.startsWith("http"))
      .slice(0, 2)
      .map((b) => ({ label: replacePlaceholders(b.label, user), url: b.url }));
    if (valid.length > 0) activity.buttons = valid;
  }

  return activity;
}

// ─── Timestamp ───────────────────────────────────────────────────────────────
function calculateStartTimestamp(timeCfg) {
  const t = timeCfg || config.time || DEFAULT_CONFIG.time;
  let hours, minutes, seconds;

  if (t.random) {
    const minH = t.minHours ?? 40;
    const maxH = t.maxHours ?? 70;
    hours   = Math.floor(Math.random() * (maxH - minH + 1)) + minH;
    minutes = Math.floor(Math.random() * 60);
    seconds = Math.floor(Math.random() * 60);
  } else {
    const c = t.customTime || DEFAULT_CONFIG.time.customTime;
    hours   = c.hours   ?? 58;
    minutes = c.minutes ?? 45;
    seconds = c.seconds ?? 10;
  }

  const offsetMs  = (hours * 3600 + minutes * 60 + seconds) * 1000;
  const start     = new Date(Date.now() - offsetMs);
  const formatted = `${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
  log(`[RPC] Waktu elapsed di-set: ${formatted} yang lalu`);
  return { start, formatted };
}

let { start: startTimestamp } = calculateStartTimestamp(config.time);

// ─── Discord Client State ─────────────────────────────────────────────────────
let client       = null;
let isConnected  = false;
let isConnecting = false;
let isRunning    = true;

async function applyPresenceToDiscord() {
  if (!client || !client.user || !isConnected) return false;
  try {
    if (config.enabled === false) {
      await client.user.clearActivity();
      log("[RPC] Status Discord dinonaktifkan (OFF).");
      return true;
    }
    const activity = formatActivity(config.presence, startTimestamp);
    await client.user.setActivity(activity);
    log(
      `[RPC] Presence diterapkan → ` +
      `Nama="${activity.name || "-"}" | ` +
      `Details="${config.presence.details || "-"}" | ` +
      `State="${config.presence.state || "-"}" | ` +
      `LargeImg="${config.presence.largeImage || "-"}" | ` +
      `SmallImg="${config.presence.smallImage || "-"}"`
    );
    return true;
  } catch (err) {
    log(`[RPC] Gagal menerapkan status: ${err.message}`);
    return false;
  }
}

async function reconnectWithNewClientId() {
  try {
    if (client) {
      if (isConnected) await client.user?.clearActivity().catch(() => {});
      await client.destroy().catch(() => {});
    }
  } catch {}
  isConnected  = false;
  isConnecting = false;
  client       = null;
  initDiscordClient();
  connectDiscordWithRetry();
}

function initDiscordClient() {
  const clientId = config.clientId || DEFAULT_CONFIG.clientId;
  client = new Client({ clientId });

  client.on("ready", async () => {
    isConnected = true;
    log(`[RPC] Terhubung ke Discord sebagai ${client.user?.username || "Discord User"} (Client ID: ${clientId})`);
    await applyPresenceToDiscord();
  });

  client.on("disconnected", () => {
    isConnected = false;
    log("[RPC] Terputus dari Discord. Mencoba menghubungkan kembali...");
    if (isRunning) setTimeout(connectDiscordWithRetry, 10000);
  });
}

async function connectDiscordWithRetry() {
  if (isConnecting || isConnected || !isRunning) return;
  isConnecting = true;

  while (isRunning && !isConnected) {
    try {
      log("[RPC] Mencoba menyambung ke aplikasi Discord...");
      if (!client) initDiscordClient();
      await client.login();
      isConnecting = false;
      return;
    } catch (err) {
      log(`[RPC] Belum bisa terhubung (${err.message}). Menunggu 10 detik...`);
      try { await client?.destroy(); } catch {}
      client = null;
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
  isConnecting = false;
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────
async function cleanup() {
  isRunning = false;
  fs.unwatchFile(CONFIG_FILE);
  log("[RPC] Menutup aplikasi Discord RPC...");
  try {
    await client?.user?.clearActivity();
    await client?.destroy();
  } catch {}
  try { if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE); } catch {}
  process.exit(0);
}

process.on("SIGINT",  cleanup);
process.on("SIGTERM", cleanup);

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  checkLogSize();
  log("==========================================");
  log("[RPC] Memulai Discord RPC...");
  log("[RPC] Edit & Save config.json untuk ubah presence secara langsung.");

  try { fs.writeFileSync(PID_FILE, String(process.pid), "utf8"); } catch {}

  // Simpan mtime awal supaya watchFile tidak trigger langsung
  try { lastMtime = fs.statSync(CONFIG_FILE).mtimeMs; } catch {}

  initDiscordClient();
  connectDiscordWithRetry();
  watchConfig(); // pantau setelah connect dimulai
}

main();
