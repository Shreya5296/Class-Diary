import { describe, it, expect } from 'vitest';
import {
  getPackageRemainingCredits,
  getStudentTotalRemainingCredits,
  isSessionDeductibleOrConsumed,
} from '../../src/domains/calendar/extraClassAccounting';
import { ClassSession } from '../../src/domains/classes/classTypes';
import { Package } from '../../src/domains/packages/packageTypes';
import { mockPackage1, pastSessionsAlice } from './extraClassTestFixtures';

describe('Frontend Extra-Class Credit Accounting (Tests 1–6)', () => {
  it('Test 1 — Single package: calculates remaining package balance accurately (10 purchased, 4 conducted => 6 remaining)', () => {
    const remainingBefore = getPackageRemainingCredits(mockPackage1, pastSessionsAlice);
    expect(remainingBefore).toBe(6);
  });

  it('Test 2 — Package renewal with carried-forward credits (12 prev, 9 consumed, 3 rem + 12 new => 15 available)', () => {
    const prevPkg: Package = {
      package_id: 'pkg_ren_1', student_id: 'stu_carol', classes_purchased: 12, start_date: '2026-08-01', status: 'EXHAUSTED'
    };
    const newPkg: Package = {
      package_id: 'pkg_ren_2', student_id: 'stu_carol', classes_purchased: 12, start_date: '2026-11-01', status: 'ACTIVE'
    };
    const studentPkgs = [prevPkg, newPkg];

    const nineConducted: ClassSession[] = Array.from({ length: 9 }, (_, i) => ({
      session_id: `cs_${i + 1}`, student_id: 'stu_carol', status: 'COMPLETED', session_status: 'COMPLETED', attendance_status: 'PRESENT', deduct_class: true
    }));

    const prevRem = getPackageRemainingCredits(prevPkg, nineConducted, studentPkgs);
    const newRem = getPackageRemainingCredits(newPkg, nineConducted, studentPkgs);
    expect(prevRem).toBe(3);
    expect(newRem).toBe(12);

    const totalAvailable = getStudentTotalRemainingCredits('stu_carol', studentPkgs, nineConducted);
    expect(totalAvailable).toBe(15);
  });

  it('Test 3 — Multiple packages: chronological consumption matches backend PackageService.gs', () => {
    const p1: Package = { package_id: 'p1', student_id: 'stu_multi', classes_purchased: 5, start_date: '2026-01-01' };
    const p2: Package = { package_id: 'p2', student_id: 'stu_multi', classes_purchased: 5, start_date: '2026-06-01' };
    const allPkgs = [p1, p2];

    const sevenSessions: ClassSession[] = Array.from({ length: 7 }, (_, i) => ({
      session_id: `ms_${i + 1}`, student_id: 'stu_multi', status: 'COMPLETED', session_status: 'COMPLETED', attendance_status: 'PRESENT', deduct_class: true
    }));

    expect(getPackageRemainingCredits(p1, sevenSessions, allPkgs)).toBe(0);
    expect(getPackageRemainingCredits(p2, sevenSessions, allPkgs)).toBe(3);
    expect(getStudentTotalRemainingCredits('stu_multi', allPkgs, sevenSessions)).toBe(3);
  });

  it('Test 4 — Extra class pending: scheduling an extra class does not immediately deduct available credits', () => {
    const pendingExtra: ClassSession = {
      session_id: 'extra_p', student_id: 'stu_alice', schedule_date: '2026-11-24', start_time: '15:00', duration_minutes: 60,
      status: 'SCHEDULED', session_status: 'SCHEDULED', attendance_status: 'NOT_MARKED', deduct_class: false, class_credit_effect: 'PENDING'
    };

    expect(isSessionDeductibleOrConsumed(pendingExtra)).toBe(false);
    const remaining = getPackageRemainingCredits(mockPackage1, [...pastSessionsAlice, pendingExtra]);
    expect(remaining).toBe(6);
  });

  it('Test 5 — Extra class completed: attendance completion deducts exactly one credit', () => {
    const completedExtra: ClassSession = {
      session_id: 'extra_c', student_id: 'stu_alice', schedule_date: '2026-11-24', start_time: '15:00', duration_minutes: 60,
      status: 'COMPLETED', session_status: 'COMPLETED', attendance_status: 'PRESENT', deduct_class: true, class_credit_effect: 'CONSUME'
    };

    expect(isSessionDeductibleOrConsumed(completedExtra)).toBe(true);
    const remaining = getPackageRemainingCredits(mockPackage1, [...pastSessionsAlice, completedExtra]);
    expect(remaining).toBe(5);
  });

  it('Test 6 — Extra class cancelled: cancellation restores credit and preserves package balance', () => {
    const cancelledExtra: ClassSession = {
      session_id: 'extra_x', student_id: 'stu_alice', schedule_date: '2026-11-24', start_time: '15:00',
      status: 'CANCELLED', session_status: 'CANCELLED', attendance_status: 'CANCELLED', deduct_class: false
    };

    expect(isSessionDeductibleOrConsumed(cancelledExtra)).toBe(false);
    const remaining = getPackageRemainingCredits(mockPackage1, [...pastSessionsAlice, cancelledExtra]);
    expect(remaining).toBe(6);
  });
});
