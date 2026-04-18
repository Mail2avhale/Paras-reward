"""
EMPLOYEE MANAGEMENT SYSTEM
============================
1. Employee CRUD (Add from existing users, Edit, Resign/Terminate)
2. Employee Pool Wallet (20% from mining, proportional salary-based distribution)
3. Attendance (Present/Absent/Half-day/Leave)
4. Salary Slip (Indian standard: Basic, HRA, Allowances, PF, ESI, PT, TDS)
5. Digital ID Card
6. Company: Paras Reward Technologies Private Limited
"""

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from pydantic import BaseModel, Field
import calendar
import math
import os
import base64

router = APIRouter(prefix="/employees", tags=["Employee Management"])

db = None
cache = None

COMPANY_NAME = "Paras Reward Technologies Private Limited"
COMPANY_ADDRESS = "B-18, Bizz Tower, Chatrapati Sambhaji Nagar, Maharashtra 431006"
COMPANY_WEBSITE = "www.parasreward.com"

# Standard Departments
DEPARTMENTS = [
    "Technology", "Operations", "Marketing", "Sales",
    "Finance", "Human Resources", "Customer Support",
    "Business Development", "Administration", "Management"
]

# Standard Designations
DESIGNATIONS = [
    "CEO", "CTO", "CFO", "COO",
    "Director", "General Manager", "Senior Manager", "Manager",
    "Assistant Manager", "Team Lead", "Senior Executive", "Executive",
    "Associate", "Junior Associate", "Trainee", "Intern",
    "Software Developer", "UI/UX Designer", "QA Engineer",
    "Digital Marketing Executive", "Content Writer",
    "Accountant", "HR Executive", "Support Executive",
    "Business Development Executive", "Operations Executive"
]

DEFAULT_EMPLOYEE_POOL_RATE = 20  # 20% of mining to employee pool


def set_db(database):
    global db
    db = database


def set_cache(cache_instance):
    global cache
    cache = cache_instance


# ==================== MODELS ====================

class AddEmployeeRequest(BaseModel):
    user_id: str
    department: str
    designation: str
    monthly_salary: float = Field(..., ge=1000)
    joining_date: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None  # Male, Female, Other
    father_name: Optional[str] = None
    blood_group: Optional[str] = None
    reporting_manager: Optional[str] = None  # employee_id of manager
    probation_months: Optional[int] = 6
    employment_type: Optional[str] = "full_time"  # full_time, part_time, contract, intern
    admin_id: str

class UpdateEmployeeRequest(BaseModel):
    employee_id: str
    department: Optional[str] = None
    designation: Optional[str] = None
    monthly_salary: Optional[float] = None
    admin_id: str

class ResignEmployeeRequest(BaseModel):
    employee_id: str
    resign_date: Optional[str] = None
    reason: Optional[str] = None
    admin_id: str

class MarkAttendanceRequest(BaseModel):
    employee_id: str
    date: str  # YYYY-MM-DD
    status: str  # present, absent, half_day, leave, holiday
    admin_id: str
    note: Optional[str] = None

class BulkAttendanceRequest(BaseModel):
    date: str
    attendance: List[dict]  # [{"employee_id": "...", "status": "present"}]
    admin_id: str

class GenerateSalarySlipRequest(BaseModel):
    employee_id: str
    month: int  # 1-12
    year: int
    admin_id: str


# ==================== SALARY BREAKDOWN HELPERS ====================

def calculate_salary_breakdown(monthly_salary: float) -> dict:
    """
    Indian standard salary breakdown.
    Basic: 40% of CTC
    HRA: 20% of CTC (50% of Basic)
    Special Allowance: 25% of CTC
    Conveyance: 1600/month standard
    Medical: Remaining
    """
    basic = round(monthly_salary * 0.40, 2)
    hra = round(monthly_salary * 0.20, 2)
    conveyance = min(1600, round(monthly_salary * 0.05, 2))
    special_allowance = round(monthly_salary * 0.25, 2)
    medical = round(monthly_salary - basic - hra - conveyance - special_allowance, 2)
    if medical < 0:
        medical = 0
        special_allowance = round(monthly_salary - basic - hra - conveyance, 2)

    # Employee Deductions
    pf_basic = min(basic, 15000)
    pf_employee = round(pf_basic * 0.12, 2)
    esi_employee = round(monthly_salary * 0.0075, 2) if monthly_salary <= 21000 else 0
    professional_tax = 200 if monthly_salary > 10000 else 0

    # TDS estimate
    annual = monthly_salary * 12
    if annual <= 300000:
        tds = 0
    elif annual <= 600000:
        tds = round((annual - 300000) * 0.05 / 12, 2)
    elif annual <= 900000:
        tds = round(((annual - 600000) * 0.10 + 300000 * 0.05) / 12, 2)
    else:
        tds = round(((annual - 900000) * 0.15 + 300000 * 0.10 + 300000 * 0.05) / 12, 2)

    # Employer contributions (not deducted from employee, but part of CTC)
    pf_employer = round(pf_basic * 0.12, 2)  # 12% employer PF
    esi_employer = round(monthly_salary * 0.0325, 2) if monthly_salary <= 21000 else 0  # 3.25% employer ESI
    gratuity = round(basic * 15 / 26 / 12, 2)  # Gratuity = (Basic * 15) / 26 / 12 per month

    total_earnings = round(basic + hra + conveyance + special_allowance + medical, 2)
    total_deductions = round(pf_employee + esi_employee + professional_tax + tds, 2)
    net_salary = round(total_earnings - total_deductions, 2)

    return {
        "earnings": {
            "basic_salary": basic,
            "hra": hra,
            "conveyance_allowance": conveyance,
            "special_allowance": special_allowance,
            "medical_allowance": medical,
            "total_earnings": total_earnings
        },
        "deductions": {
            "pf_employee": pf_employee,
            "esi_employee": esi_employee,
            "professional_tax": professional_tax,
            "tds": tds,
            "total_deductions": total_deductions
        },
        "employer_contributions": {
            "pf_employer": pf_employer,
            "esi_employer": esi_employer,
            "gratuity": gratuity,
            "total_employer": round(pf_employer + esi_employer + gratuity, 2)
        },
        "net_salary": net_salary
    }


