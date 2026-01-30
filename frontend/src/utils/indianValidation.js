/**
 * Indian Document & Field Validation Utilities
 * Reduces fraud by enforcing standard formats
 */

// ========== MOBILE NUMBER ==========
// Indian mobile: 10 digits, starts with 6-9
export const validateMobile = (mobile) => {
  const cleaned = mobile?.replace(/\D/g, '') || '';
  const isValid = /^[6-9]\d{9}$/.test(cleaned);
  return {
    isValid,
    cleaned,
    error: !isValid ? 'Enter valid 10-digit mobile number starting with 6-9' : null
  };
};

export const formatMobile = (value) => {
  // Remove non-digits and limit to 10
  return value?.replace(/\D/g, '').slice(0, 10) || '';
};

// ========== EMAIL ==========
export const validateEmail = (email) => {
  const trimmed = email?.trim().toLowerCase() || '';
  const isValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed);
  return {
    isValid,
    cleaned: trimmed,
    error: !isValid ? 'Enter valid email address' : null
  };
};

// ========== PAN CARD ==========
// Format: AAAAA1234A (5 letters, 4 digits, 1 letter)
// 4th character indicates holder type: P=Person, C=Company, H=HUF, etc.
export const validatePAN = (pan) => {
  const cleaned = pan?.toUpperCase().replace(/[^A-Z0-9]/g, '') || '';
  const isValid = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleaned);
  
  let holderType = '';
  if (cleaned.length >= 4) {
    const typeChar = cleaned[3];
    const types = {
      'P': 'Individual',
      'C': 'Company',
      'H': 'HUF',
      'A': 'AOP',
      'B': 'BOI',
      'G': 'Government',
      'J': 'Artificial Juridical Person',
      'L': 'Local Authority',
      'F': 'Firm/LLP',
      'T': 'Trust'
    };
    holderType = types[typeChar] || '';
  }
  
  return {
    isValid,
    cleaned,
    holderType,
    error: !isValid ? 'Enter valid PAN (e.g., ABCDE1234F)' : null
  };
};

export const formatPAN = (value) => {
  // Uppercase and remove special chars, limit to 10
  return value?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || '';
};

// ========== AADHAAR CARD ==========
// 12 digits, cannot start with 0 or 1
export const validateAadhaar = (aadhaar) => {
  const cleaned = aadhaar?.replace(/\D/g, '') || '';
  const isValid = /^[2-9]\d{11}$/.test(cleaned);
  return {
    isValid,
    cleaned,
    formatted: cleaned.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3'),
    error: !isValid ? 'Enter valid 12-digit Aadhaar number' : null
  };
};

export const formatAadhaar = (value) => {
  // Remove non-digits and limit to 12
  const digits = value?.replace(/\D/g, '').slice(0, 12) || '';
  // Add spaces for display: XXXX XXXX XXXX
  if (digits.length > 8) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;
  } else if (digits.length > 4) {
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  }
  return digits;
};

// ========== IFSC CODE ==========
// Format: First 4 chars = bank code (letters), 5th = 0, last 6 = branch code (alphanumeric)
export const validateIFSC = (ifsc) => {
  const cleaned = ifsc?.toUpperCase().replace(/[^A-Z0-9]/g, '') || '';
  const isValid = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleaned);
  
  let bankCode = '';
  let branchCode = '';
  if (cleaned.length === 11) {
    bankCode = cleaned.slice(0, 4);
    branchCode = cleaned.slice(5);
  }
  
  return {
    isValid,
    cleaned,
    bankCode,
    branchCode,
    error: !isValid ? 'Enter valid IFSC code (e.g., SBIN0001234)' : null
  };
};

export const formatIFSC = (value) => {
  // Uppercase and remove special chars, limit to 11
  return value?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11) || '';
};

// ========== BANK ACCOUNT NUMBER ==========
// Indian bank accounts: 9-18 digits
export const validateBankAccount = (account) => {
  const cleaned = account?.replace(/\D/g, '') || '';
  const isValid = cleaned.length >= 9 && cleaned.length <= 18;
  return {
    isValid,
    cleaned,
    error: !isValid ? 'Enter valid account number (9-18 digits)' : null
  };
};

export const formatBankAccount = (value) => {
  // Remove non-digits and limit to 18
  return value?.replace(/\D/g, '').slice(0, 18) || '';
};

// ========== UPI ID ==========
// Format: username@bankhandle (e.g., name@upi, name@paytm)
export const validateUPI = (upi) => {
  const trimmed = upi?.trim().toLowerCase() || '';
  const isValid = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(trimmed);
  return {
    isValid,
    cleaned: trimmed,
    error: !isValid ? 'Enter valid UPI ID (e.g., name@upi)' : null
  };
};

