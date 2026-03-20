"""
PRC Field Standardization Helpers
=================================

STANDARD FIELD: total_prc_deducted

Problem:
- Old documents use: prc_used
- New documents use: total_prc_deducted
- Some documents use: prc_amount, total_prc, prc_deducted

This module provides helper functions to:
1. Read PRC values from documents (handles all legacy field names)
2. Write PRC values (always uses standard field)
3. Build MongoDB queries/aggregations for PRC fields

USAGE:
    from utils.prc_fields import get_prc_amount, STANDARD_PRC_FIELD, PRC_AGGREGATION_FIELD
    
    # Reading (handles legacy fields)
    prc = get_prc_amount(document)
    
    # Writing (always use standard)
    new_doc = {STANDARD_PRC_FIELD: total_prc_required}

Created: March 2026
"""

# Standard field name - USE THIS when writing new data
STANDARD_PRC_FIELD = "total_prc_deducted"

# Legacy fields in priority order
LEGACY_PRC_FIELDS = [
    "total_prc_deducted",  # Standard (check first)
    "prc_used",            # Legacy bill_payment_requests
    "prc_deducted",        # Legacy bank transfers, chatbot DMT
    "prc_amount",          # Generic legacy field
    "amount_prc",          # Used in transactions collection
    "total_prc",           # Orders
    "prc_required",        # Some redeem requests
    "amount",              # DMT transactions - raw amount field
]


def get_prc_amount(doc: dict) -> float:
    """
    Safely get PRC amount from a document, checking all possible field names.
    
    Priority order:
    1. total_prc_deducted (new standard)
    2. prc_used (legacy)
    3. prc_deducted
    4. prc_amount
    5. amount_prc (transactions collection)
    6. total_prc
    7. prc_required
    8. amount (DMT transactions)
    
    Args:
        doc: Document from any redemption collection
        
    Returns:
        PRC amount as float, or 0 if not found
    """
    if not doc:
        return 0.0
    
    # Try each field in priority order
    for field in LEGACY_PRC_FIELDS:
        value = doc.get(field)
        if value is not None and value != 0:
            try:
                return float(value)
            except (ValueError, TypeError):
                continue
    
    return 0.0


def get_prc_with_source(doc: dict) -> tuple:
    """
    Get the PRC amount and which field it came from.
    Useful for debugging and migration tracking.
    
    Args:
        doc: The document to read from
    
    Returns:
        tuple: (prc_value: float, source_field: str or None)
    """
    if not doc:
        return (0.0, None)
    
    for field in LEGACY_PRC_FIELDS:
        value = doc.get(field)
        if value is not None and value != 0:
            try:
                return (float(value), field)
            except (ValueError, TypeError):
                continue
    
    return (0.0, None)


# MongoDB aggregation expression for getting PRC from any field
# Use this in $group stages: {"$group": {"_id": None, "total": {"$sum": PRC_AGGREGATION_FIELD}}}
PRC_AGGREGATION_FIELD = {
    "$ifNull": [
        "$total_prc_deducted",
        {"$ifNull": [
            "$prc_used",
            {"$ifNull": [
                "$prc_deducted",
                {"$ifNull": [
                    "$prc_amount",
                    {"$ifNull": [
                        "$amount_prc",
                        {"$ifNull": [
                            "$total_prc",
                            {"$ifNull": [
                                "$prc_required",
                                {"$ifNull": ["$amount", 0]}
                            ]}
                        ]}
                    ]}
                ]}
            ]}
        ]}
    ]
}


def build_prc_projection() -> dict:
    """
    Build a MongoDB projection to get PRC from any field.
    
    Usage:
        cursor = collection.find({}, {
            "request_id": 1,
            "status": 1,
            **build_prc_projection()
        })
    
    Returns:
        dict: Projection with computed 'prc' field
    """
    return {
        "prc": {
            "$ifNull": [
                "$total_prc_deducted",
                {"$ifNull": [
                    "$prc_used",
                    {"$ifNull": [
                        "$prc_deducted",
                        {"$ifNull": [
                            "$prc_amount",
                            {"$ifNull": ["$total_prc", 0]}
                        ]}
                    ]}
                ]}
            ]
        }
    }


# Collection-specific field mappings (for documentation)
COLLECTION_PRC_MAPPINGS = {
    "bill_payment_requests": ["prc_used", "total_prc_deducted", "prc_amount"],
    "bank_withdrawal_requests": ["total_prc_deducted", "prc_deducted", "prc_amount", "prc_used"],
    "bank_transfer_requests": ["prc_deducted", "total_prc_deducted", "prc_amount"],
    "dmt_transactions": ["total_prc_deducted", "prc_deducted", "prc_amount"],
    "redeem_requests": ["total_prc_deducted", "prc_amount", "prc_required"],
    "gift_voucher_orders": ["total_prc_deducted", "prc_used", "prc_amount"],
    "orders": ["total_prc", "total_prc_deducted", "prc_amount"],
    "subscription_payments": ["prc_amount", "total_prc_deducted"],
    "chatbot_dmt_requests": ["prc_deducted", "total_prc_deducted"],
}
