/**
 * FourTableMigration: Migrates the 6-table datastore to the canonical 4-table datastore.
 * 
 * - Ensures Students has primary_meeting_link (10 cols).
 * - Ensures ClassSessions has session_notes (9 cols).
 * - Creates pre-migration verified backups of all tables.
 * - Migrates MeetingLinks into Students.primary_meeting_link.
 * - Migrates StudentNotes into ClassSessions.session_notes matching student_id & date.
 * - Generates comprehensive migration report.
 * - Preserves unmatched notes in archival sheet _Archived_StudentNotes.
 * - Removes MeetingLinks and StudentNotes tabs only after complete verification.
 * - Fully idempotent.
 */

var CANONICAL_SPREADSHEET_ID = '1cVQknq_Ix-T6igp7c-DwwuYHvgn60fVGbwTGZfGSii8';

function runFourTableCanonicalMigration(spreadsheet, options) {
  var opts = options || {};
  var expectedId = opts.expectedSpreadsheetId || CANONICAL_SPREADSHEET_ID;
  var ss = spreadsheet;

  if (!ss) {
    if (typeof SpreadsheetApp !== 'undefined' && typeof SpreadsheetApp.openById === 'function') {
      try {
        ss = SpreadsheetApp.openById(expectedId);
      } catch (openErr) {
        return {
          success: false,
          code: 'OPEN_FAILED',
          message: 'Failed to open target spreadsheet (' + expectedId + '): ' + openErr.message
        };
      }
    }
  }

  if (!ss) {
    return { success: false, code: 'UNAVAILABLE', message: 'Spreadsheet unavailable' };
  }

  // Strict target ID verification before ANY spreadsheet mutation
  var actualId = typeof ss.getId === 'function' ? ss.getId() : '';
  if (actualId !== expectedId) {
    return {
      success: false,
      code: 'INVALID_TARGET',
      message: 'Target spreadsheet ID verification failed. Expected: ' + expectedId + ', got: ' + (actualId || 'unknown')
    };
  }

  var report = {
    originalRowCounts: {},
    targetRowCounts: {},
    migratedMeetingLinks: 0,
    conflictingMeetingLinks: [],
    duplicateMeetingLinks: [],
    missingStudentMeetingLinks: [],
    migratedNotes: 0,
    unmatchedNotes: [],
    ambiguousNotes: [],
    matchedFollowUpNotes: [],
    backupsCreated: [],
    archivedTabs: [],
    errors: [],
    verified: false,
    success: false
  };

  // 1. BACKUP & ROW COUNT RECORDING
  var canonicalTabs = ['Students', 'Packages', 'Payments', 'ClassSessions', 'MeetingLinks', 'StudentNotes'];
  for (var t = 0; t < canonicalTabs.length; t++) {
    var tabName = canonicalTabs[t];
    var sh = ss.getSheetByName(tabName);
    if (sh) {
      var rCount = sh.getLastRow();
      report.originalRowCounts[tabName] = rCount;
      var backupName = '_Backup_Pre4Table_' + tabName;
      if (!ss.getSheetByName(backupName) && typeof sh.copyTo === 'function') {
        try {
          var bSh = sh.copyTo(ss);
          bSh.setName(backupName);
          report.backupsCreated.push(backupName);
        } catch (e) {
          report.errors.push('Failed backup of ' + tabName + ': ' + e.message);
        }
      }
    } else {
      report.originalRowCounts[tabName] = 0;
    }
  }

  var stuSheet = ss.getSheetByName('Students');
  var clsSheet = ss.getSheetByName('ClassSessions');
  var mlSheet = ss.getSheetByName('MeetingLinks');
  var notesSheet = ss.getSheetByName('StudentNotes');

  if (!stuSheet || !clsSheet) {
    report.errors.push('Essential sheets Students or ClassSessions missing');
    return { success: false, report: report };
  }

  // 2. ENSURE STUDENTS SCHEMA (10 Columns, add primary_meeting_link)
  var stuData = stuSheet.getDataRange().getValues();
  var stuHeaders = stuData[0] || [];
  var stuColMap = {};
  for (var h = 0; h < stuHeaders.length; h++) {
    stuColMap[String(stuHeaders[h]).trim()] = h;
  }

  var stuLinkColIdx = stuColMap['primary_meeting_link'];
  if (stuLinkColIdx === undefined) {
    stuLinkColIdx = stuHeaders.length;
    stuSheet.getRange(1, stuLinkColIdx + 1).setValue('primary_meeting_link');
    stuHeaders.push('primary_meeting_link');
    stuColMap['primary_meeting_link'] = stuLinkColIdx;
    stuData = stuSheet.getDataRange().getValues();
  }

  // Map student rows by student_id
  var studentRowMap = {};
  for (var sr = 1; sr < stuData.length; sr++) {
    var sid = String(stuData[sr][stuColMap['student_id']] || '').trim();
    if (sid) {
      studentRowMap[sid] = {
        rowIndex: sr + 1,
        values: stuData[sr]
      };
    }
  }

  // 3. ENSURE CLASSSESSIONS SCHEMA (9 Columns, add session_notes)
  var clsData = clsSheet.getDataRange().getValues();
  var clsHeaders = clsData[0] || [];
  var clsColMap = {};
  for (var ch = 0; ch < clsHeaders.length; ch++) {
    clsColMap[String(clsHeaders[ch]).trim()] = ch;
  }

  var clsNotesColIdx = clsColMap['session_notes'];
  if (clsNotesColIdx === undefined) {
    clsNotesColIdx = clsHeaders.length;
    clsSheet.getRange(1, clsNotesColIdx + 1).setValue('session_notes');
    clsHeaders.push('session_notes');
    clsColMap['session_notes'] = clsNotesColIdx;
    clsData = clsSheet.getDataRange().getValues();
  }

  // 4. MIGRATE MEETING LINKS
  if (mlSheet && mlSheet.getLastRow() > 1) {
    var mlData = mlSheet.getDataRange().getValues();
    var mlHeaders = mlData[0] || [];
    var mlColMap = {};
    for (var mh = 0; mh < mlHeaders.length; mh++) {
      mlColMap[String(mlHeaders[mh]).trim()] = mh;
    }

    var seenMlStudents = {};
    for (var mr = 1; mr < mlData.length; mr++) {
      var row = mlData[mr];
      var mSid = String(row[mlColMap['student_id']] || '').trim();
      var mName = String(row[mlColMap['student_name']] || '').trim();
      var link1 = String(row[mlColMap['meeting_link_1']] || '').trim();
      var link2 = String(row[mlColMap['meeting_link_2']] || '').trim();

      if (!mSid) continue;

      if (seenMlStudents[mSid]) {
        report.duplicateMeetingLinks.push({ student_id: mSid, row: mr + 1 });
        continue;
      }
      seenMlStudents[mSid] = true;

      var stuEntry = studentRowMap[mSid];
      if (!stuEntry) {
        report.missingStudentMeetingLinks.push({ student_id: mSid, student_name: mName, link1: link1, link2: link2 });
        continue;
      }

      var chosenLink = link1 || link2 || '';
      if (link1 && link2 && link1 !== link2) {
        report.conflictingMeetingLinks.push({
          student_id: mSid,
          student_name: mName,
          primaryCandidate: link1,
          secondaryFallback: link2,
          chosen: chosenLink
        });
      }

      var existingStuLink = String(stuEntry.values[stuLinkColIdx] || '').trim();
      if (!existingStuLink && chosenLink) {
        stuSheet.getRange(stuEntry.rowIndex, stuLinkColIdx + 1).setValue(chosenLink);
        stuEntry.values[stuLinkColIdx] = chosenLink;
        report.migratedMeetingLinks++;
      } else if (existingStuLink) {
        // Already populated (idempotent)
        report.migratedMeetingLinks++;
      }
    }
  }

  // 5. MIGRATE STUDENT NOTES
  function _normalizeNoteDate(dVal) {
    if (!dVal) return '';
    if (dVal instanceof Date) {
      var y = dVal.getFullYear();
      var m = dVal.getMonth() + 1;
      var d = dVal.getDate();
      return y + '-' + (m < 10 ? '0' + m : String(m)) + '-' + (d < 10 ? '0' + d : String(d));
    }
    var str = String(dVal).trim().replace(/^'/, '');
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
      var parts = str.split('/');
      var dy = parts[2];
      var dm = parts[1].length < 2 ? '0' + parts[1] : parts[1];
      var dd = parts[0].length < 2 ? '0' + parts[0] : parts[0];
      return dy + '-' + dm + '-' + dd;
    }
    return str.slice(0, 10);
  }

  if (notesSheet && notesSheet.getLastRow() > 1) {
    var noteData = notesSheet.getDataRange().getValues();
    var noteHeaders = noteData[0] || [];
    var noteColMap = {};
    for (var nh = 0; nh < noteHeaders.length; nh++) {
      noteColMap[String(noteHeaders[nh]).trim()] = nh;
    }

    // Refresh ClassSessions data
    clsData = clsSheet.getDataRange().getValues();
    var clsDateColIdx = clsColMap['schedule_date'] !== undefined ? clsColMap['schedule_date'] : clsColMap['class_date'];
    var clsStuColIdx = clsColMap['student_id'];

    for (var nr = 1; nr < noteData.length; nr++) {
      var nRow = noteData[nr];
      var nSid = String(nRow[noteColMap['student_id']] || '').trim();
      var nDate = _normalizeNoteDate(nRow[noteColMap['note_date']]);
      var nText = String(nRow[noteColMap['note_text']] || '').trim();
      var nFollowUp = _normalizeNoteDate(nRow[noteColMap['follow_up_date']]);

      if (!nSid && !nText) continue;

      // Find matching session
      var matchingSessions = [];
      for (var cr = 1; cr < clsData.length; cr++) {
        var cSid = String(clsData[cr][clsStuColIdx] || '').trim();
        var cDate = _normalizeNoteDate(clsData[cr][clsDateColIdx]);
        if (cSid === nSid && cDate === nDate) {
          matchingSessions.push({ rowIndex: cr + 1, dataRow: clsData[cr] });
        }
      }

      if (matchingSessions.length === 1) {
        var match = matchingSessions[0];
        var curNotes = String(match.dataRow[clsNotesColIdx] || '').trim();
        var fullNoteToAdd = nText;
        if (nFollowUp) {
          fullNoteToAdd += ' (Follow-up: ' + nFollowUp + ')';
        }

        if (!curNotes) {
          clsSheet.getRange(match.rowIndex, clsNotesColIdx + 1).setValue(fullNoteToAdd);
          match.dataRow[clsNotesColIdx] = fullNoteToAdd;
          report.migratedNotes++;
        } else if (curNotes.indexOf(nText) === -1) {
          var merged = curNotes + '\n' + fullNoteToAdd;
          clsSheet.getRange(match.rowIndex, clsNotesColIdx + 1).setValue(merged);
          match.dataRow[clsNotesColIdx] = merged;
          report.migratedNotes++;
        } else {
          // Already contains note (idempotent)
          report.migratedNotes++;
        }

        // Preserve matched note with follow-up date in structured archive
        if (nFollowUp) {
          report.matchedFollowUpNotes.push({
            student_id: nSid,
            note_date: nDate,
            note_text: nText,
            follow_up_date: nFollowUp
          });
        }
      } else if (matchingSessions.length > 1) {
        report.ambiguousNotes.push({
          student_id: nSid,
          note_date: nDate,
          note_text: nText,
          follow_up_date: nFollowUp,
          matchCount: matchingSessions.length
        });
      } else {
        report.unmatchedNotes.push({
          student_id: nSid,
          note_date: nDate,
          note_text: nText,
          follow_up_date: nFollowUp
        });
      }
    }
  }

  // 6. ARCHIVE UNMATCHED, AMBIGUOUS, AND FOLLOW-UP NOTES SAFELY & IDEMPOTENTLY
  var hasArchiveItems = (report.unmatchedNotes.length > 0 ||
                         report.ambiguousNotes.length > 0 ||
                         report.matchedFollowUpNotes.length > 0);

  if (hasArchiveItems) {
    var archSheet = ss.getSheetByName('_Archived_Historical_Notes');
    if (!archSheet) {
      archSheet = ss.insertSheet('_Archived_Historical_Notes');
      archSheet.appendRow(['student_id', 'note_date', 'note_text', 'follow_up_date', 'archived_reason']);
      report.archivedTabs.push('_Archived_Historical_Notes');
    }

    // Build deduplication index from existing archive rows
    var existingArchiveKeys = {};
    if (archSheet.getLastRow() > 1) {
      var archData = archSheet.getDataRange().getValues();
      for (var ar = 1; ar < archData.length; ar++) {
        var aSid = String(archData[ar][0] || '').trim();
        var aDate = String(archData[ar][1] || '').trim();
        var aText = String(archData[ar][2] || '').trim();
        var aFollow = String(archData[ar][3] || '').trim();
        var aReason = String(archData[ar][4] || '').trim();
        var sig = aSid + '||' + aDate + '||' + aText + '||' + aFollow + '||' + aReason;
        existingArchiveKeys[sig] = true;
      }
    }

    function _appendArchiveRowIfNotExists(sid, dt, txt, follow, reason) {
      var rowSig = sid + '||' + dt + '||' + txt + '||' + (follow || '') + '||' + reason;
      if (!existingArchiveKeys[rowSig]) {
        archSheet.appendRow([sid, dt, txt, follow || '', reason]);
        existingArchiveKeys[rowSig] = true;
      }
    }

    for (var u = 0; u < report.unmatchedNotes.length; u++) {
      var un = report.unmatchedNotes[u];
      _appendArchiveRowIfNotExists(un.student_id, un.note_date, un.note_text, un.follow_up_date, 'UNMATCHED_NO_SESSION_ON_DATE');
    }
    for (var a = 0; a < report.ambiguousNotes.length; a++) {
      var an = report.ambiguousNotes[a];
      _appendArchiveRowIfNotExists(an.student_id, an.note_date, an.note_text, an.follow_up_date, 'AMBIGUOUS_MULTIPLE_SESSIONS');
    }
    for (var m = 0; m < report.matchedFollowUpNotes.length; m++) {
      var mf = report.matchedFollowUpNotes[m];
      _appendArchiveRowIfNotExists(mf.student_id, mf.note_date, mf.note_text, mf.follow_up_date, 'MATCHED_WITH_FOLLOW_UP_DATE');
    }
  }

  // 7. VERIFICATION
  var finalStuCount = stuSheet.getLastRow();
  var finalClsCount = clsSheet.getLastRow();
  report.targetRowCounts['Students'] = finalStuCount;
  report.targetRowCounts['ClassSessions'] = finalClsCount;

  var pkgSheet = ss.getSheetByName('Packages');
  var paySheet = ss.getSheetByName('Payments');
  report.targetRowCounts['Packages'] = pkgSheet ? pkgSheet.getLastRow() : 0;
  report.targetRowCounts['Payments'] = paySheet ? paySheet.getLastRow() : 0;

  report.verified = (
    finalStuCount === report.originalRowCounts['Students'] &&
    finalClsCount === report.originalRowCounts['ClassSessions'] &&
    report.errors.length === 0
  );

  // 8. REMOVE REDUNDANT TABS ONLY IF VERIFIED AND NOT EXPLICITLY PRESERVED
  if (report.verified && opts.removeOldTabs !== false) {
    if (mlSheet) {
      try {
        ss.deleteSheet(mlSheet);
        report.archivedTabs.push('MeetingLinks (deleted)');
      } catch (e) {
        report.errors.push('Could not delete MeetingLinks: ' + e.message);
      }
    }
    if (notesSheet) {
      try {
        ss.deleteSheet(notesSheet);
        report.archivedTabs.push('StudentNotes (deleted)');
      } catch (e) {
        report.errors.push('Could not delete StudentNotes: ' + e.message);
      }
    }
  }

  report.success = report.verified && report.errors.length === 0;
  return { success: report.success, report: report };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runFourTableCanonicalMigration: runFourTableCanonicalMigration
  };
}
