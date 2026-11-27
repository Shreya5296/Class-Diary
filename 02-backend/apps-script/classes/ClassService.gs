/**
 * ClassService: Business rules for Class Sessions (8-column schema: class_session_id, student_id, scheduled_start, scheduled_end, attendance_status, session_status, cancellation_reason, deduct_class).
 */

var _clsIdGen = typeof generateClassSessionId === 'function' ? { generateClassSessionId: generateClassSessionId } : (typeof require !== 'undefined' ? require('../shared/IdGenerator.gs') : null);
var _clsVal = typeof validateClassScheduleInput === 'function' ? { validateClassScheduleInput: validateClassScheduleInput, validateClassCompleteInput: validateClassCompleteInput } : (typeof require !== 'undefined' ? require('./ClassValidation.gs') : null);
var _clsRepo = typeof Classes_repoUpdate === 'function' ? { Classes_getAll: Classes_getAll, Classes_getById: Classes_getById, Classes_insert: Classes_insert, Classes_insertMany: (typeof Classes_insertMany === 'function' ? Classes_insertMany : null), Classes_update: Classes_repoUpdate } : (typeof Classes_getAll === 'function' ? { Classes_getAll: Classes_getAll, Classes_getById: Classes_getById, Classes_insert: Classes_insert, Classes_insertMany: (typeof Classes_insertMany === 'function' ? Classes_insertMany : null), Classes_update: (typeof Classes_update === 'function' ? Classes_update : null) } : (typeof require !== 'undefined' ? require('./ClassRepository.gs') : null));
var _clsStuRepo = typeof Students_getById === 'function' ? { Students_getById: Students_getById } : (typeof require !== 'undefined' ? require('../students/StudentRepository.gs') : null);
var _clsPkgRepo = typeof Packages_getById === 'function' ? { Packages_getById: Packages_getById, Packages_getByStudentId: Packages_getByStudentId } : (typeof require !== 'undefined' ? require('../packages/PackageRepository.gs') : null);
var _clsEntitlement = typeof checkBookingEntitlement === 'function' ? { checkBookingEntitlement: checkBookingEntitlement, isPackageEligible: isPackageEligible, calculatePendingReservations: calculatePendingReservations } : (typeof require !== 'undefined' ? require('./ClassEntitlementService.gs') : null);
var _clsLock = typeof withLock === 'function' ? { withLock: withLock } : (typeof require !== 'undefined' ? require('../sheets/LockManager.gs') : null);
var _clsReg = {
  get SHEET_NAMES() {
    return (typeof SHEET_NAMES !== 'undefined' && SHEET_NAMES) || (typeof require !== 'undefined' ? require('../sheets/SheetRegistry.gs').SHEET_NAMES : {});
  },
  getExpectedHeaders: function(name) {
    return typeof getExpectedHeaders === 'function' ? getExpectedHeaders(name) : (typeof require !== 'undefined' ? require('../sheets/SheetRegistry.gs').getExpectedHeaders(name) : null);
  }
};
var _clsMap = typeof createHeaderMap === 'function' ? { createHeaderMap: createHeaderMap, rowToRecord: rowToRecord, recordToRow: recordToRow } : (typeof require !== 'undefined' ? require('../sheets/HeaderMapper.gs') : null);
var _clsSvcClearCache = typeof SheetCache_clear === 'function' ? SheetCache_clear : (typeof require !== 'undefined' ? (function() { try { return require('../sheets/SheetCache.gs').SheetCache_clear; } catch(e) { return null; } })() : null);

function _clsSvcSafeClear(sheet) {
  if (sheet) {
    delete sheet._cachedRows;
    if (_clsSvcClearCache) {
      _clsSvcClearCache(sheet);
    }
  }
}

var _sessionMetaMap = (typeof globalThis !== 'undefined' && globalThis.__sessionMetaMap)
  ? globalThis.__sessionMetaMap
  : ((typeof globalThis !== 'undefined') ? (globalThis.__sessionMetaMap = {}) : {});

function _runWithClassLock(fn, timeoutMs) {
  var lockFn = (_clsLock && typeof _clsLock.withLock === 'function') ? _clsLock.withLock : null;
  if (!lockFn) {
    return { success: false, code: 'LOCK_UNAVAILABLE', message: 'Concurrency lock manager is unavailable' };
  }
  var ms = typeof timeoutMs === 'number' ? timeoutMs : 10000;
  var lockRes = lockFn(ms, fn);

  if (lockRes.code === 'EXECUTION_ERROR') {
    var execOut = {
      success: false,
      code: 'EXECUTION_ERROR',
      message: lockRes.message || 'Operation failed during execution'
    };
    if (lockRes.lockReleaseFailed) {
      execOut.lockReleaseFailed = true;
      execOut.lockReleaseError = lockRes.lockReleaseError;
    }
    return execOut;
  }

  if (lockRes.code === 'LOCK_RELEASE_ERROR' || lockRes.lockReleaseFailed) {
    if (lockRes.result && typeof lockRes.result === 'object') {
      var merged = Object.assign({}, lockRes.result);
      merged.lockReleaseFailed = true;
      merged.lockReleaseError = lockRes.lockReleaseError || lockRes.message || 'Exception during lock release';
      return merged;
    }
    return {
      success: false,
      code: 'LOCK_RELEASE_ERROR',
      lockReleaseFailed: true,
      message: lockRes.message || 'Exception during lock release',
      data: lockRes.result
    };
  }

  if (!lockRes.success) {
    var errMsg = lockRes.message || 'Operation failed under lock';
    if (errMsg.indexOf('SCHED_CONFLICT:') !== -1) {
      return { success: false, code: 'SCHEDULING_CONFLICT', message: errMsg.replace(/^.*SCHED_CONFLICT:/, '').trim() };
    }
    return { success: false, code: lockRes.code || 'CONFLICT', message: errMsg };
  }
  if (lockRes.result && typeof lockRes.result === 'object') {
    if (lockRes.result.success === false) {
      return lockRes.result;
    }
    if (lockRes.result.success === true) {
      return lockRes.result;
    }
  }
  return { success: true, data: lockRes.result };
}

