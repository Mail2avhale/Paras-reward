"""
PRC FIELD STANDARDIZATION

Problem:
- Old documents use: prc_used
- New documents use: total_prc_deducted
- Some documents use: prc_amount, total_prc

Standard field: total_prc_deducted

This module provides a helper function to safely get PRC amount from any document.
"""

def get_prc_amount(doc: dict) -> float:
    """
    Safely get PRC amount from a document, checking all possible field names.
    
    Priority order:
    1. total_prc_deducted (new standard)
    2. prc_used (legacy)
    3. prc_amount
    4. total_prc
    5. prc_deducted
    6. amount * 100 (if amount is INR)
    
    Args:
        doc: Document from any redemption collection
        
    Returns:
        PRC amount as float, or 0 if not found
    """
    if not doc:
        return 0.0
    
    # Try each field in priority order
    for field in ["total_prc_deducted", "prc_used", "prc_amount", "total_prc", "prc_deducted"]:
        value = doc.get(field)
        if value is not None and value != 0:
            try:
                return float(value)
            except (ValueError, TypeError):
                continue
    
    # Fallback: calculate from INR amount (100 PRC = ₹1)
    amount_inr = doc.get("amount_inr") or doc.get("amount")
    if amount_inr:
        try:
            return float(amount_inr) * 100
        except (ValueError, TypeError):
            pass
    
    return 0.0


# MongoDB aggregation expression for getting PRC from any field
PRC_AGGREGATION_FIELD = {
    "$ifNull": [
        "$total_prc_deducted",
        {"$ifNull": [
            "$prc_used",
            {"$ifNull": [
                "$prc_amount",
                {"$ifNull": [
                    "$total_prc",
                    {"$ifNull": [
                        "$prc_deducted",
                        {"$multiply": [{"$ifNull": ["$amount_inr", "$amount"]}, 100]}
                    ]}
                ]}
            ]}
        ]}
    ]
}
