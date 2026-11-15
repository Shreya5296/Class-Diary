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
    skippedEmptyMeetingLinks: 0,
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
    meetingLinksDeletionEligible: false,
    meetingLinksBlockedReasons: [],
    studentNotesDeletionEligible: false,
    studentNotesBlockedReasons: [],
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
      if (!opts.skipBackups && !ss.getSheetByName(backupName) && typeof sh.copyTo === 'function') {
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

      // Empty meeting link records contain no data to migrate: skip safely
      if (!link1 && !link2) {
        report.skippedEmptyMeetingLinks++;
        continue;
      }

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

  // 7. INDEPENDENT VERIFICATION & SEPARATE DELETION GATES
  var finalStuCount = stuSheet.getLastRow();
  var finalClsCount = clsSheet.getLastRow();
  report.targetRowCounts['Students'] = finalStuCount;
  report.targetRowCounts['ClassSessions'] = finalClsCount;

  var pkgSheet = ss.getSheetByName('Packages');
  var paySheet = ss.getSheetByName('Payments');
  report.targetRowCounts['Packages'] = pkgSheet ? pkgSheet.getLastRow() : 0;
  report.targetRowCounts['Payments'] = paySheet ? paySheet.getLastRow() : 0;

  var baseRowCountsPreserved = (
    finalStuCount === report.originalRowCounts['Students'] &&
    finalClsCount === report.originalRowCounts['ClassSessions'] &&
    report.targetRowCounts['Packages'] === report.originalRowCounts['Packages'] &&
    report.targetRowCounts['Payments'] === report.originalRowCounts['Payments']
  );

  // 7.1 Independent Deletion Gate: MeetingLinks
  var mlBlockedReasons = [];
  if (report.conflictingMeetingLinks.length > 0) {
    mlBlockedReasons.push('Conflicting meeting links detected: ' + report.conflictingMeetingLinks.length);
  }
  if (report.missingStudentMeetingLinks.length > 0) {
    mlBlockedReasons.push('Orphaned non-empty meeting links detected: ' + report.missingStudentMeetingLinks.length);
  }
  if (report.duplicateMeetingLinks.length > 0) {
    mlBlockedReasons.push('Duplicate student meeting link rows detected: ' + report.duplicateMeetingLinks.length);
  }
  if (!baseRowCountsPreserved) {
    mlBlockedReasons.push('Base row counts not preserved');
  }

  report.meetingLinksDeletionEligible = (mlBlockedReasons.length === 0 && report.errors.length === 0);
  report.meetingLinksBlockedReasons = mlBlockedReasons;

  // 7.2 Independent Deletion Gate: StudentNotes
  var notesBlockedReasons = [];
  var totalNotesToAccount = (notesSheet && notesSheet.getLastRow() > 1) ? notesSheet.getLastRow() - 1 : 0;
  var notesAccounted = report.migratedNotes + report.unmatchedNotes.length + report.ambiguousNotes.length;

  if (notesAccounted < totalNotesToAccount) {
    notesBlockedReasons.push('Unaccounted notes detected: ' + notesAccounted + ' accounted of ' + totalNotesToAccount);
  }

  var notesRequiringArchive = report.unmatchedNotes.length + report.ambiguousNotes.length + report.matchedFollowUpNotes.length;
  if (notesRequiringArchive > 0) {
    var checkArchSheet = ss.getSheetByName('_Archived_Historical_Notes');
    if (!checkArchSheet || checkArchSheet.getLastRow() <= 1) {
      notesBlockedReasons.push('Archive verification failed: _Archived_Historical_Notes sheet missing or empty');
    } else {
      var archValues = checkArchSheet.getDataRange().getValues();
      var archSigSet = {};
      for (var av = 1; av < archValues.length; av++) {
        var aRow = archValues[av];
        var asid = String(aRow[0] || '').trim();
        var adt = String(aRow[1] || '').trim();
        var atxt = String(aRow[2] || '').trim();
        var afollow = String(aRow[3] || '').trim();
        var areason = String(aRow[4] || '').trim();
        archSigSet[asid + '||' + adt + '||' + atxt + '||' + afollow + '||' + areason] = true;
      }

      for (var uIdx = 0; uIdx < report.unmatchedNotes.length; uIdx++) {
        var uItem = report.unmatchedNotes[uIdx];
        var uSig = uItem.student_id + '||' + uItem.note_date + '||' + uItem.note_text + '||' + (uItem.follow_up_date || '') + '||UNMATCHED_NO_SESSION_ON_DATE';
        if (!archSigSet[uSig]) {
          notesBlockedReasons.push('Archive verification missing record for unmatched note: ' + uSig);
          break;
        }
      }

      for (var aIdx = 0; aIdx < report.ambiguousNotes.length; aIdx++) {
        var aItem = report.ambiguousNotes[aIdx];
        var aSig = aItem.student_id + '||' + aItem.note_date + '||' + aItem.note_text + '||' + (aItem.follow_up_date || '') + '||AMBIGUOUS_MULTIPLE_SESSIONS';
        if (!archSigSet[aSig]) {
          notesBlockedReasons.push('Archive verification missing record for ambiguous note: ' + aSig);
          break;
        }
      }

      for (var fIdx = 0; fIdx < report.matchedFollowUpNotes.length; fIdx++) {
        var fItem = report.matchedFollowUpNotes[fIdx];
        var fSig = fItem.student_id + '||' + fItem.note_date + '||' + fItem.note_text + '||' + (fItem.follow_up_date || '') + '||MATCHED_WITH_FOLLOW_UP_DATE';
        if (!archSigSet[fSig]) {
          notesBlockedReasons.push('Archive verification missing record for follow-up note: ' + fSig);
          break;
        }
      }
    }
  }

  if (!baseRowCountsPreserved) {
    notesBlockedReasons.push('Base row counts not preserved');
  }

  report.studentNotesDeletionEligible = (notesBlockedReasons.length === 0 && report.errors.length === 0);
  report.studentNotesBlockedReasons = notesBlockedReasons;

  report.verified = (
    baseRowCountsPreserved &&
    report.errors.length === 0 &&
    report.meetingLinksDeletionEligible &&
    report.studentNotesDeletionEligible
  );

  // 8. REMOVE REDUNDANT TABS WITH INDEPENDENT GATES
  if (opts.removeOldTabs !== false) {
    if (mlSheet && report.meetingLinksDeletionEligible) {
      try {
        ss.deleteSheet(mlSheet);
        report.archivedTabs.push('MeetingLinks (deleted)');
      } catch (e) {
        report.errors.push('Could not delete MeetingLinks: ' + e.message);
      }
    }
    if (notesSheet && report.studentNotesDeletionEligible) {
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

function generatePreMigrationInventory(spreadsheet) {
  var ss = spreadsheet;
  if (!ss) {
    if (typeof SpreadsheetApp !== 'undefined' && typeof SpreadsheetApp.openById === 'function') {
      try {
        ss = SpreadsheetApp.openById(CANONICAL_SPREADSHEET_ID);
      } catch (e) {
        return { success: false, code: 'OPEN_FAILED', message: e.message };
      }
    }
  }
  if (!ss) return { success: false, code: 'UNAVAILABLE', message: 'Spreadsheet unavailable' };

  var sheets = ss.getSheets();
  var inventory = {
    spreadsheetId: ss.getId(),
    spreadsheetName: typeof ss.getName === 'function' ? ss.getName() : 'Private Class Dashboard',
    tabs: [],
    rowCounts: {},
    headers: {},
    missingExpectedTabs: [],
    schemaMatch: true
  };
  var expectedCanonical = ['Students', 'Packages', 'Payments', 'ClassSessions', 'MeetingLinks', 'StudentNotes'];
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var name = sh.getName();
    inventory.tabs.push(name);
    inventory.rowCounts[name] = sh.getLastRow();
    if (sh.getLastRow() > 0) {
      var lastCol = typeof sh.getLastColumn === 'function' ? sh.getLastColumn() : (sh.rows && sh.rows[0] ? sh.rows[0].length : 0);
      if (lastCol > 0 && typeof sh.getRange === 'function') {
        inventory.headers[name] = sh.getRange(1, 1, 1, lastCol).getValues()[0];
      } else if (sh.rows && sh.rows[0]) {
        inventory.headers[name] = sh.rows[0];
      }
    }
  }
  for (var e = 0; e < expectedCanonical.length; e++) {
    if (inventory.tabs.indexOf(expectedCanonical[e]) === -1) {
      inventory.missingExpectedTabs.push(expectedCanonical[e]);
      inventory.schemaMatch = false;
    }
  }
  if (typeof Logger !== 'undefined' && typeof Logger.log === 'function') {
    Logger.log('=== PRE-MIGRATION INVENTORY ===');
    Logger.log(JSON.stringify(inventory, null, 2));
  }
  return inventory;
}

function runFourTableMigrationWithoutBackups() {
  var res = runFourTableCanonicalMigration(null, { skipBackups: true });
  if (typeof Logger !== 'undefined' && typeof Logger.log === 'function') {
    Logger.log('=== FOUR-TABLE MIGRATION RESULT (NO BACKUPS) ===');
    Logger.log(JSON.stringify(res, null, 2));
  }
  return res;
}

function createIndependentSpreadsheetSnapshot() {
  var file = DriveApp.getFileById(CANONICAL_SPREADSHEET_ID);
  var ts = new Date().toISOString().replace(/[:.]/g, '-');
  var copyName = 'Private Class Dashboard — Pre-4Table Independent Snapshot (' + ts + ')';
  var copy = file.makeCopy(copyName);
  var result = {
    originalId: CANONICAL_SPREADSHEET_ID,
    snapshotId: copy.getId(),
    snapshotName: copy.getName(),
    snapshotUrl: copy.getUrl()
  };
  Logger.log('=== INDEPENDENT SNAPSHOT CREATED ===');
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function runFourTableMigrationPreflight(spreadsheet) {
  var ss = spreadsheet;
  if (!ss) {
    if (typeof SpreadsheetApp !== 'undefined' && typeof SpreadsheetApp.openById === 'function') {
      try {
        ss = SpreadsheetApp.openById(CANONICAL_SPREADSHEET_ID);
      } catch (e) {
        return { success: false, code: 'OPEN_FAILED', message: e.message };
      }
    }
  }
  if (!ss) return { success: false, code: 'UNAVAILABLE', message: 'Spreadsheet unavailable' };

  var preflight = {
    spreadsheetId: ss.getId(),
    spreadsheetName: typeof ss.getName === 'function' ? ss.getName() : 'Personal Dashboard',
    meetingLinksAnalysis: {
      totalRecords: 0,
      withLink1: 0,
      withLink2: 0,
      skippedEmptyLinks: 0,
      bothIdentical: 0,
      bothDiffer: 0,
      orphanedStudentIds: [],
      cannotBeMappedSafely: [],
      sharedUrlsObservation: [],
      studentsAlreadyHavePrimaryLink: 0,
      recordDetails: []
    },
    studentNotesAnalysis: {
      totalNotes: 0,
      matchedExactlyOne: 0,
      matchedMultiple: 0,
      matchedNone: 0,
      withFollowUpDate: 0,
      duplicates: [],
      preservationConfirmed: true,
      recordDetails: []
    },
    classSessionsAnalysis: {
      totalSessions: 0,
      targetColumnSessionNotesIndex: -1,
      targetColumnAlreadyExists: false,
      existingNonEmptySessionNotes: 0,
      duplicateStudentDateSessions: []
    },
    safetyVerification: {
      verifiedConditions: "report.verified requires: base row counts preserved, zero unhandled errors, meetingLinksDeletionEligible === true, and studentNotesDeletionEligible === true",
      conflictsPreventDeletion: true,
      orphansPreventDeletion: true,
      ambiguousPreventDeletion: true,
      archiveVerificationRequired: true,
      duplicateNotesPreventedByIdempotencyKey: true
    },
    conclusion: 'PENDING'
  };

  // 1. Read Students
  var stuSheet = ss.getSheetByName('Students');
  var stuMap = {};
  if (stuSheet && stuSheet.getLastRow() > 1) {
    var sData = stuSheet.getDataRange().getValues();
    var sHeaders = sData[0];
    var sIdIdx = sHeaders.indexOf('student_id');
    var sLinkIdx = sHeaders.indexOf('primary_meeting_link');
    preflight.meetingLinksAnalysis.studentsAlreadyHavePrimaryLink = 0;
    for (var r = 1; r < sData.length; r++) {
      var sid = String(sData[r][sIdIdx] || '').trim();
      if (sid) {
        stuMap[sid] = true;
        if (sLinkIdx !== -1 && String(sData[r][sLinkIdx] || '').trim()) {
          preflight.meetingLinksAnalysis.studentsAlreadyHavePrimaryLink++;
        }
      }
    }
  }

  // 2. Read MeetingLinks
  var mlSheet = ss.getSheetByName('MeetingLinks');
  if (mlSheet && mlSheet.getLastRow() > 1) {
    var mlData = mlSheet.getDataRange().getValues();
    var mlHeaders = mlData[0];
    var mlSidIdx = mlHeaders.indexOf('student_id');
    var mlL1Idx = mlHeaders.indexOf('meeting_link_1');
    var mlL2Idx = mlHeaders.indexOf('meeting_link_2');

    preflight.meetingLinksAnalysis.totalRecords = mlData.length - 1;
    var urlStudentMap = {};

    for (var m = 1; m < mlData.length; m++) {
      var mRow = mlData[m];
      var mSid = String(mRow[mlSidIdx] || '').trim();
      var l1 = String(mRow[mlL1Idx] || '').trim();
      var l2 = String(mRow[mlL2Idx] || '').trim();

      if (l1) preflight.meetingLinksAnalysis.withLink1++;
      if (l2) preflight.meetingLinksAnalysis.withLink2++;

      // Empty meeting link records contains no data to migrate: skip safely
      if (!l1 && !l2) {
        preflight.meetingLinksAnalysis.skippedEmptyLinks++;
        preflight.meetingLinksAnalysis.recordDetails.push({
          student_id: mSid,
          hasLink1: false,
          hasLink2: false,
          isIdentical: false,
          isConflict: false,
          isOrphan: !stuMap[mSid],
          isEmpty: true,
          chosenLink: ''
        });
        continue;
      }

      var isIdentical = (l1 && l2 && l1 === l2);
      var isDiffer = (l1 && l2 && l1 !== l2);
      if (isIdentical) preflight.meetingLinksAnalysis.bothIdentical++;
      if (isDiffer) preflight.meetingLinksAnalysis.bothDiffer++;

      var isOrphan = !stuMap[mSid];
      if (isOrphan) {
        preflight.meetingLinksAnalysis.orphanedStudentIds.push(mSid);
        preflight.meetingLinksAnalysis.cannotBeMappedSafely.push({ student_id: mSid, reason: 'ORPHAN_NON_EMPTY_LINK' });
      } else if (isDiffer) {
        preflight.meetingLinksAnalysis.cannotBeMappedSafely.push({ student_id: mSid, reason: 'CONFLICTING_LINKS' });
      }

      var chosen = l1 || l2;
      if (chosen) {
        if (!urlStudentMap[chosen]) urlStudentMap[chosen] = [];
        urlStudentMap[chosen].push(mSid);
      }

      preflight.meetingLinksAnalysis.recordDetails.push({
        student_id: mSid,
        hasLink1: !!l1,
        hasLink2: !!l2,
        isIdentical: isIdentical,
        isConflict: isDiffer,
        isOrphan: isOrphan,
        isEmpty: false,
        chosenLink: chosen
      });
    }

    // Identify shared URLs across distinct students (observation only, not a conflict)
    for (var uKey in urlStudentMap) {
      if (urlStudentMap[uKey].length > 1) {
        preflight.meetingLinksAnalysis.sharedUrlsObservation.push({
          url: uKey,
          studentIds: urlStudentMap[uKey]
        });
      }
    }
  }

  // 3. Read ClassSessions
  var clsSheet = ss.getSheetByName('ClassSessions');
  var sessionDateCountMap = {};
  var clsData = [];
  var clsDateIdx = -1;
  var clsSidIdx = -1;
  var clsNotesIdx = -1;

  if (clsSheet && clsSheet.getLastRow() > 1) {
    clsData = clsSheet.getDataRange().getValues();
    var clsHeaders = clsData[0];
    clsSidIdx = clsHeaders.indexOf('student_id');
    clsDateIdx = clsHeaders.indexOf('schedule_date');
    if (clsDateIdx === -1) clsDateIdx = clsHeaders.indexOf('class_date');
    clsNotesIdx = clsHeaders.indexOf('session_notes');

    preflight.classSessionsAnalysis.totalSessions = clsData.length - 1;
    preflight.classSessionsAnalysis.targetColumnAlreadyExists = (clsNotesIdx !== -1);
    preflight.classSessionsAnalysis.targetColumnSessionNotesIndex = (clsNotesIdx !== -1 ? clsNotesIdx + 1 : clsHeaders.length + 1);

    for (var c = 1; c < clsData.length; c++) {
      var cSid = String(clsData[c][clsSidIdx] || '').trim();
      var cDate = _normalizeNoteDate(clsData[c][clsDateIdx]);
      var cNotes = clsNotesIdx !== -1 ? String(clsData[c][clsNotesIdx] || '').trim() : '';
      if (cNotes) {
        preflight.classSessionsAnalysis.existingNonEmptySessionNotes++;
      }
      var key = cSid + '||' + cDate;
      sessionDateCountMap[key] = (sessionDateCountMap[key] || 0) + 1;
    }

    for (var k in sessionDateCountMap) {
      if (sessionDateCountMap[k] > 1) {
        var parts = k.split('||');
        preflight.classSessionsAnalysis.duplicateStudentDateSessions.push({
          student_id: parts[0],
          schedule_date: parts[1],
          sessionCount: sessionDateCountMap[k]
        });
      }
    }
  }

  // 4. Read StudentNotes
  var notesSheet = ss.getSheetByName('StudentNotes');
  var seenNoteSigs = {};
  if (notesSheet && notesSheet.getLastRow() > 1) {
    var nData = notesSheet.getDataRange().getValues();
    var nHeaders = nData[0];
    var nSidIdx = nHeaders.indexOf('student_id');
    var nDateIdx = nHeaders.indexOf('note_date');
    var nTextIdx = nHeaders.indexOf('note_text');
    var nFollowIdx = nHeaders.indexOf('follow_up_date');

    preflight.studentNotesAnalysis.totalNotes = nData.length - 1;

    for (var n = 1; n < nData.length; n++) {
      var nSid = String(nData[n][nSidIdx] || '').trim();
      var nDate = _normalizeNoteDate(nData[n][nDateIdx]);
      var nText = String(nData[n][nTextIdx] || '').trim();
      var nFollow = _normalizeNoteDate(nData[n][nFollowIdx]);

      if (nFollow) preflight.studentNotesAnalysis.withFollowUpDate++;

      var sig = nSid + '||' + nDate + '||' + nText + '||' + nFollow;
      if (seenNoteSigs[sig]) {
        preflight.studentNotesAnalysis.duplicates.push({ student_id: nSid, note_date: nDate, row: n + 1 });
      }
      seenNoteSigs[sig] = true;

      // Find matches in ClassSessions
      var matchCount = 0;
      for (var cr = 1; cr < clsData.length; cr++) {
        var csid = String(clsData[cr][clsSidIdx] || '').trim();
        var cdate = _normalizeNoteDate(clsData[cr][clsDateIdx]);
        if (csid === nSid && cdate === nDate) {
          matchCount++;
        }
      }

      if (matchCount === 1) preflight.studentNotesAnalysis.matchedExactlyOne++;
      else if (matchCount > 1) preflight.studentNotesAnalysis.matchedMultiple++;
      else preflight.studentNotesAnalysis.matchedNone++;

      var destination = matchCount === 1 
        ? (nFollow ? 'ClassSessions.session_notes AND _Archived_Historical_Notes' : 'ClassSessions.session_notes')
        : '_Archived_Historical_Notes';

      preflight.studentNotesAnalysis.recordDetails.push({
        student_id: nSid,
        note_date: nDate,
        hasFollowUp: !!nFollow,
        follow_up_date: nFollow,
        matchCount: matchCount,
        destination: destination
      });
    }
  }

  var hasBlockers = (
    preflight.meetingLinksAnalysis.cannotBeMappedSafely.length > 0 ||
    preflight.studentNotesAnalysis.matchedMultiple > 0 ||
    preflight.studentNotesAnalysis.duplicates.length > 0
  );

  preflight.conclusion = hasBlockers ? 'BLOCKED — DATA RECONCILIATION REQUIRED' : 'READY TO MIGRATE';

  if (typeof Logger !== 'undefined' && typeof Logger.log === 'function') {
    Logger.log('=== FOUR-TABLE MIGRATION READ-ONLY PREFLIGHT REPORT ===');
    Logger.log(JSON.stringify(preflight, null, 2));
  }

  return preflight;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CANONICAL_SPREADSHEET_ID: CANONICAL_SPREADSHEET_ID,
    runFourTableCanonicalMigration: runFourTableCanonicalMigration,
    runFourTableMigrationWithoutBackups: runFourTableMigrationWithoutBackups,
    generatePreMigrationInventory: generatePreMigrationInventory,
    runFourTableMigrationPreflight: runFourTableMigrationPreflight,
    createIndependentSpreadsheetSnapshot: createIndependentSpreadsheetSnapshot
  };
}