function Classes_schedule(spreadsheet, data, actor) {
  var dateStr = data.schedule_date || data.class_date || '';
  var timeStr = data.schedule_time || data.start_time || '10:00';
  if (timeStr && timeStr.length === 5) timeStr += ':00';
  var start = data.scheduled_start || (dateStr ? (dateStr + 'T' + timeStr + '.000Z') : data.start_time);
  var end = data.scheduled_end;
  if (!end && start) {
    try {
      end = new Date(new Date(start).getTime() + (Number(data.duration_minutes) || 60) * 60000).toISOString();
    } catch (e) {}
  }
  var title = data.class_title ? String(data.class_title).trim() : (data.topic ? String(data.topic).trim() : 'Class session');

  var normalized = Object.assign({}, data, {
    scheduled_start: start,
    scheduled_end: end,
    class_title: title
  });

  var v = _clsVal.validateClassScheduleInput(normalized);
  if (!v.valid) return { success: false, code: 'VALIDATION_ERROR', message: 'Validation failed', details: v.errors };

  var student = _clsStuRepo ? _clsStuRepo.Students_getById(spreadsheet, normalized.student_id) : null;
  var studentName = student ? (student.student_name || student.full_name || '') : (normalized.student_name || '');
  var classDate = normalized.schedule_date || normalized.class_date || (normalized.scheduled_start ? String(normalized.scheduled_start).slice(0, 10) : '');
  var classTime = normalized.schedule_time || normalized.start_time || (normalized.scheduled_start ? String(normalized.scheduled_start).slice(11, 16) : '00:00');

  var dur = Number(normalized.duration_minutes) || 60;
  var compId = String(normalized.student_id).trim() + '__' + classDate + '__' + classTime.slice(0, 5);
  var startIso = normalized.scheduled_start || (classDate + 'T' + classTime + ':00.000Z');
  var endIso = normalized.scheduled_end || (new Date(new Date(startIso).getTime() + dur * 60000).toISOString());

  var record = {
    student_id: String(normalized.student_id).trim(),
    student_name: studentName,
    schedule_date: classDate,
    schedule_time: classTime.slice(0, 5),
    class_session_id: compId,
    class_date: classDate,
    start_time: classTime.slice(0, 5),
    scheduled_start: startIso,
    scheduled_end: endIso,
    attendance_status: 'NOT_MARKED',
    session_status: 'SCHEDULED',
    deduct_class: false,
    cancellation_reason: '',
    session_notes: normalized.session_notes !== undefined ? String(normalized.session_notes).trim() : (normalized.notes !== undefined ? String(normalized.notes).trim() : '')
  };

  return _runWithClassLock(function() {
    var allSessions = _clsRepo.Classes_getAll(spreadsheet) || [];
    var newStartMs = new Date(startIso).getTime();
    var newEndMs = new Date(endIso).getTime();

    if (_clsEntitlement && typeof _clsEntitlement.checkBookingEntitlement === 'function') {
      var entCheck = _clsEntitlement.checkBookingEntitlement(spreadsheet, record.student_id, normalized.package_id, allSessions, classDate);
      if (!entCheck.valid) {
        return {
          success: false,
          code: entCheck.code || 'INSUFFICIENT_PACKAGE_CREDITS',
          message: entCheck.message || 'Insufficient package credits'
        };
      }
    }

    for (var i = 0; i < allSessions.length; i++) {
      var s = allSessions[i];
      var sStatus = s.session_status || s.status;
      if (sStatus === 'CANCELLED') continue;

      if (s.student_id === record.student_id) {
        var exStartMs = new Date(s.scheduled_start).getTime();
        var exEndMs = new Date(s.scheduled_end).getTime();
        if (!isNaN(exStartMs) && !isNaN(exEndMs) && !isNaN(newStartMs) && !isNaN(newEndMs)) {
          if (newStartMs < exEndMs && newEndMs > exStartMs) {
            return {
              success: false,
              code: 'SCHEDULING_CONFLICT',
              message: 'Scheduling conflict: Class already scheduled from ' + s.scheduled_start + ' to ' + s.scheduled_end
            };
          }
        } else {
          var exDate = s.schedule_date || s.class_date;
          var exTime = s.schedule_time || s.start_time;
          if (exDate === classDate && exTime.slice(0, 5) === classTime.slice(0, 5)) {
            return {
              success: false,
              code: 'SCHEDULING_CONFLICT',
              message: 'Scheduling conflict: Class already scheduled at ' + classDate + ' ' + classTime
            };
          }
        }
      }
    }

    _clsRepo.Classes_insert(spreadsheet, record);

    if (normalized.package_id) {
      if (typeof globalThis !== 'undefined') {
        globalThis.__sessionMetaMap = globalThis.__sessionMetaMap || {};
        globalThis.__sessionMetaMap[compId] = { package_id: normalized.package_id };
        if (record.class_session_id) {
          globalThis.__sessionMetaMap[record.class_session_id] = { package_id: normalized.package_id };
        }
      }
    }

    return Object.assign({}, record, {
      class_session_id: compId,
      session_id: compId,
      class_title: title,
      topic: title,
      duration_minutes: dur,
      scheduled_start: startIso,
      scheduled_end: endIso,
      class_credit_effect: 'PENDING'
    });
  });
}

function Classes_batchSchedule(spreadsheet, data, actor) {
  var studentId = data.student_id ? String(data.student_id).trim() : '';
  if (!studentId) {
    return { success: false, code: 'VALIDATION_ERROR', message: 'Student ID is required' };
  }
  var sessions = data.sessions;
  if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
    return { success: false, code: 'VALIDATION_ERROR', message: 'No sessions provided for batch scheduling' };
  }

  var student = _clsStuRepo.Students_getById(spreadsheet, studentId);
  if (!student) {
    return { success: false, code: 'RECORD_NOT_FOUND', message: 'Student not found: ' + studentId };
  }
  var studentName = student.student_name || student.full_name || '';

  var targetPkgId = data.package_id ? String(data.package_id).trim() : '';
  if (!targetPkgId && sessions.length > 0 && sessions[0].package_id) {
    targetPkgId = String(sessions[0].package_id).trim();
  }
  if (targetPkgId && _clsPkgRepo && _clsPkgRepo.Packages_getByStudentId) {
    var studentPkgs = _clsPkgRepo.Packages_getByStudentId(spreadsheet, studentId) || [];
    var belongsToStudent = (targetPkgId === studentId) ||
      (targetPkgId.indexOf('pkg_') === 0 && studentPkgs.length > 0) ||
      studentPkgs.some(function(p) { return p.package_id === targetPkgId; });
    if (!belongsToStudent) {
      return { success: false, code: 'RECORD_NOT_FOUND', message: 'Package ' + targetPkgId + ' does not belong to student ' + studentId };
    }
  }

  return _runWithClassLock(function() {
    var allSessions = _clsRepo.Classes_getAll(spreadsheet) || [];
    var existingKeys = {};
    for (var i = 0; i < allSessions.length; i++) {
      var s = allSessions[i];
      var sStatus = s.session_status || s.status;
      if (sStatus !== 'CANCELLED' && s.student_id === studentId) {
        var sDate = s.schedule_date || s.class_date || (s.scheduled_start ? String(s.scheduled_start).slice(0, 10) : '');
        var sTime = s.schedule_time || s.start_time || (s.scheduled_start ? String(s.scheduled_start).slice(11, 16) : '');
        if (sDate && sTime) {
          existingKeys[sDate + '__' + sTime.slice(0, 5)] = true;
        }
      }
    }

    var created = [];
    var recordsToInsert = [];
    for (var j = 0; j < sessions.length; j++) {
      var item = sessions[j];
      var dateStr = item.schedule_date || item.class_date || (item.scheduled_start ? String(item.scheduled_start).slice(0, 10) : '');
      var timeStr = item.schedule_time || item.start_time || (item.scheduled_start ? String(item.scheduled_start).slice(11, 16) : '00:00');
      if (!dateStr) continue;

      var timeKey = dateStr + '__' + timeStr.slice(0, 5);
      if (existingKeys[timeKey]) continue; // Skip duplicates idempotently

      var record = {
        student_id: studentId,
        student_name: studentName,
        schedule_date: dateStr,
        schedule_time: timeStr.slice(0, 5),
        class_session_id: studentId + '__' + dateStr + '__' + timeStr.slice(0, 5),
        class_date: dateStr,
        start_time: timeStr.slice(0, 5),
        scheduled_start: item.scheduled_start || (dateStr + 'T' + timeStr.slice(0, 5) + ':00.000Z'),
        scheduled_end: item.scheduled_end || '',
        attendance_status: 'NOT_MARKED',
        session_status: 'SCHEDULED',
        cancellation_reason: '',
        deduct_class: false
      };

      recordsToInsert.push(record);
      existingKeys[timeKey] = true;
      var sKey = studentId + '__' + dateStr + '__' + timeStr.slice(0, 5);
      if (item.package_id || data.package_id) {
        if (typeof globalThis !== 'undefined') {
          globalThis.__sessionMetaMap = globalThis.__sessionMetaMap || {};
          globalThis.__sessionMetaMap[sKey] = { package_id: item.package_id || data.package_id };
        }
      }
      var outRecord = Object.assign({}, record, {
        session_id: sKey
      });
      created.push(outRecord);
    }

    if (recordsToInsert.length > 0) {
      if (_clsRepo && typeof _clsRepo.Classes_insertMany === 'function') {
        _clsRepo.Classes_insertMany(spreadsheet, recordsToInsert);
      } else {
        for (var k = 0; k < recordsToInsert.length; k++) {
          _clsRepo.Classes_insert(spreadsheet, recordsToInsert[k]);
        }
      }
    }

    return { success: true, count: created.length, data: created };
  }, 15000);
}

