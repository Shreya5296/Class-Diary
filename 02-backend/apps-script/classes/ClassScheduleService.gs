/**
 * ClassScheduleService: Manages recurring weekly class schedules per student.
 * Canonical schedule data is stored directly in Packages.class_schedule.
 * ClassSchedules is permanently removed as an application-managed data table.
 */

var _schedIdGen = typeof generateId === 'function' ? { generateId: generateId } : (typeof require !== 'undefined' ? require('../shared/IdGenerator.gs') : null);
var _schedStuRepo = typeof Students_getById === 'function' ? { Students_getById: Students_getById } : (typeof require !== 'undefined' ? require('../students/StudentRepository.gs') : null);
var _schedLock = typeof withLock === 'function' ? { withLock: withLock } : (typeof require !== 'undefined' ? require('../sheets/LockManager.gs') : null);

var VALID_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
var TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
var _DAY_ABBRS = { MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun' };
var _ABBR_TO_DAY = { MON: 'MONDAY', TUE: 'TUESDAY', WED: 'WEDNESDAY', THU: 'THURSDAY', FRI: 'FRIDAY', SAT: 'SATURDAY', SUN: 'SUNDAY' };

var _memorySchedules = typeof globalThis !== 'undefined' && globalThis.__recurringSchedules ? globalThis.__recurringSchedules : {};
if (typeof globalThis !== 'undefined') globalThis.__recurringSchedules = _memorySchedules;

function validateScheduleEntry(entry) {
  if (!entry || typeof entry !== 'object') return { valid: false, message: 'Invalid schedule entry' };
  var day = String(entry.day_of_week || '').trim().toUpperCase();
  if (VALID_DAYS.indexOf(day) === -1) {
    return { valid: false, message: 'Invalid day of week: ' + entry.day_of_week };
  }
  var start = String(entry.start_time || '').trim();
  var end = String(entry.end_time || '').trim();
  if (!TIME_REGEX.test(start)) {
    return { valid: false, message: 'Start time must be in HH:MM format (e.g. 17:00)' };
  }
  if (!TIME_REGEX.test(end)) {
    return { valid: false, message: 'End time must be in HH:MM format (e.g. 18:00)' };
  }
  if (end <= start) {
    return { valid: false, message: 'End time must be after start time' };
  }
  return { valid: true, day: day, start: start, end: end };
}

function _formatTimeTo12h(timeStr) {
  if (!timeStr) return '';
  var clean = String(timeStr).trim().replace(/^'/, '');
  var match = clean.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return clean;
  var h = parseInt(match[1], 10);
  var m = match[2];
  var ampm = h >= 12 ? 'PM' : 'AM';
  var h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return h12 + ':' + m + ' ' + ampm;
}

function _parseTimeTo24h(timeStr) {
  if (!timeStr) return '00:00';
  var clean = String(timeStr).trim();
  var match = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return clean;
  var h = parseInt(match[1], 10);
  var m = match[2];
  var ampm = match[3] ? match[3].toUpperCase() : '';
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return (h < 10 ? '0' + h : String(h)) + ':' + m;
}

function _formatScheduleString(entries) {
  if (!entries || !Array.isArray(entries) || entries.length === 0) return '';
  var DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  var sorted = entries.slice().sort(function(a, b) {
    var da = String(a.day_of_week || '').toUpperCase();
    var db = String(b.day_of_week || '').toUpperCase();
    return DAY_ORDER.indexOf(da) - DAY_ORDER.indexOf(db);
  });
  var parts = [];
  for (var i = 0; i < sorted.length; i++) {
    var e = sorted[i];
    var dUpper = String(e.day_of_week || '').toUpperCase();
    var abbr = _DAY_ABBRS[dUpper] || e.day_of_week;
    var t12 = _formatTimeTo12h(e.start_time);
    if (abbr && t12) {
      parts.push(abbr + ' - ' + t12);
    }
  }
  return parts.join(', ');
}

function _parseScheduleString(str, durationMinutes) {
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
    var fullDay = _ABBR_TO_DAY[dayPart] || dayPart;
    var start24 = _parseTimeTo24h(timePart);
    var startParts = start24.split(':').map(Number);
    var endTotalMins = (startParts[0] * 60 + startParts[1]) + dur;
    var endH = Math.floor(endTotalMins / 60) % 24;
    var endM = endTotalMins % 60;
    var end24 = (endH < 10 ? '0' + endH : String(endH)) + ':' + (endM < 10 ? '0' + endM : String(endM));
    results.push({
      schedule_id: 'csch_parsed_' + i,
      day_of_week: fullDay,
      start_time: start24,
      end_time: end24
    });
  }
  return results;
}

function _ensureClassSchedulesSheet(spreadsheet) {
  // Application-managed ClassSchedules table permanently removed.
  // Canonical recurring schedule data is persisted exclusively in Packages.class_schedule.
  return null;
}

function Schedules_list(spreadsheet, studentId) {
  var sid = studentId ? String(studentId).trim() : null;

  // Primary source of truth: Packages.class_schedule
  var pkgSheet = spreadsheet && spreadsheet.getSheetByName ? spreadsheet.getSheetByName('Packages') : null;
  if (pkgSheet) {
    var pData = pkgSheet.getDataRange ? pkgSheet.getDataRange().getValues() : (pkgSheet.getData ? pkgSheet.getData() : []);
    if (pData.length > 1) {
      var pHeaders = pData[0].map(function(h) { return String(h || '').trim(); });
      var pStuCol = pHeaders.indexOf('student_id');
      var pNameCol = pHeaders.indexOf('student_name');
      var pSchedCol = pHeaders.indexOf('class_schedule');
      var pDurCol = pHeaders.indexOf('class_duration');
      var pStartCol = pHeaders.indexOf('start_date');
      var pStatusCol = pHeaders.indexOf('status');
      if (pStatusCol === -1) pStatusCol = pHeaders.indexOf('package_status');

      if (pStuCol !== -1 && pSchedCol !== -1) {
        var studentPkgMap = {};
        for (var pi = 1; pi < pData.length; pi++) {
          var pRow = pData[pi];
          var rowSid = String(pRow[pStuCol] || '').trim();
          if (!rowSid) continue;
          if (sid && rowSid !== sid) continue;

          var schedStr = String(pRow[pSchedCol] || '').trim();
          var dur = Number(pDurCol !== -1 ? pRow[pDurCol] : 60) || 60;
          var sName = pNameCol !== -1 ? String(pRow[pNameCol] || '').trim() : '';
          var sDate = pStartCol !== -1 ? String(pRow[pStartCol] || '').trim() : '';
          var sStatus = pStatusCol !== -1 ? String(pRow[pStatusCol] || '').trim().toUpperCase() : '';

          if (!studentPkgMap[rowSid]) {
            studentPkgMap[rowSid] = [];
          }
          studentPkgMap[rowSid].push({
            rowSid: rowSid,
            sName: sName,
            schedStr: schedStr,
            dur: dur,
            sDate: sDate,
            sStatus: sStatus,
            rowIndex: pi + 1
          });
        }

        var pkgResults = [];
        for (var sKey in studentPkgMap) {
          var pkgs = studentPkgMap[sKey];
          pkgs.sort(function(a, b) {
            if (a.sStatus === 'ACTIVE' && b.sStatus !== 'ACTIVE') return -1;
            if (b.sStatus === 'ACTIVE' && a.sStatus !== 'ACTIVE') return 1;
            return a.sDate < b.sDate ? 1 : (a.sDate > b.sDate ? -1 : (b.rowIndex - a.rowIndex));
          });

          var chosen = null;
          for (var c = 0; c < pkgs.length; c++) {
            if (pkgs[c].schedStr) {
              chosen = pkgs[c];
              break;
            }
          }
          if (!chosen && pkgs.length > 0) chosen = pkgs[0];

          if (chosen && chosen.schedStr) {
            var parsed = _parseScheduleString(chosen.schedStr, chosen.dur);
            for (var k = 0; k < parsed.length; k++) {
              parsed[k].student_id = chosen.rowSid;
              parsed[k].student_name = chosen.sName;
              parsed[k].is_active = true;
              pkgResults.push(parsed[k]);
            }
          }
        }

        if (pkgResults.length > 0 || sid) {
          return { success: true, data: pkgResults, meta: { persistentSheet: true, source: 'Packages' } };
        }
      }
    }
  }

  if (sid && _memorySchedules[sid]) return { success: true, data: _memorySchedules[sid], meta: { persistentSheet: false } };
  if (!sid) {
    var allMem = [];
    for (var mKey in _memorySchedules) {
      if (Array.isArray(_memorySchedules[mKey])) {
        allMem = allMem.concat(_memorySchedules[mKey]);
      }
    }
    if (allMem.length > 0) return { success: true, data: allMem, meta: { persistentSheet: false } };
  }
  return { success: true, data: [], meta: { persistentSheet: false } };
}

function Schedules_save(spreadsheet, studentId, entries, actor, options) {
  var sid = String(studentId || '').trim();
  if (!sid) return { success: false, code: 'VALIDATION_ERROR', message: 'Student ID is required' };

  var list = entries || [];
  var validated = [];
  for (var i = 0; i < list.length; i++) {
    var check = validateScheduleEntry(list[i]);
    if (!check.valid) {
      return { success: false, code: 'VALIDATION_ERROR', message: check.message };
    }
    var existingId = list[i].schedule_id || (list[i].id && !list[i].id.startsWith('temp_') && !/^\d+$/.test(list[i].id) ? list[i].id : null);
    validated.push({
      schedule_id: existingId || (_schedIdGen ? _schedIdGen.generateId('csch_') : 'csch_' + Date.now() + '_' + i),
      student_id: sid,
      day_of_week: check.day,
      start_time: check.start,
      end_time: check.end,
      is_active: true,
      created_at: list[i].created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  if (!_schedLock || typeof _schedLock.withLock !== 'function') {
    return { success: false, code: 'LOCK_UNAVAILABLE', message: 'Concurrency lock manager is unavailable' };
  }

  var lockRes = _schedLock.withLock(10000, function() {
    // Update Packages.class_schedule (canonical single source of truth)
    var schedStr = _formatScheduleString(validated);
    var pkgRepo = typeof Packages_update === 'function' ? {
      Packages_update: Packages_update,
      Packages_getByStudentId: typeof Packages_getByStudentId === 'function' ? Packages_getByStudentId : null,
      Packages_getAll: typeof Packages_getAll === 'function' ? Packages_getAll : null,
      Packages_getById: typeof Packages_getById === 'function' ? Packages_getById : null,
      Packages_insert: typeof Packages_insert === 'function' ? Packages_insert : null
    } : (typeof require !== 'undefined' ? require('../packages/PackageRepository.gs') : null);

    var persistedToPkg = false;
    if (pkgRepo) {
      var studentPkgs = pkgRepo.Packages_getByStudentId ? pkgRepo.Packages_getByStudentId(spreadsheet, sid) : [];
      if ((!studentPkgs || studentPkgs.length === 0) && pkgRepo.Packages_getAll) {
        studentPkgs = (pkgRepo.Packages_getAll(spreadsheet) || []).filter(function(p) { return p.student_id === sid; });
      }

      var targetPkg = null;
      var callerTargetId = options && (options.package_id || options.target_package_id);
      var callerRowIndex = options && (options._rowIndex || options.rowIndex);

      if (callerTargetId || callerRowIndex) {
        for (var cp = 0; cp < studentPkgs.length; cp++) {
          if (callerRowIndex && studentPkgs[cp]._rowIndex === Number(callerRowIndex)) {
            targetPkg = studentPkgs[cp];
            break;
          }
          if (callerTargetId && studentPkgs[cp].package_id === callerTargetId) {
            targetPkg = studentPkgs[cp];
            break;
          }
        }
        if (!targetPkg && callerTargetId && pkgRepo.Packages_getById) {
          var resolvedById = pkgRepo.Packages_getById(spreadsheet, callerTargetId);
          if (resolvedById && resolvedById.student_id === sid) {
            targetPkg = resolvedById;
          }
        }
        if (!targetPkg) {
          return {
            success: false,
            code: 'TARGET_PACKAGE_NOT_FOUND',
            message: 'Specified package target was not found or does not belong to student ' + sid + '.'
          };
        }
      } else if (studentPkgs && studentPkgs.length === 1) {
        targetPkg = studentPkgs[0];
      } else if (studentPkgs && studentPkgs.length > 1) {
        var sortedPkgs = studentPkgs.slice().sort(function(a, b) {
          var da = a.start_date || '';
          var db = b.start_date || '';
          return da < db ? 1 : (da > db ? -1 : 0);
        });

        var latestPkg = sortedPkgs[0];
        var secondLatest = sortedPkgs[1];

        var latestStart = latestPkg.start_date ? String(latestPkg.start_date).slice(0, 10) : '';
        var secondStart = secondLatest.start_date ? String(secondLatest.start_date).slice(0, 10) : '';

        if (latestStart && secondStart && latestStart === secondStart) {
          return {
            success: false,
            code: 'AMBIGUOUS_PACKAGE_TARGET',
            message: 'Cannot safely determine target package for schedule update: multiple packages share the same start date (' + latestStart + ').'
          };
        }

        var activeMatches = studentPkgs.filter(function(p) {
          var s = String(p.status || p.package_status || '').toUpperCase();
          return s === 'ACTIVE';
        });
        if (activeMatches.length > 1) {
          var a1 = activeMatches[0].start_date || '';
          var a2 = activeMatches[1].start_date || '';
          if (a1 === a2) {
            return {
              success: false,
              code: 'AMBIGUOUS_PACKAGE_TARGET',
              message: 'Cannot safely determine target package: multiple competing packages are marked ACTIVE with identical start dates.'
            };
          }
        }

        var nowDate = new Date().toISOString().slice(0, 10);
        var allExpired = studentPkgs.every(function(p) {
          return p.end_date && String(p.end_date).slice(0, 10) < nowDate;
        });
        if (allExpired) {
          return {
            success: false,
            code: 'AMBIGUOUS_PACKAGE_TARGET',
            message: 'Cannot safely determine target package: all existing packages are historical/expired. Explicit package selection required.'
          };
        }

        if (latestStart && (!secondStart || latestStart > secondStart)) {
          targetPkg = latestPkg;
        } else {
          return {
            success: false,
            code: 'AMBIGUOUS_PACKAGE_TARGET',
            message: 'Cannot safely determine target package for schedule update: no unambiguous active package found.'
          };
        }
      }

      if (targetPkg && pkgRepo.Packages_update) {
        var updatePayload = { class_schedule: schedStr };
        if (targetPkg._rowIndex) updatePayload._rowIndex = targetPkg._rowIndex;
        try {
          pkgRepo.Packages_update(spreadsheet, sid, updatePayload);
          persistedToPkg = true;
        } catch (e) {}
      } else if (!targetPkg && pkgRepo.Packages_insert) {
        try {
          pkgRepo.Packages_insert(spreadsheet, {
            student_id: sid,
            student_name: '',
            plan_type: 'Per Class',
            currency: 'INR',
            package_price: '',
            per_class: '',
            classes_purchased: 0,
            class_duration: 60,
            class_schedule: schedStr
          });
          persistedToPkg = true;
        } catch (e) {}
      }
    }

    _memorySchedules[sid] = validated;

    return {
      success: true,
      data: validated,
      meta: {
        persistentSheet: persistedToPkg,
        source: 'Packages'
      }
    };
  });

  if (!lockRes.success) {
    return {
      success: false,
      code: lockRes.code || 'CONFLICT',
      message: lockRes.message || 'Schedule lock acquisition failed'
    };
  }

  return lockRes.result;
}

function auditClassSchedulesSheetStrict(spreadsheet) {
  var result = {
    safeToArchive: false,
    isSafeToArchive: false,
    totalRows: 0,
    validRows: [],
    duplicateRows: [],
    malformedRows: [],
    unmatchedRows: [],
    ambiguousMatches: [],
    incompleteRows: [],
    summary: ''
  };

  if (!spreadsheet || typeof spreadsheet.getSheetByName !== 'function') {
    result.summary = 'Spreadsheet unavailable';
    return result;
  }

  var sheet = spreadsheet.getSheetByName('ClassSchedules');
  if (!sheet) {
    result.summary = 'ClassSchedules sheet does not exist';
    return result;
  }

  var data = sheet.getDataRange ? sheet.getDataRange().getValues() : (sheet.getData ? sheet.getData() : []);
  if (!data || data.length <= 1) {
    result.summary = 'ClassSchedules sheet is empty or has only headers';
    return result;
  }

  var headers = data[0].map(function(h) { return String(h || '').trim(); });
  var reqHeaders = ['student_id', 'day_of_week', 'start_time'];
  for (var rh = 0; rh < reqHeaders.length; rh++) {
    if (headers.indexOf(reqHeaders[rh]) === -1) {
      result.incompleteRows.push({ error: 'Missing required header: ' + reqHeaders[rh] });
    }
  }
  if (result.incompleteRows.length > 0) {
    result.summary = 'Missing required columns in ClassSchedules';
    return result;
  }

  var colStu = headers.indexOf('student_id');
  var colDay = headers.indexOf('day_of_week');
  var colStart = headers.indexOf('start_time');
  var colEnd = headers.indexOf('end_time');
  var colId = headers.indexOf('schedule_id');

  var pkgSheet = spreadsheet.getSheetByName('Packages');
  var pkgData = pkgSheet && pkgSheet.getDataRange ? pkgSheet.getDataRange().getValues() : (pkgSheet && pkgSheet.getData ? pkgSheet.getData() : []);
  var studentPkgMap = {};
  if (pkgData && pkgData.length > 1) {
    var pHeaders = pkgData[0].map(function(h) { return String(h || '').trim(); });
    var pStuCol = pHeaders.indexOf('student_id');
    var pSchedCol = pHeaders.indexOf('class_schedule');
    var pStartCol = pHeaders.indexOf('start_date');
    if (pStuCol !== -1) {
      for (var pi = 1; pi < pkgData.length; pi++) {
        var pRow = pkgData[pi];
        var pSid = String(pRow[pStuCol] || '').trim();
        if (!pSid) continue;
        if (!studentPkgMap[pSid]) studentPkgMap[pSid] = [];
        studentPkgMap[pSid].push({
          rowIndex: pi + 1,
          schedule: pSchedCol !== -1 ? String(pRow[pSchedCol] || '').trim() : '',
          startDate: pStartCol !== -1 ? String(pRow[pStartCol] || '').trim() : ''
        });
      }
    }
  }

  var seenKeys = {};
  var seenIds = {};

  for (var r = 1; r < data.length; r++) {
    result.totalRows++;
    var row = data[r];
    var sid = colStu !== -1 ? String(row[colStu] || '').trim() : '';
    var day = colDay !== -1 ? String(row[colDay] || '').trim().toUpperCase() : '';
    var start = colStart !== -1 ? String(row[colStart] || '').trim() : '';
    var end = colEnd !== -1 ? String(row[colEnd] || '').trim() : '';
    var schId = colId !== -1 ? String(row[colId] || '').trim() : '';

    if (!sid || !day || !start) {
      result.incompleteRows.push({ rowIndex: r + 1, row: row, reason: 'Missing mandatory fields' });
      continue;
    }

    var normStart = _parseTimeTo24h(start);
    var normEnd = end ? _parseTimeTo24h(end) : '';
    var check = validateScheduleEntry({ day_of_week: day, start_time: normStart, end_time: normEnd || '23:59' });
    if (!check.valid) {
      result.malformedRows.push({ rowIndex: r + 1, row: row, reason: check.message });
      continue;
    }

    var rowKey = sid + '|' + day + '|' + normStart;
    if (seenKeys[rowKey]) {
      result.duplicateRows.push({ rowIndex: r + 1, studentId: sid, key: rowKey, reason: 'Duplicate schedule key for student' });
    } else {
      seenKeys[rowKey] = r + 1;
    }

    if (schId) {
      if (seenIds[schId]) {
        result.duplicateRows.push({ rowIndex: r + 1, scheduleId: schId, reason: 'Duplicate schedule_id' });
      } else {
        seenIds[schId] = r + 1;
      }
    }

    var pkgs = studentPkgMap[sid];
    if (!pkgs || pkgs.length === 0) {
      result.unmatchedRows.push({ rowIndex: r + 1, studentId: sid, reason: 'No corresponding Packages row found for student' });
    } else if (pkgs.length > 1) {
      var matchingPkgs = pkgs.filter(function(p) {
        return p.schedule && p.schedule.indexOf(day) !== -1;
      });
      if (matchingPkgs.length > 1 || (matchingPkgs.length === 0 && pkgs.length > 1)) {
        result.ambiguousMatches.push({ rowIndex: r + 1, studentId: sid, candidateCount: pkgs.length, reason: 'Multiple competing packages without unambiguous schedule match' });
      }
    }

    result.validRows.push({ rowIndex: r + 1, studentId: sid, day: day, startTime: normStart, endTime: normEnd });
  }

  var isClean = (
    result.totalRows > 0 &&
    result.duplicateRows.length === 0 &&
    result.malformedRows.length === 0 &&
    result.unmatchedRows.length === 0 &&
    result.ambiguousMatches.length === 0 &&
    result.incompleteRows.length === 0
  );

  result.safeToArchive = isClean;
  result.isSafeToArchive = isClean;
  result.summary = isClean
    ? 'ClassSchedules tab is fully validated and safe to archive (' + result.validRows.length + ' valid rows).'
    : 'ClassSchedules tab is NOT safe to archive: ' +
      [
        result.duplicateRows.length > 0 ? (result.duplicateRows.length + ' duplicate rows') : null,
        result.malformedRows.length > 0 ? (result.malformedRows.length + ' malformed rows') : null,
        result.unmatchedRows.length > 0 ? (result.unmatchedRows.length + ' unmatched rows') : null,
        result.ambiguousMatches.length > 0 ? (result.ambiguousMatches.length + ' ambiguous matches') : null,
        result.incompleteRows.length > 0 ? (result.incompleteRows.length + ' incomplete rows') : null
      ].filter(Boolean).join(', ');

  return result;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateScheduleEntry: validateScheduleEntry,
    _formatScheduleString: _formatScheduleString,
    _parseScheduleString: _parseScheduleString,
    Schedules_list: Schedules_list,
    Schedules_save: Schedules_save,
    auditClassSchedulesSheetStrict: auditClassSchedulesSheetStrict,
    _setLockManager: function(lm) { _schedLock = lm; }
  };
}
