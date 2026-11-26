/**
 * RenewalService: Coordinates student renewals, cumulative credit accounting,
 * safe session transition, payment recording, and student reactivation.
 */

var _renVal = typeof validateRenewalInput === 'function' ? { validateRenewalInput: validateRenewalInput, validateRenewalActor: validateRenewalActor } : (typeof require !== 'undefined' ? require('./RenewalValidation.gs') : null);
var _renStuRepo = typeof Students_getById === 'function' ? { Students_getById: Students_getById } : (typeof require !== 'undefined' ? require('../students/StudentRepository.gs') : null);
var _renStuSvc = typeof Students_update === 'function' ? { Students_update: Students_update } : (typeof require !== 'undefined' ? require('../students/StudentService.gs') : null);
function _getRenPkgRepo() {
  if (typeof require !== 'undefined') {
    try { return require('./PackageRepository.gs'); } catch (e) {}
  }
  return {
    Packages_getById: typeof Packages_getById === 'function' ? Packages_getById : null,
    Packages_getByStudentId: typeof Packages_getByStudentId === 'function' ? Packages_getByStudentId : null,
    Packages_insert: typeof Packages_insert === 'function' ? Packages_insert : null,
    Packages_update: typeof Packages_update === 'function' ? Packages_update : null
  };
}
var _renPkgSvc = typeof Packages_enrichWithBalance === 'function' ? { Packages_enrichWithBalance: Packages_enrichWithBalance, _calcPkgDates: _calcPkgDates, _formatScheduleString: _formatScheduleString, _parseScheduleString: _parseScheduleString } : (typeof require !== 'undefined' ? require('./PackageService.gs') : null);
var _renClsRepo = typeof Classes_getAll === 'function' ? { Classes_getAll: Classes_getAll } : (typeof require !== 'undefined' ? require('../classes/ClassRepository.gs') : null);
var _renPaySvc = typeof Payments_record === 'function' ? { Payments_record: Payments_record } : (typeof require !== 'undefined' ? require('../payments/PaymentService.gs') : null);
var _renSchedSvc = typeof Schedules_save === 'function' ? { Schedules_save: Schedules_save } : (typeof require !== 'undefined' ? require('../classes/ClassScheduleService.gs') : null);
var _renLock = typeof withLock === 'function' ? { withLock: withLock } : (typeof require !== 'undefined' ? require('../sheets/LockManager.gs') : null);
var _renTrans = typeof _cancelFutureSessionsOnRenewal === 'function' ? { _countConsumedCredits: _countConsumedCredits, _cancelFutureSessionsOnRenewal: _cancelFutureSessionsOnRenewal, _planRenewalSlots: _planRenewalSlots, _generateNewRenewalSessions: _generateNewRenewalSessions } : (typeof require !== 'undefined' ? require('./RenewalSessionTransition.gs') : null);
var _renIdemp = typeof _checkRenewalIdempotency === 'function' ? { _checkRenewalIdempotency: _checkRenewalIdempotency, _recordRenewalInitiated: _recordRenewalInitiated, _saveRenewalIdempotency: _saveRenewalIdempotency } : (typeof require !== 'undefined' ? require('./RenewalIdempotency.gs') : null);

var PACKAGE_12_COLUMNS = [
  'student_id',
  'student_name',
  'plan_type',
  'currency',
  'package_price',
  'per_class',
  'classes_purchased',
  'start_date',
  'end_date',
  'next_due_date',
  'class_duration',
  'class_schedule'
];

function _isPackageSnapshotComplete(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  for (var i = 0; i < PACKAGE_12_COLUMNS.length; i++) {
    var col = PACKAGE_12_COLUMNS[i];
    if (!(col in snapshot)) return false;
    if (snapshot[col] === undefined || snapshot[col] === null) return false;
  }
  return true;
}

