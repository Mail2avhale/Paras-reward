"""
Phase F (Performance + Incentives) + Phase G (RBAC + Audit + Templates) contract tests.
"""
import os
import re
import time
import pytest
import requests

API = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
pytestmark = pytest.mark.skipif(not API, reason="REACT_APP_BACKEND_URL not set")


def _seed_employee():
    """Reuses the Phase D seed flow to get a fresh joined employee."""
    job = requests.post(f"{API}/api/public/careers/jobs/create", json={
        "title": f"PhaseFG job {int(time.time()*1000)}",
        "department": "Sales",
        "description": "Auto-seed for Phase F/G tests",
        "vacancy_count": 5,
    }, timeout=30).json()["job"]
    email = f"phaseFG_{int(time.time()*1000)}@t.com"
    r = requests.post(
        f"{API}/api/public/careers/apply",
        files={"resume": ("r.pdf", b"%PDF-1.4\nseed", "application/pdf")},
        data={"job_id": job["job_id"], "name": "FG Applicant", "email": email, "phone": "9800000001"},
        timeout=30,
    )
    app_id = r.json()["application_id"]
    off = requests.post(f"{API}/api/public/offers/generate", json={
        "application_id": app_id, "hiring_type": "Direct Hire",
        "designation": "Sales Executive", "department": "Sales",
        "joining_date": "2026-03-01", "salary_ctc": 500000,
    }, timeout=30).json()
    requests.post(f"{API}/api/public/offers/respond", json={"token": off["token"], "action": "accept"}, timeout=30)
    emp = requests.post(f"{API}/api/public/employees/from-application", json={"application_id": app_id}, timeout=30).json()["employee"]
    return emp


# ============================================================
# Phase F — Targets + Appraisals + Incentives
# ============================================================

def test_targets_assignment_and_weight_validation():
    emp = _seed_employee()

    # Weights don't sum to 100 → 400
    bad = requests.post(f"{API}/api/public/performance/targets", json={
        "employee_id": emp["employee_id"], "period": "2026-Q1", "kind": "quarterly",
        "metrics": [{"name": "Revenue", "target_value": 100000, "unit": "INR", "weight_pct": 40}],
    }, timeout=30)
    assert bad.status_code == 400

    r = requests.post(f"{API}/api/public/performance/targets", json={
        "employee_id": emp["employee_id"], "period": "2026-Q1", "kind": "quarterly",
        "metrics": [
            {"name": "Revenue", "target_value": 500000, "unit": "INR", "weight_pct": 60},
            {"name": "Leads", "target_value": 100, "unit": "count", "weight_pct": 40},
        ],
    }, timeout=30)
    assert r.status_code == 200
    tgt = r.json()["target"]
    assert re.match(r"^TGT-", tgt["target_id"])
    assert len(tgt["metrics"]) == 2

    listed = requests.get(f"{API}/api/public/performance/targets?employee_id={emp['employee_id']}", timeout=30).json()
    assert listed["total"] >= 1


def test_appraisal_full_cycle_with_auto_rating():
    emp = _seed_employee()

    # Create
    r = requests.post(f"{API}/api/public/performance/appraisals", json={
        "employee_id": emp["employee_id"], "cycle": "2026-Q1",
    }, timeout=30)
    assert r.status_code == 200
    apr = r.json()["appraisal"]
    assert apr["status"] == "draft"
    apr_id = apr["appraisal_id"]

    # Idempotent
    r2 = requests.post(f"{API}/api/public/performance/appraisals", json={
        "employee_id": emp["employee_id"], "cycle": "2026-Q1"
    }, timeout=30).json()
    assert r2["already_exists"] is True

    # Self review + submit
    r = requests.patch(f"{API}/api/public/performance/appraisals/{apr_id}", json={
        "self_review": "Met all targets", "status_action": "submit_self"
    }, timeout=30)
    assert r.status_code == 200
    assert r.json()["appraisal"]["status"] == "self_submitted"

    # Manager KPI scores → auto overall + rating
    r = requests.patch(f"{API}/api/public/performance/appraisals/{apr_id}", json={
        "manager_review": "Strong performer",
        "kpi_scores": [
            {"name": "Revenue", "target": 500000, "achieved": 480000, "weight_pct": 60},
            {"name": "Leads", "target": 100, "achieved": 110, "weight_pct": 40},
        ],
        "status_action": "manager_review",
    }, timeout=30).json()["appraisal"]
    # Revenue = 96%, Leads = 110% (capped 150) → weighted = 96*0.6 + 110*0.4 = 57.6 + 44 = 101.6
    assert abs(r["overall_score"] - 101.6) < 0.5
    assert r["rating"] == "outstanding"
    assert r["status"] == "manager_reviewed"

    # Finalise
    r = requests.post(f"{API}/api/public/performance/appraisals/{apr_id}/finalize", json={
        "recommendation": "increment_and_promotion"
    }, timeout=30)
    assert r.status_code == 200
    fin = r.json()["appraisal"]
    assert fin["status"] == "finalised"
    assert fin["recommendation"] == "increment_and_promotion"

    # Cannot update finalised
    r = requests.patch(f"{API}/api/public/performance/appraisals/{apr_id}", json={"self_review": "x"}, timeout=30)
    assert r.status_code == 400


