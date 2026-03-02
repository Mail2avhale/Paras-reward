// ===============================
// PARAS REWARD – EKO REDEEM SYSTEM
// CORRECTED VERSION - Eko Documentation Compliant
// ===============================

const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

// ===============================
// CONFIGURATION
// ===============================

const BASE_URL = "https://api.eko.in:25002/ekoicici";
const DEVELOPER_KEY = "7c179a397b4710e71b2248d1f5892d19";
const INITIATOR_ID = "9936606966";
const AUTHENTICATOR_KEY = "7a2529f5-3587-4add-a2df-3d0606d62460";
const USER_CODE = "20810200"; // Retailer code from Eko

// Charges
const FIXED_TX_CHARGE = 10; // ₹10 per transaction
const ADMIN_PERCENT = 0.20; // 20%
const EKO_CHARGE = 5; // Example ₹5 per transaction

// ===============================
// DATABASE MODELS
// ===============================

mongoose.connect("mongodb://localhost:27017/parasreward");

const transactionSchema = new mongoose.Schema({
  userId: String,
  serviceType: String,
  operatorId: String,
  utilityAccNo: String,
  customerMobile: String,
  senderName: String,
  amount: Number,
  adminCharge: Number,
  fixedCharge: Number,
  ekoCharge: Number,
  totalDebit: Number,
  status: String,
  referenceId: String,
  ekoTxnId: String,
  utrNumber: String,
  errorMessage: String,
  errorCode: String,
  createdAt: { type: Date, default: Date.now },
  processedAt: Date,
  completedAt: Date
});

const Transaction = mongoose.model("Transaction", transactionSchema);

// ===============================
// HELPER: Generate Secret Key (CORRECTED)
// As per Eko Documentation
// ===============================

function generateSecretKey(timestamp) {
  // Step 1: BASE64 encode the authenticator key FIRST
  const encodedKey = Buffer.from(AUTHENTICATOR_KEY).toString('base64');
  
  // Step 2: Use encoded key for HMAC SHA256
  const signature = crypto
    .createHmac("sha256", encodedKey)
    .update(timestamp)
    .digest();
  
  // Step 3: BASE64 encode the result
  return signature.toString('base64');
}

// ===============================
// HELPER: Generate Request Hash (CORRECTED)
// Sequence: timestamp + utility_acc_no + amount + user_code
// ===============================

function generateRequestHash(timestamp, utilityAccNo, amount, userCode) {
  // Step 1: BASE64 encode the authenticator key
  const encodedKey = Buffer.from(AUTHENTICATOR_KEY).toString('base64');
  
  // Step 2: Concatenate in EXACT sequence
  const concatenatedString = timestamp + utilityAccNo + amount + userCode;
  
  // Step 3: HMAC SHA256 with encoded key
  const signature = crypto
    .createHmac("sha256", encodedKey)
    .update(concatenatedString)
    .digest();
  
  // Step 4: BASE64 encode the result
  return signature.toString('base64');
}

// ===============================
// EKO ERROR CODES
// ===============================

const EKO_ERROR_CODES = {
  "0": { status: "SUCCESS", message: "Transaction Successful" },
  "1": { status: "FAILED", message: "Transaction Failed" },
  "2": { status: "PROCESSING", message: "Response Awaited (NEFT)" },
  "3": { status: "REFUND_PENDING", message: "Refund Pending" },
  "4": { status: "REFUNDED", message: "Refunded" },
  "5": { status: "HOLD", message: "Transaction on Hold - Inquiry Required" },
  
  // Common Error Codes
  "41": { status: "FAILED", message: "Wrong IFSC Code" },
  "44": { status: "FAILED", message: "Customer not found" },
  "45": { status: "FAILED", message: "Recipient not found / Incomplete IFSC" },
  "46": { status: "FAILED", message: "Invalid account details" },
  "102": { status: "FAILED", message: "Invalid Account number length" },
  "168": { status: "FAILED", message: "TID does not exist" },
  "302": { status: "FAILED", message: "Wrong OTP" },
  "303": { status: "FAILED", message: "OTP expired" },
  "317": { status: "FAILED", message: "NEFT not allowed" },
  "344": { status: "FAILED", message: "IMPS is not available in this bank" },
  "350": { status: "FAILED", message: "Verification failed - Recipient name not found" },
  "463": { status: "FAILED", message: "User not found" },
  "508": { status: "FAILED", message: "Invalid IFSC for selected bank" },
  "521": { status: "FAILED", message: "IFSC not found in system" },
  "544": { status: "FAILED", message: "Bank is not available now" },
  "945": { status: "FAILED", message: "Monthly limit exhausted" }
};

