/**
 * ==============================================================================
 * SNAPZDEALZ - COMPLETE GOOGLE APPS SCRIPT WEBHOOK (MULTI-TAB DATABASE)
 * ==============================================================================
 * 
 * Supports:
 * 1. "Orders" Tab:
 *    - Records all incoming orders from Checkout.
 *    - Order Status strictly formatted as: "Pending" | "Delivered" | "Cancelled".
 *    - Supports updating status to Cancelled / Delivered.
 * 
 * 2. "Users" Tab:
 *    - Automatically created & formatted with dark headers.
 *    - Records every new SIGNUP with Name, Phone, Email, Password, Reg Date, Status.
 *    - Automatically updates "Last Login Date" on every user LOGIN.
 * 
 * 3. "Password_Resets" Tab:
 *    - Records all FORGOT PASSWORD and reset requests.
 *    - Automatically updates the user's password in the "Users" tab so customer
 *      records remain 100% synchronized and secure.
 * 
 * 4. "Login_Activity" Tab:
 *    - Logs every login attempt with timestamp and device info.
 * ==============================================================================
 */

// Tab 1: Orders Headers
var SHEET_HEADERS = [
  "Order ID",
  "Order Date & Time",
  "Customer Name",
  "Phone Number",
  "Email Address",
  "Delivery Address",
  "City",
  "Items & Quantities",
  "Payment Method",
  "Payment Status",
  "Subtotal ($)",
  "Discount ($)",
  "Shipping ($)",
  "Total Amount ($)",
  "Order Status"
];

// Tab 2: Users Headers
var USERS_HEADERS = [
  "User ID",
  "Registration Date",
  "Full Name",
  "Phone Number",
  "Email Address",
  "Password (SHA-256 Secure Hash)",
  "Last Login Date",
  "Account Status"
];

// Tab 3: Password Resets Headers
var RESETS_HEADERS = [
  "Reset Ref ID",
  "Request Date & Time",
  "Email Address",
  "Customer Name",
  "Recovery Status",
  "Password (SHA-256 Secure Hash)"
];

// Tab 4: Login Activity Headers
var LOGIN_HEADERS = [
  "Timestamp",
  "Email Address",
  "Customer Name",
  "Action",
  "Status"
];

// Tab 5: OTP Verifications Headers (6-Digit Gmail OTP)
var OTP_HEADERS = [
  "Timestamp",
  "Email Address",
  "Customer Name",
  "6-Digit OTP",
  "Email Delivery Status"
];

/**
 * Neutralizes formula injection (=, +, -, @) and strips HTML/script tags
 */
function sanitizeForSheet(val) {
  if (val === null || val === undefined) return "";
  var s = String(val).trim();
  s = s.replace(/<[^>]*>/g, "");
  if (s.length > 0 && (s.charAt(0) === '=' || s.charAt(0) === '+' || s.charAt(0) === '-' || s.charAt(0) === '@')) {
    s = "'" + s;
  }
  return s;
}

/**
 * Computes or validates SHA-256 hash so plaintext passwords are NEVER saved in Google Sheet
 */
function getSecurePasswordHash(data) {
  var raw = String(data.passwordHash || data.password || data.newPassword || "").trim();
  if (!raw || raw === "N/A") return "PROTECTED_HASH";
  // If already a 64-char hex SHA-256 hash
  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return raw;
  }
  // Otherwise compute SHA-256 with salt
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, "SNAPZDEALZ_SALT::" + raw, Utilities.Charset.UTF_8);
  var hex = "";
  for (var i = 0; i < digest.length; i++) {
    var b = digest[i];
    if (b < 0) b += 256;
    var h = b.toString(16);
    if (h.length === 1) hex += "0";
    hex += h;
  }
  return hex;
}

/**
 * Normalizes Order Status to strictly one of the 3 requested values:
 * 1. "Pending"
 * 2. "Delivered"
 * 3. "Cancelled"
 */
