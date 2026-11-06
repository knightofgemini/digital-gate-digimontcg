#!/usr/bin/env python3
"""Date in cui ogni carta spoiler (versione dei prodotti in arrivo, es. "BT27-015" o "BT27-015_P1") è entrata nel
catalogo, per la Home dell'app ("Ultimi spoiler" e banner "Nuovi spoiler", 6 novembre 2026).
- tools/spoiler_dates.json: {versione: "AAAA-MM-GG"}, solo per i prodotti ancora in arrivo.
- merge_set.save() (usato anche da spoiler_check.py --apply) segna con la data di oggi le versioni nuove e mette le
  date dentro src/data.json come "sd", così l'app le riceve con le carte nuove senza un APK nuovo.
Uso: python3 tools/spoiler_dates.py --storia   ricostruisce le date dalla storia git di src/data.json"""
import datetime, json, pathlib, subprocess, sys

root = pathlib.Path(__file__).resolve().parent.parent
PATH = root / "tools" / "spoiler_dates.json"


def soon_ids(D, today):
    """versioni (codice + suffisso) dei prodotti con data di uscita futura"""
    out = set()
    for s in D["sets"]:
        if not (s.get("date") and s["date"][0] != "0" and s["date"] > today):
            continue
        for x in s["v"]:
            i, suf = (x, "") if isinstance(x, int) else (x[0], x[1])
            r = D["cards"][i]
            if r[16] == s["id"] or suf:
                out.add(r[0] + suf)
    return out


def load():
    try:
        return json.loads(PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}


def save(sd):
    PATH.write_text(json.dumps(dict(sorted(sd.items())), ensure_ascii=False, indent=0) + "\n", encoding="utf-8")


def stamp(D, today=None):
    """segna le versioni nuove dei prodotti in arrivo con la data di oggi, toglie quelle dei prodotti usciti,
    salva tools/spoiler_dates.json e mette le date in D["sd"]"""
    today = today or datetime.date.today().isoformat()
    ids = soon_ids(D, today)
    sd = {k: v for k, v in load().items() if k in ids}
    for k in ids:
        sd.setdefault(k, today)
    save(sd)
    D["sd"] = dict(sorted(sd.items()))
    return D


def history():
    """prima comparsa di ogni versione dei prodotti oggi in arrivo, commit per commit"""
    today = datetime.date.today().isoformat()
    cur = json.loads((root / "src" / "data.json").read_text(encoding="utf-8"))
    want = soon_ids(cur, today)
    log = subprocess.run(["git", "-C", str(root), "log", "--reverse", "--format=%H %cd", "--date=short", "--", "src/data.json"], capture_output=True, text=True, check=True).stdout.split("\n")
    sd = {}
    for line in filter(None, log):
        h, day = line.split()
        try:
            D = json.loads(subprocess.run(["git", "-C", str(root), "show", h + ":src/data.json"], capture_output=True, text=True, check=True).stdout)
        except Exception:
            continue
        for k in soon_ids(D, day) & want:
            sd.setdefault(k, day)
    for k in want:
        sd.setdefault(k, today)
    return sd


if __name__ == "__main__":
    if "--storia" in sys.argv:
        sd = history()
        save(sd)
        by = {}
        for v in sd.values():
            by[v] = by.get(v, 0) + 1
        print(len(sd), "versioni:", ", ".join("%s %d" % x for x in sorted(by.items())))
    else:
        sys.exit(__doc__)
