/**
 * MongoDB Index Creation Script for Production
 * =============================================
 * Run this on production after deployment:
 * mongosh paras_reward_db < create_indexes.js
 * 
 * Created: March 10, 2026
 */

print("=== PARAS REWARD - INDEX OPTIMIZATION SCRIPT ===\n");
print("Starting index creation...\n");

// ========== DMT TRANSACTIONS ==========
print("📁 dmt_transactions");
db.dmt_transactions.createIndex({"user_id": 1, "created_at": -1}, {background: true, name: "user_date_idx"});
db.dmt_transactions.createIndex({"user_id": 1, "status": 1}, {background: true, name: "user_status_idx"});
db.dmt_transactions.createIndex({"transaction_id": 1}, {background: true, sparse: true, name: "txn_id_idx"});
db.dmt_transactions.createIndex({"status": 1, "created_at": -1}, {background: true, name: "status_date_idx"});
db.dmt_transactions.createIndex({"eko_tid": 1}, {background: true, sparse: true, name: "eko_tid_idx"});
db.dmt_transactions.createIndex({"user_id": 1, "service_type": 1, "status": 1, "created_at": 1}, {background: true, name: "daily_limit_idx"});
print("   ✅ 6 indexes created\n");

// ========== ORDERS ==========
print("📁 orders");
db.orders.createIndex({"user_id": 1, "status": 1}, {background: true, name: "user_status_idx"});
db.orders.createIndex({"user_id": 1, "created_at": -1}, {background: true, name: "user_date_idx"});
print("   ✅ indexes created\n");

// ========== BILL PAYMENT REQUESTS ==========
print("📁 bill_payment_requests");
db.bill_payment_requests.createIndex({"user_id": 1, "status": 1}, {background: true, name: "user_status_idx"});
db.bill_payment_requests.createIndex({"user_id": 1, "created_at": -1}, {background: true, name: "user_date_idx"});
print("   ✅ indexes created\n");

// ========== GIFT VOUCHER REQUESTS ==========
print("📁 gift_voucher_requests");
db.gift_voucher_requests.createIndex({"user_id": 1, "status": 1}, {background: true, name: "user_status_idx"});
db.gift_voucher_requests.createIndex({"user_id": 1, "created_at": -1}, {background: true, name: "user_date_idx"});
print("   ✅ indexes created\n");

// ========== BANK REDEEM REQUESTS ==========
print("📁 bank_redeem_requests");
db.bank_redeem_requests.createIndex({"user_id": 1, "status": 1}, {background: true, name: "user_status_idx"});
db.bank_redeem_requests.createIndex({"user_id": 1, "created_at": -1}, {background: true, name: "user_date_idx"});
print("   ✅ indexes created\n");

// ========== TRANSACTIONS ==========
print("📁 transactions");
db.transactions.createIndex({"user_id": 1, "type": 1}, {background: true, name: "user_type_idx"});
db.transactions.createIndex({"user_id": 1, "created_at": -1}, {background: true, name: "user_date_idx"});
db.transactions.createIndex({"user_id": 1, "type": 1, "created_at": -1}, {background: true, name: "user_type_date_idx"});
print("   ✅ indexes created\n");

// ========== LOGIN HISTORY ==========
print("📁 login_history");
db.login_history.createIndex({"user_id": 1, "timestamp": -1}, {background: true, name: "user_time_idx"});
db.login_history.createIndex({"uid": 1, "timestamp": -1}, {background: true, name: "uid_time_idx"});
db.login_history.createIndex({"ip_address": 1}, {background: true, name: "ip_idx"});
db.login_history.createIndex({"timestamp": -1}, {background: true, name: "time_idx"});
print("   ✅ indexes created\n");

// ========== ADMIN SESSIONS ==========
print("📁 admin_sessions");
db.admin_sessions.createIndex({"uid": 1, "is_active": 1}, {background: true, name: "uid_active_idx"});
db.admin_sessions.createIndex({"token_id": 1}, {background: true, name: "token_idx"});
print("   ✅ indexes created\n");

// ========== ACTIVITY LOGS ==========
print("📁 activity_logs");
db.activity_logs.createIndex({"user_id": 1, "timestamp": -1}, {background: true, name: "user_time_idx"});
db.activity_logs.createIndex({"action_type": 1, "timestamp": -1}, {background: true, name: "action_time_idx"});
print("   ✅ indexes created\n");

// ========== DMT LOGS ==========
print("📁 dmt_logs");
db.dmt_logs.createIndex({"user_id": 1, "timestamp": -1}, {background: true, name: "user_time_idx"});
db.dmt_logs.createIndex({"action": 1}, {background: true, name: "action_idx"});
print("   ✅ indexes created\n");

// ========== SECURITY ALERTS ==========
print("📁 security_alerts");
db.security_alerts.createIndex({"user_id": 1, "created_at": -1}, {background: true, name: "user_time_idx"});
db.security_alerts.createIndex({"alert_type": 1}, {background: true, name: "type_idx"});
print("   ✅ indexes created\n");

// ========== LOGIN ATTEMPTS ==========
print("📁 login_attempts");
db.login_attempts.createIndex({"identifier": 1, "timestamp": -1}, {background: true, name: "id_time_idx"});
db.login_attempts.createIndex({"ip_address": 1}, {background: true, name: "ip_idx"});
print("   ✅ indexes created\n");

// ========== FINAL REPORT ==========
print("\n=== INDEX CREATION COMPLETE ===");
print("Run db.collection.getIndexes() to verify indexes");
print("Run db.setProfilingLevel(1, {slowms: 100}) to monitor slow queries");