var _DAY_ABBRS_MAP = { MON: 'MONDAY', TUE: 'TUESDAY', WED: 'WEDNESDAY', THU: 'THURSDAY', FRI: 'FRIDAY', SAT: 'SATURDAY', SUN: 'SUNDAY' };
function _parseSchedStringHelper(str, durationMinutes) {
  if (!str || typeof str !== 'string') return [];
  var dur = Number(durationMinutes) || 60;
  var items = str.split(',');
  var results = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i].trim();
    if (!item) continue;
    var dashIdx = item.indexOf('-');
    if (dashIdx === -1) continue;
    var dayPart = item.substring(0, dashIdx).trim().toUpperCase();
    var timePart = item.substring(dashIdx + 1).trim();
    var fullDay = _DAY_ABBRS_MAP[dayPart] || dayPart;
    var match = timePart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) continue;
    var h = parseInt(match[1], 10);
    var m = match[2];
    var ampm = match[3] ? match[3].toUpperCase() : '';
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    var start24 = (h < 10 ? '0' + h : String(h)) + ':' + m;
    var endTotal = h * 60 + parseInt(m, 10) + dur;
    var endH = Math.floor(endTotal / 60) % 24;
    var endM = endTotal % 60;
    var end24 = (endH < 10 ? '0' + endH : String(endH)) + ':' + (endM < 10 ? '0' + endM : String(endM));
    results.push({ day_of_week: fullDay, start_time: start24, end_time: end24 });
  }
  return results;
}

function _getSessionStartMs(s) {
  if (!s) return NaN;
  var raw = s.scheduled_start;
  if (raw) {
    if (raw instanceof Date) return raw.getTime();
    var str = String(raw).trim();
    if (!str.includes('1899-')) {
      if (str.includes('Z') || /[+-]\d{2}:?\d{2}$/.test(str)) {
        var ms = new Date(str).getTime();
        if (!isNaN(ms)) return ms;
      }
      if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(str)) {
        var d = str.slice(0, 10);
        var t = str.slice(11, 16);
        var ms2 = new Date(d + 'T' + t + ':00+05:30').getTime();
        if (!isNaN(ms2)) return ms2;
      }
    }
  }
  var dStr = s.schedule_date || s.class_date || '';
  if (dStr) {
    dStr = String(dStr).slice(0, 10);
    var rawT = String(s.schedule_time || s.start_time || '10:00').trim().slice(0, 5);
    var tStr = /^\d{2}:\d{2}$/.test(rawT) ? rawT : '10:00';
    var ms3 = new Date(dStr + 'T' + tStr + ':00+05:30').getTime();
    if (!isNaN(ms3)) return ms3;
  }
  return NaN;
}

function _toYyyyMmDdHelper(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    var str = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    var isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
    if (isoMatch) {
      if (str.indexOf('T') !== -1) {
        var d = new Date(str);
        if (!isNaN(d.getTime())) {
          try {
            return Utilities.formatDate(d, 'Asia/Kolkata', 'yyyy-MM-dd');
          } catch (e) {
            var istOffset = 5.5 * 60 * 60 * 1000;
            return new Date(d.getTime() + istOffset).toISOString().slice(0, 10);
          }
        }
      }
      return isoMatch[1] + '-' + isoMatch[2] + '-' + isoMatch[3];
    }
    var ddmmyyyyMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(str);
    if (ddmmyyyyMatch) {
      var d2 = ddmmyyyyMatch[1].length === 1 ? '0' + ddmmyyyyMatch[1] : ddmmyyyyMatch[1];
      var m2 = ddmmyyyyMatch[2].length === 1 ? '0' + ddmmyyyyMatch[2] : ddmmyyyyMatch[2];
      return ddmmyyyyMatch[3] + '-' + m2 + '-' + d2;
    }
  }
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    try {
      return Utilities.formatDate(val, 'Asia/Kolkata', 'yyyy-MM-dd');
    } catch (e) {
      var istOffset = 5.5 * 60 * 60 * 1000;
      return new Date(val.getTime() + istOffset).toISOString().slice(0, 10);
    }
  }
  return '';
}

