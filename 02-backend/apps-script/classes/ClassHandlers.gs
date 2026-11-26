/**
 * ClassHandlers: Adapts API requests to ClassService calls and registers operations.
 */

var _clsSvcH = typeof Classes_schedule === 'function' ? {
  Classes_schedule: Classes_schedule,
  Classes_batchSchedule: Classes_batchSchedule,
  Classes_generateForPackage: Classes_generateForPackage,
  Classes_complete: Classes_complete,
  Classes_cancel: Classes_cancel,
  Classes_restoreCredit: Classes_restoreCredit,
  Classes_update: Classes_update,
  Classes_batchUpdate: Classes_batchUpdate
} : (typeof require !== 'undefined' ? require('./ClassService.gs') : null);
var _clsRepoH = typeof Classes_repoUpdate === 'function' ? { Classes_getAll: Classes_getAll, Classes_update: Classes_repoUpdate } : (typeof Classes_getAll === 'function' ? { Classes_getAll: Classes_getAll, Classes_update: Classes_update } : (typeof require !== 'undefined' ? require('./ClassRepository.gs') : null));

function registerClassOperations(router) {
  var reg = router && router.registerOperation ? router.registerOperation : (typeof registerOperation === 'function' ? registerOperation : null);
  if (!reg) return;

  reg('classes.list', function(ctx) {
    var studentId = ctx.payload && (ctx.payload.studentId || ctx.payload.student_id);
    var scope = ctx.payload && ctx.payload.scope;
    var all = _clsRepoH.Classes_getAll(ctx.spreadsheet);

    var filtered = all.filter(function(c) {
      if (studentId && c.student_id !== studentId) return false;
      if (scope === 'upcoming') {
        var start = c.scheduled_start || (c.schedule_date + 'T' + (c.schedule_time || '00:00:00'));
        var nowStr = new Date().toISOString();
        if (start < nowStr && c.session_status !== 'SCHEDULED') return false;
      } else if (scope === 'past') {
        var start = c.scheduled_start || (c.schedule_date + 'T' + (c.schedule_time || '00:00:00'));
        var nowStr = new Date().toISOString();
        if (start >= nowStr || c.session_status === 'SCHEDULED') return false;
      }
      return true;
    }).map(function(c) {
      var copy = Object.assign({}, c);
      copy.session_id = c.session_id || (c.student_id + '__' + c.schedule_date + '__' + c.schedule_time);
      copy.topic = (c.student_name || 'Class') + ' - Session';
      copy.class_title = copy.topic;
      copy.start_time = c.schedule_time || c.start_time;
      copy.status = c.session_status || 'SCHEDULED';
      copy.duration_minutes = Number(c.duration_minutes) || 60;
      copy.session_notes = c.session_notes || '';
      return copy;
    });

    return { success: true, data: filtered };
  });

  var scheduleHandler = function(ctx) {
    return _clsSvcH.Classes_schedule(ctx.spreadsheet, ctx.payload, {
      actorId: ctx.actorId, email: ctx.verifiedEmail, requestId: ctx.requestId
    });
  };
  reg('classes.create', scheduleHandler);
  reg('classes.schedule', scheduleHandler);

  reg('classes.batchSchedule', function(ctx) {
    var p = ctx.payload || ctx.data || {};
    return _clsSvcH.Classes_batchSchedule(ctx.spreadsheet, p, {
      actorId: ctx.actorId, email: ctx.verifiedEmail, requestId: ctx.requestId
    });
  });

  reg('classes.generateForPackage', function(ctx) {
    var p = ctx.payload || ctx.data || {};
    return _clsSvcH.Classes_generateForPackage(ctx.spreadsheet, p, {
      actorId: ctx.actorId, email: ctx.verifiedEmail, requestId: ctx.requestId
    });
  });

  var completeHandler = function(ctx) {
    return _clsSvcH.Classes_complete(ctx.spreadsheet, ctx.payload, {
      actorId: ctx.actorId, email: ctx.verifiedEmail, requestId: ctx.requestId
    });
  };
  reg('classes.complete', completeHandler);
  reg('classes.recordAttendance', completeHandler);

  reg('classes.cancel', function(ctx) {
    return _clsSvcH.Classes_cancel(ctx.spreadsheet, ctx.payload, {
      actorId: ctx.actorId, email: ctx.verifiedEmail, requestId: ctx.requestId
    });
  });

  reg('classes.restoreCredit', function(ctx) {
    return _clsSvcH.Classes_restoreCredit(ctx.spreadsheet, ctx.payload, {
      actorId: ctx.actorId, email: ctx.verifiedEmail, requestId: ctx.requestId
    });
  });

  reg('classes.update', function(ctx) {
    var p = ctx.payload || ctx.data || {};
    var id = p.class_session_id || p.session_id || p._rowIndex || p.rowIndex;
    if (!id) return { success: false, code: 'VALIDATION_ERROR', message: 'Class session ID or row index is required' };
    return _clsSvcH.Classes_update(ctx.spreadsheet, p, {
      actorId: ctx.actorId, email: ctx.verifiedEmail, requestId: ctx.requestId
    });
  });

  reg('classes.batchUpdate', function(ctx) {
    var p = ctx.payload || ctx.data || {};
    var items = p.updates || p.sessions || [];
    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, code: 'VALIDATION_ERROR', message: 'No updates provided' };
    }
    return _clsSvcH.Classes_batchUpdate(ctx.spreadsheet, p, {
      actorId: ctx.actorId, email: ctx.verifiedEmail, requestId: ctx.requestId
    });
  });
}

if (typeof registerOperation === 'function') {
  registerClassOperations({ registerOperation: registerOperation });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { registerClassOperations: registerClassOperations };
}
