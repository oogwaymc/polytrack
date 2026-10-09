// PolyTrack secret dev menu: type 24119 to open/close.
(function () {
  var S = { speed: 1 };

  // Hooks called from the game code (main.bundle.js)
  var cheat = {
    mp: null, T: null,
    inc: function () {},
    out: function (n) { return n; }
  };
  window.__ptCheat = cheat;

  function pushSpeed() {
    (window.__ptWs || []).forEach(function (w) { try { w.postMessage({ __ptSpeed: S.speed }); } catch (e) {} });
  }
  setInterval(pushSpeed, 1000);

  function build() {
    var css = document.createElement("style");
    css.textContent =
      "#ptdev{position:fixed;top:70px;right:12px;z-index:99999;width:290px;max-width:calc(100vw - 24px);" +
      "background:rgba(28,34,72,.96);color:#fff;font-family:ForcedSquare,Arial,sans-serif;border:2px solid #4b5bb0;box-shadow:0 8px 30px rgba(0,0,0,.5);display:none;user-select:none}" +
      "#ptdev.open{display:block}#ptdev h3{margin:0;padding:10px 12px;background:#2a3576;font-style:italic;font-size:20px;display:flex;justify-content:space-between;align-items:center}" +
      "#ptdev h3 button{transform:none;padding:2px 8px}#ptdev section{padding:10px 12px;border-top:1px solid #3a468f}" +
      "#ptdev label.t{display:block;font-size:13px;opacity:.75;margin-bottom:6px;font-style:italic}" +
      "#ptdev .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}" +
      "#ptdev button{font:inherit;font-style:italic;font-size:14px;color:#fff;background:#1a2257;border:1px solid #4b5bb0;padding:7px 6px;cursor:pointer;transform:skewX(-8deg)}" +
      "#ptdev button:hover{background:#2c3a8a}#ptdev button.on{background:#e8b923;color:#1a2257;border-color:#e8b923}" +
      "#ptdev input[type=range]{width:100%;accent-color:#e8b923}#ptdev input[type=text]{font:inherit;width:100%;box-sizing:border-box;padding:6px;background:#11173d;color:#fff;border:1px solid #4b5bb0}" +
      "#ptdev .row{display:flex;gap:6px;align-items:center}#ptdev .val{min-width:44px;text-align:right}#ptdev .msg{font-size:12px;opacity:.8;margin-top:6px;min-height:14px}";
    document.head.appendChild(css);

    var el = document.createElement("div");
    el.id = "ptdev";
    el.innerHTML =
      '<h3>Dev Menu <button id="ptd-x">X</button></h3>' +
      '<section><label class="t">Game speed</label>' +
      '<div class="row"><input id="ptd-speed" type="range" min="0.25" max="4" step="0.25" value="1"><span class="val" id="ptd-speedv">1x</span></div>' +
      '<div class="grid" style="margin-top:6px"><button data-sp="1" class="on">Normal</button><button data-sp="2">2x</button><button data-sp="3">3x</button><button data-sp="0.5">Slow-mo</button></div></section>' +
      '<section><label class="t">Fake lap time (multiplayer)</label>' +
      '<div class="row"><input id="ptd-time" type="text" value="0:01.337" placeholder="m:ss.mmm"><button id="ptd-send">Send</button></div>' +
      '<div class="msg" id="ptd-tmsg">Drive for a second in a multiplayer game first.</div></section>';
    document.body.appendChild(el);

    ["keydown", "keyup", "keypress"].forEach(function (t) {
      el.addEventListener(t, function (e) { if (e.target.tagName === "INPUT" && e.target.type === "text") e.stopPropagation(); });
    });

    function $(id) { return document.getElementById(id); }
    function setSpeed(v) {
      S.speed = +v; $("ptd-speed").value = v; $("ptd-speedv").textContent = (+v) + "x"; pushSpeed();
      el.querySelectorAll("[data-sp]").forEach(function (b) { b.classList.toggle("on", +b.dataset.sp === S.speed); });
    }
    $("ptd-speed").addEventListener("input", function () { setSpeed(this.value); });
    el.querySelectorAll("[data-sp]").forEach(function (b) { b.onclick = function () { setSpeed(b.dataset.sp); }; });
    $("ptd-x").onclick = function () { el.classList.remove("open"); };

    function parseTime(s) {
      s = String(s).trim(); var m = 0, sec;
      if (s.indexOf(":") >= 0) { var a = s.split(":"); m = parseInt(a[0], 10) || 0; sec = parseFloat(a[1]); } else sec = parseFloat(s);
      if (isNaN(sec)) return null;
      return Math.round((m * 60 + sec) * 1000);
    }
    $("ptd-send").onclick = function () {
      var msg = $("ptd-tmsg"), f = parseTime($("ptd-time").value);
      if (f == null || f < 1 || f > 5999999) { msg.textContent = "Type a time like 0:01.337"; return; }
      if (!cheat.mp || !cheat.T) { msg.textContent = "Join or host a game and drive a bit first."; return; }
      try { cheat.mp.c.sendRecord(cheat.mp.s, new cheat.T(f)); msg.textContent = "Sent! Check the Players list."; }
      catch (e) { msg.textContent = "Didn't work: " + e.message; }
    };
    return el;
  }

  // Secret code: type 2 4 1 1 9 (top row or numpad) to toggle
  var CODE = "24119", typed = "", panel = null;
  window.addEventListener("keydown", function (e) {
    if (e.target && e.target.tagName === "INPUT" && e.target.type === "text") return;
    var m = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
    if (!m) return;
    typed = (typed + m[1]).slice(-CODE.length);
    if (typed === CODE) {
      typed = "";
      if (!panel) panel = build();
      panel.classList.toggle("open");
    }
  }, true);
})();