function getErrorInfo(code) {
  return EKO_ERROR_CODES[code?.toString()] || { 
    status: "FAILED", 
    message: `Unknown error (Code: ${code})` 
  };
}

// ===============================
// STEP 1 – USER REQUEST
// ===============================

app.post("/create-request", async (req, res) => {
  try {
    const { 
      userId, 
      serviceType,
      operatorId,
      utilityAccNo,
      customerMobile,
      senderName,
      amount 
    } = req.body;

    // Validate required fields
    if (!userId || !serviceType || !operatorId || !utilityAccNo || !amount) {
      return res.status(400).json({ 
        error: "Missing required fields",
        required: ["userId", "serviceType", "operatorId", "utilityAccNo", "amount"]
      });
    }

    const adminCharge = Math.round(amount * ADMIN_PERCENT);
    const totalDebit = amount + adminCharge + FIXED_TX_CHARGE + EKO_CHARGE;

    // Generate unique reference ID
    const referenceId = "PRC" + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();

    const txn = await Transaction.create({
      userId,
      serviceType,
      operatorId,
      utilityAccNo,
      customerMobile: customerMobile || INITIATOR_ID,
      senderName: senderName || "Customer",
      amount,
      adminCharge,
      fixedCharge: FIXED_TX_CHARGE,
      ekoCharge: EKO_CHARGE,
      totalDebit,
      status: "PENDING_ADMIN",
      referenceId
    });

    res.json({
      success: true,
      message: "Request Created. Waiting for Admin Approval.",
      data: {
        txnId: txn._id,
        referenceId: txn.referenceId,
        amount: txn.amount,
        adminCharge: txn.adminCharge,
        fixedCharge: txn.fixedCharge,
        ekoCharge: txn.ekoCharge,
        totalDebit: txn.totalDebit
      }
    });

  } catch (error) {
    console.error("Create Request Error:", error);
    res.status(500).json({ error: "Request Creation Failed", details: error.message });
  }
});

// ===============================
// STEP 2 – ADMIN APPROVE
// ===============================

app.post("/admin-approve/:id", async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id);
    
    if (!txn) {
      return res.status(404).json({ error: "Transaction Not Found" });
    }

    if (txn.status !== "PENDING_ADMIN") {
      return res.status(400).json({ 
        error: "Transaction cannot be approved",
        currentStatus: txn.status
      });
    }

    txn.status = "PROCESSING";
    txn.processedAt = new Date();
    await txn.save();

    // Execute EKO API
    const result = await executeEkoPayment(txn);

    res.json({ 
      success: true,
      message: "Processing Complete",
      result
    });

  } catch (error) {
    console.error("Admin Approve Error:", error);
    res.status(500).json({ error: "Approval Failed", details: error.message });
  }
});

// ===============================
// STEP 3 – ADMIN REJECT
// ===============================

