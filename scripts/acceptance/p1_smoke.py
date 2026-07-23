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
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            try:
                return resp.status, json.loads(body)
            except json.JSONDecodeError:
                return resp.status, body
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")
    except Exception as exc:  # noqa: BLE001
        return 0, str(exc)


def main() -> int:
    checks = [
        ("fragments", "fragments"),
        ("elevator lookups", "api/elevators/lookups"),
        ("topology diagnostics", "api/topology/diagnostics?limit=5"),
        ("auth me (may 401 if AUTH on)", "api/v1/auth/me"),
    ]
    failed = 0
    for title, path in checks:
        status, body = get(path)
        ok = status in {200, 401}  # 401 acceptable for /me when auth required without token
        if path.endswith("lookups") or path.startswith("fragments") or "diagnostics" in path:
            ok = status == 200
        print(f"[{'OK' if ok else 'FAIL'}] {title}: HTTP {status}")
        if not ok:
            failed += 1
            print(" ", str(body)[:300])

    # Topology mutations must stay disabled by default
    status, body = get("api/v1/topology/node")  # wrong method → may 405; POST checked below
    req = urllib.request.Request(
        f"{API_BASE}/api/v1/topology/node",
        data=json.dumps({"lng": 76.9, "lat": 43.2}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            topo_status = resp.status
            topo_body = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        topo_status = exc.code
        topo_body = exc.read().decode("utf-8", errors="replace")
    except Exception as exc:  # noqa: BLE001
        topo_status = 0
        topo_body = str(exc)

    # Expect 401/403/503 — never 200 on default flags
    topo_ok = topo_status in {401, 403, 503}
    print(f"[{'OK' if topo_ok else 'FAIL'}] topology create blocked: HTTP {topo_status}")
    if not topo_ok:
        failed += 1
        print(" ", topo_body[:300])

    print("failed:", failed)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
