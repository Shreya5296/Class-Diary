/**
 * RowWriter: Validated spreadsheet record writer.
 * Appends and updates rows by ID using HeaderMapper.
 * Compatible with both Google Apps Script runtime and MockSheet.
 */

var _readRowsHelper = typeof _getSheetRows === 'function' ? _getSheetRows : function(sheet) {
  if (!sheet) return [];
  if (typeof sheet.getData === 'function') return sheet.getData();
  try {
    if (typeof sheet.getDataRange === 'function') {
      var r = sheet.getDataRange();
      return r ? r.getValues() : [];
    }
    if (typeof sheet.getLastRow === 'function' && typeof sheet.getLastColumn === 'function') {
      var lr = sheet.getLastRow();
      var lc = sheet.getLastColumn();
      if (lr < 1 || lc < 1) return [];
      return sheet.getRange(1, 1, lr, lc).getValues();
    }
  } catch (e) {
    return [];
  }
  return [];
};
var _clearCacheHelper = typeof SheetCache_clear === 'function' ? SheetCache_clear : (typeof require !== 'undefined' ? require('./SheetCache.gs').SheetCache_clear : null);

function _safeClearCache(sheet) {
  if (sheet) {
    delete sheet._cachedRows;
    if (_clearCacheHelper) {
      var sName = typeof sheet.getName === 'function' ? sheet.getName() : (sheet.name || null);
      _clearCacheHelper(sName || sheet);
    }
  }
}

function appendRecord(sheet, headerMapper, headerList, record) {
  if (!sheet) throw new Error('Sheet is required for appendRecord');
  var rawData = _readRowsHelper(sheet);
  if (rawData.length === 0) {
    sheet.appendRow(headerList);
    rawData = [headerList];
  }

  var headerRow = rawData[0];
  var map = headerMapper.createHeaderMap(headerRow);
  var targetHeaders = (headerRow && headerRow.length) ? headerRow : headerList;
  var row = headerMapper.recordToRow(map, targetHeaders, record);

  sheet.appendRow(row);
  _safeClearCache(sheet);
  return record;
}

function appendRecords(sheet, headerMapper, headerList, records) {
  if (!sheet) throw new Error('Sheet is required for appendRecords');
  if (!records || !Array.isArray(records) || records.length === 0) return [];
  var rawData = _readRowsHelper(sheet);
  if (rawData.length === 0) {
    sheet.appendRow(headerList);
    rawData = [headerList];
  }

  var headerRow = rawData[0];
  var map = headerMapper.createHeaderMap(headerRow);
  var targetHeaders = (headerRow && headerRow.length) ? headerRow : headerList;

  var rows = [];
  for (var i = 0; i < records.length; i++) {
    rows.push(headerMapper.recordToRow(map, targetHeaders, records[i]));
  }

  var lastRow = sheet.getLastRow ? sheet.getLastRow() : (sheet.rows ? sheet.rows.length : 1);
  if (typeof sheet.getRange === 'function') {
    sheet.getRange(lastRow + 1, 1, rows.length, targetHeaders.length).setValues(rows);
  } else {
    for (var j = 0; j < rows.length; j++) {
      sheet.appendRow(rows[j]);
    }
  }
  _safeClearCache(sheet);
  return records;
}

function updateRecordById(sheet, headerMapper, headerList, idField, idValue, updates) {
  if (!sheet) throw new Error('Sheet is required for updateRecordById');
  var rawData = _readRowsHelper(sheet);
  if (rawData.length <= 1) return null;

  var headerRow = rawData[0];
  var map = headerMapper.createHeaderMap(headerRow);
  var idColIdx = map[idField];
  if (idColIdx === undefined) {
    throw new Error('ID field not found in sheet: ' + idField);
  }

  for (var i = 1; i < rawData.length; i++) {
    if (String(rawData[i][idColIdx] || '').trim() === String(idValue || '').trim()) {
      var currentRecord = headerMapper.rowToRecord(map, rawData[i]);
      for (var key in updates) {
        if (updates.hasOwnProperty(key)) {
          currentRecord[key] = updates[key];
        }
      }
      var targetHeaders = (headerRow && headerRow.length) ? headerRow : headerList;
      var updatedRow = headerMapper.recordToRow(map, targetHeaders, currentRecord);
      if (typeof sheet.setRow === 'function') {
        sheet.setRow(i, updatedRow); // Mock support
      } else if (typeof sheet.getRange === 'function') {
        // 1-based row index in Google Sheets: row i + 1, col 1 to updatedRow.length
        sheet.getRange(i + 1, 1, 1, updatedRow.length).setValues([updatedRow]);
      }
      _safeClearCache(sheet);
      return currentRecord;
    }
  }

  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    appendRecord: appendRecord,
    appendRecords: appendRecords,
    updateRecordById: updateRecordById
  };
}
