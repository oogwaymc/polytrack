// PolyTrack secret dev menu: type 2411 (or 24119) while playing to open/close.
(function () {
  var S = { speed: 1, fake: null, boost: 1 };

  // Hooks called from the game code (main.bundle.js / simulation_worker.bundle.js)
  var cheat = {
    T: null,
    inc: function () {},
    out: function (n) { return n; }
  };
  window.__ptCheat = cheat;

  // The game sets cheat.mp = {c: connection, s: sessionId} on every car update.
  // Wrap that connection's sendRecord so a fake time / record boost always sticks,
  // even after you finish a real lap.
  var mp = null, sentFor = null;
  Object.defineProperty(cheat, "mp", {
    get: function () { return mp; },
    set: function (v) {
      mp = v;
      if (!v || !v.c) return;
      wrap(v.c);
      var key = v.s;
      if (S.fake != null && cheat.T && sentFor !== key) { sentFor = key; sendNow(); }
    }
  });
  function wrap(c) {
    if (c.__ptWrapped || typeof c.sendRecord !== "function") return;
    var orig = c.sendRecord;
    c.__ptWrapped = true;
    c.sendRecord = function (s, t) {
      try {
        if (S.fake != null && cheat.T) t = new cheat.T(S.fake);
        else if (S.boost < 1 && cheat.T && t && t.numberOfFrames > 0) t = new cheat.T(Math.max(1, Math.round(t.numberOfFrames * S.boost)));
      } catch (e) {}
      return orig.call(this, s, t);
    };
  }
  function sendNow() {
    if (!mp || !cheat.T || S.fake == null) return false;
    mp.c.sendRecord(mp.s, new cheat.T(S.fake));
    return true;
  }

  function pushSpeed() {
    (window.__ptWs || []).forEach(function (w) { try { w.postMessage({ __ptSpeed: S.speed }); } catch (e) {} });
  }
  setInterval(pushSpeed, 1000);

  function build() {
    var css = document.createElement("style");
    css.textContent =
      "#ptdev{position:fixed;top:70px;right:12px;z-index:99999;width:300px;max-width:calc(100vw - 24px);max-height:calc(100vh - 90px);overflow:auto;" +
      "background:rgba(28,34,72,.96);color:#fff;font-family:ForcedSquare,Arial,sans-serif;border:2px solid #4b5bb0;box-shadow:0 8px 30px rgba(0,0,0,.5);display:none;user-select:none}" +
      "#ptdev.open{display:block}#ptdev h3{margin:0;padding:10px 12px;background:#2a3576;font-style:italic;font-size:20px;display:flex;justify-content:space-between;align-items:center}" +
      "#ptdev h3 button{transform:none;padding:2px 8px}#ptdev section{padding:10px 12px;border-top:1px solid #3a468f}" +
      "#ptdev label.t{display:block;font-size:13px;opacity:.75;margin-bottom:6px;font-style:italic}" +
      "#ptdev .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}#ptdev .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}" +
      "#ptdev button{font:inherit;font-style:italic;font-size:14px;color:#fff;background:#1a2257;border:1px solid #4b5bb0;padding:7px 6px;cursor:pointer;transform:skewX(-8deg)}" +
      "#ptdev button:hover{background:#2c3a8a}#ptdev button.on{background:#e8b923;color:#1a2257;border-color:#e8b923}" +
      "#ptdev input[type=range]{width:100%;accent-color:#e8b923}#ptdev input[type=text]{font:inherit;width:100%;box-sizing:border-box;padding:6px;background:#11173d;color:#fff;border:1px solid #4b5bb0}" +
      "#ptdev .row{display:flex;gap:6px;align-items:center}#ptdev .val{min-width:44px;text-align:right}#ptdev .msg{font-size:12px;opacity:.85;margin-top:6px;min-height:14px;line-height:1.35}";
    document.head.appendChild(css);

    var el = document.createElement("div");
    el.id = "ptdev";
    el.innerHTML =
      '<h3>Dev Menu <button id="ptd-x" title="Close">X</button></h3>' +
      '<section><label class="t">Game speed</label>' +
      '<div class="row"><input id="ptd-speed" type="range" min="0.25" max="4" step="0.25" value="1"><span class="val" id="ptd-speedv">1x</span></div>' +
      '<div class="grid4" style="margin-top:6px"><button data-sp="0.25">0.25x</button><button data-sp="0.5">0.5x</button><button data-sp="1" class="on">1x</button><button data-sp="2">2x</button></div>' +
      '<div class="msg">The lap timer counts game time, so slow-mo makes laps easier to drive without making your time slower.</div></section>' +
      '<section><label class="t">Record boost (multiplayer)</label>' +
      '<div class="grid4"><button data-bo="1" class="on">Off</button><button data-bo="0.95">-5%</button><button data-bo="0.9">-10%</button><button data-bo="0.75">-25%</button></div>' +
      '<div class="msg">Every real lap you finish is shown to other players this much faster.</div></section>' +
      '<section><label class="t">Fake lap time (multiplayer)</label>' +
      '<div class="row"><input id="ptd-time" type="text" value="0:01.337" placeholder="m:ss.mmm"><button id="ptd-send">Set</button></div>' +
      '<div class="grid" style="margin-top:6px"><button id="ptd-clear">Stop faking</button><button id="ptd-resend">Send again</button></div>' +
      '<div class="msg" id="ptd-tmsg">Sets your time in the Players list and keeps it there, even after real laps.</div></section>';
    document.body.appendChild(el);

    // Let the time box take typing without driving the car
    ["keydown", "keyup", "keypress"].forEach(function (t) {
      el.addEventListener(t, function (e) { if (e.target.tagName === "INPUT" && e.target.type === "text") e.stopPropagation(); });
    });
    // After clicking a menu button, hand the keyboard back to the game
    el.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (b) setTimeout(function () { b.blur(); }, 0);
    });

    function $(id) { return document.getElementById(id); }
    function mark(attr, v) { el.querySelectorAll("[" + attr + "]").forEach(function (b) { b.classList.toggle("on", +b.getAttribute(attr) === +v); }); }
    function setSpeed(v) {
      S.speed = +v; $("ptd-speed").value = v; $("ptd-speedv").textContent = (+v) + "x"; pushSpeed(); mark("data-sp", v);
    }
    $("ptd-speed").addEventListener("input", function () { setSpeed(this.value); });
    el.querySelectorAll("[data-sp]").forEach(function (b) { b.onclick = function () { setSpeed(b.dataset.sp); }; });
    el.querySelectorAll("[data-bo]").forEach(function (b) { b.onclick = function () { S.boost = +b.dataset.bo; mark("data-bo", S.boost); }; });
    $("ptd-x").onclick = function () { el.classList.remove("open"); };

    function parseTime(s) {
      s = String(s).trim(); var m = 0, sec;
      if (s.indexOf(":") >= 0) { var a = s.split(":"); m = parseInt(a[0], 10) || 0; sec = parseFloat(a[1]); } else sec = parseFloat(s);
      if (isNaN(sec)) return null;
      return Math.round((m * 60 + sec) * 1000);
    }
    function fmt(ms) { var m = Math.floor(ms / 60000), s = (ms % 60000) / 1000; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(3); }
    var msg = $("ptd-tmsg");
    function trySend() {
      try {
        if (sendNow()) msg.textContent = "Fake time " + fmt(S.fake) + " is on. Check the Players list.";
        else msg.textContent = "Fake time " + fmt(S.fake) + " is ready. It sends as soon as you start driving in a multiplayer game.";
      } catch (e) { msg.textContent = "Didn't work: " + e.message; }
    }
    $("ptd-send").onclick = function () {
      var f = parseTime($("ptd-time").value);
      if (f == null || f < 1 || f > 5999999) { msg.textContent = "Type a time like 0:01.337"; return; }
      S.fake = f; sentFor = mp ? mp.s : null; trySend();
    };
    $("ptd-resend").onclick = function () { if (S.fake == null) { msg.textContent = "Set a fake time first."; return; } trySend(); };
    $("ptd-clear").onclick = function () { S.fake = null; sentFor = null; msg.textContent = "Stopped. Your next real lap record will be sent as normal."; };
    return el;
  }

  // Secret code: type 2 4 1 1 (top row or numpad) to toggle. 24119 still works too.
  var typed = "", panel = null;
  window.addEventListener("keydown", function (e) {
    if (e.target && e.target.tagName === "INPUT" && e.target.type === "text") return;
    var m = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
    if (!m) { if (e.code !== "ShiftLeft" && e.code !== "ShiftRight") typed = ""; return; }
    typed = (typed + m[1]).slice(-4);
    if (typed === "2411") {
      typed = "";
      if (!panel) panel = build();
      panel.classList.toggle("open");
    }
  }, true);
})();