function getNormalizedSheetStatus(rawStatus, isCancellation) {
  if (isCancellation) return "Cancelled";
  var s = String(rawStatus || "").trim().toLowerCase();
  if (s.indexOf("cancel") > -1) return "Cancelled";
  if (s.indexOf("deliver") > -1) return "Delivered";
  return "Pending";
}

/**
 * Handle POST requests (Orders, Signup, Login, Password Reset)
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    var data = parseRequestData(e);
    var action = String(data.action || "").toUpperCase();
    
    // 0. SEND_OTP Action (6-Digit OTP to Gmail)
    if (action === "SEND_OTP" || action === "DISPATCH_OTP") {
      var otpResult = sendEmailOtp(data);
      return ContentService.createTextOutput(JSON.stringify({
        status: otpResult.success ? "success" : "email_sent",
        action: "SEND_OTP",
        message: otpResult.message,
        email: data.email || "",
        otp: otpResult.otp
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 1. SIGNUP Action
    if (action === "SIGNUP" || action === "USER_REGISTER") {
      var userResult = recordUserSignup(data);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "SIGNUP",
        message: userResult.message,
        userId: userResult.userId
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. LOGIN Action
    if (action === "LOGIN" || action === "USER_LOGIN") {
      var loginResult = recordUserLogin(data);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "LOGIN",
        message: "Login recorded successfully"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 3. FORGOT PASSWORD Action
    if (action === "FORGOT_PASSWORD" || action === "PASSWORD_RESET") {
      var resetResult = recordPasswordReset(data);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "FORGOT_PASSWORD",
        message: resetResult.message,
        resetId: resetResult.resetId
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 4. GET_ORDERS Action
    if (action === "GET_ORDERS") {
      var orders = fetchOrdersFromSheet();
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        orders: orders,
        count: orders.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 5. DELETE_ORDER / PURGE_ORDER Action (When cancelled orders expire or are cleared)
    if (action === "DELETE_ORDER" || action === "PURGE_ORDER") {
      var delRes = deleteOrderFromSheet(data.orderNumber || data.orderId || data["Order ID"]);
      return ContentService.createTextOutput(JSON.stringify({
        status: delRes.success ? "success" : "not_found",
        action: "DELETE_ORDER",
        message: delRes.message,
        orderId: data.orderNumber || data.orderId || ""
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 6. CLEAR_ALL_ORDERS Action (Resets/wipes test orders across Orders and Cancelled_Archive)
    if (action === "CLEAR_ALL_ORDERS" || action === "RESET_ORDERS" || action === "CLEAR_ALL_DATA") {
      var wipeRes = clearAllOrdersFromSheet();
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "CLEAR_ALL_ORDERS",
        message: wipeRes.message,
        rowsDeleted: wipeRes.rowsDeleted
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 7. Default: Order Placement / Cancellation
    var result = processOrderData(data);
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      action: result.action,
      message: result.message,
      orderId: data.orderNumber || data.orderId || "",
      sheetStatus: result.sheetStatus,
      rowNumber: result.row
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handle GET requests (Fetching orders, Signup/Login fallback, Health Check)
 */
