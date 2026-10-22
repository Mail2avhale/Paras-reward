# Seed/cleanup a temp mobile_recharge service charge for UI test (iter 311)
import os, sys
from datetime import datetime, timezone
from dotenv import load_dotenv; load_dotenv('/app/backend/.env')
from pymongo import MongoClient
db = MongoClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
uid = '76b75808-47fa-48dd-ad7c-8074678e3607'  # login 9970100782
CID = 'SVC-TEST311-MOBRCH'
if sys.argv[1] == 'seed':
    now = datetime.now(timezone.utc).isoformat()
    db.redemption_service_charges.delete_many({'charge_id': CID})
    db.redemption_service_charges.insert_one({
        'charge_id': CID, 'user_id': uid, 'redemption_id': 'TEST311-RCH-REQ', 'redemption_type': 'mobile_recharge',
        'prc_amount': 1990.0, 'charge_basis': 'prc', 'details': {'recharge_type': 'mobile', 'operator': 'Jio', 'number': 'XXXXXX3210', 'recharge_amount_inr': 199.0},
        'prc_rate': 10, 'redemption_value_inr': 199.0, 'service_charge_percentage': 20, 'service_charge_amount': 39.8,
        'tax_amount': 0.0, 'total_payable': 39.8, 'currency': 'INR', 'status': 'PAID', 'payment_order_id': None, 'payment_id': None,
        'payment_gateway': 'razorpay', 'payment_attempts': 0, 'created_at': now, 'applicable_at': now, 'paid_at': now, 'updated_at': now})
    print('seeded', CID)
else:
    print('deleted', db.redemption_service_charges.delete_many({'charge_id': CID}).deleted_count)
