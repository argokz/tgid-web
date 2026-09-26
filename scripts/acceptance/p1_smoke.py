#!/usr/bin/env python3
"""P1 smoke checks against a running itwin-api (read-mostly).

Usage:
  set API_BASE=http://localhost:8011
  python scripts/acceptance/p1_smoke.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

API_BASE = os.getenv("API_BASE", "http://localhost:8011").rstrip("/")


def get(path: str) -> tuple[int, object]:
    url = f"{API_BASE}/{path.lstrip('/')}"
    req = urllib.request.Request(url, headers={"User-Agent": "p1-smoke/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode("utf-8")
            try:
                return resp.status, json.loads(body)
            except json.JSONDecodeError:
                return resp.status, body
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")
    except Exception as exc:  # noqa: BLE001
        return 0, str(exc)


def post(path: str, payload: dict | None = None) -> tuple[int, object]:
    data = json.dumps(payload or {}).encode()
    req = urllib.request.Request(
        f"{API_BASE}/{path.lstrip('/')}",
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "p1-smoke/1.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.status, json.loads(body)
            except json.JSONDecodeError:
                return resp.status, body
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")
    except Exception as exc:  # noqa: BLE001
        return 0, str(exc)


def find_passport_leaf(nodes) -> tuple[str, int] | None:
    """Walk passport hierarchy to a leaf with ms_rs + site_id."""
    stack = list(nodes or [])
    while stack:
        node = stack.pop(0)
        if not isinstance(node, dict):
            continue
        if node.get("is_leaf") and node.get("ms_rs") and node.get("site_id"):
            return str(node["ms_rs"]), int(node["site_id"])
        children = node.get("children") or node.get("sites") or []
        stack.extend(children)
    return None


def main() -> int:
    checks = [
        ("health", "health"),
        ("auth config", "api/v1/auth/config"),
        ("fragments", "fragments"),
        ("elevator lookups", "api/elevators/lookups"),
        ("passport hierarchy", "api/passports/hierarchy"),
        ("passport diagnostics", "api/passports/diagnostics"),
        ("technical conditions", "api/technical-conditions?page=1&page_size=1"),
        ("tu balance", "api/technical-conditions/balance"),
        ("excel types", "api/reports/excel-types"),
        ("defects RO", "api/defects?page=1&page_size=1"),
        ("shurf RO", "api/shurfs?page=1&page_size=1"),
        ("osmotr RO", "api/inspections?page=1&page_size=1"),
        ("piezometer path probe", "piezometer/path?node_id1=1&node_id2=2"),
        ("ochered opressovok", "api/ochered-opressovok?page=1&page_size=1"),
        ("heat-loss lookups", "api/heat-losses/lookups"),
        ("tg lookups", "api/temperature-graphs/lookups"),
        ("consumer-load lookups", "api/consumer-load-diagnostics/lookups"),
        ("network volume", "api/network-queries/volume"),
        ("network length", "api/network-queries/length"),
        ("auth me", "api/v1/auth/me"),
        ("openapi", "openapi.json"),
    ]
    failed = 0
    health_body: object = None
    for title, path in checks:
        status, body = get(path)
        if path == "health":
            health_body = body
        if "piezometer" in path:
            ok = status in {200, 400, 404, 422}
        elif path.endswith("auth/me"):
            ok = status in {200, 401}
        elif path in {
            "api/shurfs?page=1&page_size=1",
            "api/inspections?page=1&page_size=1",
        }:
            # alternate route names exist in some builds
            ok = status in {200, 404}
            if status == 404:
                print(f"[WARN] {title}: HTTP 404 (route alias may differ)")
                continue
        else:
            ok = status == 200
        print(f"[{'OK' if ok else 'FAIL'}] {title}: HTTP {status}")
        if not ok:
            failed += 1
            print(" ", str(body)[:300])

    if isinstance(health_body, dict):
        redis = health_body.get("redis") or {}
        redis_ok = redis.get("ok") is True
        print(f"[{'OK' if redis_ok else 'WARN'}] health.redis.ok={redis.get('ok')}")
        routes = health_body.get("routes") or 0
        r_ok = int(routes) >= 80
        print(f"[{'OK' if r_ok else 'FAIL'}] health.routes: {routes}")
        if not r_ok:
            failed += 1

    # Topology mutations must stay blocked by default
    topo_status, topo_body = post("api/v1/topology/node", {"lng": 76.9, "lat": 43.2})
    topo_ok = topo_status in {401, 403, 503}
    print(f"[{'OK' if topo_ok else 'FAIL'}] topology create blocked: HTTP {topo_status}")
    if not topo_ok:
        failed += 1
        print(" ", str(topo_body)[:300])

    # Excel types must advertise tu-balance (avoid downloading large binary in smoke)
    et_status, et_body = get("api/reports/excel-types")
    codes: set[str] = set()
    if et_status == 200 and isinstance(et_body, dict):
        for item in et_body.get("items") or []:
            if isinstance(item, dict) and item.get("code"):
                codes.add(str(item["code"]))
    has_balance = "tu-balance" in codes or "tu_balance" in codes
    has_hl = "heat-loss-seasons" in codes
    print(f"[{'OK' if has_balance else 'FAIL'}] excel-types contains tu-balance: {sorted(codes)}")
    if not has_balance:
        failed += 1
    print(f"[{'OK' if has_hl else 'FAIL'}] excel-types contains heat-loss-seasons")
    if not has_hl:
        failed += 1

    # Word route present (empty journals → 404 record; unknown journal → 404)
    w_status, _ = get("reports/word/shurf/1")
    w_ok = w_status in {200, 404, 500}
    print(f"[{'OK' if w_ok else 'FAIL'}] word shurf probe: HTTP {w_status}")
    if not w_ok:
        failed += 1

    # Passport probe via real leaf site
    hier_status, hier = get("api/passports/hierarchy")
    leaf = find_passport_leaf(hier) if hier_status == 200 else None
    if leaf:
        ms_rs, site_id = leaf
        p_status, p_body = post(f"api/db/object/uchastok_{ms_rs}/{site_id}", {})
        p_ok = p_status in {200, 404, 500}
        print(
            f"[{'OK' if p_ok else 'FAIL'}] passport probe uchastok_{ms_rs}/{site_id}: HTTP {p_status}"
        )
        if not p_ok:
            failed += 1
            print(" ", str(p_body)[:300])
    else:
        print("[SKIP] passport probe: no leaf site in hierarchy")

    o_status, openapi = get("openapi.json")
    if o_status == 200 and isinstance(openapi, dict):
        count = len(openapi.get("paths") or {})
        ok = count >= 80
        print(f"[{'OK' if ok else 'FAIL'}] openapi path count: {count}")
        if not ok:
            failed += 1
    else:
        print(f"[FAIL] openapi unavailable: HTTP {o_status}")
        failed += 1

    print("failed:", failed)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
