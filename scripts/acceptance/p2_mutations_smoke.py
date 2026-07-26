#!/usr/bin/env python3
"""P2 mutations smoke (requires MUTATIONS_ENABLED + JWT editor or AUTH_DISABLED).

Usage:
  set API_BASE=http://localhost:8011
  set MUTATION_USER=editor
  set MUTATION_PASSWORD=dev
  python scripts/acceptance/p2_mutations_smoke.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

API_BASE = os.getenv("API_BASE", "http://localhost:8011").rstrip("/")
USER = os.getenv("MUTATION_USER", "editor")
PASSWORD = os.getenv("MUTATION_PASSWORD", "dev")


def call(method: str, path: str, payload: dict | None = None, token: str | None = None):
    data = None if payload is None else json.dumps(payload).encode()
    headers = {"Content-Type": "application/json", "User-Agent": "p2-mutations-smoke/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        f"{API_BASE}/{path.lstrip('/')}",
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.status, json.loads(body)
            except json.JSONDecodeError:
                return resp.status, body
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


def main() -> int:
    failed = 0
    status, health = call("GET", "health")
    print(f"[{'OK' if status == 200 else 'FAIL'}] health: {status}")
    if status != 200:
        return 1
    flags = (health or {}).get("flags") or {}
    mutations_on = bool(flags.get("mutations_enabled"))
    print(f"  mutations_enabled={mutations_on} auth_disabled={flags.get('auth_disabled')}")

    status, login = call(
        "POST",
        "api/v1/auth/login",
        {"username": USER, "password": PASSWORD, "role": "editor"},
    )
    if status != 200 or not isinstance(login, dict):
        print(f"[FAIL] login: HTTP {status} {str(login)[:200]}")
        return 1
    token = login.get("access_token")
    print(f"[OK] login as {login.get('username')} role={login.get('role')}")

    # Topology must stay blocked unless explicitly enabled
    t_status, t_body = call(
        "POST",
        "api/v1/topology/node",
        {"lng": 76.9, "lat": 43.2},
        token=token,
    )
    topo_ok = t_status in {401, 403, 503}
    print(f"[{'OK' if topo_ok else 'FAIL'}] topology blocked: HTTP {t_status}")
    if not topo_ok:
        failed += 1

    if not mutations_on:
        c_status, c_body = call(
            "POST",
            "api/v1/technical-conditions",
            {"fields": {"nomer_tu": "SMOKE-TEMP"}},
            token=token,
        )
        ok = c_status == 503
        print(f"[{'OK' if ok else 'FAIL'}] TU create gated off: HTTP {c_status}")
        if not ok:
            failed += 1
            print(" ", str(c_body)[:200])
        print("failed:", failed)
        return 1 if failed else 0

    # Create → update → delete TU
    c_status, created = call(
        "POST",
        "api/v1/technical-conditions",
        {
            "fields": {
                "nomer_tu": "SMOKE-P2",
                "organizatsiya": "smoke-test",
                "istochnik": "smoke",
            }
        },
        token=token,
    )
    if c_status != 200 or not isinstance(created, dict) or not created.get("id"):
        print(f"[FAIL] TU create: HTTP {c_status} {str(created)[:200]}")
        return 1
    tu_id = created["id"]
    print(f"[OK] TU create id={tu_id}")

    u_status, _ = call(
        "PUT",
        f"api/v1/technical-conditions/{tu_id}",
        {"fields": {"organizatsiya": "smoke-test-updated"}},
        token=token,
    )
    print(f"[{'OK' if u_status == 200 else 'FAIL'}] TU update: HTTP {u_status}")
    if u_status != 200:
        failed += 1

    d_status, _ = call(
        "DELETE",
        f"api/v1/technical-conditions/{tu_id}",
        token=token,
    )
    print(f"[{'OK' if d_status == 200 else 'FAIL'}] TU delete: HTTP {d_status}")
    if d_status != 200:
        failed += 1

    print("failed:", failed)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
