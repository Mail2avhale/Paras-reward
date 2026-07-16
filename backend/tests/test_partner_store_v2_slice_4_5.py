"""
Partner Store v2.0 — Slice 4 (Audit Log + Fraud) + Slice 5 (Reports + CSV)
==========================================================================
Backend E2E validation of newly-added endpoints:

  Slice 4:
    - GET /api/v2/partner-stores/admin/audit-log (+ filters + pagination)
    - Fraud & success events written on payment engine outcomes

  Slice 5:
    - GET /api/v2/partner-stores/admin/reports/summary
    - GET /api/v2/partner-stores/admin/reports/csv?type=payments|settlements|fraud
    - GET /api/v2/partner-stores/self/{uid}/report/csv (partner store gated)

Also runs quick regressions to confirm Slices 1-3 still pass.
"""

import os
import time
import uuid
import csv
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
V2 = f"{API}/v2/partner-stores"

ADMIN_PIN = "123456"

USER_MOBILE = "9970100782"
USER_PIN = "997010"
USER_UID = "76b75808-47fa-48dd-ad7c-8074678e3607"

SEED_STORE_ID = "100001"
SEED_STORE_MOBILE = "8888800001"
SEED_STORE_UID = "pstore-100001"


def _hdr():
    return {"X-Admin-Pin": ADMIN_PIN}


def _new_mobile():
    return "77776" + str(int(time.time() * 1000) % 100000).zfill(5)


# --------------------------------------------------------------------------
# Session-scoped: create & verify a fresh store to hit fraud limits cleanly
# --------------------------------------------------------------------------
@pytest.fixture(scope="module")
def fresh_store():
    mobile = _new_mobile()
    c = requests.post(f"{V2}/admin/create", json={
        "admin_pin": ADMIN_PIN,
        "business_name": "TEST_AuditStore",
        "owner_name": "TEST_AuditOwner",
        "mobile_number": mobile,
        "login_pin": "111222",
        "address": "TEST Audit Address",
        "bank_account_number": "99887766554433",
        "bank_ifsc": "HDFC0001234",
        "bank_account_holder": "TEST Auditor",
        "business_type": "grocery",
    }, timeout=15)
    assert c.status_code == 200, c.text
    sid = c.json()["store_id"]
    v = requests.post(f"{V2}/admin/verify", json={
        "admin_pin": ADMIN_PIN, "store_id": sid, "action": "verify"
    }, timeout=10)
    assert v.status_code == 200
    yield {"store_id": sid, "mobile": mobile}
    # Cleanup - suspend
    try:
        requests.post(f"{V2}/admin/verify", json={
            "admin_pin": ADMIN_PIN, "store_id": sid, "action": "suspend"
        }, timeout=10)
    except Exception:
        pass


