"""
Holiday Calendar Routes
- Manages holidays (Government, Local, Weekly offs)
- Blocks redeem/bill pay on holidays
- Provides calendar data to frontend
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone, timedelta, date
from typing import Optional
import logging

router = APIRouter(prefix="/holidays", tags=["Holidays"])

db = None
cache = None

def set_db(database):
    global db
    db = database

def set_cache(cache_manager):
    global cache
    cache = cache_manager


# Standard India Government Holidays 2026 (Verified from ClearTax/Govt sources)
INDIA_HOLIDAYS_2026 = [
    {"date": "2026-01-26", "name": "Republic Day", "type": "government"},
    {"date": "2026-03-04", "name": "Holi", "type": "government"},
    {"date": "2026-03-10", "name": "Maha Shivaratri", "type": "government"},
    {"date": "2026-03-21", "name": "Id-ul-Fitr (Eid)", "type": "government"},
    {"date": "2026-03-26", "name": "Ram Navami", "type": "government"},
    {"date": "2026-03-31", "name": "Mahavir Jayanti", "type": "government"},
    {"date": "2026-04-02", "name": "Hanuman Jayanti", "type": "government"},
    {"date": "2026-04-03", "name": "Good Friday", "type": "government"},
    {"date": "2026-04-14", "name": "Dr. Ambedkar Jayanti", "type": "government"},
    {"date": "2026-05-01", "name": "Buddha Purnima / May Day", "type": "government"},
    {"date": "2026-05-27", "name": "Eid-ul-Adha (Bakrid)", "type": "government"},
    {"date": "2026-06-26", "name": "Muharram", "type": "government"},
    {"date": "2026-08-15", "name": "Independence Day", "type": "government"},
    {"date": "2026-08-26", "name": "Milad-un-Nabi", "type": "government"},
    {"date": "2026-09-04", "name": "Janmashtami", "type": "government"},
    {"date": "2026-10-02", "name": "Gandhi Jayanti", "type": "government"},
    {"date": "2026-10-20", "name": "Dussehra", "type": "government"},
    {"date": "2026-11-08", "name": "Diwali", "type": "government"},
    {"date": "2026-11-09", "name": "Diwali (Day 2)", "type": "government"},
    {"date": "2026-11-24", "name": "Guru Nanak Jayanti", "type": "government"},
    {"date": "2026-12-25", "name": "Christmas", "type": "government"},
]


async def seed_holidays():
    """Seed default holidays - upsert to ensure correct dates"""
    try:
        # Check settings
        settings = await db.holiday_settings.find_one({"_id": "config"})
        if not settings:
            await db.holiday_settings.update_one(
                {"_id": "config"},
                {"$set": {
                    "weekly_off_saturday": True,
                    "weekly_off_sunday": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True
            )
        
        # Remove old wrong government holidays and upsert correct ones
        correct_dates = {h["date"] for h in INDIA_HOLIDAYS_2026}
        await db.holidays.delete_many({"type": "government", "date": {"$regex": "^2026-"}, "date": {"$nin": list(correct_dates)}})
        for h in INDIA_HOLIDAYS_2026:
            await db.holidays.update_one(
                {"date": h["date"], "type": "government"},
                {"$set": {
                    **h,
                    "active": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True
            )
        logging.info(f"[HOLIDAYS] Seeded {len(INDIA_HOLIDAYS_2026)} government holidays for 2026")
    except Exception as e:
        logging.error(f"[HOLIDAYS] Seed error: {e}")


async def is_holiday(check_date: str = None) -> dict:
    """
    Check if a given date is a holiday.
    Returns: {"is_holiday": bool, "reason": str, "holiday_name": str}
    """
    try:
        if check_date:
            d = datetime.strptime(check_date, "%Y-%m-%d").date()
        else:
            # Use IST (UTC+5:30) for India
            d = (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).date()
        
        date_str = d.isoformat()
        
        # Check settings
        settings = await db.holiday_settings.find_one({"_id": "config"})
        if not settings:
            settings = {"weekly_off_saturday": True, "weekly_off_sunday": True}
        
        # Check weekly off
        weekday = d.weekday()  # 0=Mon, 5=Sat, 6=Sun
        if weekday == 5 and settings.get("weekly_off_saturday", True):
            return {"is_holiday": True, "reason": "weekly_off", "holiday_name": "Saturday - Weekly Off"}
        if weekday == 6 and settings.get("weekly_off_sunday", True):
            return {"is_holiday": True, "reason": "weekly_off", "holiday_name": "Sunday - Weekly Off"}
        
        # Check declared holidays
        holiday = await db.holidays.find_one({"date": date_str, "active": True})
        if holiday:
            return {"is_holiday": True, "reason": holiday.get("type", "government"), "holiday_name": holiday.get("name", "Holiday")}
        
        return {"is_holiday": False, "reason": None, "holiday_name": None}
    except Exception as e:
        logging.error(f"[HOLIDAYS] Check error: {e}")
        return {"is_holiday": False, "reason": None, "holiday_name": None}


# ========== PUBLIC ENDPOINTS ==========

@router.get("/today")
async def check_today_holiday():
    """Check if today is a holiday"""
    result = await is_holiday()
    return result


@router.get("/calendar/{year}/{month}")
async def get_calendar(year: int, month: int):
    """Get holiday calendar for a specific month"""
    try:
        settings = await db.holiday_settings.find_one({"_id": "config"})
        if not settings:
            settings = {"weekly_off_saturday": True, "weekly_off_sunday": True}
        
        # Get all holidays for the month
        month_str = f"{year}-{month:02d}"
        holidays = await db.holidays.find(
            {"date": {"$regex": f"^{month_str}"}, "active": True},
            {"_id": 0}
        ).to_list(50)
        
        # Build calendar with weekly offs
        import calendar
        cal = calendar.Calendar()
        month_days = []
        
        for d in cal.itermonthdays2(year, month):
            day_num, weekday = d
            if day_num == 0:
                continue
            
            date_str = f"{year}-{month:02d}-{day_num:02d}"
            day_info = {"date": date_str, "day": day_num, "weekday": weekday, "is_holiday": False, "holiday_name": None, "type": None}
            
            # Check weekly off
            if weekday == 5 and settings.get("weekly_off_saturday", True):
                day_info["is_holiday"] = True
                day_info["holiday_name"] = "Saturday"
                day_info["type"] = "weekly_off"
            elif weekday == 6 and settings.get("weekly_off_sunday", True):
                day_info["is_holiday"] = True
                day_info["holiday_name"] = "Sunday"
                day_info["type"] = "weekly_off"
            
            # Check declared holidays (overrides weekly)
            for h in holidays:
                if h["date"] == date_str:
                    day_info["is_holiday"] = True
                    day_info["holiday_name"] = h["name"]
                    day_info["type"] = h.get("type", "government")
                    break
            
            month_days.append(day_info)
        
        # Count holidays this month
        total_holidays = sum(1 for d in month_days if d["is_holiday"])
        working_days = len(month_days) - total_holidays
        
        return {
            "year": year,
            "month": month,
            "days": month_days,
            "total_holidays": total_holidays,
            "working_days": working_days,
            "settings": {
                "weekly_off_saturday": settings.get("weekly_off_saturday", True),
                "weekly_off_sunday": settings.get("weekly_off_sunday", True),
            }
        }
    except Exception as e:
        logging.error(f"[HOLIDAYS] Calendar error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== ADMIN ENDPOINTS ==========

@router.get("/admin/settings")
async def get_holiday_settings():
    """Get holiday settings"""
    settings = await db.holiday_settings.find_one({"_id": "config"})
    if not settings:
        settings = {"weekly_off_saturday": True, "weekly_off_sunday": True}
    settings.pop("_id", None)
    return settings


@router.put("/admin/settings")
async def update_holiday_settings(data: dict):
    """Update holiday settings (weekly off toggles)"""
    update = {}
    if "weekly_off_saturday" in data:
        update["weekly_off_saturday"] = bool(data["weekly_off_saturday"])
    if "weekly_off_sunday" in data:
        update["weekly_off_sunday"] = bool(data["weekly_off_sunday"])
    
    if update:
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.holiday_settings.update_one({"_id": "config"}, {"$set": update}, upsert=True)
    
    return {"success": True, "message": "Settings updated"}


@router.get("/admin/list")
async def list_holidays(year: int = 2026):
    """List all declared holidays for a year"""
    holidays = await db.holidays.find(
        {"date": {"$regex": f"^{year}-"}},
        {"_id": 0}
    ).sort("date", 1).to_list(100)
    return {"holidays": holidays, "total": len(holidays)}


@router.post("/admin/add")
async def add_holiday(data: dict):
    """Add a new holiday"""
    date_str = data.get("date")
    name = data.get("name")
    holiday_type = data.get("type", "local")  # government or local
    
    if not date_str or not name:
        raise HTTPException(status_code=400, detail="Date and name are required")
    
    # Validate date format
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Check duplicate
    existing = await db.holidays.find_one({"date": date_str, "name": name})
    if existing:
        raise HTTPException(status_code=400, detail="Holiday already exists for this date")
    
    holiday = {
        "date": date_str,
        "name": name,
        "type": holiday_type,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.holidays.insert_one(holiday)
    
    return {"success": True, "message": f"Holiday '{name}' added on {date_str}"}


@router.delete("/admin/remove")
async def remove_holiday(date: str, name: str):
    """Remove a holiday"""
    result = await db.holidays.delete_one({"date": date, "name": name})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
    return {"success": True, "message": f"Holiday removed"}


@router.put("/admin/toggle")
async def toggle_holiday(data: dict):
    """Toggle a holiday active/inactive"""
    date_str = data.get("date")
    name = data.get("name")
    active = data.get("active", True)
    
    result = await db.holidays.update_one(
        {"date": date_str, "name": name},
        {"$set": {"active": active}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    return {"success": True, "message": f"Holiday {'activated' if active else 'deactivated'}"}