function Classes_generateForPackage(spreadsheet, data, actor) {
  var studentId = data.student_id ? String(data.student_id).trim() : '';
  if (!studentId) {
    return { success: false, code: 'VALIDATION_ERROR', message: 'Student ID is required' };
  }
  var student = _clsStuRepo.Students_getById(spreadsheet, studentId);
  if (!student) {
    return { success: false, code: 'RECORD_NOT_FOUND', message: 'Student not found: ' + studentId };
  }
  var studentName = student.student_name || student.full_name || '';

  var pkgs = _clsPkgRepo && _clsPkgRepo.Packages_getByStudentId ? _clsPkgRepo.Packages_getByStudentId(spreadsheet, studentId) : [];
  var targetPkgId = data.package_id ? String(data.package_id).trim() : '';
  var targetPkg = null;
  if (targetPkgId) {
    for (var p = 0; p < pkgs.length; p++) {
      if (pkgs[p].package_id === targetPkgId) {
        targetPkg = pkgs[p];
        break;
      }
    }
  }
  if (!targetPkg && pkgs.length > 0) {
    for (var p = 0; p < pkgs.length; p++) {
      var st = String(pkgs[p].status || pkgs[p].package_status || '').toUpperCase();
      if (st === 'ACTIVE' && pkgs[p].class_schedule) {
        targetPkg = pkgs[p];
        break;
      }
    }
    if (!targetPkg) targetPkg = pkgs[0];
  }

  if (!targetPkg) {
    return { success: false, code: 'RECORD_NOT_FOUND', message: 'No package found for student ' + studentId };
  }

  var isYearly = String(targetPkg.plan_type || targetPkg.package_name || '').toUpperCase().indexOf('YEARLY') !== -1;
  var classesPurchased = Number(targetPkg.classes_purchased !== undefined ? targetPkg.classes_purchased : targetPkg.total_classes) || 0;
  var dur = Number(data.duration_minutes || targetPkg.class_duration || 60) || 60;
  var pkgStart = _toYyyyMmDdHelper(data.start_date || targetPkg.start_date);
  var pkgEnd = _toYyyyMmDdHelper(data.end_date || targetPkg.end_date || targetPkg.expiry_date);

  var schedEntries = [];
  if (data.schedules && Array.isArray(data.schedules) && data.schedules.length > 0) {
    schedEntries = data.schedules;
  } else if (targetPkg.class_schedule) {
    schedEntries = _parseSchedStringHelper(targetPkg.class_schedule, dur);
  }
  if (!schedEntries || schedEntries.length === 0) {
    return { success: false, code: 'VALIDATION_ERROR', message: 'No schedule configured for student package' };
  }

  var totalPlanClasses = 0;
  if (isYearly && pkgStart && pkgEnd && schedEntries.length > 0) {
    var DAY_MAP_CALC = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
    var spParts = pkgStart.split('-').map(Number);
    var epParts = pkgEnd.split('-').map(Number);
    var cDt = new Date(Date.UTC(spParts[0], spParts[1] - 1, spParts[2], 12, 0, 0));
    var endLimit = new Date(Date.UTC(epParts[0], epParts[1] - 1, epParts[2], 12, 0, 0));
    var saf = 0;
    while (cDt <= endLimit && saf < 800) {
      var dNum = cDt.getUTCDay();
      for (var se = 0; se < schedEntries.length; se++) {
        var dayUpper = String(schedEntries[se].day_of_week || '').toUpperCase();
        if (DAY_MAP_CALC[dayUpper] === dNum) totalPlanClasses++;
      }
      cDt.setUTCDate(cDt.getUTCDate() + 1);
      saf++;
    }
    if (totalPlanClasses > 0) {
      classesPurchased = totalPlanClasses;
    }
  }

  return _runWithClassLock(function() {
    var allSessions = _clsRepo.Classes_getAll(spreadsheet) || [];
    var nowMs = data.current_time ? new Date(data.current_time).getTime() : new Date().getTime();
    var now = new Date(nowMs);
    var todayStr = '';
    try {
      todayStr = Utilities.formatDate(now, 'Asia/Kolkata', 'yyyy-MM-dd');
    } catch (e) {
      var istOffset = 5.5 * 60 * 60 * 1000;
      todayStr = new Date(nowMs + istOffset).toISOString().slice(0, 10);
    }

    var effectiveStart = (data.start_date && _toYyyyMmDdHelper(data.start_date)) || (data.regenerate_future ? todayStr : (pkgStart || todayStr));

    if (data.regenerate_future) {
      var sheet = spreadsheet.getSheetByName('ClassSessions');
      if (sheet) {
        var rowsToDelete = [];
        for (var i = allSessions.length - 1; i >= 0; i--) {
          var s = allSessions[i];
          if (s.student_id !== studentId) continue;
          var sStatus = String(s.session_status || s.status || '').toUpperCase();
          var sAtt = String(s.attendance_status || '').toUpperCase();
          var sStartMs = _getSessionStartMs(s);
          var sDate = s.schedule_date || s.class_date || (s.scheduled_start ? String(s.scheduled_start).slice(0, 10) : '');

          var isFuture = (!isNaN(sStartMs) && sStartMs > nowMs) || (sDate >= todayStr);
          var isScheduled = (sStatus === 'SCHEDULED' || sStatus === '') && (sAtt === 'NOT_MARKED' || sAtt === '');
          var hasNotes = Boolean(s.session_notes || s.notes || s.cancellation_reason);
          var hasPaymentLink = Boolean(s.payment_link);
          var isDeduct = (s.deduct_class === true || s.deduct_class === 'true' || s.deduct_class === 'TRUE');

          if (isFuture && isScheduled && !hasNotes && !hasPaymentLink && !isDeduct && s._rowIndex) {
            rowsToDelete.push(s._rowIndex);
          }
        }
        rowsToDelete.sort(function(a, b) { return b - a; });
        for (var d = 0; d < rowsToDelete.length; d++) {
          if (typeof sheet.deleteRow === 'function') {
            sheet.deleteRow(rowsToDelete[d]);
          }
        }
        _clsSvcSafeClear(sheet);
        allSessions = _clsRepo.Classes_getAll(spreadsheet) || [];
      }
    }

    var consumingSessions = [];
    var existingKeys = {};
    for (var i = 0; i < allSessions.length; i++) {
      var s = allSessions[i];
      if (s.student_id === studentId) {
        var sStatus = String(s.session_status || s.status || '').toUpperCase();
        var isDeduct = s.deduct_class === true || s.deduct_class === 'true' || s.deduct_class === 'TRUE';

        var sDate = s.schedule_date || s.class_date || (s.scheduled_start ? String(s.scheduled_start).slice(0, 10) : '');
        var sTime = s.schedule_time || s.start_time || (s.scheduled_start ? String(s.scheduled_start).slice(11, 16) : '');
        var sStartMs = _getSessionStartMs(s);
        var isFuture = !isNaN(sStartMs) && (sStartMs > nowMs);

        var isScheduled = (sStatus === 'SCHEDULED' || sStatus === '') && (s.attendance_status === 'NOT_MARKED' || !s.attendance_status);

        if (sStatus !== 'CANCELLED') {
          if (isScheduled || isDeduct) {
            consumingSessions.push(s);
          }
        }

        if (sDate && sTime) {
          existingKeys[sDate + '__' + sTime.slice(0, 5)] = true;
        }
      }
    }

    var existingCount = consumingSessions.length;
    var classesNeeded = isYearly ? 9999 : (classesPurchased - existingCount);

    if (classesNeeded <= 0 && !isYearly) {
      return {
        success: true,
        count: 0,
        createdCount: 0,
        totalPurchased: classesPurchased,
        existingCount: existingCount,
        lastClassDate: null,
        message: 'All package classes are already generated (0 new classes)'
      };
    }

    var DAY_MAP = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
    var sortedScheds = schedEntries.slice().sort(function(a, b) {
      var tA = a.start_time || '00:00';
      var tB = b.start_time || '00:00';
      return tA.localeCompare(tB);
    });

    var startParts = effectiveStart.split('-').map(Number);
    var currDate = new Date(Date.UTC(startParts[0], startParts[1] - 1, startParts[2], 12, 0, 0));
    var proposed = [];
    var lastDate = null;
    var iterations = 0;
    var maxDays = 730;

    while (proposed.length < classesNeeded && iterations < maxDays) {
      var y = currDate.getUTCFullYear();
      var m = String(currDate.getUTCMonth() + 1);
      if (m.length < 2) m = '0' + m;
      var d = String(currDate.getUTCDate());
      if (d.length < 2) d = '0' + d;
      var dateStr = y + '-' + m + '-' + d;
      var dayOfWeek = currDate.getUTCDay();

      if (pkgEnd && dateStr > pkgEnd) {
        break;
      }

      for (var sIdx = 0; sIdx < sortedScheds.length; sIdx++) {
        if (proposed.length >= classesNeeded) break;
        var entry = sortedScheds[sIdx];
        var entryDay = String(entry.day_of_week || '').toUpperCase();
        if (DAY_MAP[entryDay] !== dayOfWeek) continue;

        var startTime = String(entry.start_time || '10:00').slice(0, 5);
        var timeKey = dateStr + '__' + startTime;

        if (existingKeys[timeKey]) continue;

        var sHours = parseInt(startTime.slice(0, 2), 10) || 0;
        var sMins = parseInt(startTime.slice(3, 5), 10) || 0;
        var endTotal = sHours * 60 + sMins + dur;
        var endH = Math.floor(endTotal / 60) % 24;
        var endM = endTotal % 60;
        var endTime = (endH < 10 ? '0' + endH : String(endH)) + ':' + (endM < 10 ? '0' + endM : String(endM));

        var startIso = dateStr + 'T' + startTime + ':00+05:30';
        var endIso = dateStr + 'T' + endTime + ':00+05:30';

        proposed.push({
          schedule_date: dateStr,
          schedule_time: startTime,
          start_time: startTime,
          scheduled_start: startIso,
          scheduled_end: endIso,
          duration_minutes: dur,
          package_id: targetPkg.package_id
        });
        existingKeys[timeKey] = true;
        lastDate = dateStr;
      }

      currDate.setUTCDate(currDate.getUTCDate() + 1);
      iterations++;
    }

    if (data.dry_run) {
      return {
        success: true,
        dry_run: true,
        count: proposed.length,
        createdCount: proposed.length,
        totalPurchased: classesPurchased,
        existingCount: existingCount,
        lastClassDate: lastDate,
        sessions: proposed
      };
    }

    var batchRes = Classes_batchSchedule(spreadsheet, {
      student_id: studentId,
      package_id: targetPkg.package_id,
      sessions: proposed
    }, actor);

    if (isYearly && totalPlanClasses > 0) {
      try {
        var pkgSheet = spreadsheet.getSheetByName('Packages');
        if (pkgSheet && targetPkg._rowIndex) {
          var pData = pkgSheet.getDataRange().getValues();
          var pHeaders = pData[0].map(function(h) { return String(h || '').trim(); });
          var colPurchased = pHeaders.indexOf('classes_purchased');
          var colTotal = pHeaders.indexOf('total_classes');
          var colPerClass = pHeaders.indexOf('per_class');
          var pPrice = Number(targetPkg.package_price !== undefined ? targetPkg.package_price : targetPkg.price) || 0;
          var rate = pPrice > 0 ? (Math.round((pPrice / totalPlanClasses) * 100) / 100) : 0;
          if (colPurchased !== -1) pkgSheet.getRange(targetPkg._rowIndex, colPurchased + 1).setValue(totalPlanClasses);
          if (colTotal !== -1) pkgSheet.getRange(targetPkg._rowIndex, colTotal + 1).setValue(totalPlanClasses);
          if (colPerClass !== -1 && rate > 0) pkgSheet.getRange(targetPkg._rowIndex, colPerClass + 1).setValue(rate);
        }
      } catch (pkgErr) {}
    }

    return {
      success: true,
      count: batchRes.count !== undefined ? batchRes.count : proposed.length,
      createdCount: batchRes.count !== undefined ? batchRes.count : proposed.length,
      totalPurchased: classesPurchased,
      existingCount: existingCount,
      lastClassDate: lastDate,
      data: batchRes.data || proposed
    };
  }, 30000);
}

