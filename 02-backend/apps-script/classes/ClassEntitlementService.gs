/**
 * ClassEntitlementService: Authoritative prepaid package entitlement reservation,
 * eligibility checks, and concurrency safety for Class Scheduling.
 */

var _entPkgRepo = typeof Packages_getByStudentId === 'function' ? { Packages_getByStudentId: Packages_getByStudentId, Packages_getById: Packages_getById } : (typeof require !== 'undefined' ? require('../packages/PackageRepository.gs') : null);

function isPackageEligible(pkg, refDate) {
  if (!pkg) return false;
  var stat = String(pkg.status || pkg.package_status || 'ACTIVE').trim().toUpperCase();
  if (stat === 'CANCELLED' || stat === 'CLOSED' || stat === 'EXPIRED' || stat === 'EXHAUSTED') return false;
  if (pkg.is_expired === true || pkg.isExpired === true) return false;
  return true;
}

function calculatePendingReservations(allSessions, studentId) {
  var reserved = 0;
  for (var i = 0; i < allSessions.length; i++) {
    var s = allSessions[i];
    if (!s || s.student_id !== studentId) continue;
    var stat = String(s.session_status || s.status || '').trim().toUpperCase();
    var aStat = String(s.attendance_status || '').trim().toUpperCase();
    var rawDeduct = s.deduct_class;
    var isDeducted = rawDeduct === true || rawDeduct === 'TRUE' || rawDeduct === 'true' || rawDeduct === 1;

    if (stat === 'CANCELLED' || aStat === 'CANCELLED') continue;
    if (stat === 'COMPLETED' || aStat === 'PRESENT' || aStat === 'ATTENDED') continue;
    if (isDeducted || s.class_credit_effect === 'CONSUME') continue;
    if (stat === 'SCHEDULED' || aStat === 'NOT_MARKED') reserved++;
  }
  return reserved;
}

function calculateChronologicalBalances(studentPkgs, allSessions, studentId, refDate) {
  var sortedPkgs = studentPkgs.slice().sort(function(a, b) {
    var da = String(a.start_date || a.package_id || '');
    var db = String(b.start_date || b.package_id || '');
    if (da !== db) return da < db ? -1 : 1;
    var ra = Number(a._rowIndex || a.rowIndex || 0);
    var rb = Number(b._rowIndex || b.rowIndex || 0);
    return ra - rb;
  });

  var totalConsumed = 0;
  for (var i = 0; i < allSessions.length; i++) {
    var s = allSessions[i];
    if (!s || s.student_id !== studentId) continue;
    var stat = String(s.session_status || s.status || '').toUpperCase();
    var aStat = String(s.attendance_status || '').toUpperCase();
    var rawDeduct = s.deduct_class;
    var isDeducted = rawDeduct === true || rawDeduct === 'TRUE' || rawDeduct === 'true' || rawDeduct === 1;
    var notDeducted = rawDeduct === false || rawDeduct === 'FALSE' || rawDeduct === 'false' || rawDeduct === 0;
    if (stat === 'CANCELLED' || aStat === 'CANCELLED') {
      if (isDeducted) totalConsumed++;
      continue;
    }
    if (notDeducted) continue;
    if (stat === 'COMPLETED' || aStat === 'PRESENT' || aStat === 'ATTENDED' || isDeducted || s.class_credit_effect === 'CONSUME') {
      totalConsumed++;
    }
  }

  var remainingToDeduct = totalConsumed;
  var balances = {}, totalEligibleRemaining = 0, hasActivePackage = false;

  for (var k = 0; k < sortedPkgs.length; k++) {
    var p = sortedPkgs[k];
    var purch = Number(p.classes_purchased !== undefined ? p.classes_purchased : p.purchased_classes) || 0;
    var allocated = Math.min(remainingToDeduct, purch);
    remainingToDeduct = Math.max(0, remainingToDeduct - allocated);
    var rem = Math.max(0, purch - allocated);
    var eligible = isPackageEligible(p, refDate);
    if (eligible) hasActivePackage = true;
    var bKey = (p._rowIndex !== undefined && p._rowIndex !== null) ? ('row_' + p._rowIndex) : (p.package_id || ('pkg_' + k));
    balances[bKey] = { package: p, purchased: purch, allocated: allocated, remaining: rem, eligible: eligible };
  }

  for (var key in balances) {
    if (balances[key].eligible) {
      totalEligibleRemaining += balances[key].remaining;
    }
  }
  return { totalConsumed: totalConsumed, totalRemaining: totalEligibleRemaining, balances: balances, hasActivePackage: hasActivePackage };
}