app.post("/admin-reject/:id", async (req, res) => {
  try {
    const { reason } = req.body;
    const txn = await Transaction.findById(req.params.id);
    
    if (!txn) {
      return res.status(404).json({ error: "Transaction Not Found" });
    }

    if (txn.status !== "PENDING_ADMIN") {
      return res.status(400).json({ 
        error: "Transaction cannot be rejected",
        currentStatus: txn.status
      });
    }

    txn.status = "REJECTED";
    txn.errorMessage = reason || "Rejected by Admin";
    await txn.save();

    // Refund PRC to user
    await refundUser(txn);

    res.json({ 
      success: true,
      message: "Transaction Rejected. PRC Refunded.",
      refundAmount: txn.totalDebit
    });

  } catch (error) {
    res.status(500).json({ error: "Rejection Failed", details: error.message });
  }
});

// ===============================
// EKO EXECUTION FUNCTION (CORRECTED)
// ===============================

async function executeEkoPayment(txn) {
  const endpoint = "/v2/billpayments/paybill";
  const fullUrl = `${BASE_URL}${endpoint}?initiator_id=${INITIATOR_ID}`;

  // Generate timestamp in milliseconds
  const timestamp = Date.now().toString();
  
  // Generate secret key (CORRECTED)
  const secretKey = generateSecretKey(timestamp);
  
  // Generate request hash (CORRECTED)
  const requestHash = generateRequestHash(
    timestamp,
    txn.utilityAccNo,
    txn.amount.toString(),
    USER_CODE
  );

  // Build CORRECT request body as per Eko Documentation
  const body = {
    initiator_id: INITIATOR_ID,
    user_code: USER_CODE,
    client_ref_id: txn.referenceId,
    utility_acc_no: txn.utilityAccNo,
    confirmation_mobile_no: txn.customerMobile,
    sender_name: txn.senderName,
    operator_id: txn.operatorId,
    source_ip: "127.0.0.1",
    latlong: "19.0760,72.8777",
    amount: txn.amount.toString()
  };

  console.log("=== EKO REQUEST ===");
  console.log("URL:", fullUrl);
  console.log("Timestamp:", timestamp);
  console.log("Body:", JSON.stringify(body, null, 2));

  try {
    const response = await axios.post(fullUrl, body, {
      headers: {
        "developer_key": DEVELOPER_KEY,
        "secret-key": secretKey,
        "secret-key-timestamp": timestamp,
        "request_hash": requestHash,
        "Content-Type": "application/json",
        "Connection": "Keep-Alive",
        "Accept-Encoding": "gzip",
        "User-Agent": "okhttp/3.9.0"
      },
      timeout: 60000
    });

    console.log("=== EKO RESPONSE ===");
    console.log("Status:", response.status);
    console.log("Data:", JSON.stringify(response.data, null, 2));

    const data = response.data;
    const statusCode = data.status?.toString() || data.response_status_id?.toString();

    // Handle response based on Eko status codes
    if (statusCode === "0") {
      // SUCCESS
      txn.status = "SUCCESS";
      txn.ekoTxnId = data.data?.tid || data.txn_id;
      txn.utrNumber = data.data?.bbpstrxnrefid || data.utr;
      txn.completedAt = new Date();
    } 
    else if (statusCode === "2") {
      // PROCESSING (NEFT - Response Awaited)
      txn.status = "PROCESSING";
      txn.ekoTxnId = data.data?.tid || data.txn_id;
    }
    else if (statusCode === "5") {
      // HOLD - Need inquiry
      txn.status = "HOLD";
      txn.ekoTxnId = data.data?.tid || data.txn_id;
      txn.errorMessage = "Transaction on hold - Inquiry required";
    }
    else {
      // FAILED
      const errorInfo = getErrorInfo(statusCode);
      txn.status = "FAILED";
      txn.errorCode = statusCode;
      txn.errorMessage = data.message || errorInfo.message;
      await refundUser(txn);
    }

    await txn.save();

    return {
      status: txn.status,
      ekoTxnId: txn.ekoTxnId,
      utrNumber: txn.utrNumber,
      message: txn.errorMessage || "Processed"
    };

  } catch (error) {
    console.error("=== EKO ERROR ===");
    console.error("Error:", error.message);
    console.error("Response:", error.response?.data);

    txn.status = "FAILED";
    txn.errorMessage = error.response?.data?.message || error.message;
    await txn.save();
    
    await refundUser(txn);

    return {
      status: "FAILED",
      message: txn.errorMessage
    };
  }
}

