import base64
import json
import unittest
import gateway


def token(**changes):
    claims = {"aud": "demo-reguerta-hu090", "iss": "https://securetoken.google.com/demo-reguerta-hu090",
              "sub": "synthetic-uid", "email": "qa.member@example.invalid", "email_verified": True,
              "exp": 2000}
    claims.update(changes)
    encode = lambda obj: base64.urlsafe_b64encode(json.dumps(obj).encode()).decode().rstrip("=")
    return "Bearer " + encode({"alg": "none"}) + "." + encode(claims) + "."


class GatewayTest(unittest.TestCase):
    def test_member_contract(self):
        code, body = gateway.response_for(gateway.PREFIX + "resolveAuthorizedMember", token(), {"env": "develop"}, now=1000)
        self.assertEqual(200, code)
        self.assertEqual("hu090-member", body["memberId"])
        self.assertEqual(["member"], body["roles"])
        self.assertEqual("develop", body["environment"])

    def test_other_project_is_rejected(self):
        code, _ = gateway.response_for(gateway.PREFIX + "resolveAuthorizedMember", token(aud="real-project"), {"env": "develop"}, now=1000)
        self.assertEqual(401, code)

    def test_unverified_unknown_or_expired_accounts_are_rejected(self):
        for changes in ({"email_verified": False}, {"email": "outside@example.invalid"}, {"exp": 999}):
            code, _ = gateway.response_for(gateway.PREFIX + "resolveAuthorizedMember", token(**changes), {"env": "develop"}, now=1000)
            self.assertEqual(401, code)

    def test_other_function_or_environment_cannot_forward(self):
        for path, body in ((gateway.PREFIX + "publish", {"env": "develop"}),
                           (gateway.PREFIX + "resolveAuthorizedMember", {"env": "production"})):
            code, _ = gateway.response_for(path, token(), body, now=1000)
            self.assertEqual(403, code)

    def test_malformed_authorization_is_rejected(self):
        code, _ = gateway.response_for(gateway.PREFIX + "resolveAuthorizedMember", "Bearer invalid", {"env": "develop"}, now=1000)
        self.assertEqual(401, code)

    def test_shift_detail_contract_is_limited_to_the_fixture_member(self):
        code, body = gateway.response_for(gateway.PREFIX + "resolveShiftNotificationDetail", token(),
                                          {"environment": "develop", "eventId": "hu090-local-shift"}, now=1000)
        self.assertEqual(200, code)
        self.assertEqual("hu090-local-shift", body["eventId"])
        self.assertEqual(1, body["assignmentRevision"])
        self.assertEqual(1, body["documentRevision"])
        self.assertEqual("delivery", body["shift"]["type"])
        self.assertEqual(["hu090-member"], body["shift"]["assignedUserIds"])
        self.assertEqual("hu090-producer", body["shift"]["helperUserId"])

    def test_other_fixture_accounts_cannot_resolve_the_members_shift(self):
        for email in ("qa.producer@example.invalid", "qa.admin@example.invalid"):
            code, _ = gateway.response_for(gateway.PREFIX + "resolveShiftNotificationDetail", token(email=email),
                                          {"environment": "develop", "eventId": "hu090-local-shift"}, now=1000)
            self.assertEqual(403, code)

    def test_other_event_environment_or_extra_fields_cannot_resolve_a_shift(self):
        for request in ({"environment": "develop", "eventId": "other-event"},
                        {"environment": "production", "eventId": "hu090-local-shift"},
                        {"environment": "develop", "eventId": "hu090-local-shift", "memberId": "hu090-member"}):
            code, _ = gateway.response_for(gateway.PREFIX + "resolveShiftNotificationDetail", token(), request, now=1000)
            self.assertEqual(403, code)


if __name__ == "__main__":
    unittest.main()
