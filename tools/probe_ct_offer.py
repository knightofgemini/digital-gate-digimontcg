"""Quali campi ha un'offerta CardTrader (senza salvare nomi di venditori): chiavi e valori utili di 'user' e offerta."""
import json, os, sys, urllib.request
from collections import Counter
TOKEN = os.environ.get("CARDTRADER_TOKEN", "").strip()
req = urllib.request.Request("https://api.cardtrader.com/api/v2/marketplace/products?expansion_id=4778", headers={"Authorization": "Bearer " + TOKEN})
mk = json.loads(urllib.request.urlopen(req, timeout=60).read())
offs = [o for v in mk.values() for o in v]
o = offs[0]
print("chiavi offerta:", sorted(o.keys()))
u = o.get("user") or {}
print("chiavi user:", sorted(u.keys()))
safe = {k: v for k, v in u.items() if k not in ("username", "id", "email")}
print("esempio user (senza nome):", safe)
for k in ("country_code", "can_sell_via_hub", "can_sell_sealed_with_ct_zero", "user_type", "too_many_request_for_cancel_as_seller", "max_sellable_in24h_quantity"):
    print(k, Counter(str((x.get("user") or {}).get(k)) for x in offs).most_common(8))
for k in ("on_vacation", "bundle_size", "graded", "tag", "expansion", "layered_price_cents"):
    print(k, Counter(str(x.get(k))[:40] for x in offs).most_common(5))
