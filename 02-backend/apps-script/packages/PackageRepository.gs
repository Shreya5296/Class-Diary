/**
 * PackageRepository: CRUD persistence for the Packages sheet.
 * Canonical schema: student_id, student_name, plan_type, currency, package_price,
 * per_class, classes_purchased, start_date, end_date, next_due_date, class_duration, class_schedule
 */

var _pkgRowReader = typeof readAllRecords === 'function' ? { readAllRecords: readAllRecords, findRecordById: findRecordById } : (typeof require !== 'undefined' ? require('../sheets/RowReader.gs') : null);
var _pkgRowWriter = typeof appendRecord === 'function' ? { appendRecord: appendRecord, updateRecordById: updateRecordById } : (typeof require !== 'undefined' ? require('../sheets/RowWriter.gs') : null);

function _resolvePkgRepoSheetNames() {
  if (typeof SHEET_NAMES !== 'undefined' && SHEET_NAMES) return SHEET_NAMES;
  if (typeof require !== 'undefined') return require('../sheets/SheetRegistry.gs').SHEET_NAMES;
  return {};
}

function _resolvePkgRepoHeaders(sheetName) {
  if (typeof getExpectedHeaders === 'function') return getExpectedHeaders(sheetName);
  if (typeof require !== 'undefined') return require('../sheets/SheetRegistry.gs').getExpectedHeaders(sheetName);
  return null;
}

var _pkgRegistry = {
  get SHEET_NAMES() { return _resolvePkgRepoSheetNames(); },
  getExpectedHeaders: function(name) { return _resolvePkgRepoHeaders(name); }
};
var _pkgMapper = typeof createHeaderMap === 'function' ? { createHeaderMap: createHeaderMap, rowToRecord: rowToRecord, recordToRow: recordToRow } : (typeof require !== 'undefined' ? require('../sheets/HeaderMapper.gs') : null);

function Packages_getAll(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(_pkgRegistry.SHEET_NAMES.PACKAGES);
  return _pkgRowReader.readAllRecords(sheet, _pkgMapper);
}

function Packages_getByStudentId(spreadsheet, studentId) {
  var all = Packages_getAll(spreadsheet);
  var matches = all.filter(function(p) { return p.student_id === studentId; });
  matches.sort(function(a, b) {
    var da = a.start_date || '';
    var db = b.start_date || '';
    return da < db ? 1 : (da > db ? -1 : 0);
  });
  return matches;
}

function Packages_getById(spreadsheet, identifier) {
  if (!identifier) return null;
  var all = Packages_getAll(spreadsheet);
  var idStr = String(identifier).trim();

  // 1. Direct match on package_id column if present
  for (var i = 0; i < all.length; i++) {
    if (all[i].package_id && all[i].package_id === idStr) {
      return all[i];
    }
  }

  // 2. Memory map lookup (for ephemeral package_ids returned to caller)
  var mem = (typeof globalThis !== 'undefined' && globalThis.__pkgMemoryMap) ? globalThis.__pkgMemoryMap[idStr] : null;
  if (mem) {
    var memDateStr = mem.start_date ? String(mem.start_date).slice(0, 10) : '';
    var candidateMatches = [];
    for (var m = 0; m < all.length; m++) {
      if (all[m].student_id === mem.student_id) {
        var sameClass = mem.classes_purchased !== undefined ? (Number(all[m].classes_purchased) === Number(mem.classes_purchased)) : true;
        var rowDateStr = all[m].start_date ? String(all[m].start_date).slice(0, 10) : '';
        var sameDate = (!memDateStr && !rowDateStr) || (memDateStr === rowDateStr);
        var samePlan = !mem.plan_type || !all[m].plan_type || (String(mem.plan_type).trim().toLowerCase() === String(all[m].plan_type).trim().toLowerCase());
        if (sameClass && sameDate && samePlan) {
          candidateMatches.push(all[m]);
        }
      }
    }

    // If multiple candidates have identical attributes, identity is ambiguous -> return null
    if (candidateMatches.length > 1) {
      return null;
    }

    if (candidateMatches.length === 1) {
      var cand = candidateMatches[0];
      // If mem recorded a row index, require the candidate row index to match exactly (protects against row moves/shifts)
      if (mem._rowIndex && cand._rowIndex !== mem._rowIndex) {
        return null;
      }
      var copy = Object.assign({}, cand);
      copy.package_id = idStr;
      return copy;
    }

    // Return null if no physical sheet row matches the memory mapping (stale identifier protection)
    return null;
  }

  // 3. Look up by student_id
  for (var j = 0; j < all.length; j++) {
    if (all[j].student_id === idStr) {
      return all[j];
    }
  }
  return null;
}

function Packages_insert(spreadsheet, record) {
  var sheet = spreadsheet.getSheetByName(_pkgRegistry.SHEET_NAMES.PACKAGES);
  var headers = _pkgRegistry.getExpectedHeaders(_pkgRegistry.SHEET_NAMES.PACKAGES);
  var res = _pkgRowWriter.appendRecord(sheet, _pkgMapper, headers, record);
  if (sheet && typeof sheet.getLastRow === 'function') {
    record._rowIndex = sheet.getLastRow();
  }
  return res;
}

function Packages_repoUpdate(spreadsheet, studentId, updates) {
  var sheet = spreadsheet.getSheetByName(_pkgRegistry.SHEET_NAMES.PACKAGES);
  if (!sheet) return null;
  var targetSid = studentId || (updates && updates.student_id);
  var rIdx = updates && (updates._rowIndex || updates.rowIndex);

  if (rIdx) {
    var rowNum = Number(rIdx);
    if (rowNum >= 2 && rowNum <= sheet.getLastRow()) {
      var rawData = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues();
      var headerRow = rawData[0];
      var map = _pkgMapper.createHeaderMap(headerRow);
      var rowVals = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
      var rec = _pkgMapper.rowToRecord(map, rowVals);
      if (targetSid && rec.student_id && rec.student_id !== targetSid) {
        return null;
      }
      for (var k in updates) {
        if (updates.hasOwnProperty(k) && k !== '_rowIndex' && k !== 'rowIndex') {
          rec[k] = updates[k];
        }
      }
      var updatedRow = _pkgMapper.recordToRow(map, headerRow, rec);
      sheet.getRange(rowNum, 1, 1, updatedRow.length).setValues([updatedRow]);
      rec._rowIndex = rowNum;
      return rec;
    }
  }

  // Update by student_id
  var headers = _pkgRegistry.getExpectedHeaders(_pkgRegistry.SHEET_NAMES.PACKAGES);
  return _pkgRowWriter.updateRecordById(sheet, _pkgMapper, headers, 'student_id', targetSid, updates);
}

var Packages_update = Packages_repoUpdate;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Packages_getAll: Packages_getAll,
    Packages_getById: Packages_getById,
    Packages_getByStudentId: Packages_getByStudentId,
    Packages_insert: Packages_insert,
    Packages_update: Packages_repoUpdate,
    Packages_repoUpdate: Packages_repoUpdate
  };
}