function checkBookingEntitlement(spreadsheet, studentId, targetPkgId, allSessions, classDate) {
  if (!allSessions) {
    var clsRepo = typeof Classes_getAll === 'function' ? { Classes_getAll: Classes_getAll } : (typeof require !== 'undefined' ? require('./ClassRepository.gs') : null);
    allSessions = (clsRepo && clsRepo.Classes_getAll) ? clsRepo.Classes_getAll(spreadsheet) : [];
  }
  var pkgRepo = _entPkgRepo || (typeof Packages_getByStudentId === 'function' ? { Packages_getByStudentId: Packages_getByStudentId, Packages_getById: Packages_getById } : null);
  var rawPkgs = (pkgRepo && pkgRepo.Packages_getByStudentId) ? pkgRepo.Packages_getByStudentId(spreadsheet, studentId) : [];
  var mem = (typeof globalThis !== 'undefined' && globalThis.__pkgMemoryMap) ? globalThis.__pkgMemoryMap : null;
  var studentPkgs = rawPkgs.map(function(p) {
    if (!mem) return p;
    for (var k in mem) {
      var m = mem[k];
      if (!m || m.student_id !== studentId) continue;
      var sameId = (p.package_id && m.package_id && p.package_id === m.package_id);
      var sameRow = (p._rowIndex && m._rowIndex && p._rowIndex === m._rowIndex);
      var sameDate = (p.start_date && m.start_date && p.start_date === m.start_date);
      var samePlan = (!p.plan_type || !m.plan_type || String(p.plan_type).trim().toUpperCase() === String(m.plan_type).trim().toUpperCase());
      if (sameId || sameRow || (sameDate && samePlan)) {
        return Object.assign({}, p, { status: m.status || m.package_status || p.status, package_status: m.package_status || m.status || p.package_status });
      }
    }
    return p;
  });

  var isPerClass = studentPkgs.length > 0 && studentPkgs.every(function(p) { return /per[\s_-]?class/i.test(String(p.plan_type || '')); });
  if (isPerClass) return { valid: true, hasEntitlement: true, isPerClass: true };

  var refDate = classDate || new Date().toISOString().slice(0, 10);
  var chrono = calculateChronologicalBalances(studentPkgs, allSessions, studentId, refDate);

  if (studentPkgs.length > 0 && !chrono.hasActivePackage) {
    return { success: false, valid: false, hasEntitlement: false, code: 'INSUFFICIENT_PACKAGE_CREDITS', message: 'Student has no active or eligible packages with available credits', available: 0, availableCredits: 0 };
  }

  var reserved = calculatePendingReservations(allSessions, studentId);
  var available = chrono.totalRemaining - reserved;

  if (available <= 0 && studentPkgs.length > 0) {
    return {
      success: false, valid: false, hasEntitlement: false, code: 'INSUFFICIENT_PACKAGE_CREDITS',
      message: 'Insufficient package credits: Student has ' + available + ' available entitlements (' +
        chrono.totalRemaining + ' remaining, ' + chrono.totalConsumed + ' consumed, ' + reserved + ' reserved)',
      available: available, availableCredits: available, consumed: chrono.totalConsumed, reserved: reserved
    };
  }

  return { valid: true, hasEntitlement: true, available: available, availableCredits: available, consumed: chrono.totalConsumed, reserved: reserved };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isPackageEligible: isPackageEligible,
    calculatePendingReservations: calculatePendingReservations,
    calculateChronologicalBalances: calculateChronologicalBalances,
    checkBookingEntitlement: checkBookingEntitlement
  };
}