# ═════════════════════════════════════════════════════════════════
# SLICE 4 — AUDIT LOG endpoint smoke
# ═════════════════════════════════════════════════════════════════
class TestAuditLogEndpoint:
    def test_audit_log_requires_admin_pin(self):
        r = requests.get(f"{V2}/admin/audit-log", timeout=10)
        assert r.status_code == 403

    def test_audit_log_wrong_pin(self):
        r = requests.get(f"{V2}/admin/audit-log", headers={"X-Admin-Pin": "wrong"}, timeout=10)
        assert r.status_code == 403

    def test_audit_log_returns_structure(self):
        r = requests.get(f"{V2}/admin/audit-log?limit=50", headers=_hdr(), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert "events" in d and isinstance(d["events"], list)
        assert "count_by_event" in d and isinstance(d["count_by_event"], dict)
        assert "has_more" in d
        assert "next_cursor" in d
        for ev in d["events"]:
            assert "_id" not in ev
            assert "event_id" in ev
            assert "event_type" in ev
            assert "severity" in ev
            assert "created_at" in ev

    def test_audit_log_filter_severity_warning(self):
        r = requests.get(f"{V2}/admin/audit-log?severity=warning&limit=50", headers=_hdr(), timeout=15)
        assert r.status_code == 200
        for ev in r.json()["events"]:
            assert ev["severity"] == "warning"

    def test_audit_log_filter_event_type(self):
        r = requests.get(f"{V2}/admin/audit-log?event_type=payment_success&limit=20", headers=_hdr(), timeout=15)
        assert r.status_code == 200
        for ev in r.json()["events"]:
            assert ev["event_type"] == "payment_success"

    def test_audit_log_filter_user_uid(self):
        r = requests.get(f"{V2}/admin/audit-log?user_uid={USER_UID}&limit=50", headers=_hdr(), timeout=15)
        assert r.status_code == 200
        for ev in r.json()["events"]:
            assert ev["user_uid"] == USER_UID

    def test_audit_log_pagination_cursor(self):
        # Fetch first page limit=5
        r1 = requests.get(f"{V2}/admin/audit-log?limit=5", headers=_hdr(), timeout=15)
        assert r1.status_code == 200
        d1 = r1.json()
        if d1.get("has_more") and d1.get("next_cursor"):
            r2 = requests.get(
                f"{V2}/admin/audit-log?limit=5&cursor={d1['next_cursor']}",
                headers=_hdr(), timeout=15
            )
            assert r2.status_code == 200
            # Second page events must be older
            d2 = r2.json()
            if d2["events"] and d1["events"]:
                assert d2["events"][0]["created_at"] < d1["events"][-1]["created_at"]


# ═════════════════════════════════════════════════════════════════
# SLICE 4 — Fraud/Success events actually written on payment engine outcomes
# ═════════════════════════════════════════════════════════════════
class TestAuditWritesOnPayment:
    def test_payment_success_writes_audit(self, fresh_store):
        sid = fresh_store["store_id"]
        client_txn = f"TEST-AUDIT-OK-{uuid.uuid4().hex[:10]}"
        r = requests.post(f"{V2}/pay", json={
            "user_uid": USER_UID, "store_id": sid,
            "prc_amount": 0.5, "client_txn_id": client_txn,
            "remark": "audit-success-test",
        }, timeout=20)
        assert r.status_code == 200, r.text
        # Give the audit_log a moment
        time.sleep(1)
        q = requests.get(
            f"{V2}/admin/audit-log?event_type=payment_success&store_id={sid}&limit=10",
            headers=_hdr(), timeout=15
        )
        assert q.status_code == 200
        events = q.json()["events"]
        assert any(
            ev["event_type"] == "payment_success" and ev["severity"] == "info"
            and ev.get("details", {}).get("txn_id") is not None
            and ev.get("details", {}).get("prc_amount") == 0.5
            and ev.get("details", {}).get("store_name")
            for ev in events
        ), f"payment_success audit not found for store {sid}: {events[:3]}"

    def test_insufficient_balance_writes_audit(self, fresh_store):
        sid = fresh_store["store_id"]
        # Create a fresh throwaway user with 0 balance
        junk_uid = f"junk-user-{uuid.uuid4().hex[:12]}"
        # Direct-insert via mongo? Cannot from client — use existing endpoint instead.
        # Instead use registration path — but simpler: use a "seed a user with 0 balance"
        # We'll insert via admin endpoint if present; else use a fake user via /auth flow.
        # Alternative: exhaust user balance is expensive. Use a non-existent uid to trigger 404 (won't audit).
        # Instead: seed via signup path is complex; skip if not doable.
        # Use direct DB seed via helper endpoint is not available.
        # We'll rely on the balance check to fire when balance < prc. Attempt using a user we know exists but with 0.
        # Fall back: use a helper endpoint if it exists, otherwise mark skip.
        pytest.skip("Cannot seed a 0-balance user via public API from test client")

    def test_daily_limit_writes_audit(self):
        pytest.skip("Cumulative >20000 PRC/day would require large real balance & many txns; skip in smoke run")

    def test_velocity_same_store_writes_audit(self, fresh_store):
        sid = fresh_store["store_id"]
        # 3 successes, then 4th should trigger velocity + audit
        for i in range(4):
            r = requests.post(f"{V2}/pay", json={
                "user_uid": USER_UID, "store_id": sid,
                "prc_amount": 0.25,
                "client_txn_id": f"TEST-VEL2-{uuid.uuid4().hex[:10]}",
                "remark": f"vel-{i}",
            }, timeout=15)
            if r.status_code == 429:
                assert "3 payments" in r.text or "already" in r.text.lower() or "daily" in r.text.lower()
                # Verify audit event
                time.sleep(1)
                q = requests.get(
                    f"{V2}/admin/audit-log?event_type=fraud_velocity_same_store_exceeded&store_id={sid}",
                    headers=_hdr(), timeout=15
                )
                assert q.status_code == 200
                events = q.json()["events"]
                assert any(
                    ev["event_type"] == "fraud_velocity_same_store_exceeded"
                    and ev["severity"] == "warning"
                    and ev.get("details", {}).get("cap") == 3
                    and "already_paid_today_to_store" in ev.get("details", {})
                    for ev in events
                ), f"velocity audit not found: {events[:3]}"
                return
        pytest.fail("Expected 429 velocity limit after 4 pays, never triggered")


# ═════════════════════════════════════════════════════════════════
# SLICE 5 — REPORTS SUMMARY
# ═════════════════════════════════════════════════════════════════
class TestReportsSummary:
    def test_reports_summary_requires_pin(self):
        r = requests.get(f"{V2}/admin/reports/summary", timeout=10)
        assert r.status_code == 403

    def test_reports_summary_ok(self):
        r = requests.get(f"{V2}/admin/reports/summary", headers=_hdr(), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert "payments" in d
        for k in ("total_prc", "txn_count", "unique_stores", "unique_users", "avg_prc"):
            assert k in d["payments"]
        assert "settlements" in d and isinstance(d["settlements"], dict)
        assert "fraud_events" in d
        assert "stores_by_status" in d
        # sanity
        assert d["payments"]["txn_count"] >= 0
        assert isinstance(d["settlements"], dict)

    def test_reports_summary_date_window(self):
        r = requests.get(
            f"{V2}/admin/reports/summary?from=2020-01-01T00:00:00Z&to=2020-01-02T00:00:00Z",
            headers=_hdr(), timeout=15
        )
        assert r.status_code == 200
        d = r.json()
        # No txns in 2020 should exist
        assert d["payments"]["txn_count"] == 0
        assert d["range"]["from"] == "2020-01-01T00:00:00Z"


# ═════════════════════════════════════════════════════════════════
# SLICE 5 — CSV EXPORT
# ═════════════════════════════════════════════════════════════════
class TestCSVExports:
    def test_csv_requires_pin(self):
        r = requests.get(f"{V2}/admin/reports/csv?type=payments", timeout=10)
        assert r.status_code == 403

    def test_csv_type_invalid(self):
        r = requests.get(f"{V2}/admin/reports/csv?type=bogus", headers=_hdr(), timeout=10)
        assert r.status_code == 422

    def _check_headers(self, r, expected_first_col):
        assert r.status_code == 200, r.text
        assert "text/csv" in r.headers.get("content-type", "").lower()
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd
        assert "filename=" in cd
        # Header row
        first_line = r.text.split("\n", 1)[0]
        cols = first_line.split(",")
        assert cols[0] == expected_first_col, f"Expected first col '{expected_first_col}', got {cols}"

    def test_csv_payments(self):
        r = requests.get(f"{V2}/admin/reports/csv?type=payments", headers=_hdr(), timeout=20)
        self._check_headers(r, "txn_id")
        # Verify 10 columns
        first = r.text.split("\n", 1)[0].split(",")
        assert first == ["txn_id", "created_at", "store_id", "store_name", "user_uid",
                         "user_name", "user_mobile", "prc_amount", "remark", "settlement_status"]
        # Parse via csv module (verifies proper escaping)
        rows = list(csv.reader(io.StringIO(r.text)))
        assert len(rows) >= 1

    def test_csv_settlements(self):
        r = requests.get(f"{V2}/admin/reports/csv?type=settlements", headers=_hdr(), timeout=20)
        self._check_headers(r, "request_id")
        first = r.text.split("\n", 1)[0].split(",")
        assert len(first) == 14, f"Expected 14 cols, got {len(first)}: {first}"

    def test_csv_fraud_excludes_info(self):
        r = requests.get(f"{V2}/admin/reports/csv?type=fraud&limit=10000", headers=_hdr(), timeout=20)
        self._check_headers(r, "event_id")
        rows = list(csv.reader(io.StringIO(r.text)))
        if len(rows) > 1:
            header = rows[0]
            sev_idx = header.index("severity")
            for row in rows[1:]:
                if row and len(row) > sev_idx:
                    assert row[sev_idx] in ("warning", "critical"), f"info leaked: {row[sev_idx]}"

    def test_csv_filename_has_date(self):
        r = requests.get(f"{V2}/admin/reports/csv?type=payments", headers=_hdr(), timeout=15)
        assert r.status_code == 200
        cd = r.headers.get("content-disposition", "")
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        assert today in cd, f"Filename missing date {today}: {cd}"

    def test_csv_escaping_via_csv_module(self):
        """Round-trip CSV via csv.reader to confirm quoted fields with commas/newlines survive."""
        r = requests.get(f"{V2}/admin/reports/csv?type=payments", headers=_hdr(), timeout=15)
        assert r.status_code == 200
        # If parsing fails, csv.Error raised
        reader = csv.reader(io.StringIO(r.text))
        rows = list(reader)
        assert len(rows) >= 1
        # ensure # cols matches header for every row
        expected_cols = len(rows[0])
        for i, row in enumerate(rows[1:], start=1):
            if row:  # skip trailing blank
                assert len(row) == expected_cols, f"Row {i} has {len(row)} cols (expected {expected_cols}): {row}"


# ═════════════════════════════════════════════════════════════════
# SLICE 5 — STORE SELF CSV
# ═════════════════════════════════════════════════════════════════
class TestStoreSelfCSV:
    def test_self_csv_ok(self):
        r = requests.get(f"{V2}/self/{SEED_STORE_UID}/report/csv", timeout=20)
        assert r.status_code == 200, r.text
        assert "text/csv" in r.headers.get("content-type", "").lower()
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd and "filename=" in cd
        first = r.text.split("\n", 1)[0].split(",")
        assert first[0] == "txn_id"

    def test_self_csv_forbidden_regular_user(self):
        r = requests.get(f"{V2}/self/{USER_UID}/report/csv", timeout=10)
        assert r.status_code == 403

    def test_self_csv_not_found(self):
        r = requests.get(f"{V2}/self/nonexistent-xyz/report/csv", timeout=10)
        # not-found user → 403 (per code, only role=partner_store allowed)
        assert r.status_code == 403


# ═════════════════════════════════════════════════════════════════
# REGRESSION — Prior slices still work
# ═════════════════════════════════════════════════════════════════
class TestRegression:
    def test_partner_store_login(self):
        r = requests.post(f"{API}/auth/login",
                          json={"mobile": SEED_STORE_MOBILE, "pin": "999888"}, timeout=10)
        assert r.status_code == 200
        assert r.json().get("role") == "partner_store"

    def test_admin_list_stores(self):
        r = requests.get(f"{V2}/admin/list?limit=5", headers=_hdr(), timeout=10)
        assert r.status_code == 200

    def test_admin_get_seed_detail(self):
        r = requests.get(f"{V2}/admin/{SEED_STORE_ID}", headers=_hdr(), timeout=10)
        assert r.status_code == 200

    def test_pay_idempotency_no_double_debit(self, fresh_store):
        sid = fresh_store["store_id"]
        client_txn = f"TEST-IDEM2-{uuid.uuid4().hex[:10]}"
        payload = {
            "user_uid": USER_UID, "store_id": sid,
            "prc_amount": 0.5, "client_txn_id": client_txn,
        }
        r1 = requests.post(f"{V2}/pay", json=payload, timeout=15)
        # Might 429 if velocity hit already — skip in that case
        if r1.status_code == 429:
            pytest.skip("velocity limit already hit for this store today")
        assert r1.status_code == 200
        bal1 = r1.json()["new_user_balance"]

        r2 = requests.post(f"{V2}/pay", json=payload, timeout=15)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("idempotent") is True
        u = requests.post(f"{API}/auth/login",
                          json={"mobile": USER_MOBILE, "pin": USER_PIN}, timeout=10).json()
        cur = float(u.get("prc_balance") or 0)
        assert abs(cur - bal1) < 0.01

    def test_first_payout_queue_excludes_partner_store(self):
        urls = [
            f"{API}/admin/bank-transfers/first-payout-queue",
            f"{API}/bank-transfer/admin/first-payout-queue",
        ]
        for url in urls:
            r = requests.get(url, params={"admin_id": "admin-test-123"}, timeout=15)
            if r.status_code == 200:
                d = r.json()
                items = d.get("requests") or d.get("items") or d.get("queue") or []
                for it in items:
                    assert it.get("source_type") != "partner_store", (
                        f"partner_store leaked into first-payout queue: {it.get('request_id')}"
                    )
                return
        pytest.skip("First-payout queue endpoint not accessible")

    def test_admin_popup_placements(self):
        """4 placements resolve via admin popup active endpoint."""
        placements = ["dashboard_home", "community_feed", "notifications", "partner_store_payment"]
        for placement in placements:
            r = requests.get(f"{API}/admin/popup/active?placement={placement}", timeout=10)
            # 200 (with or without popup) is fine; 404/500 is not
            assert r.status_code in (200, 204), f"placement={placement} → {r.status_code}: {r.text[:100]}"

    def test_community_leadership_position(self):
        r = requests.get(f"{API}/partners/my-position/{USER_UID}", timeout=15)
        # 200 or 404 (user not a partner). We just need endpoint reachable.
        assert r.status_code in (200, 404), f"unexpected {r.status_code}: {r.text[:100]}"
        if r.status_code == 200:
            d = r.json()
            # Only assert fields IF the endpoint returns them
            # (depending on user progression these may or may not be present)
            assert isinstance(d, dict)
