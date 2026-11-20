import { MockSpreadsheet } from '../mocks/MockSpreadsheet';

// @ts-ignore
import SheetRegistry from '../../02-backend/apps-script/sheets/SheetRegistry.gs';
// @ts-ignore
import SpreadsheetBootstrap from '../../02-backend/apps-script/sheets/SpreadsheetBootstrap.gs';
// @ts-ignore
import StudentService from '../../02-backend/apps-script/students/StudentService.gs';
// @ts-ignore
import PackageRepository from '../../02-backend/apps-script/packages/PackageRepository.gs';
// @ts-ignore
import ClassRepository from '../../02-backend/apps-script/classes/ClassRepository.gs';

export function setupExtraClassTestEnvironment() {
  if (typeof globalThis !== 'undefined') {
    delete (globalThis as any).__pkgMemoryMap;
    delete (globalThis as any).__sessionMetaMap;
  }
  const spreadsheet = new MockSpreadsheet();
  SpreadsheetBootstrap.bootstrapSpreadsheet(spreadsheet, SheetRegistry, '1.0.0');
  const actor = { actorId: 'usr_admin', email: 'admin@example.com', requestId: 'req_extra_cls' };

  const sA = StudentService.Students_create(spreadsheet, {
    first_name: 'Alice', parent_guardian_name: 'ParentA', primary_phone: '+919876543201'
  }, actor);
  const studentAId = sA.data.student_id;

  const sB = StudentService.Students_create(spreadsheet, {
    first_name: 'Bob', parent_guardian_name: 'ParentB', primary_phone: '+919876543202'
  }, actor);
  const studentBId = sB.data.student_id;

  function getBackendAvailableBalance(sid: string) {
    const pkgs = PackageRepository.Packages_getByStudentId(spreadsheet, sid) || [];
    let totalPurchased = 0;
    for (let i = 0; i < pkgs.length; i++) {
      totalPurchased += Number(pkgs[i].classes_purchased !== undefined ? pkgs[i].classes_purchased : pkgs[i].purchased_classes) || 0;
    }
    const allSessions = ClassRepository.Classes_getAll(spreadsheet) || [];
    let consumed = 0;
    let reserved = 0;
    for (let j = 0; j < allSessions.length; j++) {
      const s = allSessions[j];
      if (s.student_id !== sid) continue;
      const stat = String(s.session_status || s.status || '').toUpperCase();
      const aStat = String(s.attendance_status || '').toUpperCase();
      if (stat === 'CANCELLED' || aStat === 'CANCELLED') {
        if (s.deduct_class === true || s.deduct_class === 'TRUE' || s.deduct_class === 1) consumed++;
        continue;
      }
      if (stat === 'COMPLETED' || aStat === 'PRESENT' || aStat === 'ATTENDED') {
        if (s.deduct_class !== false && s.deduct_class !== 'false' && s.deduct_class !== 0) consumed++;
        continue;
      }
      if (s.deduct_class === true || s.deduct_class === 'TRUE' || s.deduct_class === 1) {
        consumed++;
      } else if (stat === 'SCHEDULED' || aStat === 'NOT_MARKED') {
        reserved++;
      }
    }
    return {
      totalPurchased,
      consumed,
      reserved,
      available: totalPurchased - consumed - reserved,
    };
  }

  return { spreadsheet, actor, studentAId, studentBId, getBackendAvailableBalance };
}
