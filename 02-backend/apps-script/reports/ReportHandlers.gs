/**
 * ReportHandlers: Adapts API requests to ReportService calls and registers operations.
 */

var _repSvcH = typeof Reports_getDashboardOverview === 'function' ? {
  Reports_getDashboardOverview: Reports_getDashboardOverview,
  Reports_getFinancialSummary: Reports_getFinancialSummary,
  Reports_getDashboardCombined: Reports_getDashboardCombined,
  Reports_getFinancesCombined: Reports_getFinancesCombined
} : (typeof require !== 'undefined' ? require('./ReportService.gs') : null);

function registerReportOperations(router) {
  var reg = router && router.registerOperation ? router.registerOperation : (typeof registerOperation === 'function' ? registerOperation : null);
  if (!reg) return;

  reg('dashboard.overview', function(ctx) {
    return _repSvcH.Reports_getDashboardOverview(ctx.spreadsheet);
  });

  reg('dashboard.combined', function(ctx) {
    return _repSvcH.Reports_getDashboardCombined(ctx.spreadsheet, ctx.payload);
  });

  reg('reports.financialSummary', function(ctx) {
    return _repSvcH.Reports_getFinancialSummary(ctx.spreadsheet, ctx.payload);
  });

  reg('finances.combined', function(ctx) {
    return _repSvcH.Reports_getFinancesCombined(ctx.spreadsheet, ctx.payload);
  });
}

if (typeof registerOperation === 'function') {
  registerReportOperations({ registerOperation: registerOperation });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { registerReportOperations: registerReportOperations };
}