function Classes_complete(spreadsheet, data, actor) {
  var rawAtt = data.attendance_status || data.outcome;
  if (rawAtt === 'CANCELLED' || data.outcome === 'CANCELLED') {
    return Classes_cancel(spreadsheet, data, actor);
  }

  return _runWithClassLock(function() {
    var sid = data.class_session_id || data.session_id;
    var att = rawAtt || 'PRESENT';
    if (att === 'NO_SHOW') att = 'ABSENT_UNEXCUSED';
    else if (att === 'EXCUSED') att = 'ABSENT_EXCUSED';

    var session = _clsRepo.Classes_getById(spreadsheet, sid);
    if (!session) return { success: false, code: 'RECORD_NOT_FOUND', message: 'Session not found: ' + sid };

    var curStatus = String(session.session_status || session.status || '').toUpperCase();
    if (curStatus === 'CANCELLED') {
      return { success: false, code: 'CONFLICT', message: 'Cannot complete a cancelled session' };
    }

    if (att === 'PRESENT' || att === 'ATTENDED') {
      var startMs = NaN;
      if (session.scheduled_start) {
        startMs = session.scheduled_start instanceof Date
          ? session.scheduled_start.getTime()
          : new Date(session.scheduled_start).getTime();
      } else if (session.schedule_date || session.class_date) {
        var dStr = String(session.schedule_date || session.class_date).slice(0, 10);
        var tStr = String(session.schedule_time || session.start_time || '00:00').slice(0, 5);
        startMs = new Date(dStr + 'T' + tStr + ':00+05:30').getTime();
        if (isNaN(startMs)) {
          startMs = new Date(dStr + 'T' + tStr + ':00.000Z').getTime();
        }
      }
      var nowMs = data.current_time ? new Date(data.current_time).getTime() : new Date().getTime();
      if (!isNaN(startMs) && startMs > nowMs) {
        return { success: false, code: 'VALIDATION_ERROR', message: 'Class is scheduled for the future and cannot be marked Attended yet.' };
      }
    }

    var deduct = false;
    if (att === 'PRESENT' || att === 'ATTENDED') {
      deduct = true;
    } else if (rawAtt === 'NO_SHOW' || att === 'NO_SHOW' || att === 'ABSENT') {
      deduct = data.deduct_class !== undefined ? Boolean(data.deduct_class) : false;
    } else if (rawAtt === 'ABSENT_UNEXCUSED' || att === 'ABSENT_UNEXCUSED') {
      deduct = data.deduct_class !== undefined ? Boolean(data.deduct_class) : true;
    } else if (att === 'EXCUSED' || att === 'ABSENT_EXCUSED' || att === 'NOT_MARKED') {
      deduct = false;
    } else if (data.deduct_class !== undefined) {
      deduct = Boolean(data.deduct_class);
    }

    var effect = deduct ? 'CONSUME' : 'NO_CONSUME';

    var updatePayload = {
      _rowIndex: session._rowIndex,
      rowIndex: session._rowIndex,
      student_id: session.student_id,
      session_status: 'COMPLETED',
      attendance_status: att,
      deduct_class: deduct
    };
    if (data.session_notes !== undefined) {
      updatePayload.session_notes = String(data.session_notes).trim();
    }

    var updated = _clsRepo.Classes_update(spreadsheet, sid, updatePayload);

    var returnData = Object.assign({}, updated, {
      session_status: 'COMPLETED',
      attendance_status: att,
      deduct_class: deduct,
      class_credit_effect: effect
    });

    return returnData;
  });
}