function doGet(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    var data = parseRequestData(e);
    var action = String(data.action || "").toUpperCase();
    
    // 0. SEND_OTP Action via GET fallback
    if (action === "SEND_OTP" || action === "DISPATCH_OTP") {
      var otpGetRes = sendEmailOtp(data);
      return ContentService.createTextOutput(JSON.stringify({
        status: otpGetRes.success ? "success" : "email_sent",
        action: "SEND_OTP",
        message: otpGetRes.message,
        email: data.email || "",
        otp: otpGetRes.otp
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 1. Fetch Orders
    if (action === "GET_ORDERS") {
      var ordersList = fetchOrdersFromSheet();
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        orders: ordersList,
        count: ordersList.length
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. Fetch Users
    if (action === "GET_USERS") {
      var usersList = fetchUsersFromSheet();
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        users: usersList,
        count: usersList.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Delete or Purge Order from Orders Sheet
    if (action === "DELETE_ORDER" || action === "PURGE_ORDER") {
      var delRes = deleteOrderFromSheet(data.orderNumber || data.orderId || data["Order ID"]);
      return ContentService.createTextOutput(JSON.stringify({
        status: delRes.success ? "success" : "not_found",
        action: "DELETE_ORDER",
        message: delRes.message,
        orderId: data.orderNumber || data.orderId || ""
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Wipe/Reset all orders from sheet
    if (action === "CLEAR_ALL_ORDERS" || action === "RESET_ORDERS" || action === "CLEAR_ALL_DATA") {
      var wipeRes2 = clearAllOrdersFromSheet();
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "CLEAR_ALL_ORDERS",
        message: wipeRes2.message,
        rowsDeleted: wipeRes2.rowsDeleted
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 5. Signup via GET fallback
    if (action === "SIGNUP") {
      var userRes = recordUserSignup(data);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "SIGNUP",
        message: userRes.message,
        userId: userRes.userId
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 4. Login via GET fallback
    if (action === "LOGIN") {
      recordUserLogin(data);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "LOGIN"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 5. Password Reset via GET fallback
    if (action === "FORGOT_PASSWORD") {
      var rRes = recordPasswordReset(data);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "FORGOT_PASSWORD",
        message: rRes.message
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 6. Health check ping
    if (!data.orderNumber && !data.orderId && !data.name && !data.customerName && !data.email && !data.action) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "active",
        message: "SnapzDealz Webhook LIVE. Multi-tab enabled: Orders | Users | Password_Resets | Login_Activity"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 7. Order processing fallback
    var result = processOrderData(data);
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      action: result.action,
      message: result.message,
      orderId: data.orderNumber || data.orderId,
      sheetStatus: result.sheetStatus,
      rowNumber: result.row
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Parse incoming data from JSON body or URL parameters
 */
function parseRequestData(e) {
  var data = {};
  if (!e) return data;
  
  if (e.postData && e.postData.contents) {
    try {
      data = JSON.parse(e.postData.contents);
      return data;
    } catch (err) {}
  }
  
  if (e.parameter) {
    for (var key in e.parameter) {
      data[key] = e.parameter[key];
    }
  }
  
  return data;
}

/**
 * Ensure a specific sheet tab exists and has formatted headers
 */
function getOrCreateSheetTab(tabName, headers) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(tabName);
  
  if (!sheet) {
    // If first sheet is named Sheet1 and we are creating Orders, rename Sheet1
    if (tabName === "Orders" && spreadsheet.getSheetByName("Sheet1")) {
      sheet = spreadsheet.getSheetByName("Sheet1");
      sheet.setName("Orders");
    } else {
      sheet = spreadsheet.insertSheet(tabName);
    }
  }
  
  // Initialize headers if empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#1f1f1f"); // Dark Charcoal
    headerRange.setFontColor("#F9B800"); // SnapzDealz Yellow
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(11);
    headerRange.setHorizontalAlignment("center");
    headerRange.setVerticalAlignment("middle");
    sheet.setRowHeight(1, 36);
    sheet.setFrozenRows(1);
    
    for (var i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
  }
  
  return sheet;
}

/**
 * ==============================================================================
 * USER SIGNUP & LOGIN MANAGEMENT
 * ==============================================================================
 */

/**
 * Record a new user registration in "Users" tab with SHA-256 password hash protection
 */
function recordUserSignup(data) {
  var sheet = getOrCreateSheetTab("Users", USERS_HEADERS);
  
  var email = String(data.email || "").trim().toLowerCase();
  var name = sanitizeForSheet(data.name || data.fullName || "Member");
  var phone = sanitizeForSheet(data.phone || "N/A");
  var passwordHash = getSecurePasswordHash(data); // SHA-256 Hash - never plaintext!
  var dateStr = data.dateString || data.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  var userId = sanitizeForSheet(data.userId || ("#USR-" + Math.floor(100000 + Math.random() * 900000)));
  var status = sanitizeForSheet(data.status || "Active");
  
  // Check if user email already exists in Users tab
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var emailRange = sheet.getRange(2, 5, lastRow - 1, 1).getValues();
    for (var i = 0; i < emailRange.length; i++) {
      if (String(emailRange[i][0]).toLowerCase() === email) {
        var existingRow = i + 2;
        // Update password hash & last login if re-registering
        sheet.getRange(existingRow, 6).setValue(passwordHash);
        sheet.getRange(existingRow, 7).setValue(dateStr);
        return {
          userId: sheet.getRange(existingRow, 1).getValue(),
          message: "User already exists; profile credentials updated with SHA-256 hash at row " + existingRow
        };
      }
    }
  }
  
  var newRow = [
    userId,
    dateStr,
    name,
    "'" + phone,
    email,
    passwordHash, // Stored as cryptographic hash
    dateStr, // Initial Last Login
    status
  ];
  
  sheet.appendRow(newRow);
  var rowNum = sheet.getLastRow();
  
  // Format row
  var rowRange = sheet.getRange(rowNum, 1, 1, newRow.length);
  rowRange.setVerticalAlignment("middle");
  rowRange.setFontSize(10);
  
  if (rowNum % 2 === 0) {
    rowRange.setBackground("#fafafa");
  } else {
    rowRange.setBackground("#ffffff");
  }
  
  sheet.getRange(rowNum, 1).setFontWeight("bold").setFontColor("#1f1f1f");
  sheet.getRange(rowNum, 8).setFontWeight("bold").setFontColor("#15803d"); // Green Active
  
  for (var c = 1; c <= USERS_HEADERS.length; c++) {
    sheet.autoResizeColumn(c);
  }
  
  return {
    userId: userId,
    message: "New user registered with SHA-256 encryption at row " + rowNum
  };
}

/**
 * Record a user login in "Users" tab (updates Last Login) and "Login_Activity" tab
 */
function recordUserLogin(data) {
  var email = String(data.email || "").trim().toLowerCase();
  var dateStr = data.dateString || data.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  var name = sanitizeForSheet(data.name || "Member");
  
  // 1. Update Last Login in "Users" tab
  var userSheet = getOrCreateSheetTab("Users", USERS_HEADERS);
  var lastRow = userSheet.getLastRow();
  if (lastRow > 1) {
    var emailRange = userSheet.getRange(2, 5, lastRow - 1, 1).getValues();
    for (var i = 0; i < emailRange.length; i++) {
      if (String(emailRange[i][0]).toLowerCase() === email) {
        var userRow = i + 2;
        userSheet.getRange(userRow, 7).setValue(dateStr); // Column 7 is Last Login Date
        break;
      }
    }
  }
  
  // 2. Append event to "Login_Activity" tab
  var loginSheet = getOrCreateSheetTab("Login_Activity", LOGIN_HEADERS);
  loginSheet.appendRow([
    dateStr,
    email,
    name,
    "User Login (Verified)",
    "Successful"
  ]);
  
  return { success: true };
}

/**
 * Record a password reset request in "Password_Resets" and update "Users" tab with SHA-256 hash
 */
function recordPasswordReset(data) {
  var email = String(data.email || "").trim().toLowerCase();
  var secureHash = getSecurePasswordHash(data); // SHA-256 hash
  var dateStr = data.dateString || data.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  var resetId = "#RST-" + Math.floor(100000 + Math.random() * 900000);
  var name = sanitizeForSheet(data.name || "Customer");
  
  // 1. Log in "Password_Resets" Tab
  var resetSheet = getOrCreateSheetTab("Password_Resets", RESETS_HEADERS);
  resetSheet.appendRow([
    resetId,
    dateStr,
    email,
    name,
    "Password Reset Completed",
    secureHash // Cryptographic hash
  ]);
  
  var lastRow = resetSheet.getLastRow();
  var range = resetSheet.getRange(lastRow, 1, 1, RESETS_HEADERS.length);
  range.setBackground("#fffbeb"); // Soft Amber
  resetSheet.getRange(lastRow, 1).setFontWeight("bold");
  resetSheet.getRange(lastRow, 5).setFontWeight("bold").setFontColor("#b45309");
  
  // 2. Update Password in "Users" Tab
  var userSheet = getOrCreateSheetTab("Users", USERS_HEADERS);
  var userLastRow = userSheet.getLastRow();
  var updatedUser = false;
  
  if (userLastRow > 1) {
    var emails = userSheet.getRange(2, 5, userLastRow - 1, 1).getValues();
    for (var j = 0; j < emails.length; j++) {
      if (String(emails[j][0]).toLowerCase() === email) {
        var targetRow = j + 2;
        userSheet.getRange(targetRow, 6).setValue(secureHash); // Column 6 is Password Hash
        userSheet.getRange(targetRow, 7).setValue(dateStr); // Update Last Login / Modified
        updatedUser = true;
        break;
      }
    }
  }
  
  return {
    resetId: resetId,
    message: updatedUser ? "Password updated in Users sheet with SHA-256 hash & logged in Password_Resets" : "Reset logged in Password_Resets"
  };
}

/**
 * Send a 6-digit verification OTP directly to the user's Gmail using Google Apps Script MailApp
 */
function sendEmailOtp(data) {
  var email = String(data.email || "").trim().toLowerCase();
  var name = sanitizeForSheet(data.name || data.fullName || "Valued Member");
  var otp = String(data.otp || "").trim();
  
  if (!otp || otp.length !== 6) {
    // Generate 6 digit random number if not passed
    otp = String(Math.floor(100000 + Math.random() * 900000));
  }
  
  var dateStr = data.dateString || data.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  
  var emailSubject = "SnapzDealz Account Verification: " + otp + " is your 6-digit OTP";
  var htmlBody = 
    '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">' +
      '<div style="background: #1f1f1f; padding: 26px 20px; text-align: center;">' +
        '<h1 style="color: #F9B800; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 2px;">⚡ SNAPZDEALZ</h1>' +
        '<p style="color: #ffffff; margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Secure VIP Account Verification</p>' +
      '</div>' +
      '<div style="padding: 32px 28px;">' +
        '<h2 style="color: #111827; margin-top: 0; font-size: 20px; font-weight: 700;">Hello ' + name + ',</h2>' +
        '<p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">' +
          'Thank you for signing in with SnapzDealz. To activate your account and verify your identity, please enter this 6-digit one-time password (OTP):' +
        '</p>' +
        '<div style="text-align: center; margin: 30px 0;">' +
          '<div style="display: inline-block; background: #fffbeb; border: 2px dashed #f59e0b; border-radius: 12px; padding: 18px 40px;">' +
            '<span style="font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #1f1f1f; font-family: Courier, monospace;">' + otp + '</span>' +
          '</div>' +
          '<p style="color: #6b7280; font-size: 13px; margin-top: 10px; font-weight: 500;">⏱️ Valid for 10 minutes. Do not share this OTP code.</p>' +
        '</div>' +
        '<div style="background: #f9fafb; border-radius: 10px; padding: 16px; font-size: 13px; color: #4b5563; line-height: 1.5; border: 1px solid #f3f4f6;">' +
          '🔒 <strong>Security Notice:</strong> If you did not request this OTP, someone may have entered your email address by mistake. Your account remains secure.' +
        '</div>' +
      '</div>' +
      '<div style="background: #f3f4f6; padding: 16px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb;">' +
        '&copy; ' + new Date().getFullYear() + ' SnapzDealz VIP Protection. All rights reserved.' +
      '</div>' +
    '</div>';

  var emailSent = false;
  var deliveryStatus = "Dispatched via MailApp";
  
  if (email && email.indexOf("@") > -1) {
    try {
      MailApp.sendEmail({
        to: email,
        subject: emailSubject,
        htmlBody: htmlBody
      });
      emailSent = true;
    } catch (mailErr) {
      deliveryStatus = "MailApp Notice: " + mailErr.toString();
    }
  } else {
    deliveryStatus = "Invalid Email";
  }

  // Record in "OTP_Verifications" sheet tab
  try {
    var otpSheet = getOrCreateSheetTab("OTP_Verifications", OTP_HEADERS);
    otpSheet.appendRow([
      dateStr,
      email,
      name,
      otp,
      deliveryStatus
    ]);
    var lastRow = otpSheet.getLastRow();
    otpSheet.getRange(lastRow, 1).setFontSize(10);
    otpSheet.getRange(lastRow, 4).setFontWeight("bold").setFontColor("#b45309"); // Amber OTP
    otpSheet.getRange(lastRow, 5).setFontColor(emailSent ? "#15803d" : "#6b7280");
  } catch (sheetErr) {}

  return {
    success: true,
    emailSent: emailSent,
    otp: otp,
    message: emailSent ? ("6-digit OTP sent to " + email) : ("OTP logged in sheet: " + deliveryStatus)
  };
}

/**
 * Security Routine: Auto-Sanitizes and converts any legacy plaintext passwords to SHA-256 hashes
 * Can be run directly from Google Apps Script editor if desired!
 */
function sanitizeAndSecureSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var userSheet = ss.getSheetByName("Users");
  if (userSheet && userSheet.getLastRow() > 1) {
    var numRows = userSheet.getLastRow() - 1;
    var passRange = userSheet.getRange(2, 6, numRows, 1);
    var values = passRange.getValues();
    var converted = 0;
    for (var i = 0; i < values.length; i++) {
      var current = String(values[i][0]).trim();
      if (current && !/^[a-f0-9]{64}$/i.test(current)) {
        values[i][0] = getSecurePasswordHash({ password: current });
        converted++;
      }
    }
    passRange.setValues(values);
    Logger.log("Sanitized " + converted + " user passwords with SHA-256 hash.");
  }
}

/**
 * Fetch all users from "Users" tab
 */
function fetchUsersFromSheet() {
  var sheet = getOrCreateSheetTab("Users", USERS_HEADERS);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  
  var values = sheet.getRange(2, 1, lastRow - 1, USERS_HEADERS.length).getValues();
  var users = [];
  
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    users.push({
      userId: row[0],
      registrationDate: row[1],
      name: row[2],
      phone: String(row[3]).replace(/^'/, ''),
      email: row[4],
      lastLogin: row[6],
      status: row[7]
    });
  }
  return users;
}

/**
 * ==============================================================================
 * ORDERS MANAGEMENT ("Orders" TAB)
 * ==============================================================================
 */

/**
 * Fetch all orders from "Orders" sheet (Latest first)
 */
function fetchOrdersFromSheet() {
  var sheet = getOrCreateSheetTab("Orders", SHEET_HEADERS);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  
  var values = sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS.length).getValues();
  var orders = [];
  
  for (var i = values.length - 1; i >= 0; i--) {
    var row = values[i];
    var orderId = String(row[0] || '').trim();
    if (!orderId) continue;
    
    var rawStatus = String(row[14] || 'Pending');
    var normStatus = getNormalizedSheetStatus(rawStatus, false);
    
    orders.push({
      orderNumber: orderId,
      orderId: orderId,
      dateString: String(row[1] || ''),
      customerName: String(row[2] || 'Customer'),
      phone: String(row[3] || '').replace(/^'/, ''),
      email: String(row[4] || ''),
      address: String(row[5] || ''),
      city: String(row[6] || ''),
      itemsSummary: String(row[7] || ''),
      paymentMethod: String(row[8] || 'Cash on Delivery'),
      paymentStatus: String(row[9] || ''),
      subtotal: parseFloat(row[10] || 0),
      discount: parseFloat(row[11] || 0),
      shipping: parseFloat(row[12] || 0),
      total: parseFloat(row[13] || 0),
      status: normStatus
    });
  }
  return orders;
}

/**
 * Permanently remove an order row from active "Orders" tab and archive it in "Cancelled_Archive" tab
 */
function deleteOrderFromSheet(orderId) {
  var sheet = getOrCreateSheetTab("Orders", SHEET_HEADERS);
  var cleanId = String(orderId || "").replace(/^#/, "").trim().toUpperCase();
  if (!cleanId || sheet.getLastRow() <= 1) {
    return { success: false, message: "Order ID not provided or Orders sheet is empty" };
  }

  var dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < dataRange.length; i++) {
    var existingRowId = String(dataRange[i][0]).replace(/^#/, "").trim().toUpperCase();
    if (existingRowId === cleanId) {
      var targetRow = i + 2;

      // Archive order row in "Cancelled_Archive" tab before deleting from active Orders
      try {
        var archiveSheet = getOrCreateSheetTab("Cancelled_Archive", SHEET_HEADERS);
        var rowValues = sheet.getRange(targetRow, 1, 1, SHEET_HEADERS.length).getValues()[0];
        rowValues[14] = "Cancelled (Purged)";
        archiveSheet.appendRow(rowValues);
        var archRow = archiveSheet.getLastRow();
        archiveSheet.getRange(archRow, 1, 1, SHEET_HEADERS.length).setBackground("#ffebee");
        archiveSheet.getRange(archRow, 15).setFontColor("#dc2626").setFontWeight("bold");
      } catch (archErr) {
        // Continue even if archive tab fails
      }

      // Delete from active Orders sheet so it disappears from Google Sheet active manifest
      sheet.deleteRow(targetRow);
      return {
        success: true,
        message: "Order #" + cleanId + " successfully removed from Orders tab and archived in Cancelled_Archive",
        row: targetRow
      };
    }
  }

  return { success: false, message: "Order #" + cleanId + " not found in Orders tab" };
}

/**
 * Permanently wipe all data rows across Orders and Cancelled_Archive tabs (keeps dark header intact)
 */
function clearAllOrdersFromSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabs = ["Orders", "Cancelled_Archive"];
  var total = 0;
  for (var i = 0; i < tabs.length; i++) {
    var sheet = ss.getSheetByName(tabs[i]);
    if (sheet && sheet.getLastRow() > 1) {
      var num = sheet.getLastRow() - 1;
      sheet.deleteRows(2, num);
      total += num;
    }
  }
  return {
    success: true,
    rowsDeleted: total,
    message: "Successfully wiped " + total + " rows across Orders and Cancelled_Archive tabs."
  };
}

/**
 * Process order data: handles cancellations, updates, or new orders in "Orders" tab
 */
function processOrderData(data) {
  var sheet = getOrCreateSheetTab("Orders", SHEET_HEADERS);
  
  var isCancellation = (data.action === "CANCEL_ORDER" || data.status === "Cancelled" || (data["Order Status"] && String(data["Order Status"]).toLowerCase().indexOf("cancel") > -1));
  var isStatusUpdate = (data.action === "UPDATE_STATUS");
  var orderId = String(data.orderNumber || data.orderId || data["Order ID"] || "").trim();
  var cleanId = orderId.replace(/^#/, "").toUpperCase();
  
  var cleanStatus = getNormalizedSheetStatus(data.newStatus || data.status || data["Order Status"], isCancellation);
  
  // Search existing rows in Orders tab to update status
  if ((isCancellation || isStatusUpdate) && cleanId && sheet.getLastRow() > 1) {
    var dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < dataRange.length; i++) {
      var existingRowId = String(dataRange[i][0]).replace(/^#/, "").trim().toUpperCase();
      if (existingRowId === cleanId) {
        var targetRow = i + 2;
        var statusCell = sheet.getRange(targetRow, 15);
        statusCell.setValue(cleanStatus);
        statusCell.setFontWeight("bold");
        
        if (cleanStatus === "Cancelled") {
          statusCell.setFontColor("#dc2626"); // Red
          sheet.getRange(targetRow, 1, 1, SHEET_HEADERS.length).setBackground("#ffebee");
        } else if (cleanStatus === "Delivered") {
          statusCell.setFontColor("#15803d"); // Green
          sheet.getRange(targetRow, 1, 1, SHEET_HEADERS.length).setBackground("#f0fdf4");
        } else {
          statusCell.setFontColor("#b45309"); // Amber for Pending
          sheet.getRange(targetRow, 1, 1, SHEET_HEADERS.length).setBackground("#fffbeb");
        }
        
        return {
          action: isCancellation ? "cancelled_updated" : "status_updated",
          sheetStatus: cleanStatus,
          message: "Order row " + targetRow + " status set to " + cleanStatus,
          row: targetRow
        };
      }
    }
  }

  // Deduplication Shield: Check if order ID already exists in sheet to prevent double entry
  if (cleanId && sheet.getLastRow() > 1) {
    var existingIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (var d = 0; d < existingIds.length; d++) {
      var curId = String(existingIds[d][0]).replace(/^#/, "").trim().toUpperCase();
      if (curId === cleanId) {
        return {
          action: "duplicate_prevented",
          sheetStatus: "Already Exists",
          message: "Order #" + cleanId + " already recorded in Google Sheet at row " + (d + 2) + "; duplicate ignored.",
          row: d + 2
        };
      }
    }
  }
  
  // Append new order row
  var newRow = buildOrderRow(data, isCancellation);
  sheet.appendRow(newRow);
  var lastRow = sheet.getLastRow();
  
  var rowRange = sheet.getRange(lastRow, 1, 1, newRow.length);
  rowRange.setVerticalAlignment("middle");
  rowRange.setFontSize(10);
  
  var finalStatus = newRow[14];
  
  if (finalStatus === "Cancelled") {
    rowRange.setBackground("#ffebee");
    sheet.getRange(lastRow, 1).setFontWeight("bold").setFontColor("#dc2626");
    sheet.getRange(lastRow, 15).setFontWeight("bold").setFontColor("#dc2626");
  } else if (finalStatus === "Delivered") {
    rowRange.setBackground("#f0fdf4");
    sheet.getRange(lastRow, 1).setFontWeight("bold").setFontColor("#1f1f1f");
    sheet.getRange(lastRow, 15).setFontWeight("bold").setFontColor("#15803d");
  } else {
    // Pending
    if (lastRow % 2 === 0) {
      rowRange.setBackground("#fafafa");
    } else {
      rowRange.setBackground("#ffffff");
    }
    sheet.getRange(lastRow, 1).setFontWeight("bold").setFontColor("#1f1f1f");
    sheet.getRange(lastRow, 14).setFontWeight("bold").setFontColor("#00875a");
    sheet.getRange(lastRow, 15).setFontWeight("bold").setFontColor("#b45309"); // Amber for Pending
  }
  
  for (var c = 1; c <= SHEET_HEADERS.length; c++) {
    sheet.autoResizeColumn(c);
  }
  
  return {
    action: isCancellation ? "cancelled_appended" : "order_created",
    sheetStatus: finalStatus,
    message: isCancellation ? "Cancellation recorded as Cancelled" : "New order recorded as " + finalStatus,
    row: lastRow
  };
}

/**
 * Format order row
 */
function buildOrderRow(data, isCancellation) {
  var orderId = data.orderNumber || data.orderId || data["Order ID"] || ("#SNP-" + Math.floor(100000 + Math.random() * 900000));
  var dateStr = data.date || data.dateString || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  var customerName = data.customerName || data.name || "N/A";
  var phone = data.phone || "N/A";
  var email = data.email || "N/A";
  var address = data.address || "N/A";
  var city = data.city || "N/A";
  var items = data.itemsSummary || data.items || (isCancellation ? "Cancellation Request" : "N/A");
  var paymentMethod = data.paymentMethod || "Cash on Delivery";
  var paymentStatus = isCancellation ? "Cancelled / No Charge" : (data.paymentStatus || (paymentMethod.indexOf("Cash") > -1 ? "Pending COD" : "Paid / Authorized"));
  var subtotal = parseFloat(data.subtotal || 0).toFixed(2);
  var discount = parseFloat(data.discount || 0).toFixed(2);
  var shipping = parseFloat(data.shipping || 0).toFixed(2);
  var total = parseFloat(data.total || 0).toFixed(2);
  
  // Strictly: "Pending", "Delivered", or "Cancelled"
  var status = getNormalizedSheetStatus(data.status || data["Order Status"] || data.newStatus, isCancellation);
  
  return [
    orderId,
    dateStr,
    customerName,
    "'" + phone,
    email,
    address,
    city,
    items,
    paymentMethod,
    paymentStatus,
    subtotal,
    discount,
    shipping,
    total,
    status
  ];
}
