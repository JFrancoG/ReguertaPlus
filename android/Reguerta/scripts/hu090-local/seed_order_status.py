#!/usr/bin/env python3
"""Own six fixed local fixture documents; never alter public config or real projects."""

import argparse
import json
from pathlib import Path
from urllib import error
from seed import document, local_json

PROJECT = "demo-reguerta-hu090"
PREFIX = f"/v1/projects/{PROJECT}/databases/(default)/documents/develop/plus-collections/"
EXPECTED_ORDERS = {"hu090-denied", "hu090-ui-allowed", "hu090-missing"}
EXPECTED_LINES = {"hu090-ui-denied-line", "hu090-ui-allowed-line", "hu090-ui-missing-line"}


def fixture():
    value = json.loads(Path(__file__).with_name("order-status-fixture.json").read_text())
    if (value["project"] != PROJECT or value["environment"] != "develop" or value["weekKey"] != "2026-W45" or
            {case["orderId"] for case in value["cases"]} != EXPECTED_ORDERS or
            {case["lineId"] for case in value["cases"]} != EXPECTED_LINES or len(value["cases"]) != 3):
        raise ValueError("Only the fixed six local order-status documents are supported")
    return value


def relative_paths():
    return ["orders/" + value for value in sorted(EXPECTED_ORDERS)] + [
        "orderlines/" + value for value in sorted(EXPECTED_LINES)]


def read(relative):
    if relative not in relative_paths():
        raise ValueError("Unexpected fixture document")
    try:
        return local_json(8798, PREFIX + relative, owner=True)
    except error.HTTPError as exc:
        if exc.code == 404:
            return None
        raise


def remove(relative):
    if relative not in relative_paths():
        raise ValueError("Unexpected fixture delete")
    try:
        local_json(8798, PREFIX + relative, method="DELETE", owner=True)
    except error.HTTPError as exc:
        if exc.code != 404:
            raise


def seed():
    value = fixture()
    if any(read(path) is not None for path in relative_paths()):
        raise RuntimeError("Refusing to overwrite an existing fixture document; clean up the prior run explicitly")
    for case in value["cases"]:
        document("develop/plus-collections/orders/" + case["orderId"], {
            "userId": case["userId"], "weekKey": value["weekKey"], "total": 2.5,
            "producerStatus": "read", "producerStatusesByVendor": {"hu090-producer": "read"},
            "updatedAt": {"_timestamp": "2026-11-10T10:00:00Z"},
        })
        document("develop/plus-collections/orderlines/" + case["lineId"], {
            "orderId": case["orderId"], "userId": case["userId"],
            "consumerDisplayName": case["consumerDisplayName"], "weekKey": value["weekKey"],
            "vendorId": "hu090-producer", "companyName": "HU090 Fixture Farm", "productId": "hu090-carrots",
            "productName": "HU090 Carrots", "quantity": 1, "priceAtOrder": 2.5, "subtotal": 2.5,
            "unitName": "bag", "unitPlural": "bags", "unitQty": 1.0, "pricingModeAtOrder": "fixed",
        })
    print("Seeded six local order-status documents; config and timestamps untouched")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--cleanup", action="store_true")
    action.add_argument("--remove-missing-order", action="store_true")
    action.add_argument("--read", action="store_true")
    args = parser.parse_args()
    fixture()
    if args.cleanup:
        for path in relative_paths():
            remove(path)
        print("Removed only the six fixed local fixture documents")
    elif args.remove_missing_order:
        remove("orders/hu090-missing")
        print("Removed only the temporary hu090-missing order; its UI-loaded line remains for NOT_FOUND")
    elif args.read:
        print(json.dumps({path: read(path) for path in relative_paths()}, indent=2))
    else:
        seed()