function Classes_cancel(spreadsheet, data, actor) {
  return _runWithClassLock(function() {
    var sid = data.class_session_id || data.session_id;
    var session = _clsRepo.Classes_getById(spreadsheet, sid);
    if (!session) return { success: false, code: 'RECORD_NOT_FOUND', message: 'Session not found: ' + sid };

    var curStatus = String(session.session_status || session.status || '').toUpperCase();
    if (curStatus === 'CANCELLED') {
      return Object.assign({}, session, {
        session_status: 'CANCELLED',
        class_credit_effect: session.deduct_class ? 'CONSUME' : 'NO_CONSUME'
      });
    }

    var cancelTime = data.cancellation_time ? new Date(data.cancellation_time) : new Date();
    var isLate = false;
    if (session.scheduled_start) {
      try {
        var startTime = new Date(session.scheduled_start).getTime();
        var diffHours = (startTime - cancelTime.getTime()) / (1000 * 60 * 60);
        if (diffHours < 4) {
          isLate = true;
        }
      } catch (e) {}
    }

    var reason = data.cancellation_reason ? String(data.cancellation_reason).trim() : 'Cancelled by owner';
    var isWaived = Boolean(
      data.credit_waiver === true ||
      data.waive_credit === true ||
      /waiv|excused/i.test(reason)
    );

    var deduct = Boolean(
      data.deduct_class !== undefined
        ? data.deduct_class
        : (isLate && !isWaived)
    );
    var attStatus = isLate ? 'CANCELLED_LATE' : 'CANCELLED';

    var cancelUpdatePayload = {
      _rowIndex: session._rowIndex,
      rowIndex: session._rowIndex,
      student_id: session.student_id,
      session_status: 'CANCELLED',
      attendance_status: attStatus,
      cancellation_reason: reason,
      deduct_class: deduct
    };
    if (data.session_notes !== undefined) {
      cancelUpdatePayload.session_notes = String(data.session_notes).trim();
    }

    var updated = _clsRepo.Classes_update(spreadsheet, sid, cancelUpdatePayload);

    var replacementSession = null;
    if (!deduct && session.student_id) {
      try {
        var pkgRepo = typeof Packages_getAll === 'function' ? { Packages_getAll: Packages_getAll, Packages_update: Packages_update } : (typeof require !== 'undefined' ? require('../packages/PackageRepository.gs') : null);
        if (pkgRepo && pkgRepo.Packages_getAll) {
          var pkgs = pkgRepo.Packages_getAll(spreadsheet) || [];
          var stuPkg = null;
          for (var p = 0; p < pkgs.length; p++) {
            if (pkgs[p].student_id === session.student_id) {
              stuPkg = pkgs[p];
              break;
            }
          }

          var classesPurchased = stuPkg ? (Number(stuPkg.classes_purchased) || Number(stuPkg.total_classes) || 0) : 0;
          if (classesPurchased > 0) {
            var allSessions = _clsRepo.Classes_getAll(spreadsheet) || [];
            var activeSessions = allSessions.filter(function(s) {
              return s.student_id === session.student_id && s.session_status !== 'CANCELLED';
            });

            if (activeSessions.length < classesPurchased) {
              var schedSvc = typeof Schedules_list === 'function' ? { Schedules_list: Schedules_list } : (typeof require !== 'undefined' ? require('./ClassScheduleService.gs') : null);
              var schedRes = schedSvc && schedSvc.Schedules_list ? schedSvc.Schedules_list(spreadsheet, session.student_id) : null;
              var schedEntries = (schedRes && schedRes.success && schedRes.data && schedRes.data.length > 0) ? schedRes.data : [];

              if (!schedEntries.length && stuPkg && stuPkg.class_schedule) {
                var pkgSvc = typeof _parseScheduleString === 'function' ? { _parseScheduleString: _parseScheduleString } : (typeof require !== 'undefined' ? require('../packages/PackageService.gs') : null);
                if (pkgSvc && pkgSvc._parseScheduleString) {
                  schedEntries = pkgSvc._parseScheduleString(stuPkg.class_schedule, stuPkg.class_duration);
                }
              }

              if (schedEntries.length > 0) {
                var DAY_MAP = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
                var latestDateStr = '';
                for (var s = 0; s < allSessions.length; s++) {
                  if (allSessions[s].student_id === session.student_id) {
                    var sd = allSessions[s].schedule_date || allSessions[s].class_date;
                    if (sd && String(sd) > latestDateStr) {
                      latestDateStr = String(sd).slice(0, 10);
                    }
                  }
                }

                var baseDate = latestDateStr ? new Date(latestDateStr + 'T12:00:00Z') : new Date();
                var existingKeys = {};
                for (var ek = 0; ek < allSessions.length; ek++) {
                  if (allSessions[ek].student_id === session.student_id) {
                    var ekDate = allSessions[ek].schedule_date || allSessions[ek].class_date;
                    var ekTime = allSessions[ek].schedule_time || allSessions[ek].start_time;
                    if (ekDate && ekTime) {
                      existingKeys[String(ekDate).slice(0, 10) + '__' + String(ekTime).slice(0, 5)] = true;
                    }
                  }
                }

                var candidateDate = new Date(baseDate.getTime() + 86400000);
                var nextSlot = null;
                var safety = 0;
                while (!nextSlot && safety < 120) {
                  var dayNum = candidateDate.getUTCDay();
                  for (var se = 0; se < schedEntries.length; se++) {
                    var entry = schedEntries[se];
                    var entryDay = DAY_MAP[String(entry.day_of_week || '').toUpperCase()];
                    if (entryDay === dayNum) {
                      var cYear = candidateDate.getUTCFullYear();
                      var cMonth = String(candidateDate.getUTCMonth() + 1); if (cMonth.length < 2) cMonth = '0' + cMonth;
                      var cDay = String(candidateDate.getUTCDate()); if (cDay.length < 2) cDay = '0' + cDay;
                      var dStr = cYear + '-' + cMonth + '-' + cDay;
                      var tStr = String(entry.start_time || '10:00').slice(0, 5);
                      if (!existingKeys[dStr + '__' + tStr]) {
                        nextSlot = {
                          dateStr: dStr,
                          timeStr: tStr,
                          endStr: String(entry.end_time || '').slice(0, 5)
                        };
                        break;
                      }
                    }
                  }
                  if (!nextSlot) {
                    candidateDate.setUTCDate(candidateDate.getUTCDate() + 1);
                    safety++;
                  }
                }

                if (nextSlot) {
                  var dur = Number(stuPkg && stuPkg.class_duration) || Number(session.duration_minutes) || 60;
                  var startIso = nextSlot.dateStr + 'T' + nextSlot.timeStr + ':00.000Z';
                  var endIso = nextSlot.dateStr + 'T' + (nextSlot.endStr || nextSlot.timeStr) + ':00.000Z';
                  var newSession = {
                    student_id: session.student_id,
                    student_name: session.student_name || '',
                    schedule_date: nextSlot.dateStr,
                    schedule_time: nextSlot.timeStr,
                    class_session_id: session.student_id + '__' + nextSlot.dateStr + '__' + nextSlot.timeStr,
                    class_date: nextSlot.dateStr,
                    start_time: nextSlot.timeStr,
                    scheduled_start: startIso,
                    scheduled_end: endIso,
                    attendance_status: 'NOT_MARKED',
                    session_status: 'SCHEDULED',
                    cancellation_reason: '',
                    deduct_class: false
                  };
                  _clsRepo.Classes_insert(spreadsheet, newSession);
                  replacementSession = newSession;

                  if (pkgRepo.Packages_update && stuPkg) {
                    pkgRepo.Packages_update(spreadsheet, session.student_id, {
                      end_date: nextSlot.dateStr
                    });
                  }
                }
              }
            }
          }
        }
      } catch (e) {}
    }

    var returnData = Object.assign({}, updated, {
      session_status: 'CANCELLED',
      attendance_status: attStatus,
      cancellation_reason: reason,
      deduct_class: deduct,
      class_credit_effect: deduct ? 'CONSUME' : 'NO_CONSUME',
      replacement_session: replacementSession
    });

    return returnData;
  });
}

function Classes_restoreCredit(spreadsheet, data, actor) {
  return _runWithClassLock(function() {
    var sid = data.class_session_id || data.session_id;
    var original = _clsRepo.Classes_getById(spreadsheet, sid);
    if (!original) return { success: false, code: 'RECORD_NOT_FOUND', message: 'Session not found' };

    var isDeducted = (original.deduct_class === true || original.deduct_class === 'true' || original.deduct_class === 'TRUE');
    if (!isDeducted) {
      return { success: false, code: 'CONFLICT', message: 'Can only restore credits for sessions with deducted class' };
    }

    var updated = _clsRepo.Classes_update(spreadsheet, sid, {
      _rowIndex: original._rowIndex,
      rowIndex: original._rowIndex,
      student_id: original.student_id,
      deduct_class: false
    });

    return Object.assign({}, updated, {
      deduct_class: false,
      class_credit_effect: 'CREDIT_BACK'
    });
  });
}

var _PROTECTED_LIFECYCLE_FIELDS = {
  session_status: true,
  status: true,
  attendance_status: true,
  outcome: true,
  deduct_class: true,
  cancellation_reason: true
};

var _ALLOWED_CLASS_UPDATE_FIELDS = {
  schedule_date: true,
  class_date: true,
  schedule_time: true,
  start_time: true,
  scheduled_start: true,
  scheduled_end: true,
  session_notes: true,
  notes: true,
  duration_minutes: true,
  topic: true,
  class_title: true
};

var _ALLOWED_CLASS_META_FIELDS = {
  class_session_id: true,
  session_id: true,
  _rowIndex: true,
  rowIndex: true,
  id: true,
  student_id: true
};

