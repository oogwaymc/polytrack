// PolyTrack multiplayer matchmaking server.
// Replaces the invite/connection part of Kodub's server. Races themselves run
// peer-to-peer between players' browsers (WebRTC); this only introduces them.
const http = require("http");
const crypto = require("crypto");
const { WebSocketServer } = require("./miniws");

const PORT = process.env.PORT || 8080;
const INVITE_TIMEOUT_MS = 60 * 60 * 1000; // invite code lasts 1 hour, then "Renew"
const ICE_SERVERS = process.env.ICE_SERVERS
  ? JSON.parse(process.env.ICE_SERVERS)
  : [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

const hostsByKey = new Map();     // key -> host
const hostsByInvite = new Map();  // inviteCode -> host
const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };
const newInviteCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c;
  do { c = Array.from(crypto.randomBytes(6), b => chars[b % chars.length]).join(""); }
  while (hostsByInvite.has(c));
  return c;
};

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const url = new URL(req.url, "http://x");
  if (url.pathname.endsWith("/iceServers")) {
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(ICE_SERVERS));
  }
  res.setHeader("Content-Type", "text/plain");
  res.end("PolyTrack multiplayer server is running. Hosts online: " + hostsByInvite.size);
});

const wss = new WebSocketServer({ server, maxPayload: 256 * 1024 });

wss.on("connection", (ws, req) => {
  const path = new URL(req.url, "http://x").pathname;
  if (path.endsWith("/multiplayer/host")) handleHost(ws);
  else if (path.endsWith("/multiplayer/join")) handleJoin(ws);
  else ws.close();
});

function handleHost(ws) {
  let host = null;
  ws.on("message", raw => {
    let m; try { m = JSON.parse(raw); } catch { return ws.close(); }
    if (m.type === "ping") return send(ws, { type: "pong" });
    if (m.type === "createInvite") {
      if (!host) {
        // Re-attach to existing host state if the game reconnects with its key
        host = (m.key && hostsByKey.get(m.key)) || { key: crypto.randomBytes(16).toString("hex"), sessions: new Map() };
        if (host.ws && host.ws !== ws) try { host.ws.close(); } catch {}
        host.ws = ws;
        hostsByKey.set(host.key, host);
      }
      if (host.inviteCode) hostsByInvite.delete(host.inviteCode);
      host.inviteCode = newInviteCode();
      hostsByInvite.set(host.inviteCode, host);
      clearTimeout(host.expiry);
      host.expiry = setTimeout(() => { hostsByInvite.delete(host.inviteCode); }, INVITE_TIMEOUT_MS);
      return send(ws, {
        type: "createInvite", inviteCode: host.inviteCode, key: host.key,
        timeoutMilliseconds: INVITE_TIMEOUT_MS,
        censoredNickname: typeof m.nickname === "string" ? m.nickname.slice(0, 50) : null,
      });
    }
    if (!host || typeof m.session !== "string") return;
    const joiner = host.sessions.get(m.session);
    if (!joiner) return;
    if (m.type === "iceCandidate") send(joiner, { type: "iceCandidate", candidate: m.candidate ?? null });
    else if (m.type === "acceptJoin") send(joiner, {
      type: "acceptJoin", answer: m.answer, version: "0.6.3",
      mods: m.mods || [], isModsVanillaCompatible: m.isModsVanillaCompatible !== false, clientId: m.clientId,
    });
    else if (m.type === "declineJoin") { send(joiner, { type: "declineJoin", reason: m.reason }); joiner.close(); }
  });
  ws.on("close", () => {
    if (!host || host.ws !== ws) return;
    clearTimeout(host.expiry);
    hostsByInvite.delete(host.inviteCode);
    hostsByKey.delete(host.key);
    for (const j of host.sessions.values()) try { j.close(); } catch {}
  });
}

function handleJoin(ws) {
  let host = null, session = null;
  ws.on("message", raw => {
    let m; try { m = JSON.parse(raw); } catch { return ws.close(); }
    if (!session) {
      host = hostsByInvite.get(String(m.inviteCode || "").trim().toUpperCase());
      if (!host || !host.ws || host.ws.readyState !== 1) { send(ws, { type: "error", error: "ExpiredInvite" }); return ws.close(); }
      session = crypto.randomBytes(12).toString("hex");
      host.sessions.set(session, ws);
      return send(host.ws, {
        type: "joinInvite", session, offer: m.offer, version: m.version || "0.6.3",
        mods: Array.isArray(m.mods) ? m.mods : [], isModsVanillaCompatible: m.isModsVanillaCompatible !== false,
        nickname: String(m.nickname || "Player").slice(0, 50), countryCode: m.countryCode ?? null,
        carStyle: typeof m.carStyle === "string" ? m.carStyle : "", iceServers: ICE_SERVERS,
      });
    }
    if ("candidate" in m && host.ws) send(host.ws, { type: "iceCandidate", session, candidate: m.candidate ?? null });
  });
  ws.on("close", () => {
    if (host && session) {
      host.sessions.delete(session);
      if (host.ws) send(host.ws, { type: "joinDisconnect", session });
    }
  });
}

server.listen(PORT, () => console.log("PolyTrack multiplayer server on port " + PORT));