def test_incentive_rule_and_calculation():
    emp = _seed_employee()

    # Create rule with 3 tiers
    r = requests.post(f"{API}/api/public/incentive/rules", json={
        "name": "Q1 Revenue Bonus", "department": "Sales", "kpi_name": "Revenue",
        "tiers": [
            {"threshold_pct": 100, "amount": 10000},
            {"threshold_pct": 120, "amount": 25000},
            {"threshold_pct": 80, "amount": 5000},
        ],
    }, timeout=30)
    assert r.status_code == 200
    rule = r.json()["rule"]
    # Tiers must be sorted DESC on threshold_pct
    assert [t["threshold_pct"] for t in rule["tiers"]] == [120, 100, 80]

    # Empty tiers → 400
    bad = requests.post(f"{API}/api/public/incentive/rules", json={
        "name": "Bad Rule", "department": "Sales", "kpi_name": "Revenue", "tiers": []
    }, timeout=30)
    assert bad.status_code == 400

    # Set up an appraisal with Revenue achievement 105% (target 500k, achieved 525k)
    requests.post(f"{API}/api/public/performance/appraisals", json={
        "employee_id": emp["employee_id"], "cycle": "2026-Q1"
    }, timeout=30)
    apr_list = requests.get(f"{API}/api/public/performance/appraisals?employee_id={emp['employee_id']}&cycle=2026-Q1", timeout=30).json()
    apr_id = apr_list["appraisals"][0]["appraisal_id"]
    requests.patch(f"{API}/api/public/performance/appraisals/{apr_id}", json={
        "kpi_scores": [{"name": "Revenue", "target": 500000, "achieved": 525000, "weight_pct": 100}]
    }, timeout=30)

    # Calculate
    r = requests.post(f"{API}/api/public/incentive/calculate", json={
        "employee_id": emp["employee_id"], "cycle": "2026-Q1"
    }, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body["count"] >= 1
    award = body["awards"][0]
    # 105% → matches 100 tier (below 120) → amount 10000
    assert award["achievement_pct"] == 105.0
    assert award["amount"] == 10000.0
    assert award["status"] == "calculated"

    # Decide flow: reject direct from calculated → allowed
    reject_r = requests.post(f"{API}/api/public/incentive/awards/{award['award_id']}/decide", json={
        "action": "reject", "comment": "budget cut"
    }, timeout=30)
    assert reject_r.json()["status"] == "rejected"

    # Cannot approve a rejected award
    approve_r = requests.post(f"{API}/api/public/incentive/awards/{award['award_id']}/decide", json={
        "action": "approve"
    }, timeout=30)
    assert approve_r.status_code == 400


def test_incentive_pay_state_machine():
    emp = _seed_employee()
    # Rule that will match easily
    r = requests.post(f"{API}/api/public/incentive/rules", json={
        "name": "Any perf bonus", "department": None, "kpi_name": "Any",
        "tiers": [{"threshold_pct": 0, "amount": 1000}],
    }, timeout=30)
    assert r.status_code == 200

    # Appraisal with matching KPI
    requests.post(f"{API}/api/public/performance/appraisals", json={
        "employee_id": emp["employee_id"], "cycle": "2026-Q2"
    }, timeout=30)
    apr = requests.get(f"{API}/api/public/performance/appraisals?employee_id={emp['employee_id']}&cycle=2026-Q2", timeout=30).json()["appraisals"][0]
    requests.patch(f"{API}/api/public/performance/appraisals/{apr['appraisal_id']}", json={
        "kpi_scores": [{"name": "Any", "target": 100, "achieved": 50, "weight_pct": 100}]
    }, timeout=30)

    calc = requests.post(f"{API}/api/public/incentive/calculate", json={
        "employee_id": emp["employee_id"], "cycle": "2026-Q2"
    }, timeout=30).json()
    award = calc["awards"][0]
    aid = award["award_id"]

    # calculated → approve → pay
    assert requests.post(f"{API}/api/public/incentive/awards/{aid}/decide", json={"action": "approve"}, timeout=30).json()["status"] == "approved"
    # cannot pay directly from calculated (already approved so this is fine)
    assert requests.post(f"{API}/api/public/incentive/awards/{aid}/decide", json={"action": "pay"}, timeout=30).json()["status"] == "paid"
    # cannot re-approve paid
    r = requests.post(f"{API}/api/public/incentive/awards/{aid}/decide", json={"action": "approve"}, timeout=30)
    assert r.status_code == 400


# ============================================================
# Phase G — RBAC + Audit + Templates
# ============================================================

def test_rbac_roles_and_permission_check():
    r = requests.get(f"{API}/api/public/rbac/roles", timeout=30).json()
    roles = {row["role"] for row in r["roles"]}
    assert roles >= {"super_admin", "hr_admin", "recruiter", "department_head", "district_manager", "employee", "candidate"}

    user = f"rbac_{int(time.time())}@t.com"
    r = requests.post(f"{API}/api/public/rbac/bind", json={"user": user, "role": "hr_admin"}, timeout=30)
    assert r.status_code == 200
    binding = r.json()["binding"]
    assert re.match(r"^RB-", binding["binding_id"])

    # Idempotent
    r2 = requests.post(f"{API}/api/public/rbac/bind", json={"user": user, "role": "hr_admin"}, timeout=30).json()
    assert r2["already_bound"] is True

    # Invalid role
    bad = requests.post(f"{API}/api/public/rbac/bind", json={"user": user, "role": "ninja_master"}, timeout=30)
    assert bad.status_code == 400

    # Permission check — hr_admin has career.jobs.* wildcard
    chk = requests.get(f"{API}/api/public/rbac/check?user={user}&permission=career.jobs.read", timeout=30).json()
    assert chk["allowed"] is True
    # But not employee.self (only 'employee' role has that)
    chk2 = requests.get(f"{API}/api/public/rbac/check?user={user}&permission=employee.self", timeout=30).json()
    assert chk2["allowed"] is False

    # Unbind
    r = requests.delete(f"{API}/api/public/rbac/bind/{binding['binding_id']}", timeout=30)
    assert r.status_code == 200
    chk3 = requests.get(f"{API}/api/public/rbac/check?user={user}&permission=career.jobs.read", timeout=30).json()
    assert chk3["allowed"] is False


def test_audit_log_captures_writes_and_filters():
    """Any action from Phase F (create appraisal etc.) must show up in /audit."""
    emp = _seed_employee()

    before = requests.get(f"{API}/api/public/audit?entity_type=performance_appraisal&limit=1000", timeout=30).json()["total"]

    requests.post(f"{API}/api/public/performance/appraisals", json={
        "employee_id": emp["employee_id"], "cycle": "2026-Q3"
    }, timeout=30)
    apr = requests.get(f"{API}/api/public/performance/appraisals?employee_id={emp['employee_id']}&cycle=2026-Q3", timeout=30).json()["appraisals"][0]
    requests.post(f"{API}/api/public/performance/appraisals/{apr['appraisal_id']}/finalize", json={"recommendation": "none"}, timeout=30)

    after = requests.get(f"{API}/api/public/audit?entity_type=performance_appraisal&limit=1000", timeout=30).json()
    assert after["total"] >= before + 2  # create + finalize

    # Filter by exact action prefix
    filt = requests.get(f"{API}/api/public/audit?action=appraisal.finalize&limit=50", timeout=30).json()
    assert all(l["action"].startswith("appraisal.finalize") for l in filt["logs"])
    # Each log has diff+ts+actor
    for l in filt["logs"][:5]:
        assert "ts" in l and "actor" in l and "action" in l
        assert isinstance(l.get("diff"), list)


def test_notification_templates_seed_and_render():
    """Default templates seeded on first list; render substitutes {vars}."""
    r = requests.get(f"{API}/api/public/notifications/templates", timeout=30).json()
    keys = {t["key"] for t in r["templates"]}
    assert "application_received" in keys
    assert "interview_scheduled" in keys
    assert r["keys"] and r["channels"]

    # Render — known + unknown var
    r = requests.post(f"{API}/api/public/notifications/render", json={
        "key": "leave_approved", "channel": "email",
        "context": {"name": "Ravi", "from_date": "2026-03-10", "to_date": "2026-03-12", "days": 3, "leave_type": "casual"}
    }, timeout=30).json()
    assert "Ravi" in r["body"]
    assert "2026-03-10" in r["subject"]

    # Missing var → verbatim {var}
    r2 = requests.post(f"{API}/api/public/notifications/render", json={
        "key": "leave_approved", "channel": "email", "context": {"name": "Ravi"}
    }, timeout=30).json()
    assert "{from_date}" in r2["subject"] or "{from_date}" in r2["body"]

    # Create + update + delete
    c = requests.post(f"{API}/api/public/notifications/templates", json={
        "key": "birthday", "channel": "email",
        "subject": "Happy Birthday {name}!", "body": "Wish you the very best."
    }, timeout=30).json()["template"]
    assert "name" in c["variables"]

    upd = requests.put(f"{API}/api/public/notifications/templates/{c['template_id']}", json={"subject": "Happy Birthday {name} — {year}!"}, timeout=30)
    assert upd.status_code == 200
    listed = requests.get(f"{API}/api/public/notifications/templates?key=birthday", timeout=30).json()
    b = next(t for t in listed["templates"] if t["template_id"] == c["template_id"])
    assert "year" in b["variables"]

    d = requests.delete(f"{API}/api/public/notifications/templates/{c['template_id']}", timeout=30)
    assert d.status_code == 200


def test_notification_template_invalid_key_and_channel():
    bad = requests.post(f"{API}/api/public/notifications/templates", json={
        "key": "not_a_key", "channel": "email", "subject": "x", "body": "y"
    }, timeout=30)
    assert bad.status_code == 400

    bad2 = requests.post(f"{API}/api/public/notifications/templates", json={
        "key": "birthday", "channel": "carrier_pigeon", "subject": "x", "body": "y"
    }, timeout=30)
    assert bad2.status_code == 400