// ===============================
// REFUND FUNCTION
// ===============================

async function refundUser(txn) {
  console.log("=== REFUNDING PRC ===");
  console.log("Reference:", txn.referenceId);
  console.log("Amount:", txn.totalDebit);
  
  // TODO: Add actual PRC balance update logic
  // await User.updateOne(
  //   { _id: txn.userId },
  //   { $inc: { prcBalance: txn.totalDebit * 10 } } // 10 PRC = ₹1
  // );
  
  txn.status = txn.status === "REJECTED" ? "REJECTED" : "REFUNDED";
  await txn.save();
  
  return true;
}

// ===============================
// CHECK TRANSACTION STATUS
// ===============================

app.get("/check-status/:id", async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id);
    
    if (!txn) {
      return res.status(404).json({ error: "Transaction Not Found" });
    }

    // If processing, check with Eko
    if (txn.status === "PROCESSING" || txn.status === "HOLD") {
      const ekoStatus = await checkEkoStatus(txn.ekoTxnId || txn.referenceId);
      if (ekoStatus) {
        txn.status = ekoStatus.status;
        if (ekoStatus.utr) txn.utrNumber = ekoStatus.utr;
        await txn.save();
      }
    }

    res.json({
      success: true,
      data: {
        txnId: txn._id,
        referenceId: txn.referenceId,
        status: txn.status,
        ekoTxnId: txn.ekoTxnId,
        utrNumber: txn.utrNumber,
        amount: txn.amount,
        totalDebit: txn.totalDebit,
        errorMessage: txn.errorMessage,
        createdAt: txn.createdAt,
        completedAt: txn.completedAt
      }
    });

  } catch (error) {
    res.status(500).json({ error: "Status Check Failed", details: error.message });
  }
});

// ===============================
// CHECK EKO STATUS
// ===============================

async function checkEkoStatus(txnId) {
  const endpoint = `/v2/transactions/${txnId}`;
  const fullUrl = `${BASE_URL}${endpoint}`;
  
  const timestamp = Date.now().toString();
  const secretKey = generateSecretKey(timestamp);

  try {
    const response = await axios.get(fullUrl, {
      params: {
        initiator_id: INITIATOR_ID,
        user_code: USER_CODE
      },
      headers: {
        "developer_key": DEVELOPER_KEY,
        "secret-key": secretKey,
        "secret-key-timestamp": timestamp
      },
      timeout: 30000
    });

    const data = response.data;
    const statusCode = data.data?.tx_status?.toString() || data.status?.toString();

    const statusMap = {
      "0": "SUCCESS",
      "1": "FAILED",
      "2": "PROCESSING",
      "3": "REFUND_PENDING",
      "4": "REFUNDED",
      "5": "HOLD"
    };

    return {
      status: statusMap[statusCode] || "UNKNOWN",
      utr: data.data?.bbpstrxnrefid || data.data?.utr
    };

  } catch (error) {
    console.error("Status Check Error:", error.message);
    return null;
  }
}

// ===============================
// LIST PENDING REQUESTS (ADMIN)
// ===============================

app.get("/admin/pending", async (req, res) => {
  try {
    const pending = await Transaction.find({ status: "PENDING_ADMIN" })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      count: pending.length,
      data: pending
    });

  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pending requests" });
  }
});

// ===============================
// SERVER START
// ===============================

app.listen(3000, () => {
  console.log("✅ Paras Reward EKO System Running on Port 3000");
  console.log("📋 Endpoints:");
  console.log("   POST /create-request - Create new redeem request");
  console.log("   POST /admin-approve/:id - Admin approve request");
  console.log("   POST /admin-reject/:id - Admin reject request");
  console.log("   GET /check-status/:id - Check transaction status");
  console.log("   GET /admin/pending - List pending requests");
});
