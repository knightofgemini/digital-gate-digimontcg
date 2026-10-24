#!/usr/bin/env python3
"""Prova dello scaricamento in sottofondo su un emulatore Android (usato da build.yml, job "bgtest").
Si collega alla pagina dell'app con gli strumenti per sviluppatori della WebView (porta 9222 inoltrata da adb).
Uso: bgtest_cdp.py start   -> apre Immagini offline e avvia "Tutto in HD"
     bgtest_cdp.py count   -> stampa quante immagini sono salvate"""
import json, sys, time, urllib.request
import websocket
def page():
    for _ in range(30):
        try:
            ps = json.load(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5))
            ps = [p for p in ps if p.get("type") == "page" and p.get("webSocketDebuggerUrl")]
            if ps: return ps[0]["webSocketDebuggerUrl"]
        except Exception as e: pass
        time.sleep(2)
    raise SystemExit("pagina non trovata")
def ev(js, timeout=60):
    ws = websocket.create_connection(page(), timeout=timeout, suppress_origin=True)
    ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {"expression": js, "awaitPromise": True, "returnByValue": True}}))
    while True:
        m = json.loads(ws.recv())
        if m.get("id") == 1: ws.close(); return m.get("result", {}).get("result", {}).get("value", m)
START = """(async () => {
  const sl = ms => new Promise(r => setTimeout(r, ms));
  const boot = document.getElementById('dg-boot'); if (boot) boot.click();
  await sl(1000);
  document.getElementById('moreBtn').click(); await sl(1000);
  document.querySelector('#menuNav button[data-m="offline"]').click(); await sl(2500);
  const b = [...document.querySelectorAll('.offopt')][1].querySelector('.btn.pri'); b.click();
  await sl(3000);
  return 'avviato: ' + (document.querySelector('.offpt') || {}).textContent;
})()"""
COUNT = "caches.open('dg-img-v3').then(c => c.keys()).then(k => k.length)"
if sys.argv[1] == "start": print(ev(START))
else: print(ev(COUNT))