function _isBlankVal(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

function _matchStudentId(a, b) {
  if (_isBlankVal(a) || _isBlankVal(b)) return false;
  return String(a).trim() === String(b).trim();
}

function _matchStringField(a, b) {
  var aBlank = _isBlankVal(a);
  var bBlank = _isBlankVal(b);
  if (aBlank && bBlank) return true;
  if (aBlank !== bBlank) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function _matchCurrencyField(a, b) {
  var aBlank = _isBlankVal(a);
  var bBlank = _isBlankVal(b);
  if (aBlank && bBlank) return true;
  if (aBlank !== bBlank) return false;
  return String(a).trim().toUpperCase() === String(b).trim().toUpperCase();
}

function _matchNumericField(a, b) {
  var aBlank = _isBlankVal(a);
  var bBlank = _isBlankVal(b);
  if (aBlank && bBlank) return true;
  if (aBlank !== bBlank) return false;
  return Number(a) === Number(b);
}

function _normDate(v) {
  if (_isBlankVal(v)) return '';
  if (v instanceof Date) {
    var yr = v.getFullYear();
    var mo = String(v.getMonth() + 1).padStart(2, '0');
    var da = String(v.getDate()).padStart(2, '0');
    return yr + '-' + mo + '-' + da;
  }
  return String(v).trim().slice(0, 10);
}

function _matchDateField(a, b) {
  return _normDate(a) === _normDate(b);
}

function _normalizeScheduleKeyForMatch(str) {
  if (_isBlankVal(str)) return '';
  var s = String(str).trim();
  if (!s) return '';
  if (typeof _renPkgSvc !== 'undefined' && _renPkgSvc && _renPkgSvc._parseScheduleString) {
    try {
      var parsed = _renPkgSvc._parseScheduleString(s);
      if (parsed && parsed.length > 0) {
        return parsed.map(function(p) {
          return String(p.day_of_week || '').toUpperCase() + '@' + String(p.start_time || '').slice(0, 5);
        }).sort().join('|');
      }
    } catch (e) {}
  }
  return s.toUpperCase().replace(/\s+/g, '');
}

function _matchScheduleField(a, b) {
  return _normalizeScheduleKeyForMatch(a) === _normalizeScheduleKeyForMatch(b);
}

function _matchColumn(col, a, b) {
  if (col === 'student_id') return _matchStudentId(a, b);
  if (col === 'currency') return _matchCurrencyField(a, b);
  if (col === 'package_price' || col === 'per_class' || col === 'classes_purchased' || col === 'class_duration') {
    return _matchNumericField(a, b);
  }
  if (col === 'start_date' || col === 'end_date' || col === 'next_due_date') {
    return _matchDateField(a, b);
  }
  if (col === 'class_schedule') {
    return _matchScheduleField(a, b);
  }
  return _matchStringField(a, b);
}

function _isPotentialCandidateRow(cand, expected) {
  if (!cand || !expected) return false;
  if (!_matchStudentId(cand.student_id, expected.student_id)) return false;

  var actCls = cand.classes_purchased !== undefined ? cand.classes_purchased : cand.purchased_classes;
  var expCls = expected.classes_purchased !== undefined ? expected.classes_purchased : expected.new_classes;
  if (actCls !== undefined && actCls !== null && expCls !== undefined && expCls !== null) {
    if (Number(actCls) !== Number(expCls)) return false;
  }

  for (var i = 0; i < PACKAGE_12_COLUMNS.length; i++) {
    var col = PACKAGE_12_COLUMNS[i];
    var cVal = cand[col];
    if (col === 'classes_purchased' && cVal === undefined && cand.purchased_classes !== undefined) {
      cVal = cand.purchased_classes;
    }
    if (cVal !== undefined && cVal !== null) {
      var eVal = expected[col];
      if (col === 'classes_purchased' && eVal === undefined && expected.new_classes !== undefined) {
        eVal = expected.new_classes;
      }
      if (!_matchColumn(col, cVal, eVal)) {
        return false;
      }
    }
  }
  return true;
}

function _matchPackage12Columns(actual, expected) {
  if (!actual || !expected) return false;
  if (!_isPackageSnapshotComplete(actual) || !_isPackageSnapshotComplete(expected)) {
    return false;
  }

  for (var i = 0; i < PACKAGE_12_COLUMNS.length; i++) {
    var col = PACKAGE_12_COLUMNS[i];
    var actVal = actual[col];
    if (col === 'classes_purchased' && actVal === undefined && actual.purchased_classes !== undefined) {
      actVal = actual.purchased_classes;
    }
    var expVal = expected[col];
    if (col === 'classes_purchased' && expVal === undefined && expected.new_classes !== undefined) {
      expVal = expected.new_classes;
    }
    if (!_matchColumn(col, actVal, expVal)) return false;
  }

  return true;
}

function Packages_renew(spreadsheet, data, actor) {
  var authCheck = _renVal.validateRenewalActor(actor);
  if (!authCheck.valid) return { success: false, code: authCheck.code, message: authCheck.message };
  var v = _renVal.validateRenewalInput(data);
  if (!v.valid) return { success: false, code: 'VALIDATION_ERROR', message: 'Validation failed', details: v.errors };

  var studentId = String(data.student_id || data.studentId).trim();
  var idempKey = String(data.idempotency_key || data.idempotencyKey).trim();
  if (_renIdemp) {
    var pre = _renIdemp._checkRenewalIdempotency(spreadsheet, idempKey, data);
    if (pre && pre.mismatch) return { success: false, code: pre.code, message: pre.message };
    if (pre && pre.completed) return { success: true, data: pre.data, meta: { idempotentRetry: true } };
  }

  if (!_renLock || typeof _renLock.withLock !== 'function') return { success: false, code: 'LOCK_UNAVAILABLE', message: 'Concurrency lock manager is unavailable' };
  var lockRes = _renLock.withLock(15000, function() {
    var renPkgRepo = _getRenPkgRepo();
    var student = _renStuRepo.Students_getById(spreadsheet, studentId);
    if (!student) return { success: false, code: 'RECORD_NOT_FOUND', message: 'Student not found: ' + studentId };
    var studentName = student.student_name || student.full_name || '';

    var allSessions = _renClsRepo.Classes_getAll(spreadsheet) || [];
    var consumedCredits = _renTrans._countConsumedCredits(allSessions, studentId);
    var existingPkgs = renPkgRepo.Packages_getByStudentId(spreadsheet, studentId) || [];
    var exPkg = existingPkgs.length > 0 ? existingPkgs[0] : null, origOldSchedule = exPkg ? exPkg.class_schedule : '';

    var prevPurchased = 0;
    for (var ep = 0; ep < existingPkgs.length; ep++) {
      prevPurchased += Number(existingPkgs[ep].classes_purchased || existingPkgs[ep].purchased_classes || 0);
    }
    var newPurchased = Number(data.new_classes_purchased);
    var cumulativePurchased = prevPurchased + newPurchased;
    var sDate = data.start_date || (exPkg ? exPkg.start_date : ''), createdSessionIds = null;
    var targetSlots = (data.schedules && data.schedules.length > 0) ? _renTrans._planRenewalSlots(allSessions, studentId, data.schedules, sDate, newPurchased) : [];

    var pkgSheet = spreadsheet && spreadsheet.getSheetByName ? spreadsheet.getSheetByName('Packages') : null;
    var preInsertLastRow = pkgSheet && typeof pkgSheet.getLastRow === 'function' ? pkgSheet.getLastRow() : 0;

    var cur = String(data.currency || (exPkg ? exPkg.currency : 'INR')).trim().toUpperCase();
    var price = data.package_price !== undefined && data.package_price !== '' ? Number(data.package_price) : (exPkg ? Number(exPkg.package_price || 0) : 0);
    var perClass = data.per_class !== undefined && data.per_class !== '' ? Number(data.per_class) : (exPkg ? Number(exPkg.per_class || 0) : 0);
    var dur = data.class_duration !== undefined && data.class_duration !== '' ? Number(data.class_duration) : (exPkg && exPkg.class_duration !== undefined && exPkg.class_duration !== '' ? Number(exPkg.class_duration) : 0);
    var pType = data.plan_type || (exPkg ? exPkg.plan_type : 'Per Class'), eDate = data.end_date || (exPkg ? exPkg.end_date : ''), nDueDate = data.next_due_date || (exPkg ? exPkg.next_due_date : '');

    var schedStr = data.class_schedule || ((data.schedules && data.schedules.length > 0) ? _renPkgSvc._formatScheduleString(data.schedules) : (exPkg ? exPkg.class_schedule || '' : ''));
    if ((!eDate || !nDueDate) && sDate && data.schedules && data.schedules.length > 0) {
      var calculated = _renPkgSvc._calcPkgDates(sDate, data.schedules.map(function(s) { return s.day_of_week; }), newPurchased);
      if (calculated) { if (!eDate) eDate = calculated.endDate; if (!nDueDate) nDueDate = calculated.nextDueDate; }
    }

    var expectedSnapshot = {
      student_id: studentId,
      student_name: studentName,
      plan_type: pType,
      currency: cur,
      package_price: price,
      per_class: perClass,
      classes_purchased: newPurchased,
      start_date: sDate,
      end_date: eDate,
      next_due_date: nDueDate,
      class_duration: dur,
      class_schedule: schedStr
    };

    var alreadyInserted = false;
    var pkgRecord = null;
    if (_renIdemp) {
      var lockCheck = _renIdemp._checkRenewalIdempotency(spreadsheet, idempKey, data);
      if (lockCheck && lockCheck.mismatch) return { success: false, code: lockCheck.code, message: lockCheck.message };
      if (lockCheck && lockCheck.completed) return lockCheck.data;
      if (lockCheck && lockCheck.inProgress && lockCheck.targetCumulative) {
        cumulativePurchased = lockCheck.targetCumulative;
        if (lockCheck.initialPurchased !== undefined) {
          prevPurchased = lockCheck.initialPurchased;
        }
        if (lockCheck.planType !== undefined && lockCheck.planType) pType = String(lockCheck.planType).trim();
        if (lockCheck.packagePrice !== undefined && lockCheck.packagePrice !== null) price = Number(lockCheck.packagePrice);
        if (lockCheck.currency !== undefined && lockCheck.currency) cur = String(lockCheck.currency).trim().toUpperCase();
        var currentLastRow = pkgSheet && typeof pkgSheet.getLastRow === 'function' ? pkgSheet.getLastRow() : 0;
        var persistedRowIndex = lockCheck.insertedRowIndex ? Number(lockCheck.insertedRowIndex) : null;

        if (persistedRowIndex) {
          var recoverySnapshot = lockCheck.expectedPackage;
          if (!recoverySnapshot || !_isPackageSnapshotComplete(recoverySnapshot)) {
            return {
              success: false,
              code: 'AMBIGUOUS_RENEWAL_RECOVERY',
              message: 'Renewal intent snapshot is incomplete or missing physical columns. Under the physical four-table schema without physical package IDs, recovery cannot establish row identity without a complete 12-column intent snapshot.'
            };
          }
          expectedSnapshot = recoverySnapshot;
        }

        var reqDateStr = sDate ? String(sDate).slice(0, 10) : '';
        var matchingCandidates = existingPkgs.filter(function(cand) {
          var cPurch = Number(cand.classes_purchased || cand.purchased_classes || 0);
          var cD = cand.start_date ? String(cand.start_date).slice(0, 10) : '';
          return cand.student_id === studentId && cPurch === newPurchased && (!reqDateStr || cD === reqDateStr);
        });

        if (persistedRowIndex) {
          if (persistedRowIndex <= currentLastRow) {
            for (var ep = 0; ep < existingPkgs.length; ep++) {
              if (existingPkgs[ep]._rowIndex === persistedRowIndex) {
                var cand = existingPkgs[ep];
                if (_matchPackage12Columns(cand, expectedSnapshot)) {
                  alreadyInserted = true;
                  pkgRecord = cand;
                }
                break;
              }
            }
          }
          if (!alreadyInserted) {
            return {
              success: false,
              code: 'AMBIGUOUS_RENEWAL_RECOVERY',
              message: 'Durable row index ' + persistedRowIndex + ' no longer matches expected 12-column package snapshot (row moved, altered, or replaced).'
            };
          }

          for (var ic = 0; ic < existingPkgs.length; ic++) {
            var checkPkg = existingPkgs[ic];
            if (checkPkg._rowIndex === persistedRowIndex) continue;
            var isPot = _isPotentialCandidateRow(checkPkg, expectedSnapshot);
            var isComp = _isPackageSnapshotComplete(checkPkg);
            if (isPot && !isComp) {
              return {
                success: false,
                code: 'AMBIGUOUS_RENEWAL_RECOVERY',
                message: 'Candidate package row at index ' + (checkPkg._rowIndex || ic) + ' is incomplete or missing physical columns. Under the physical four-table schema, incomplete candidate rows cannot be ruled out as non-matches, preventing unambiguous identity proof.'
              };
            }
          }

          var otherMatchingCandidate = existingPkgs.find(function(p) {
            if (p._rowIndex === persistedRowIndex) return false;
            return _matchPackage12Columns(p, expectedSnapshot);
          });
          if (otherMatchingCandidate) {
            return {
              success: false,
              code: 'AMBIGUOUS_RENEWAL_RECOVERY',
              message: 'Expected package snapshot found at multiple rows or moved to a different row (row ' + otherMatchingCandidate._rowIndex + '). Under the physical four-table schema without physical package IDs, row-index persistence cannot guarantee package identity against row movement, reordering, or replacement.'
            };
          }

          var hasTwinInSheet = false;
          for (var t1 = 0; t1 < existingPkgs.length; t1++) {
            for (var t2 = t1 + 1; t2 < existingPkgs.length; t2++) {
              if (_matchPackage12Columns(existingPkgs[t1], existingPkgs[t2])) {
                hasTwinInSheet = true;
                break;
              }
            }
            if (hasTwinInSheet) break;
          }
          if (hasTwinInSheet) {
            return {
              success: false,
              code: 'AMBIGUOUS_RENEWAL_RECOVERY',
              message: 'Multiple packages with identical 12-column attributes exist for student ' + studentId + '. Under the physical four-table schema without physical package IDs, row-index persistence cannot guarantee package identity against row movement, reordering, or replacement.'
            };
          }

          if (matchingCandidates.length > 1) {
            return {
              success: false,
              code: 'AMBIGUOUS_RENEWAL_RECOVERY',
              message: 'Multiple packages with identical attributes exist for student ' + studentId + '. Under the physical four-table schema without physical package IDs, row-index persistence cannot guarantee package identity against row movement, reordering, or replacement.'
            };
          }
        } else {
          var updatedInPlace = existingPkgs.find(function(p) {
            return Number(p.classes_purchased) === Number(cumulativePurchased);
          });
          if (updatedInPlace && matchingCandidates.length === 0) {
            alreadyInserted = true;
            pkgRecord = updatedInPlace;
          } else {
            return {
              success: false,
              code: 'AMBIGUOUS_RENEWAL_RECOVERY',
              message: 'Renewal intent was initiated but package row index was not durably confirmed. Under the physical four-table schema, durable state cannot distinguish whether insertion was never attempted or whether the inserted row was modified, moved, or deleted. Requires manual reconciliation.'
            };
          }
        }

        if (lockCheck.oldSchedule !== undefined) origOldSchedule = lockCheck.oldSchedule;
        if (lockCheck.targetSlots && lockCheck.targetSlots.length > 0) {
          targetSlots = lockCheck.targetSlots;
        } else if (lockCheck.createdSessionIds && lockCheck.createdSessionIds.length > 0) {
          targetSlots = null;
          createdSessionIds = lockCheck.createdSessionIds;
        }
      } else {
        var intentRes = _renIdemp._recordRenewalInitiated(spreadsheet, idempKey, studentId, prevPurchased, cumulativePurchased, data, actor, targetSlots, origOldSchedule, existingPkgs.length, preInsertLastRow, expectedSnapshot);
        if (!intentRes || !intentRes.success) return intentRes || { success: false, code: 'DURABLE_INTENT_FAILED', message: 'Failed writing durable intent' };
      }
    }

    if (String(student.status || '').toUpperCase() !== 'ACTIVE') _renStuSvc.Students_update(spreadsheet, studentId, { status: 'ACTIVE' }, actor);
    var prevAvailable = Math.max(0, prevPurchased - consumedCredits), newAvailable = Math.max(0, cumulativePurchased - consumedCredits);

    if (!alreadyInserted || !pkgRecord) {
      pkgRecord = {
        student_id: studentId,
        student_name: studentName,
        plan_type: pType,
        currency: cur,
        package_price: price,
        per_class: perClass,
        classes_purchased: newPurchased,
        start_date: sDate,
        end_date: eDate,
        next_due_date: nDueDate,
        class_duration: dur,
        class_schedule: schedStr
      };
      renPkgRepo.Packages_insert(spreadsheet, pkgRecord);
      if (_renIdemp && _renIdemp._recordRenewalPackageRow && pkgRecord._rowIndex) {
        var rowStoreRes = _renIdemp._recordRenewalPackageRow(spreadsheet, idempKey, pkgRecord._rowIndex);
        if (rowStoreRes && rowStoreRes.success === false) {
          return {
            success: false,
            code: 'DURABLE_PERSIST_FAILED',
            message: 'Package row inserted at index ' + pkgRecord._rowIndex + ' but failed persisting row pointer in durable store: ' + (rowStoreRes.message || 'unknown error'),
            package_row_index: pkgRecord._rowIndex
          };
        }
      }
    }

    var paymentResult = null;
    if (data.payment && (Number(data.payment.amount) > 0 || data.payment.record_payment)) {
      var payCur = String(data.payment.currency || cur).trim().toUpperCase(), payAmt = Number(data.payment.amount) || 0;
      var inInr = (data.payment.in_inr !== undefined && data.payment.in_inr !== null && data.payment.in_inr !== '')
        ? Number(data.payment.in_inr)
        : (payCur === 'INR' ? payAmt : '');
      var payDate = data.payment.payment_date || sDate || new Date().toISOString().slice(0, 10);
      paymentResult = _renPaySvc.Payments_record(spreadsheet, {
        student_id: studentId, student_name: studentName, payment_date: payDate,
        amount: payAmt, currency: payCur, in_inr: inInr, reference_number: data.payment.reference_number || '',
        idempotency_key: idempKey + '_pay'
      }, actor);

      if (paymentResult && paymentResult.success === false) {
        try {
          if (!alreadyInserted && pkgRecord && pkgRecord._rowIndex && typeof spreadsheet.getSheetByName === 'function') {
            var pSheet = spreadsheet.getSheetByName('Packages');
            if (pSheet && typeof pSheet.deleteRow === 'function') {
              pSheet.deleteRow(pkgRecord._rowIndex);
              if (pSheet._cachedRows) delete pSheet._cachedRows;
            }
          }
          var rollbackRepo = _getRenPkgRepo();
          if (rollbackRepo && typeof rollbackRepo.Packages_update === 'function') {
            rollbackRepo.Packages_update(spreadsheet, studentId, { rollback: true });
          }
          if (String(student.status || '').toUpperCase() !== 'ACTIVE') _renStuSvc.Students_update(spreadsheet, studentId, { status: 'INACTIVE' }, actor);
        } catch (rbErr) {
          return { success: false, code: 'COMPENSATION_FAILED', message: 'Payment failed and compensating rollback failed: ' + (rbErr.message || String(rbErr)) };
        }
        return paymentResult;
      }
    }

    var sessionsCreatedCount = 0;
    if (data.schedules && Array.isArray(data.schedules) && data.schedules.length > 0) {
      _renSchedSvc.Schedules_save(spreadsheet, studentId, data.schedules, actor);
      _renTrans._cancelFutureSessionsOnRenewal(spreadsheet, allSessions, studentId, sDate, origOldSchedule, targetSlots);
      sessionsCreatedCount = _renTrans._generateNewRenewalSessions(spreadsheet, studentId, studentName, data.schedules, sDate, newPurchased, dur, eDate, createdSessionIds, targetSlots);
    }

    var resultData = {
      student_id: studentId, student_name: studentName, status: 'ACTIVE',
      previous_available_balance: prevAvailable, new_classes_purchased: newPurchased,
      new_available_balance: newAvailable, cumulative_purchased: cumulativePurchased,
      cumulative_consumed: consumedCredits,
      package: Object.assign({}, pkgRecord, {
        consumed_classes: Math.max(0, consumedCredits - prevPurchased),
        remaining_classes: newPurchased - Math.max(0, consumedCredits - prevPurchased)
      }),
      payment: paymentResult && paymentResult.success ? paymentResult.data : null,
      sessions_created: sessionsCreatedCount
    };

    if (_renIdemp) {
      var saveRes = _renIdemp._saveRenewalIdempotency(spreadsheet, idempKey, studentId, resultData, actor, data);
      if (saveRes && saveRes.success === false) return saveRes;
    }
    return resultData;
  });

  if (!lockRes.success) return { success: false, code: lockRes.code || 'CONFLICT', message: lockRes.message || 'Renewal lock acquisition failed' };
  if (lockRes.result && lockRes.result.success === false) return lockRes.result;
  return { success: true, data: lockRes.result };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Packages_renew: Packages_renew,
    _setLockManager: function(lm) { _renLock = lm; },
    _countConsumedCredits: _renTrans ? _renTrans._countConsumedCredits : null,
    _cancelFutureSessionsOnRenewal: _renTrans ? _renTrans._cancelFutureSessionsOnRenewal : null,
    _planRenewalSlots: _renTrans ? _renTrans._planRenewalSlots : null,
    _generateNewRenewalSessions: _renTrans ? _renTrans._generateNewRenewalSessions : null,
    _matchPackage12Columns: _matchPackage12Columns,
    _matchColumn: _matchColumn,
    _isPotentialCandidateRow: _isPotentialCandidateRow,
    _isPackageSnapshotComplete: _isPackageSnapshotComplete,
    PACKAGE_12_COLUMNS: PACKAGE_12_COLUMNS
  };
}
