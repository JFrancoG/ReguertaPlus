#!/usr/bin/env python3
"""Local app-contract fixture, not a Firebase backend implementation or proxy."""
import base64
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import time

FIXTURES = json.loads(Path(__file__).with_name("gateway-fixtures.json").read_text())
NOTIFICATION = json.loads(Path(__file__).with_name("notification-fixture.json").read_text())
PROJECT = "demo-reguerta-hu090"
PREFIX = f"/{PROJECT}/europe-west1/"
if FIXTURES["project"] != PROJECT or FIXTURES["environment"] != "develop":
    raise RuntimeError("Only the fixed local demo fixtures are supported")
if (NOTIFICATION["project"] != PROJECT or NOTIFICATION["environment"] != "develop" or
        NOTIFICATION["memberId"] != "hu090-member" or NOTIFICATION["eventId"] != "hu090-local-shift"):
    raise RuntimeError("Only the fixed local notification fixture is supported")


def response_for(path, authorization, request, now=None):
    """Reject non-fixture identities and paths without forwarding any request."""
    if path not in (PREFIX + "resolveAuthorizedMember", PREFIX + "resolveShiftNotificationDetail"):
        return 403, {"error": {"code": "fixture_function_not_supported"}}
    expected_request = ({"env": "develop"} if path == PREFIX + "resolveAuthorizedMember" else
                        {"environment": "develop", "eventId": "hu090-local-shift"})
    if request != expected_request:
        return 403, {"error": {"code": "fixture_environment_required"}}
    try:
        if not authorization.startswith("Bearer "):
            raise ValueError("missing bearer")
        parts = authorization[7:].split(".")
        if len(parts) != 3 or parts[2] != "":
            raise ValueError("only unsigned emulator tokens are supported")
        decode = lambda part: json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))
        header, claims = decode(parts[0]), decode(parts[1])
        if (header["alg"] != "none" or claims["aud"] != PROJECT or
                claims["iss"] != "https://securetoken.google.com/" + PROJECT or
                claims["email_verified"] is not True or not claims["sub"] or
                claims["exp"] <= (time.time() if now is None else now)):
            raise ValueError("non-fixture token")
        account = FIXTURES["accounts"][claims["email"]]
    except (ValueError, KeyError, TypeError):
        return 401, {"error": {"code": "fixture_auth_required"}}
    if path == PREFIX + "resolveShiftNotificationDetail":
        if claims["email"] != "qa.member@example.invalid" or account["memberId"] != "hu090-member":
            return 403, {"error": {"code": "fixture_notification_member_required"}}
        return 200, NOTIFICATION["detail"]
    return 200, {
        "authorized": True,
        "isActive": True,
        "memberId": account["memberId"],
        "roles": account["roles"],
        "environment": "develop",
        "firstLoginLinked": False,
    }


class Handler(BaseHTTPRequestHandler):
    def send(self, code, payload):
        data = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/_hu090/health":
            self.send(200, {"project": PROJECT, "oracle": "local-contract-fixture", "cloudForwarding": False})
        else:
            self.send(404, {"error": "fixture_path_not_found"})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 65536:
                raise ValueError("body bound")
            payload = json.loads(self.rfile.read(length))
            code, body = response_for(self.path, self.headers.get("Authorization", ""), payload)
            self.send(code, body)
        except (ValueError, json.JSONDecodeError):
            self.send(400, {"error": "invalid_fixture_request"})

    def log_message(self, format, *args):
        # No tokens, request bodies or account details in logs.
        return


if __name__ == "__main__":
    print("HU090 local contract fixture on 127.0.0.1:5009; no cloud forwarding", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 5009), Handler).serve_forever()
