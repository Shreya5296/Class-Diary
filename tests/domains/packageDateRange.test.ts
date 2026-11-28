import { describe, it, expect } from 'vitest';
import { computeActivePackageDateRange } from '../../src/domains/students/packageDateRange';
import { Package } from '../../src/domains/packages/packageTypes';

describe('Fix L7: computeActivePackageDateRange', () => {
  it('computes earliest start date to latest end date across multiple active packages after renewal', () => {
    const packages: Package[] = [
      {
        package_id: 'pkg_old',
        status: 'ACTIVE',
        start_date: '2026-12-02',
        end_date: '2026-12-23',
      } as Package,
      {
        package_id: 'pkg_renewed',
        status: 'ACTIVE',
        start_date: '2026-12-24',
        end_date: '2027-01-20',
      } as Package,
    ];

    const result = computeActivePackageDateRange(packages);
    expect(result).not.toBeNull();
    expect(result?.earliestStart).toBe('2026-12-02');
    expect(result?.latestEnd).toBe('2027-01-20');
    expect(result?.formattedRange).toContain('02-12-2026');
    expect(result?.formattedRange).toContain('20-01-2027');
  });

  it('excludes VOID and CANCELLED packages from the date range calculation', () => {
    const packages: Package[] = [
      {
        package_id: 'pkg_void',
        status: 'VOID',
        start_date: '2026-01-01',
        end_date: '2026-01-31',
      } as Package,
      {
        package_id: 'pkg_active',
        status: 'ACTIVE',
        start_date: '2026-05-01',
        end_date: '2026-06-01',
      } as Package,
      {
        package_id: 'pkg_cancelled',
        status: 'CANCELLED',
        start_date: '2026-07-01',
        end_date: '2026-08-01',
      } as Package,
    ];

    const result = computeActivePackageDateRange(packages);
    expect(result).not.toBeNull();
    expect(result?.earliestStart).toBe('2026-05-01');
    expect(result?.latestEnd).toBe('2026-06-01');
  });

  it('returns null when there are no active packages', () => {
    expect(computeActivePackageDateRange([])).toBeNull();
    expect(computeActivePackageDateRange([
      { package_id: 'pkg_1', status: 'VOID', start_date: '2026-01-01' } as Package,
      { package_id: 'pkg_2', status: 'CANCELLED', start_date: '2026-02-01' } as Package,
    ])).toBeNull();
  });
});