function _resolveTargetSession(allSessions, item) {
  var sidStr = (item.class_session_id || item.session_id || (typeof item.id === 'string' ? item.id : ''))
    ? String(item.class_session_id || item.session_id || item.id).trim()
    : '';
  var rowVal = item._rowIndex !== undefined && item._rowIndex !== null && item._rowIndex !== ''
    ? item._rowIndex
    : (item.rowIndex !== undefined && item.rowIndex !== null && item.rowIndex !== '' ? item.rowIndex : null);
  var rowNum = (rowVal !== null && !isNaN(Number(rowVal))) ? Number(rowVal) : null;

  var recBySid = null;
  if (sidStr) {
    for (var i = 0; i < allSessions.length; i++) {
      var s = allSessions[i];
      if (s.class_session_id === sidStr || s.session_id === sidStr) {
        recBySid = s;
        break;
      }
      var parts = sidStr.split('__');
      if (parts.length === 3 && s.student_id === parts[0] && s.schedule_date === parts[1] && s.schedule_time === parts[2]) {
        recBySid = s;
        break;
      }
    }
  }

  var recByRow = null;
  if (rowNum !== null && rowNum >= 2) {
    for (var j = 0; j < allSessions.length; j++) {
      if (allSessions[j]._rowIndex === rowNum) {
        recByRow = allSessions[j];
        break;
      }
    }
  }

  if (sidStr && rowNum !== null) {
    if (!recBySid && !recByRow) {
      return { error: { success: false, code: 'RECORD_NOT_FOUND', message: 'Class session not found: ' + sidStr } };
    }
    if (recBySid && recByRow && recBySid._rowIndex !== recByRow._rowIndex) {
      return { error: { success: false, code: 'IDENTITY_CONFLICT', message: 'Session ID and row index identify different records' } };
    }
    if (recBySid && !recByRow) {
      return { error: { success: false, code: 'IDENTITY_CONFLICT', message: 'Row index ' + rowNum + ' does not match session ' + sidStr } };
    }
    if (!recBySid && recByRow) {
      return { error: { success: false, code: 'IDENTITY_CONFLICT', message: 'Session ID ' + sidStr + ' does not match row ' + rowNum } };
    }
    return { record: recBySid };
  }

  if (recBySid) return { record: recBySid };
  if (recByRow) return { record: recByRow };

  return { error: { success: false, code: 'RECORD_NOT_FOUND', message: 'Class session not found' } };
}

function _validateAndSanitizeSessionUpdates(existing, item) {
  if (item.student_id && existing.student_id && String(item.student_id).trim() !== String(existing.student_id).trim()) {
    return { error: { success: false, code: 'FORBIDDEN_MUTATION', message: 'Changing student_id on an existing class session is not permitted' } };
  }

  // Reject attempts to update protected lifecycle or credit-accounting fields
  for (var k in item) {
    if (!item.hasOwnProperty(k)) continue;
    if (_PROTECTED_LIFECYCLE_FIELDS[k]) {
      return {
        error: {
          success: false,
          code: 'LIFECYCLE_OPERATION_REQUIRED',
          message: 'Field "' + k + '" cannot be updated via generic update. Use dedicated lifecycle operations (classes.complete, classes.cancel, classes.restoreCredit).'
        }
      };
    }
  }

  var updates = {
    _rowIndex: existing._rowIndex,
    student_id: existing.student_id
  };

  for (var key in item) {
    if (!item.hasOwnProperty(key)) continue;
    if (_ALLOWED_CLASS_META_FIELDS[key]) continue;
    if (!_ALLOWED_CLASS_UPDATE_FIELDS[key]) {
      return { error: { success: false, code: 'INVALID_FIELD', message: 'Unknown or protected field: ' + key } };
    }
    if (key === 'notes' && item.session_notes === undefined) {
      updates.session_notes = item.notes;
    } else if (key === 'class_date' && item.schedule_date === undefined) {
      updates.schedule_date = item.class_date;
    } else if (key === 'start_time' && item.schedule_time === undefined) {
      updates.schedule_time = item.start_time;
    } else {
      updates[key] = item[key];
    }
  }

  return { updates: updates };
}

function Classes_update(spreadsheet, data, actor) {
  var item = {};
  if (typeof data === 'string' || typeof data === 'number') {
    item = (actor && typeof actor === 'object') ? Object.assign({}, actor) : {};
    if (typeof data === 'number' || /^\d+$/.test(String(data))) {
      item._rowIndex = Number(data);
    } else {
      item.class_session_id = String(data);
    }
  } else if (data && typeof data === 'object') {
    item = Object.assign({}, data);
  } else {
    return { success: false, code: 'VALIDATION_ERROR', message: 'Invalid session update payload' };
  }

  var sid = item.class_session_id || item.session_id || item._rowIndex || item.rowIndex || item.id;
  if (!sid && sid !== 0) return { success: false, code: 'VALIDATION_ERROR', message: 'Session ID or row index is required' };

  return _runWithClassLock(function() {
    var all = _clsRepo.Classes_getAll(spreadsheet) || [];
    var resolved = _resolveTargetSession(all, item);
    if (resolved.error) return resolved.error;

    var sanitized = _validateAndSanitizeSessionUpdates(resolved.record, item);
    if (sanitized.error) return sanitized.error;

    var updated = _clsRepo.Classes_update(spreadsheet, resolved.record._rowIndex, sanitized.updates);
    if (!updated) return { success: false, code: 'RECORD_NOT_FOUND', message: 'Class session not found at row ' + resolved.record._rowIndex };
    if (!updated.class_session_id && !updated.session_id) {
      updated.class_session_id = resolved.record.class_session_id || resolved.record.session_id || sid;
      updated.session_id = updated.class_session_id;
    }
    return updated;
  });
}

