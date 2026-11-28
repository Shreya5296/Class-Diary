/**
 * SheetCache: In-memory sheet instance and CacheService sheet-level caching.
 * Caches sheet rows for up to 60 seconds and clears cache after writes.
 * Preserves Date objects across CacheService JSON round-trips.
 */

function SheetCache_getScriptCache() {
  if (typeof CacheService !== 'undefined' && typeof CacheService.getScriptCache === 'function') {
    return CacheService.getScriptCache();
  }
  return null;
}

function _cacheEncodeRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(function(row) {
    if (!Array.isArray(row)) return row;
    return row.map(function(cell) {
      if (cell && (cell instanceof Date || Object.prototype.toString.call(cell) === '[object Date]') && !isNaN(cell.getTime())) {
        return { __sheetDate: cell.toISOString() };
      }
      return cell;
    });
  });
}

function _cacheDecodeRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(function(row) {
    if (!Array.isArray(row)) return row;
    return row.map(function(cell) {
      if (cell && typeof cell === 'object' && typeof cell.__sheetDate === 'string'
          && Object.keys(cell).length === 1) {
        return new Date(cell.__sheetDate);
      }
      return cell;
    });
  });
}

function SheetCache_getRows(sheet) {
  if (!sheet) return [];
  // 1. Check sheet-level execution cache (per sheet instance in current execution)
  if (sheet._cachedRows && Array.isArray(sheet._cachedRows)) {
    return sheet._cachedRows;
  }

  var sName = typeof sheet.getName === 'function' ? sheet.getName() : (sheet.name || 'default');
  var cacheKey = 'sheet_data_' + sName;

  // 2. Check Apps Script CacheService
  var sc = SheetCache_getScriptCache();
  if (sc) {
    try {
      var cachedStr = sc.get(cacheKey);
      if (cachedStr) {
        var parsed = JSON.parse(cachedStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          var decoded = _cacheDecodeRows(parsed);
          sheet._cachedRows = decoded;
          return decoded;
        }
      }
    } catch (e) {}
  }

  // 3. Read from sheet once with getDataRange().getValues()
  var rows = [];
  if (typeof sheet.getData === 'function') {
    rows = sheet.getData();
  } else {
    try {
      if (typeof sheet.getDataRange === 'function') {
        var range = sheet.getDataRange();
        rows = range ? range.getValues() : [];
      } else if (typeof sheet.getLastRow === 'function' && typeof sheet.getLastColumn === 'function') {
        var lr = sheet.getLastRow();
        var lc = sheet.getLastColumn();
        if (lr >= 1 && lc >= 1) {
          rows = sheet.getRange(1, 1, lr, lc).getValues();
        }
      }
    } catch (e) {
      rows = [];
    }
  }

  if (Array.isArray(rows)) {
    sheet._cachedRows = rows;
    if (sc && rows.length > 0) {
      try {
        var encoded = _cacheEncodeRows(rows);
        var jsonStr = JSON.stringify(encoded);
        if (jsonStr.length < 95000) {
          sc.put(cacheKey, jsonStr, 60);
        }
      } catch (e) {}
    }
  }
  return rows || [];
}

function SheetCache_clear(sheetOrName) {
  if (sheetOrName && typeof sheetOrName === 'object') {
    delete sheetOrName._cachedRows;
    var sName = typeof sheetOrName.getName === 'function' ? sheetOrName.getName() : (sheetOrName.name || null);
    if (sName) {
      var sc = SheetCache_getScriptCache();
      if (sc) {
        try { sc.remove('sheet_data_' + sName); } catch (e) {}
      }
    }
  } else if (typeof sheetOrName === 'string') {
    var sc = SheetCache_getScriptCache();
    if (sc) {
      try { sc.remove('sheet_data_' + sheetOrName); } catch (e) {}
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SheetCache_getRows: SheetCache_getRows,
    SheetCache_clear: SheetCache_clear,
    _cacheEncodeRows: _cacheEncodeRows,
    _cacheDecodeRows: _cacheDecodeRows
  };
}