def calculate_ctc(monthly_salary: float) -> dict:
    """Calculate annual CTC including employer contributions."""
    breakdown = calculate_salary_breakdown(monthly_salary)
    employer = breakdown.get("employer_contributions", {})
    monthly_ctc = monthly_salary + employer.get("total_employer", 0)
    return {
        "monthly": round(monthly_ctc, 2),
        "annual": round(monthly_ctc * 12, 2),
        "gross_monthly": monthly_salary,
        "gross_annual": monthly_salary * 12
    }


def number_to_words_inr(amount: float) -> str:
    """Convert number to Indian Rupees in words."""
    ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
            'Seventeen', 'Eighteen', 'Nineteen']
    tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

    def two_digits(n):
        if n < 20:
            return ones[n]
        return tens[n // 10] + (' ' + ones[n % 10] if n % 10 else '')

    def three_digits(n):
        if n >= 100:
            return ones[n // 100] + ' Hundred' + (' and ' + two_digits(n % 100) if n % 100 else '')
        return two_digits(n)

    if amount < 0:
        return 'Minus ' + number_to_words_inr(-amount)

    rupees = int(amount)
    paise = round((amount - rupees) * 100)

    if rupees == 0:
        return 'Zero Rupees' + (f' and {two_digits(paise)} Paise' if paise else ' Only')

    parts = []
    if rupees >= 10000000:
        parts.append(two_digits(rupees // 10000000) + ' Crore')
        rupees %= 10000000
    if rupees >= 100000:
        parts.append(two_digits(rupees // 100000) + ' Lakh')
        rupees %= 100000
    if rupees >= 1000:
        parts.append(two_digits(rupees // 1000) + ' Thousand')
        rupees %= 1000
    if rupees > 0:
        parts.append(three_digits(rupees))

    result = 'Rupees ' + ' '.join(parts)
    if paise:
        result += f' and {two_digits(paise)} Paise'
    result += ' Only'
    return result


# ==================== EMPLOYEE POOL WALLET ====================

async def get_employee_pool_settings() -> dict:
    settings = await db.employee_pool_settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {
            "pool_rate": DEFAULT_EMPLOYEE_POOL_RATE,
            "enabled": True,
            "prc_to_inr_rate": 0.10,  # 1 PRC = 0.10 INR (dynamic, admin configurable)
        }
        await db.employee_pool_settings.update_one(
            {}, {"$set": settings}, upsert=True
        )
    return settings


async def credit_employee_pool(amount: float, user_id: str, description: str = "Mining collect"):
    """Called from mining.py when user collects mining rewards."""
    try:
        settings = await get_employee_pool_settings()
        if not settings.get("enabled"):
            return

        pool_rate = settings.get("pool_rate", DEFAULT_EMPLOYEE_POOL_RATE)
        pool_amount = round(amount * pool_rate / 100, 6)

        if pool_amount <= 0:
            return

        await db.employee_pool_settings.update_one(
            {},
            {"$inc": {"pool_balance": pool_amount}},
            upsert=True
        )

        await db.employee_pool_transactions.insert_one({
            "txn_id": f"EPT-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:6]}",
            "type": "credit",
            "amount": pool_amount,
            "source_user_id": user_id,
            "description": f"Mining collect: {description}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        logging.error(f"[EMPLOYEE POOL] Credit error: {e}")


async def distribute_employee_pool():
    """Distribute pool balance proportionally based on salary. Called by cron daily."""
    try:
        settings = await get_employee_pool_settings()
        pool_balance = settings.get("pool_balance", 0)
        prc_to_inr = settings.get("prc_to_inr_rate", 0.10)

        if pool_balance <= 0:
            logging.info("[EMPLOYEE POOL] No balance to distribute")
            return

        now = datetime.now(timezone.utc)
        current_month = now.month
        current_year = now.year

        # Get active employees
        active_employees = await db.employees.find(
            {"status": "active"},
            {"_id": 0}
        ).to_list(10000)

        if not active_employees:
            logging.info("[EMPLOYEE POOL] No active employees")
            return

        total_salary = sum(e.get("monthly_salary", 0) for e in active_employees)
        if total_salary <= 0:
            return

        distributed_count = 0
        total_distributed = 0

        for emp in active_employees:
            salary = emp.get("monthly_salary", 0)
            if salary <= 0:
                continue

            # Proportional share
            share_ratio = salary / total_salary
            share_prc = round(pool_balance * share_ratio, 6)

            # Check monthly cap (salary in PRC = salary_inr / prc_to_inr)
            salary_cap_prc = salary / prc_to_inr if prc_to_inr > 0 else salary * 10

            # Get already distributed this month
            month_start = f"{current_year}-{current_month:02d}-01"
            earned_this_month = await db.employee_pool_transactions.aggregate([
                {"$match": {
                    "type": "distribution",
                    "employee_id": emp["employee_id"],
                    "timestamp": {"$gte": month_start}
                }},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]).to_list(1)
            already_earned = earned_this_month[0]["total"] if earned_this_month else 0

            remaining_cap = max(0, salary_cap_prc - already_earned)
            actual_share = min(share_prc, remaining_cap)

            if actual_share <= 0:
                continue

            # Credit to user's PRC balance
            user_id = emp.get("user_id")
            await db.users.update_one(
                {"uid": user_id},
                {"$inc": {"prc_balance": actual_share}}
            )

            # Record transaction
            await db.employee_pool_transactions.insert_one({
                "txn_id": f"EPD-{now.strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:6]}",
                "type": "distribution",
                "amount": actual_share,
                "employee_id": emp["employee_id"],
                "user_id": user_id,
                "employee_name": emp.get("name", ""),
                "salary_ratio": round(share_ratio, 4),
                "description": "Daily salary distribution",
                "timestamp": now.isoformat()
            })

            # Update employee earned this month
            await db.employees.update_one(
                {"employee_id": emp["employee_id"]},
                {"$inc": {"earned_this_month": actual_share}}
            )

            distributed_count += 1
            total_distributed += actual_share

        # Deduct from pool
        if total_distributed > 0:
            await db.employee_pool_settings.update_one(
                {},
                {"$inc": {"pool_balance": -total_distributed}}
            )

            await db.employee_pool_transactions.insert_one({
                "txn_id": f"EPD-BATCH-{now.strftime('%Y%m%d%H%M%S')}",
                "type": "batch_distribution",
                "amount": total_distributed,
                "employees_count": distributed_count,
                "description": f"Daily distribution to {distributed_count} employees",
                "timestamp": now.isoformat()
            })

        logging.info(f"[EMPLOYEE POOL] Distributed {total_distributed:.4f} PRC to {distributed_count} employees")

    except Exception as e:
        logging.error(f"[EMPLOYEE POOL] Distribution error: {e}")


# ==================== EMPLOYEE CRUD ENDPOINTS ====================

@router.get("/departments")
async def get_departments():
    return {"departments": DEPARTMENTS, "designations": DESIGNATIONS}


@router.post("/add")
async def add_employee(data: AddEmployeeRequest):
    try:
        user = await db.users.find_one({"uid": data.user_id}, {"_id": 0, "uid": 1, "name": 1, "email": 1, "mobile": 1})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        existing = await db.employees.find_one({"user_id": data.user_id, "status": "active"})
        if existing:
            raise HTTPException(status_code=400, detail="User is already an active employee")

        # Generate employee ID
        count = await db.employees.count_documents({})
        employee_id = f"EMP-{count + 1:04d}"

        now = datetime.now(timezone.utc).isoformat()
        joining = data.joining_date or now[:10]

        breakdown = calculate_salary_breakdown(data.monthly_salary)

        employee = {
            "employee_id": employee_id,
            "user_id": data.user_id,
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "mobile": user.get("mobile", ""),
            "date_of_birth": data.date_of_birth,
            "gender": data.gender,
            "father_name": data.father_name,
            "blood_group": data.blood_group,
            "department": data.department,
            "designation": data.designation,
            "reporting_manager": data.reporting_manager,
            "employment_type": data.employment_type or "full_time",
            "probation_months": data.probation_months or 6,
            "monthly_salary": data.monthly_salary,
            "salary_breakdown": breakdown,
            "ctc": calculate_ctc(data.monthly_salary),
            "joining_date": joining,
            "confirmation_date": None,
            "status": "active",
            "photo_url": None,
            # Leave balance (annual allocation)
            "leave_balance": {
                "casual_leave": 12,
                "sick_leave": 12,
                "earned_leave": 15,
                "used_casual": 0,
                "used_sick": 0,
                "used_earned": 0
            },
            # Documents
            "documents": {
                "aadhar_number": None,
                "pan_number": None,
                "bank_account": None,
                "bank_name": None,
                "ifsc_code": None,
                "uan_number": None,
                "esic_number": None,
                "pf_eligible": True,
                "esi_eligible": data.monthly_salary <= 21000
            },
            # Emergency contact
            "emergency_contact": {
                "name": None,
                "relation": None,
                "phone": None
            },
            # Address
            "address": {
                "current": None,
                "permanent": None
            },
            "earned_this_month": 0,
            "total_earned": 0,
            "added_by": data.admin_id,
            "created_at": now,
            "updated_at": now
        }

        await db.employees.insert_one(employee)
        employee.pop("_id", None)

        return {"success": True, "message": f"Employee {employee_id} added", "employee": employee}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[EMPLOYEE] Add error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def list_employees(status: str = "all"):
    try:
        query = {}
        if status != "all":
            query["status"] = status
        employees = await db.employees.find(query, {"_id": 0}).sort("employee_id", 1).to_list(10000)
        
        active_count = sum(1 for e in employees if e.get("status") == "active")
        total_salary = sum(e.get("monthly_salary", 0) for e in employees if e.get("status") == "active")
        
        return {
            "employees": employees,
            "stats": {
                "total": len(employees),
                "active": active_count,
                "resigned": sum(1 for e in employees if e.get("status") == "resigned"),
                "terminated": sum(1 for e in employees if e.get("status") == "terminated"),
                "total_monthly_salary": total_salary
            }
        }
    except Exception as e:
        logging.error(f"[EMPLOYEE] List error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/update")
async def update_employee(data: UpdateEmployeeRequest):
    try:
        emp = await db.employees.find_one({"employee_id": data.employee_id})
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        update = {"updated_at": datetime.now(timezone.utc).isoformat()}
        if data.department:
            update["department"] = data.department
        if data.designation:
            update["designation"] = data.designation
        if data.monthly_salary:
            update["monthly_salary"] = data.monthly_salary
            update["salary_breakdown"] = calculate_salary_breakdown(data.monthly_salary)
            # Log salary change
            await db.employee_salary_history.insert_one({
                "employee_id": data.employee_id,
                "old_salary": emp.get("monthly_salary"),
                "new_salary": data.monthly_salary,
                "changed_by": data.admin_id,
                "changed_at": datetime.now(timezone.utc).isoformat()
            })

        await db.employees.update_one({"employee_id": data.employee_id}, {"$set": update})
        return {"success": True, "message": "Employee updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resign")
async def resign_employee(data: ResignEmployeeRequest):
    try:
        emp = await db.employees.find_one({"employee_id": data.employee_id})
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        if emp.get("status") != "active":
            raise HTTPException(status_code=400, detail="Employee is not active")

        now = datetime.now(timezone.utc).isoformat()
        resign_date = data.resign_date or now[:10]

        await db.employees.update_one(
            {"employee_id": data.employee_id},
            {"$set": {
                "status": "resigned",
                "resign_date": resign_date,
                "resign_reason": data.reason or "",
                "resigned_by": data.admin_id,
                "updated_at": now
            }}
        )
        return {"success": True, "message": f"Employee {data.employee_id} resigned"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== DOCUMENTS & PERSONAL INFO ====================

@router.put("/update-documents/{employee_id}")
async def update_employee_documents(employee_id: str, request: Request):
    """Update employee documents (Aadhar, PAN, Bank, UAN)."""
    try:
        emp = await db.employees.find_one({"employee_id": employee_id})
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        data = await request.json()
        docs = emp.get("documents", {})
        for key in ["aadhar_number", "pan_number", "bank_account", "bank_name", "ifsc_code", "uan_number", "esic_number", "pf_eligible", "esi_eligible"]:
            if key in data:
                docs[key] = data[key]

        await db.employees.update_one(
            {"employee_id": employee_id},
            {"$set": {"documents": docs, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"success": True, "message": "Documents updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/update-emergency/{employee_id}")
async def update_emergency_contact(employee_id: str, request: Request):
    """Update emergency contact details."""
    try:
        emp = await db.employees.find_one({"employee_id": employee_id})
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        data = await request.json()
        contact = emp.get("emergency_contact", {})
        for key in ["name", "relation", "phone"]:
            if key in data:
                contact[key] = data[key]

        await db.employees.update_one(
            {"employee_id": employee_id},
            {"$set": {"emergency_contact": contact, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"success": True, "message": "Emergency contact updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/update-address/{employee_id}")
async def update_address(employee_id: str, request: Request):
    """Update employee address."""
    try:
        emp = await db.employees.find_one({"employee_id": employee_id})
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        data = await request.json()
        address = emp.get("address", {})
        for key in ["current", "permanent"]:
            if key in data:
                address[key] = data[key]

        await db.employees.update_one(
            {"employee_id": employee_id},
            {"$set": {"address": address, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"success": True, "message": "Address updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== LEAVE MANAGEMENT ====================

LEAVE_TYPES = {
    "casual_leave": {"label": "Casual Leave", "annual": 12},
    "sick_leave": {"label": "Sick Leave", "annual": 12},
    "earned_leave": {"label": "Earned Leave", "annual": 15}
}


@router.post("/leave/apply")
async def apply_leave(request: Request):
    """Apply for leave (admin on behalf of employee)."""
    try:
        data = await request.json()
        employee_id = data.get("employee_id")
        leave_type = data.get("leave_type")  # casual_leave, sick_leave, earned_leave
        start_date = data.get("start_date")
        end_date = data.get("end_date", start_date)
        reason = data.get("reason", "")

        if leave_type not in LEAVE_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid leave type. Use: {list(LEAVE_TYPES.keys())}")

        emp = await db.employees.find_one({"employee_id": employee_id, "status": "active"})
        if not emp:
            raise HTTPException(status_code=404, detail="Active employee not found")

        # Calculate days
        from datetime import date as date_type
        start = datetime.fromisoformat(start_date).date() if isinstance(start_date, str) else start_date
        end = datetime.fromisoformat(end_date).date() if isinstance(end_date, str) else end_date
        days = (end - start).days + 1
        if days <= 0:
            raise HTTPException(status_code=400, detail="Invalid date range")

        # Check leave balance
        balance = emp.get("leave_balance", {})
        used_key = f"used_{leave_type.replace('_leave', '')}"
        annual = LEAVE_TYPES[leave_type]["annual"]
        used = balance.get(used_key, 0)
        remaining = annual - used

        if days > remaining:
            raise HTTPException(status_code=400, detail=f"Insufficient {LEAVE_TYPES[leave_type]['label']} balance. Remaining: {remaining} days")

        now = datetime.now(timezone.utc).isoformat()
        leave_id = f"LV-{employee_id}-{now[:10].replace('-', '')}-{str(uuid.uuid4())[:4]}"

        leave_record = {
            "leave_id": leave_id,
            "employee_id": employee_id,
            "user_id": emp.get("user_id"),
            "employee_name": emp.get("name"),
            "leave_type": leave_type,
            "leave_label": LEAVE_TYPES[leave_type]["label"],
            "start_date": start_date,
            "end_date": end_date,
            "days": days,
            "reason": reason,
            "status": "approved",  # Auto-approved by admin
            "approved_by": data.get("admin_id", "admin"),
            "created_at": now
        }

        await db.employee_leaves.insert_one(leave_record)

        # Update leave balance
        await db.employees.update_one(
            {"employee_id": employee_id},
            {"$inc": {f"leave_balance.{used_key}": days}}
        )

        # Auto-mark attendance as "leave" for those dates
        current = start
        while current <= end:
            date_str = current.isoformat()
            await db.employee_attendance.update_one(
                {"employee_id": employee_id, "date": date_str},
                {"$set": {
                    "employee_id": employee_id,
                    "user_id": emp.get("user_id"),
                    "name": emp.get("name"),
                    "date": date_str,
                    "status": "leave",
                    "note": f"{LEAVE_TYPES[leave_type]['label']}: {reason}",
                    "marked_by": "leave_system",
                    "marked_at": now
                }},
                upsert=True
            )
            current += timedelta(days=1)

        leave_record.pop("_id", None)
        return {"success": True, "message": f"{days} day(s) {LEAVE_TYPES[leave_type]['label']} approved", "leave": leave_record}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[LEAVE] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/leave/{employee_id}")
async def get_employee_leaves(employee_id: str, year: Optional[int] = None):
    """Get leave history for an employee."""
    try:
        y = year or datetime.now(timezone.utc).year
        start = f"{y}-01-01"
        end = f"{y}-12-31"

        leaves = await db.employee_leaves.find(
            {"employee_id": employee_id, "start_date": {"$gte": start, "$lte": end}},
            {"_id": 0}
        ).sort("start_date", -1).to_list(100)

        emp = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0, "leave_balance": 1})
        balance = emp.get("leave_balance", {}) if emp else {}

        return {
            "leaves": leaves,
            "balance": {
                "casual_leave": {"annual": 12, "used": balance.get("used_casual", 0), "remaining": 12 - balance.get("used_casual", 0)},
                "sick_leave": {"annual": 12, "used": balance.get("used_sick", 0), "remaining": 12 - balance.get("used_sick", 0)},
                "earned_leave": {"annual": 15, "used": balance.get("used_earned", 0), "remaining": 15 - balance.get("used_earned", 0)}
            },
            "year": y
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/detail/{employee_id}")
async def get_employee_detail(employee_id: str):
    try:
        emp = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        # Get attendance stats for current month
        now = datetime.now(timezone.utc)
        month_start = f"{now.year}-{now.month:02d}-01"
        attendance = await db.employee_attendance.find(
            {"employee_id": employee_id, "date": {"$gte": month_start}},
            {"_id": 0}
        ).to_list(31)

        present = sum(1 for a in attendance if a.get("status") == "present")
        absent = sum(1 for a in attendance if a.get("status") == "absent")
        half_day = sum(1 for a in attendance if a.get("status") == "half_day")
        leave = sum(1 for a in attendance if a.get("status") == "leave")

        # Get salary slips
        slips = await db.employee_salary_slips.find(
            {"employee_id": employee_id},
            {"_id": 0}
        ).sort("generated_at", -1).limit(12).to_list(12)

        return {
            "employee": emp,
            "attendance": {
                "current_month": attendance,
                "summary": {"present": present, "absent": absent, "half_day": half_day, "leave": leave}
            },
            "salary_slips": slips
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== PHOTO UPLOAD ====================

@router.post("/upload-photo/{employee_id}")
async def upload_employee_photo(employee_id: str, file: UploadFile = File(...)):
    try:
        emp = await db.employees.find_one({"employee_id": employee_id})
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        contents = await file.read()
        if len(contents) > 2 * 1024 * 1024:  # 2MB limit
            raise HTTPException(status_code=400, detail="Photo must be under 2MB")

        # Save to disk
        upload_dir = "/app/backend/uploads/employee_photos"
        os.makedirs(upload_dir, exist_ok=True)
        ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        filename = f"{employee_id}.{ext}"
        filepath = os.path.join(upload_dir, filename)

        with open(filepath, "wb") as f:
            f.write(contents)

        photo_url = f"/api/employees/photo/{employee_id}"
        await db.employees.update_one(
            {"employee_id": employee_id},
            {"$set": {"photo_url": photo_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

        return {"success": True, "photo_url": photo_url}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/photo/{employee_id}")
async def get_employee_photo(employee_id: str):
    from fastapi.responses import FileResponse
    upload_dir = "/app/backend/uploads/employee_photos"
    for ext in ["jpg", "jpeg", "png", "webp"]:
        filepath = os.path.join(upload_dir, f"{employee_id}.{ext}")
        if os.path.exists(filepath):
            return FileResponse(filepath)
    raise HTTPException(status_code=404, detail="Photo not found")


# ==================== ATTENDANCE ====================

@router.post("/attendance/mark")
async def mark_attendance(data: MarkAttendanceRequest):
    try:
        emp = await db.employees.find_one({"employee_id": data.employee_id, "status": "active"})
        if not emp:
            raise HTTPException(status_code=404, detail="Active employee not found")

        if data.status not in ["present", "absent", "half_day", "leave", "holiday"]:
            raise HTTPException(status_code=400, detail="Invalid status")

        await db.employee_attendance.update_one(
            {"employee_id": data.employee_id, "date": data.date},
            {"$set": {
                "employee_id": data.employee_id,
                "user_id": emp.get("user_id"),
                "name": emp.get("name"),
                "date": data.date,
                "status": data.status,
                "note": data.note or "",
                "marked_by": data.admin_id,
                "marked_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        return {"success": True, "message": f"Attendance marked: {data.status}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/attendance/bulk")
async def bulk_mark_attendance(data: BulkAttendanceRequest):
    try:
        count = 0
        for entry in data.attendance:
            emp_id = entry.get("employee_id")
            status = entry.get("status", "present")
            emp = await db.employees.find_one({"employee_id": emp_id, "status": "active"})
            if emp:
                await db.employee_attendance.update_one(
                    {"employee_id": emp_id, "date": data.date},
                    {"$set": {
                        "employee_id": emp_id,
                        "user_id": emp.get("user_id"),
                        "name": emp.get("name"),
                        "date": data.date,
                        "status": status,
                        "marked_by": data.admin_id,
                        "marked_at": datetime.now(timezone.utc).isoformat()
                    }},
                    upsert=True
                )
                count += 1
        return {"success": True, "message": f"Attendance marked for {count} employees"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/attendance/{employee_id}")
async def get_attendance(employee_id: str, month: Optional[int] = None, year: Optional[int] = None):
    try:
        now = datetime.now(timezone.utc)
        m = month or now.month
        y = year or now.year
        start = f"{y}-{m:02d}-01"
        days_in_month = calendar.monthrange(y, m)[1]
        end = f"{y}-{m:02d}-{days_in_month}"

        records = await db.employee_attendance.find(
            {"employee_id": employee_id, "date": {"$gte": start, "$lte": end}},
            {"_id": 0}
        ).sort("date", 1).to_list(31)

        present = sum(1 for r in records if r.get("status") == "present")
        absent = sum(1 for r in records if r.get("status") == "absent")
        half_day = sum(1 for r in records if r.get("status") == "half_day")
        leave = sum(1 for r in records if r.get("status") == "leave")
        holiday = sum(1 for r in records if r.get("status") == "holiday")

        return {
            "employee_id": employee_id,
            "month": m,
            "year": y,
            "records": records,
            "summary": {
                "total_days": days_in_month,
                "present": present,
                "absent": absent,
                "half_day": half_day,
                "leave": leave,
                "holiday": holiday,
                "working_days": present + half_day
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== SALARY SLIP ====================

@router.post("/salary-slip/generate")
async def generate_salary_slip(data: GenerateSalarySlipRequest):
    try:
        emp = await db.employees.find_one({"employee_id": data.employee_id}, {"_id": 0})
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        # Get attendance for the month
        days_in_month = calendar.monthrange(data.year, data.month)[1]
        start = f"{data.year}-{data.month:02d}-01"
        end = f"{data.year}-{data.month:02d}-{days_in_month}"

        attendance = await db.employee_attendance.find(
            {"employee_id": data.employee_id, "date": {"$gte": start, "$lte": end}},
            {"_id": 0}
        ).to_list(31)

        present = sum(1 for a in attendance if a.get("status") == "present")
        half_day = sum(1 for a in attendance if a.get("status") == "half_day")
        holiday = sum(1 for a in attendance if a.get("status") == "holiday")
        leave = sum(1 for a in attendance if a.get("status") == "leave")
        absent = sum(1 for a in attendance if a.get("status") == "absent")

        # Effective working days (Sundays excluded = ~22 working days)
        total_working_days = 26  # Standard Indian working days
        effective_days = present + (half_day * 0.5) + holiday + leave
        attendance_ratio = min(1, effective_days / total_working_days) if total_working_days > 0 else 1

        monthly_salary = emp.get("monthly_salary", 0)
        breakdown = calculate_salary_breakdown(monthly_salary)

        # Adjust for attendance (pro-rata)
        adjusted_earnings = {}
        for key, val in breakdown["earnings"].items():
            if key != "total_earnings":
                adjusted_earnings[key] = round(val * attendance_ratio, 2)
        adjusted_earnings["total_earnings"] = round(sum(v for k, v in adjusted_earnings.items()), 2)

        # Loss of pay deduction
        loss_of_pay = round(monthly_salary - (monthly_salary * attendance_ratio), 2) if attendance_ratio < 1 else 0

        # Deductions (on adjusted salary)
        adjusted_basic = adjusted_earnings.get("basic_salary", 0)
        adjusted_gross = adjusted_earnings["total_earnings"]

        pf_basic = min(adjusted_basic, 15000)
        pf_employee = round(pf_basic * 0.12, 2)
        esi_employee = round(adjusted_gross * 0.0075, 2) if adjusted_gross <= 21000 else 0
        professional_tax = 200 if adjusted_gross > 10000 else 0

        annual = adjusted_gross * 12
        if annual <= 300000:
            tds = 0
        elif annual <= 600000:
            tds = round((annual - 300000) * 0.05 / 12, 2)
        elif annual <= 900000:
            tds = round(((annual - 600000) * 0.10 + 300000 * 0.05) / 12, 2)
        else:
            tds = round(((annual - 900000) * 0.15 + 300000 * 0.10 + 300000 * 0.05) / 12, 2)

        total_deductions = round(pf_employee + esi_employee + professional_tax + tds + loss_of_pay, 2)
        net_salary = round(adjusted_gross - total_deductions, 2)

        month_name = calendar.month_name[data.month]
        slip_id = f"SLIP-{data.employee_id}-{data.year}{data.month:02d}"

        salary_slip = {
            "slip_id": slip_id,
            "employee_id": data.employee_id,
            "employee_name": emp.get("name", ""),
            "designation": emp.get("designation", ""),
            "department": emp.get("department", ""),
            "joining_date": emp.get("joining_date", ""),
            "month": data.month,
            "month_name": month_name,
            "year": data.year,
            "period": f"{month_name} {data.year}",
            "company": {
                "name": COMPANY_NAME,
                "address": COMPANY_ADDRESS,
                "website": COMPANY_WEBSITE
            },
            "attendance": {
                "total_working_days": total_working_days,
                "present": present,
                "half_day": half_day,
                "absent": absent,
                "leave": leave,
                "holiday": holiday,
                "effective_days": effective_days,
                "attendance_ratio": round(attendance_ratio, 4)
            },
            "gross_salary": monthly_salary,
            "earnings": adjusted_earnings,
            "deductions": {
                "pf_employee": pf_employee,
                "esi_employee": esi_employee,
                "professional_tax": professional_tax,
                "tds": tds,
                "loss_of_pay": loss_of_pay,
                "total_deductions": total_deductions
            },
            "employer_contributions": {
                "pf_employer": round(min(adjusted_basic, 15000) * 0.12, 2),
                "esi_employer": round(adjusted_gross * 0.0325, 2) if adjusted_gross <= 21000 else 0,
                "gratuity": round(adjusted_basic * 15 / 26 / 12, 2)
            },
            "net_salary": net_salary,
            "net_salary_words": number_to_words_inr(net_salary),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "generated_by": data.admin_id
        }

        # Upsert slip
        await db.employee_salary_slips.update_one(
            {"slip_id": slip_id},
            {"$set": salary_slip},
            upsert=True
        )

        return {"success": True, "salary_slip": salary_slip}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[SALARY SLIP] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/salary-slips/{employee_id}")
async def get_salary_slips(employee_id: str):
    try:
        slips = await db.employee_salary_slips.find(
            {"employee_id": employee_id},
            {"_id": 0}
        ).sort("generated_at", -1).to_list(24)
        return {"slips": slips}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ID CARD DATA ====================

@router.get("/id-card/{employee_id}")
async def get_id_card_data(employee_id: str):
    try:
        emp = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        return {
            "id_card": {
                "company_name": COMPANY_NAME,
                "company_address": COMPANY_ADDRESS,
                "company_website": COMPANY_WEBSITE,
                "employee_id": emp["employee_id"],
                "name": emp.get("name", ""),
                "father_name": emp.get("father_name", ""),
                "date_of_birth": emp.get("date_of_birth", ""),
                "gender": emp.get("gender", ""),
                "blood_group": emp.get("blood_group", ""),
                "designation": emp.get("designation", ""),
                "department": emp.get("department", ""),
                "joining_date": emp.get("joining_date", ""),
                "mobile": emp.get("mobile", ""),
                "email": emp.get("email", ""),
                "photo_url": emp.get("photo_url"),
                "status": emp.get("status", "active"),
                "emergency_contact": emp.get("emergency_contact", {})
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== POOL WALLET ADMIN ENDPOINTS ====================

@router.get("/pool/balance")
async def get_pool_balance():
    try:
        settings = await get_employee_pool_settings()
        active_count = await db.employees.count_documents({"status": "active"})
        total_salary = 0
        async for emp in db.employees.find({"status": "active"}, {"monthly_salary": 1}):
            total_salary += emp.get("monthly_salary", 0)

        return {
            "pool_balance": round(settings.get("pool_balance", 0), 4),
            "pool_rate": settings.get("pool_rate", DEFAULT_EMPLOYEE_POOL_RATE),
            "prc_to_inr_rate": settings.get("prc_to_inr_rate", 0.10),
            "enabled": settings.get("enabled", True),
            "active_employees": active_count,
            "total_monthly_salary": total_salary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pool/settings")
async def update_pool_settings(request: Request):
    try:
        data = await request.json()
        update = {}
        if "pool_rate" in data:
            update["pool_rate"] = float(data["pool_rate"])
        if "prc_to_inr_rate" in data:
            update["prc_to_inr_rate"] = float(data["prc_to_inr_rate"])
        if "enabled" in data:
            update["enabled"] = bool(data["enabled"])

        if update:
            await db.employee_pool_settings.update_one({}, {"$set": update}, upsert=True)

        return {"success": True, "message": "Settings updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pool/distribute")
async def manual_distribute():
    try:
        await distribute_employee_pool()
        return {"success": True, "message": "Distribution completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pool/post-salary")
async def post_salary(request: Request):
    """Admin posts salary - distributes remaining pool and resets monthly earned."""
    try:
        data = await request.json()
        admin_id = data.get("admin_id", "admin")

        # First distribute remaining pool
        await distribute_employee_pool()

        # Reset earned_this_month for all active employees
        now = datetime.now(timezone.utc)
        result = await db.employees.update_many(
            {"status": "active"},
            {"$set": {"earned_this_month": 0}}
        )

        # Log the salary posting
        await db.employee_pool_transactions.insert_one({
            "txn_id": f"EPS-{now.strftime('%Y%m%d%H%M%S')}",
            "type": "salary_posted",
            "description": f"Monthly salary posted by admin. {result.modified_count} employees reset.",
            "admin_id": admin_id,
            "timestamp": now.isoformat()
        })

        return {"success": True, "message": f"Salary posted. {result.modified_count} employees reset."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pool/transactions")
async def get_pool_transactions(limit: int = 50):
    try:
        txns = await db.employee_pool_transactions.find(
            {}, {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
        return {"transactions": txns}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== SEARCH USER FOR ADDING ====================

@router.get("/search-user")
async def search_user_for_employee(q: str):
    try:
        if not q or len(q) < 2:
            return {"users": []}

        query = {
            "$or": [
                {"name": {"$regex": q, "$options": "i"}},
                {"mobile": {"$regex": q}},
                {"email": {"$regex": q, "$options": "i"}}
            ]
        }
        users = await db.users.find(query, {"_id": 0, "uid": 1, "name": 1, "mobile": 1, "email": 1}).limit(10).to_list(10)

        # Check which are already employees
        for u in users:
            existing = await db.employees.find_one({"user_id": u["uid"], "status": "active"})
            u["is_employee"] = bool(existing)

        return {"users": users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
