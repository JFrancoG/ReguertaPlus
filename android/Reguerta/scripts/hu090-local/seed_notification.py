#!/usr/bin/env python3
"""Write one synthetic local inbox item after the performance pair; never reseed config."""

import json
from pathlib import Path
from seed import document


def seed_notification():
    fixture = json.loads(Path(__file__).with_name("notification-fixture.json").read_text())
    if (fixture["project"] != "demo-reguerta-hu090" or fixture["environment"] != "develop" or
            fixture["memberId"] != "hu090-member" or fixture["eventId"] != "hu090-local-shift"):
        raise ValueError("Only the fixed local notification fixture is supported")
    document(
        "develop/plus-collections/users/hu090-member/notificationInbox/hu090-local-shift",
        fixture["inbox"],
    )
    print("Seeded one local demo inbox item; no config, user or performance fixture changed")


if __name__ == "__main__":
    seed_notification()