function Classes_batchUpdate(spreadsheet, data, actor) {
  var p = data || {};
  var items = p.updates || p.sessions || [];
  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, code: 'VALIDATION_ERROR', message: 'No updates provided' };
  }

  return _runWithClassLock(function() {
    var all = _clsRepo.Classes_getAll(spreadsheet) || [];
    var prepared = [];

    // Phase 1: Pre-validate EVERY item before any writes. Fail immediately if invalid or contains lifecycle fields.
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item || typeof item !== 'object') {
        return { success: false, code: 'VALIDATION_ERROR', message: 'Item at index ' + i + ' is invalid' };
      }
      var sid = item.class_session_id || item.session_id || item._rowIndex || item.rowIndex || item.id;
      if (!sid && sid !== 0) {
        return { success: false, code: 'VALIDATION_ERROR', message: 'Item at index ' + i + ' is missing a session identifier' };
      }

      var resolved = _resolveTargetSession(all, item);
      if (resolved.error) {
        return Object.assign({}, resolved.error, {
          message: resolved.error.message + ' (item index ' + i + ')'
        });
      }

      var sanitized = _validateAndSanitizeSessionUpdates(resolved.record, item);
      if (sanitized.error) {
        return Object.assign({}, sanitized.error, {
          message: sanitized.error.message + ' (item index ' + i + ')'
        });
      }

      prepared.push({
        record: resolved.record,
        updates: sanitized.updates,
        identifier: sid
      });
    }

    // Phase 2: Sequential execution under lock with explicit partial failure tracking
    var succeeded = [];
    var failed = [];

    for (var j = 0; j < prepared.length; j++) {
      var prep = prepared[j];
      var res = null;
      var writeError = null;

      try {
        res = _clsRepo.Classes_update(spreadsheet, prep.record._rowIndex, prep.updates);
      } catch (err) {
        writeError = err;
      }

      if (res && !writeError) {
        if (!res.class_session_id && !res.session_id) {
          res.class_session_id = prep.record.class_session_id || prep.record.session_id || prep.identifier;
          res.session_id = res.class_session_id;
        }
        succeeded.push(res);
      } else {
        var isException = !!writeError;
        var errDetail = isException ? (writeError.message || String(writeError)) : 'Repository update returned no record';
        failed.push({
          identifier: prep.identifier,
          rowIndex: prep.record._rowIndex,
          error: errDetail,
          outcomeUnknown: isException
        });
        var successfulIds = succeeded.map(function(s) { return s.class_session_id || s.session_id; });
        var failedIds = failed.map(function(f) { return f.identifier; });

        if (succeeded.length > 0) {
          var partialRes = {
            success: false,
            code: 'PARTIAL_BATCH_FAILURE',
            message: isException
              ? ('Batch update partially failed: ' + succeeded.length + ' succeeded, write on ' + prep.identifier + ' encountered an exception (' + errDetail + '). Earlier changes were persisted; outcome of failed write is uncertain.')
              : ('Batch update partially failed: ' + succeeded.length + ' succeeded, ' + failed.length + ' failed. Partial changes occurred and were not rolled back. Failed on ' + prep.identifier + ': ' + errDetail),
            partialChangesOccurred: true,
            successfulCount: succeeded.length,
            failedCount: failed.length,
            successfulSessions: successfulIds,
            failedSessions: failedIds,
            data: succeeded
          };
          if (isException) {
            partialRes.writeOutcomeUnknown = true;
          }
          return partialRes;
        } else {
          if (isException) {
            return {
              success: false,
              code: 'BATCH_UPDATE_FAILED',
              message: 'Batch update encountered an exception on session ' + prep.identifier + ': ' + errDetail + '. Write outcome is uncertain; changes may or may not have persisted.',
              writeOutcomeUnknown: true,
              successfulCount: 0,
              failedCount: 1,
              successfulSessions: [],
              failedSessions: failedIds,
              data: []
            };
          } else {
            return {
              success: false,
              code: 'BATCH_UPDATE_FAILED',
              message: 'Batch update failed on session ' + prep.identifier + ': ' + errDetail + '. Zero changes occurred.',
              partialChangesOccurred: false,
              successfulCount: 0,
              failedCount: 1,
              successfulSessions: [],
              failedSessions: failedIds,
              data: []
            };
          }
        }
      }
    }

    return { success: true, count: succeeded.length, data: succeeded };
  }, 15000);
}

function Classes_deleteUntouched(spreadsheet, data, actor) {
  var studentId = data.student_id ? String(data.student_id).trim() : '';
  if (!studentId) {
    return { success: false, code: 'VALIDATION_ERROR', message: 'Student ID is required' };
  }
  return _runWithClassLock(function() {
    var sheet = spreadsheet.getSheetByName('ClassSessions');
    if (!sheet) {
      return { success: false, code: 'SHEET_NOT_FOUND', message: 'ClassSessions sheet not found' };
    }
    var allSessions = _clsRepo.Classes_getAll(spreadsheet) || [];
    var rowsToDelete = [];
    var matchedCount = 0;
    var skippedCount = 0;

    for (var i = allSessions.length - 1; i >= 0; i--) {
      var s = allSessions[i];
      if (s.student_id !== studentId) continue;

      var sStatus = String(s.session_status || s.status || '').toUpperCase();
      var sAtt = String(s.attendance_status || '').toUpperCase();
      var hasNotes = Boolean(s.session_notes || s.notes || s.cancellation_reason);
      var isUntouched = (sStatus === 'SCHEDULED' || sStatus === '') &&
                        (sAtt === 'NOT_MARKED' || sAtt === '') &&
                        !hasNotes;

      if (isUntouched) {
        if (s._rowIndex) {
          rowsToDelete.push(s._rowIndex);
        }
        matchedCount++;
      } else {
        skippedCount++;
      }
    }

    rowsToDelete.sort(function(a, b) { return b - a; });
    for (var d = 0; d < rowsToDelete.length; d++) {
      if (typeof sheet.deleteRow === 'function') {
        sheet.deleteRow(rowsToDelete[d]);
      }
    }
    _clsSvcSafeClear(sheet);

    return {
      success: true,
      deletedCount: rowsToDelete.length,
      skippedCount: skippedCount,
      message: 'Deleted ' + rowsToDelete.length + ' untouched classes for student ' + studentId
    };
  }, 30000);
}

function Classes_markPastAttended(spreadsheet, data, actor) {
  var studentId = data.student_id ? String(data.student_id).trim() : '';
  if (!studentId) {
    return { success: false, code: 'VALIDATION_ERROR', message: 'Student ID is required' };
  }
  var cutoffDate = data.cutoff_date ? _toYyyyMmDdHelper(data.cutoff_date) : '';
  if (!cutoffDate) {
    var now = new Date();
    try {
      cutoffDate = Utilities.formatDate(now, 'Asia/Kolkata', 'yyyy-MM-dd');
    } catch (e) {
      cutoffDate = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
    }
  }

  return _runWithClassLock(function() {
    var sheet = spreadsheet.getSheetByName('ClassSessions');
    if (!sheet) {
      return { success: false, code: 'SHEET_NOT_FOUND', message: 'ClassSessions sheet not found' };
    }
    var rows = sheet.getDataRange().getValues();
    if (!rows || rows.length <= 1) {
      return { success: true, count: 0 };
    }
    var headers = rows[0].map(function(h) { return String(h || '').trim(); });
    var colSid = headers.indexOf('student_id');
    var colDate = headers.indexOf('schedule_date');
    if (colDate === -1) colDate = headers.indexOf('class_date');
    var colStart = headers.indexOf('scheduled_start');
    var colStatus = headers.indexOf('session_status');
    if (colStatus === -1) colStatus = headers.indexOf('status');
    var colAtt = headers.indexOf('attendance_status');
    var colDeduct = headers.indexOf('deduct_class');

    var markedCount = 0;
    var remainingCount = 0;
    var totalCount = 0;

    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      var sid = colSid !== -1 ? String(row[colSid] || '').trim() : '';
      if (sid !== studentId) continue;
      totalCount++;

      var sDate = colDate !== -1 ? String(row[colDate] || '').slice(0, 10) : '';
      if (!sDate && colStart !== -1) {
        sDate = _toYyyyMmDdHelper(row[colStart]);
      }
      var sStatus = colStatus !== -1 ? String(row[colStatus] || '').trim().toUpperCase() : '';

      if (sStatus === 'CANCELLED') continue;

      if (sDate < cutoffDate) {
        if (colStatus !== -1) row[colStatus] = 'COMPLETED';
        if (colAtt !== -1) row[colAtt] = 'PRESENT';
        if (colDeduct !== -1) row[colDeduct] = true;
        markedCount++;
      } else {
        remainingCount++;
      }
    }

    if (markedCount > 0) {
      sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    }
    _clsSvcSafeClear(sheet);

    return {
      success: true,
      student_id: studentId,
      cutoff_date: cutoffDate,
      marked_attended: markedCount,
      remaining_scheduled: remainingCount,
      total_classes: totalCount
    };
  }, 30000);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Classes_schedule: Classes_schedule,
    Classes_batchSchedule: Classes_batchSchedule,
    Classes_generateForPackage: Classes_generateForPackage,
    Classes_complete: Classes_complete,
    Classes_cancel: Classes_cancel,
    Classes_restoreCredit: Classes_restoreCredit,
    Classes_update: Classes_update,
    Classes_batchUpdate: Classes_batchUpdate,
    Classes_deleteUntouched: Classes_deleteUntouched,
    Classes_markPastAttended: Classes_markPastAttended,
    _setLockManager: function(lm) { _clsLock = lm; }
  };
}
