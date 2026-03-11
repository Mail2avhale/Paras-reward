"""
BBPS Operator Mapping - Based on Eko Developer Documentation
Generated from live API audit on March 2026

This file contains:
1. Category IDs for all BBPS services
2. Popular operator IDs with parameter requirements
3. Account number formats and validation rules
"""

# ==================== CATEGORY IDs ====================
# These are Eko's category IDs for different BBPS services

BBPS_CATEGORIES = {
    # Telecom
    "mobile_prepaid": 5,
    "mobile_postpaid": 10,
    "landline": 9,
    "broadband": 1,
    
    # DTH
    "dth": 4,
    
    # Utilities
    "electricity": 8,
    "water": 11,
    "gas": 14,        # Piped Natural Gas (PNG)
    "lpg": 23,        # LPG Cylinder
    
    # Financial
    "emi": 21,
    "loan": 21,
    "loan_emi": 21,
    "credit_card": 7,
    "insurance": 20,
    
    # Transport & Others
    "fastag": 22,
    "housing_society": 12,
    "municipal_tax": 12,
    "education": 13,
    "hospital": 24
}

# ==================== POPULAR OPERATORS ====================
# Format: operator_id, name, parameters required, account format

MOBILE_PREPAID_OPERATORS = {
    1: {"name": "Airtel Prepaid", "params": ["utility_acc_no"], "format": "10 digit mobile"},
    5: {"name": "BSNL Prepaid", "params": ["utility_acc_no"], "format": "10 digit mobile"},
    90: {"name": "Jio Prepaid", "params": ["utility_acc_no"], "format": "10 digit mobile"},
    91: {"name": "MTNL Delhi Prepaid", "params": ["utility_acc_no"], "format": "10 digit mobile"},
    508: {"name": "MTNL Mumbai Prepaid", "params": ["utility_acc_no"], "format": "10 digit mobile"},
}

MOBILE_POSTPAID_OPERATORS = {
    41: {"name": "Airtel Postpaid", "params": ["utility_acc_no"], "format": "^[6-9]{1}[0-9]{9}$", "fetch_required": True},
    89: {"name": "BSNL Mobile Postpaid", "params": ["utility_acc_no"], "format": "10 digit mobile", "fetch_required": True},
    172: {"name": "Jio Postpaid", "params": ["utility_acc_no"], "format": "10 digit mobile", "fetch_required": True},
    615: {"name": "Vi Postpaid", "params": ["utility_acc_no"], "format": "10 digit mobile", "fetch_required": True},
}

DTH_OPERATORS = {
    21: {"name": "Airtel DTH", "params": ["utility_acc_no"], "format": "Subscriber ID"},
    17: {"name": "BIG TV DTH", "params": ["utility_acc_no"], "format": "Subscriber ID"},
    16: {"name": "Dish TV", "params": ["utility_acc_no"], "format": "Subscriber ID"},
    20: {"name": "Tata Sky", "params": ["utility_acc_no"], "format": "Subscriber ID"},
    95: {"name": "Videocon D2H", "params": ["utility_acc_no"], "format": "Subscriber ID"},
}

ELECTRICITY_OPERATORS = {
    62: {
        "name": "MSEDCL-Maharashtra State Electricity Distribution Co Limited",
        "params": ["utility_acc_no", "cycle_number"],
        "format": {
            "utility_acc_no": "^[0-9]{12}$ (12 digit Consumer No, eg. 000437378053)",
            "cycle_number": "^[0-9]{4}$ (4 digit BU number, eg. 3667)"
        },
        "fetch_required": True
    },
    22: {"name": "BSES Rajdhani", "params": ["utility_acc_no"], "format": "CA Number", "fetch_required": True},
    23: {"name": "BSES Yamuna", "params": ["utility_acc_no"], "format": "CA Number", "fetch_required": True},
    56: {"name": "Bangalore Electricity (BESCOM)", "params": ["utility_acc_no"], "format": "Account ID", "fetch_required": True},
    53: {"name": "BEST Mumbai", "params": ["utility_acc_no"], "format": "Consumer No", "fetch_required": True},
    242: {"name": "Adani Electricity Mumbai Limited", "params": ["utility_acc_no"], "format": "Consumer No", "fetch_required": True},
}

WATER_OPERATORS = {
    161: {
        "name": "Bangalore Water Supply and Sewerage Board (BWSSB)",
        "params": ["utility_acc_no"],
        "format": "^[0-9A-Za-z\\-]{8}$ (8 chars, eg: GB-31254)",
        "fetch_required": True
    },
    130: {"name": "Delhi Jal Board", "params": ["utility_acc_no"], "format": "K Number", "fetch_required": True},
    167: {"name": "Hyderabad Metropolitan Water Supply", "params": ["utility_acc_no"], "format": "CAN", "fetch_required": True},
    117: {"name": "Pune Municipal Corporation - Water", "params": ["utility_acc_no"], "format": "Property No", "fetch_required": True},
}

