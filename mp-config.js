// Address of your PolyTrack multiplayer server (must end with a slash).
window.POLYTRACK_MP_SERVER = "https://polytrack-mp.onrender.com/";
// Wake the server up as soon as the page loads (free hosts sleep when idle).
try { fetch(window.POLYTRACK_MP_SERVER, { mode: "no-cors" }).catch(function () {}); } catch (e) {}
