"""
Org Chart — visual hierarchy tree from Employee.reports_to
Prefix: /api/public/orgchart/*
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/public/orgchart", tags=["Org Chart"])
db = None


def set_db(database):
    global db
    db = database


class SetManager(BaseModel):
    reports_to: Optional[str] = None   # target manager's employee_id (None = root)
    admin_id: str = "admin"


@router.patch("/employees/{employee_id}")
async def set_manager(employee_id: str, data: SetManager):
    emp = await db.employees.find_one({"employee_id": employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if data.reports_to == employee_id:
        raise HTTPException(status_code=400, detail="Cannot report to self")
    if data.reports_to:
        mgr = await db.employees.find_one({"employee_id": data.reports_to}, {"_id": 0, "employee_id": 1})
        if not mgr:
            raise HTTPException(status_code=404, detail="Manager not found")
        # Cycle detection: walk up from proposed manager, must not encounter employee_id
        seen = set()
        cur = data.reports_to
        while cur:
            if cur == employee_id:
                raise HTTPException(status_code=400, detail="Cycle detected — proposed manager reports to this employee (directly or indirectly)")
            if cur in seen:
                break
            seen.add(cur)
            p = await db.employees.find_one({"employee_id": cur}, {"_id": 0, "reports_to": 1})
            cur = (p or {}).get("reports_to")

    now = datetime.now(timezone.utc).isoformat()
    await db.employees.update_one(
        {"employee_id": employee_id},
        {"$set": {"reports_to": data.reports_to, "updated_at": now, "reports_to_updated_by": data.admin_id}},
    )
    return {"success": True, "employee_id": employee_id, "reports_to": data.reports_to}


@router.get("/tree")
async def org_tree(department: Optional[str] = None):
    """Return a nested tree of active employees rooted at those without reports_to."""
    q = {"status": {"$ne": "separated"}}
    if department:
        q["department"] = department
    rows = await db.employees.find(
        q,
        {"_id": 0, "employee_id": 1, "name": 1, "designation": 1, "department": 1,
         "email": 1, "phone": 1, "reports_to": 1},
    ).to_list(5000)

    by_id = {r["employee_id"]: {**r, "reports": []} for r in rows}
    roots = []
    for r in rows:
        mgr_id = r.get("reports_to")
        if mgr_id and mgr_id in by_id:
            by_id[mgr_id]["reports"].append(by_id[r["employee_id"]])
        else:
            roots.append(by_id[r["employee_id"]])

    # Compute total headcount + max depth
    def _stats(node, depth=1):
        if not node["reports"]:
            return 1, depth
        count = 1
        max_d = depth
        for c in node["reports"]:
            cc, md = _stats(c, depth + 1)
            count += cc
            max_d = max(max_d, md)
        return count, max_d

    total = 0; max_depth = 0
    for r in roots:
        c, d = _stats(r)
        total += c; max_depth = max(max_depth, d)

    return {
        "tree": roots,
        "total_employees": total,
        "max_depth": max_depth,
        "orphans": [{"employee_id": r["employee_id"], "name": r["name"]} for r in rows
                    if r.get("reports_to") and r["reports_to"] not in by_id],
    }


@router.get("/flat")
async def flat_list(department: Optional[str] = None):
    """Simple flat list for admin dropdowns (choose a manager)."""
    q = {"status": {"$ne": "separated"}}
    if department:
        q["department"] = department
    rows = await db.employees.find(
        q,
        {"_id": 0, "employee_id": 1, "name": 1, "designation": 1, "department": 1, "reports_to": 1},
    ).sort([("department", 1), ("name", 1)]).to_list(5000)
    return {"employees": rows, "total": len(rows)}
