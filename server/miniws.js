// Minimal dependency-free WebSocket server (RFC 6455), enough for JSON signaling.
const crypto = require("crypto");
const { EventEmitter } = require("events");
const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

class Socket extends EventEmitter {
  constructor(sock, maxPayload) {
    super();
    this.sock = sock; this.readyState = 1; this.buf = Buffer.alloc(0); this.frag = []; this.max = maxPayload;
    sock.setNoDelay(true);
    sock.on("data", d => { this.buf = Buffer.concat([this.buf, d]); this._parse(); });
    sock.on("close", () => this._closed());
    sock.on("error", () => this._closed());
  }
  _closed() { if (this.readyState === 3) return; this.readyState = 3; this.emit("close"); }
  _parse() {
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = b0 & 0x80, op = b0 & 0x0f, masked = b1 & 0x80;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > this.max) return this.close();
      const need = off + (masked ? 4 : 0) + len;
      if (this.buf.length < need) return;
      let payload = this.buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) { const k = this.buf.subarray(off, off + 4); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= k[i & 3]; }
      this.buf = this.buf.subarray(need);
      if (op === 0x8) return this.close();
      if (op === 0x9) { this._frame(0xA, payload); continue; }
      if (op === 0xA) continue;
      if (op === 0x1 || op === 0x2 || op === 0x0) {
        this.frag.push(payload);
        if (fin) { const msg = Buffer.concat(this.frag); this.frag = []; this.emit("message", msg.toString("utf8")); }
      }
    }
  }
  _frame(op, data) {
    if (this.readyState !== 1 && op !== 0x8) return;
    const len = data.length;
    const head = len < 126 ? Buffer.from([0x80 | op, len])
      : len < 65536 ? Buffer.from([0x80 | op, 126, len >> 8, len & 255])
      : (() => { const h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); return h; })();
    try { this.sock.write(Buffer.concat([head, data])); } catch {}
  }
  send(str) { this._frame(0x1, Buffer.from(str, "utf8")); }
  close() {
    if (this.readyState !== 1) return;
    this._frame(0x8, Buffer.from([0x03, 0xe8]));
    this.readyState = 2;
    setTimeout(() => this.sock.destroy(), 500);
  }
}

class WebSocketServer extends EventEmitter {
  constructor({ server, maxPayload = 1 << 20 }) {
    super();
    server.on("upgrade", (req, sock) => {
      const key = req.headers["sec-websocket-key"];
      if (!key || (req.headers.upgrade || "").toLowerCase() !== "websocket") return sock.destroy();
      const accept = crypto.createHash("sha1").update(key + GUID).digest("base64");
      sock.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
      this.emit("connection", new Socket(sock, maxPayload), req);
    });
  }
}
module.exports = { WebSocketServer };