// ========== GST NUMBER ==========
// Format: 2 digits (state code) + 10 char PAN + 1 digit + Z + 1 check digit
export const validateGST = (gst) => {
  const cleaned = gst?.toUpperCase().replace(/[^A-Z0-9]/g, '') || '';
  const isValid = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleaned);
  return {
    isValid,
    cleaned,
    stateCode: cleaned.slice(0, 2),
    pan: cleaned.slice(2, 12),
    error: !isValid ? 'Enter valid 15-character GSTIN' : null
  };
};

export const formatGST = (value) => {
  return value?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15) || '';
};

// ========== PINCODE ==========
// Indian pincode: 6 digits, first digit 1-9
export const validatePincode = (pincode) => {
  const cleaned = pincode?.replace(/\D/g, '') || '';
  const isValid = /^[1-9][0-9]{5}$/.test(cleaned);
  return {
    isValid,
    cleaned,
    error: !isValid ? 'Enter valid 6-digit pincode' : null
  };
};

export const formatPincode = (value) => {
  return value?.replace(/\D/g, '').slice(0, 6) || '';
};

// ========== UTR NUMBER ==========
// UTR (Unique Transaction Reference) - STRICT 12 DIGIT FORMAT ONLY
// For IMPS/UPI payments which are most common for subscription payments
export const validateUTR = (utr) => {
  // Remove all non-numeric characters
  const cleaned = utr?.replace(/[^0-9]/g, '') || '';
  const length = cleaned.length;
  
  // STRICT: Only 12 digits allowed
  const isValid = /^\d{12}$/.test(cleaned);
  
  return {
    isValid,
    cleaned,
    utrType: isValid ? 'IMPS/UPI' : 'unknown',
    error: !isValid ? 'UTR number फक्त 12 अंकी असावा' : null,
    hint: isValid ? '✓ Valid 12-digit UTR' : (length > 0 ? `${length}/12 digits` : null)
  };
};

export const formatUTR = (value) => {
  // STRICT: Only numbers, limit to exactly 12 digits
  return value?.replace(/[^0-9]/g, '').slice(0, 12) || '';
};

// ========== VEHICLE NUMBER ==========
// Format: SS-DD-XX-DDDD (State-District-Series-Number)
export const validateVehicleNumber = (vehicle) => {
  const cleaned = vehicle?.toUpperCase().replace(/[^A-Z0-9]/g, '') || '';
  const isValid = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/.test(cleaned);
  return {
    isValid,
    cleaned,
    error: !isValid ? 'Enter valid vehicle number (e.g., MH12AB1234)' : null
  };
};

// ========== AMOUNT VALIDATION ==========
export const validateAmount = (amount, min = 1, max = 100000) => {
  const num = parseFloat(amount);
  const isValid = !isNaN(num) && num >= min && num <= max;
  return {
    isValid,
    value: isValid ? num : null,
    error: !isValid ? `Amount must be between ₹${min} and ₹${max}` : null
  };
};

// ========== HELPER: Get validation for field type ==========
export const getValidator = (fieldType) => {
  const validators = {
    mobile: validateMobile,
    phone: validateMobile,
    email: validateEmail,
    pan: validatePAN,
    pan_number: validatePAN,
    aadhaar: validateAadhaar,
    aadhaar_number: validateAadhaar,
    ifsc: validateIFSC,
    ifsc_code: validateIFSC,
    bank_account: validateBankAccount,
    account_number: validateBankAccount,
    upi: validateUPI,
    upi_id: validateUPI,
    gst: validateGST,
    gstin: validateGST,
    pincode: validatePincode
  };
  return validators[fieldType] || (() => ({ isValid: true }));
};

export const getFormatter = (fieldType) => {
  const formatters = {
    mobile: formatMobile,
    phone: formatMobile,
    pan: formatPAN,
    pan_number: formatPAN,
    aadhaar: formatAadhaar,
    aadhaar_number: formatAadhaar,
    ifsc: formatIFSC,
    ifsc_code: formatIFSC,
    bank_account: formatBankAccount,
    account_number: formatBankAccount,
    gst: formatGST,
    gstin: formatGST,
    pincode: formatPincode
  };
  return formatters[fieldType] || ((v) => v);
};

// ========== EXPORT DEFAULT ==========
export default {
  validateMobile,
  formatMobile,
  validateEmail,
  validatePAN,
  formatPAN,
  validateAadhaar,
  formatAadhaar,
  validateIFSC,
  formatIFSC,
  validateBankAccount,
  formatBankAccount,
  validateUPI,
  validateGST,
  formatGST,
  validatePincode,
  formatPincode,
  validateVehicleNumber,
  validateAmount,
  getValidator,
  getFormatter
};
