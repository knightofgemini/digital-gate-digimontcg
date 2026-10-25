// Pagina nascosta che fa il lavoro "da browser" della scansione, come nell'app attuale: OCR con Tesseract.js (scaricato la
// prima volta che serve) e impronta dell'illustrazione (16×12 pixel normalizzati) per riconoscere la versione.
// Gira in una WebView (telefono) o in un iframe (sito). Nessuna foto viene inviata o salvata.
export const ENGINE_HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
var TESS_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js", tessP = null;
function send(o) { var s = JSON.stringify(o); if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s); else parent.postMessage(s, "*"); }
function loadTess() {
  if (tessP) return tessP;
  tessP = new Promise(function (res, rej) {
    if (window.Tesseract) { res(); return; }
    var s = document.createElement("script"); s.src = TESS_URL; s.async = true;
    s.onload = function () { res(); }; s.onerror = function () { rej(new Error("rete")); };
    document.head.appendChild(s);
  }).then(function () {
    return window.Tesseract.createWorker("eng", 1, { logger: function (m) { if (m && m.progress != null && String(m.status || "").indexOf("recogn") < 0) send({ ev: "progress", p: m.progress }); } });
  }).then(function (w) { return w.setParameters({ tessedit_pageseg_mode: "11" }).then(function () { return w; }); });
  tessP.catch(function () { tessP = null; });
  return tessP;
}
function loadImg(src, cors) {
  return new Promise(function (res, rej) { var im = new Image(); if (cors) im.crossOrigin = "anonymous"; im.onload = function () { res(im); }; im.onerror = function () { rej(new Error("img")); }; im.src = src; });
}
// ritaglio della carta dalla cornice: la foto è mostrata "cover" nella vista, la cornice è in coordinate della vista
function grab(im, cr) {
  var vw = im.naturalWidth, vh = im.naturalHeight, sx = 0, sy = 0, sw = vw, sh = vh;
  if (cr) {
    var k = Math.max(cr.vw / vw, cr.vh / vh), ox = (cr.vw - vw * k) / 2, oy = (cr.vh - vh * k) / 2, m = .03;
    sx = (cr.fx - ox) / k; sy = (cr.fy - oy) / k; sw = cr.fw / k; sh = cr.fh / k;
    sx -= sw * m; sy -= sh * m; sw *= 1 + 2 * m; sh *= 1 + 2 * m;
    sx = Math.max(0, sx); sy = Math.max(0, sy); sw = Math.min(vw - sx, sw); sh = Math.min(vh - sy, sh);
  }
  var w = cr ? 1000 : Math.min(1600, vw), c = document.createElement("canvas"); c.width = w; c.height = Math.round(w * sh / sw);
  c.getContext("2d").drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}
// parte bassa della carta (nome + numero), in scala di grigi e con più contrasto
function ocrCanvas(src, y0) {
  var w = src.width, h = src.height, sy = Math.round(h * y0), c = document.createElement("canvas");
  c.width = w; c.height = h - sy;
  var x = c.getContext("2d"); x.drawImage(src, 0, sy, w, h - sy, 0, 0, w, h - sy);
  try {
    var id = x.getImageData(0, 0, c.width, c.height), d = id.data, lo = 255, hi = 0, i, g;
    for (i = 0; i < d.length; i += 4) { g = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; d[i] = g; if (g < lo) lo = g; if (g > hi) hi = g; }
    var sc = 255 / Math.max(40, hi - lo);
    for (i = 0; i < d.length; i += 4) { g = (d[i] - lo) * sc; d[i] = d[i + 1] = d[i + 2] = g; }
    x.putImageData(id, 0, 0);
  } catch (e) {}
  return c;
}
function sig(src, w, h) {
  try {
    var c = document.createElement("canvas"); c.width = 16; c.height = 12;
    var x = c.getContext("2d"); x.drawImage(src, w * .1, h * .1, w * .8, h * .42, 0, 0, 16, 12);
    var d = x.getImageData(0, 0, 16, 12).data, v = [];
    for (var ch = 0; ch < 3; ch++) {
      var a = [], s = 0, q = 0, i; for (i = 0; i < d.length; i += 4) { a.push(d[i + ch]); s += d[i + ch]; }
      var mu = s / a.length; a.forEach(function (t) { q += (t - mu) * (t - mu); }); var sd = Math.sqrt(q / a.length) || 1;
      a.forEach(function (t) { v.push((t - mu) / sd); });
    }
    return v;
  } catch (e) { return null; }
}
var SIGS = {};
function thumbSig(u) {
  if (!SIGS[u]) SIGS[u] = loadImg(u, true).then(function (im) { return sig(im, im.naturalWidth, im.naturalHeight); }, function () { return null; });
  return SIGS[u];
}
function handle(m) {
  if (!m || !m.id) return;
  var done = function (o) { o.id = m.id; send(o); }, fail = function (e) { done({ err: String(e && e.message || e) }); };
  if (m.op === "warm") { loadTess().then(function () { done({ ok: 1 }); }, fail); return; }
  if (m.op === "ocr") {
    loadImg(m.img).then(function (im) {
      var c = grab(im, m.crop);
      return loadTess().then(function (w) { return w.recognize(ocrCanvas(c, m.y0)); }).then(function (out) {
        done({ text: (out && out.data && out.data.text) || "", sig: sig(c, c.width, c.height) });
      });
    }).catch(fail);
    return;
  }
  if (m.op === "rank") {
    Promise.all(m.urls.map(thumbSig)).then(function (sigs) {
      done({ d: sigs.map(function (t) { if (!t || !m.sig) return null; var s = 0; for (var j = 0; j < t.length; j++) s += Math.abs(t[j] - m.sig[j]); return s / t.length; }) });
    }).catch(fail);
  }
}
window.__msg = handle;
window.addEventListener("message", function (e) { try { handle(typeof e.data === "string" ? JSON.parse(e.data) : e.data); } catch (x) {} });
send({ ev: "ready" });
</script></body></html>`;