EMI_LOAN_OPERATORS = {
    269: {
        "name": "IDFC FIRST Bank Ltd",
        "params": ["utility_acc_no"],
        "format": "^[0-9A-Za-z]{6,12}$ (6-12 alphanumeric)",
        "fetch_required": True
    },
    3005: {"name": "HDFC Bank Retail Assets", "params": ["utility_acc_no"], "format": "Loan Account No", "fetch_required": True},
    430: {"name": "ICICI BANK - Interest Repayment Loans", "params": ["utility_acc_no"], "format": "Loan Account No", "fetch_required": True},
    5622: {"name": "State Bank of India (SBI) - Loans", "params": ["utility_acc_no"], "format": "Loan Account No", "fetch_required": True},
    336: {"name": "Bajaj Auto Finance", "params": ["utility_acc_no"], "format": "Loan Account No", "fetch_required": True},
    328: {"name": "Axis Bank Limited - Retail Loan", "params": ["utility_acc_no"], "format": "Loan Account No", "fetch_required": True},
    2681: {"name": "Kotak Mahindra Bank Ltd.-Loans", "params": ["utility_acc_no"], "format": "Loan Account No", "fetch_required": True},
}

CREDIT_CARD_OPERATORS = {
    5303: {"name": "HDFC Credit Card", "params": ["utility_acc_no"], "format": "Card Number (Last 4 digits)", "fetch_required": True},
    5304: {"name": "Axis Bank Credit Card", "params": ["utility_acc_no"], "format": "Card Number", "fetch_required": True},
    5288: {"name": "AU Bank Credit Card", "params": ["utility_acc_no"], "format": "Card Number", "fetch_required": True},
}

INSURANCE_OPERATORS = {
    419: {"name": "HDFC Life Insurance", "params": ["utility_acc_no"], "format": "Policy No", "fetch_required": True},
    335: {"name": "Bajaj Allianz Life Insurance", "params": ["utility_acc_no"], "format": "Policy No", "fetch_required": True},
    103: {"name": "Exide Life Insurance", "params": ["utility_acc_no"], "format": "Policy No", "fetch_required": True},
    554: {"name": "Care Health Insurance", "params": ["utility_acc_no"], "format": "Policy No", "fetch_required": True},
}

FASTAG_OPERATORS = {
    326: {"name": "Axis Bank Fastag", "params": ["utility_acc_no"], "format": "Vehicle No/Wallet ID"},
    596: {"name": "ICICI Bank Fastag", "params": ["utility_acc_no"], "format": "Vehicle No/Wallet ID"},
    433: {"name": "IDFC FIRST Bank - FasTag", "params": ["utility_acc_no"], "format": "Vehicle No/Wallet ID"},
    537: {"name": "Paytm Payments Bank FASTag", "params": ["utility_acc_no"], "format": "Vehicle No/Wallet ID"},
    472: {"name": "Kotak Mahindra Bank - Fastag", "params": ["utility_acc_no"], "format": "Vehicle No/Wallet ID"},
}


# ==================== HELPER FUNCTIONS ====================

def get_category_id(service_type: str) -> int:
    """Get Eko category ID for a service type"""
    return BBPS_CATEGORIES.get(service_type.lower())


def get_operator_info(operator_id: int) -> dict:
    """Get operator info by ID (searches all categories)"""
    all_operators = {
        **MOBILE_PREPAID_OPERATORS,
        **MOBILE_POSTPAID_OPERATORS,
        **DTH_OPERATORS,
        **ELECTRICITY_OPERATORS,
        **WATER_OPERATORS,
        **EMI_LOAN_OPERATORS,
        **CREDIT_CARD_OPERATORS,
        **INSURANCE_OPERATORS,
        **FASTAG_OPERATORS,
    }
    return all_operators.get(operator_id)


def is_fetch_required(operator_id: int) -> bool:
    """Check if bill fetch is required before payment for an operator"""
    info = get_operator_info(operator_id)
    if info:
        return info.get("fetch_required", True)
    return True  # Default to requiring fetch


# ==================== VALIDATION PATTERNS ====================

ACCOUNT_VALIDATION = {
    # Mobile
    "mobile": r"^[6-9]{1}[0-9]{9}$",  # Indian mobile starting with 6-9
    
    # MSEDCL
    "msedcl_consumer": r"^[0-9]{12}$",  # 12 digit
    "msedcl_bu": r"^[0-9]{4}$",  # 4 digit BU
    
    # Water
    "bwssb_rr": r"^[0-9A-Za-z\-]{8}$",  # 8 chars like GB-31254
    
    # Loan
    "idfc_loan": r"^[0-9A-Za-z]{6,12}$",  # 6-12 alphanumeric
}
