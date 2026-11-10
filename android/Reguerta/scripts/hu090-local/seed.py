#!/usr/bin/env python3
"""Seed only the fixed demo Auth/Firestore emulators; no ADC, cloud URL or redirects."""
from datetime import datetime, timezone
import base64
import json
from pathlib import Path
from urllib import error, request

PROJECT = "demo-reguerta-hu090"
FIXTURES = json.loads(Path(__file__).with_name("gateway-fixtures.json").read_text())
PASSWORD = "Qa-Local-090!"  # Public synthetic emulator password, never a real account credential.


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise RuntimeError("Emulator redirects are forbidden")


OPENER = request.build_opener(request.ProxyHandler({}), NoRedirect())


def local_json(port, path, body=None, method=None, owner=False):
    if port not in (9098, 8798, 9198) or not path.startswith("/") or path.startswith("//"):
        raise ValueError("Only fixed local emulator endpoints are supported")
    headers = {"Content-Type": "application/json"}
    if owner:
        headers["Authorization"] = "Bearer owner"
    data = None if body is None else json.dumps(body).encode()
    req = request.Request(f"http://127.0.0.1:{port}{path}", data=data, headers=headers, method=method)
    with OPENER.open(req, timeout=10) as response:
        raw = response.read()
        return json.loads(raw) if raw else {}


def verify_emulator_token(token, verified=False):
    parts = token.split(".")
    if len(parts) != 3 or parts[2] != "":
        raise ValueError("Expected an unsigned Auth emulator token")
    decode = lambda part: json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))
    header, claims = decode(parts[0]), decode(parts[1])
    if (header.get("alg") != "none" or claims.get("aud") != PROJECT or
            claims.get("iss") != "https://securetoken.google.com/" + PROJECT):
        raise ValueError("Auth emulator returned a different project identity")
    if verified and claims.get("email_verified") is not True:
        raise ValueError("Synthetic account was not marked verified")
    return claims


def fields(values):
    def encode(value):
        if value is None:
            return {"nullValue": None}
        if isinstance(value, bool):
            return {"booleanValue": value}
        if isinstance(value, int):
            return {"integerValue": str(value)}
        if isinstance(value, float):
            return {"doubleValue": value}
        if isinstance(value, str):
            return {"stringValue": value}
        if isinstance(value, list):
            return {"arrayValue": {"values": [encode(v) for v in value]}}
        if isinstance(value, dict) and set(value) == {"_timestamp"}:
            return {"timestampValue": value["_timestamp"]}
        if isinstance(value, dict):
            return {"mapValue": {"fields": fields(value)}}
        raise ValueError("unsupported fixture value")
    return {k: encode(v) for k, v in values.items()}


def document(path, values):
    if not path.startswith("develop/plus-collections/"):
        raise ValueError("Only synthetic develop fixture documents can be seeded")
    return local_json(
        8798, f"/v1/projects/{PROJECT}/databases/(default)/documents/{path}",
        {"fields": fields(values)}, method="PATCH", owner=True,
    )


def seed():
    if FIXTURES["project"] != PROJECT:
        raise ValueError("Only the fixed demo project is supported")
    for email, account in FIXTURES["accounts"].items():
        body = {"email": email, "password": PASSWORD, "returnSecureToken": True}
        try:
            auth = local_json(9098, "/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake", body)
        except error.HTTPError as exc:
            if exc.code != 400 or b"EMAIL_EXISTS" not in exc.read():
                raise
            try:
                auth = local_json(9098, "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake", body)
            except error.HTTPError as signin_error:
                if signin_error.code != 400:
                    raise
                reason = signin_error.read()
                if b"INVALID_LOGIN_CREDENTIALS" not in reason and b"INVALID_PASSWORD" not in reason:
                    raise
                # Upgrade only the earlier public local fixture password, preserving synthetic UIDs.
                legacy_body = {**body, "password": "LocalQa-Only-090!"}
                auth = local_json(9098, "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake", legacy_body)
        verify_emulator_token(auth["idToken"])
        uid = auth["localId"]
        # This privileged marker is meaningful only to the fixed local emulator.
        local_json(9098, "/identitytoolkit.googleapis.com/v1/accounts:update?key=fake",
                   {"localId": uid, "emailVerified": True, "password": PASSWORD}, owner=True)
        verified = local_json(9098, "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake", body)
        verify_emulator_token(verified["idToken"], verified=True)
        member = {
            "userId": account["memberId"], "displayName": account["displayName"],
            "normalizedEmail": email, "authUid": uid, "roles": account["roles"],
            "isActive": True, "producerCatalogEnabled": True,
            "isCommonPurchaseManager": False, "ecoCommitment": {"mode": "weekly"},
            "companyName": "HU090 Fixture Farm",
        }
        document("develop/plus-collections/users/" + account["memberId"], member)
        document("develop/plus-collections/memberDirectory/" + account["memberId"], member)
        document("develop/plus-collections/authLinks/" + uid, {"memberId": account["memberId"]})
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    document("develop/plus-collections/config/public", {"versions": {"android": {
        "current": "0.3.0.1", "min": "0.3.0.1", "forceUpdate": False,
        "storeUrl": "https://example.invalid/hu090-never-publish",
    }}})
    document("develop/plus-collections/config/member", {
        "cacheExpirationMinutes": 60, "deliveryDayOfWeek": "THU",
        "lastTimestamps": {key: {"_timestamp": now} for key in
                           ("users", "products", "orders", "orderlines", "containers", "measures")},
    })
    document("develop/plus-collections/products/hu090-carrots", {
        "vendorId": "hu090-producer", "companyName": "HU090 Fixture Farm",
        "name": "HU090 Carrots", "description": "Synthetic local product",
        "price": 2.5, "unitName": "bag", "unitPlural": "bags", "unitQty": 1.0,
        "isAvailable": True, "pricingMode": "fixed", "stockMode": "infinite",
    })
    print(json.dumps({"project": PROJECT, "fixtureAccounts": len(FIXTURES["accounts"]),
                      "environment": "develop", "writes": "local-emulators-only"}))


if __name__ == "__main__":
    seed()
