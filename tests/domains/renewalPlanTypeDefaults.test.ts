import { describe, it, expect } from 'vitest';
import {
  resolveRenewalPlanType,
  resolveLatestActivePackage,
} from '../../src/domains/packages/useStudentRenewalForm';
import { Package } from '../../src/domains/packages/packageTypes';

describe('Fix L6: Renew Package wizard plan type defaults', () => {
  it('correctly defaults to "Package" for "Package", "PACKAGE", and "Package (Class Block)"', () => {
    expect(resolveRenewalPlanType({ plan_type: 'Package' } as Package)).toBe('Package');
    expect(resolveRenewalPlanType({ plan_type: 'PACKAGE' } as Package)).toBe('Package');
    expect(resolveRenewalPlanType({ plan_type: 'Package (Class Block)' } as Package)).toBe('Package');
    expect(resolveRenewalPlanType({ package_name: '12-Session Package Block' } as Package)).toBe('Package');
  });

  it('correctly defaults to "Per Class" for "Per Class" and "PER_CLASS"', () => {
    expect(resolveRenewalPlanType({ plan_type: 'Per Class' } as Package)).toBe('Per Class');
    expect(resolveRenewalPlanType({ plan_type: 'PER_CLASS' } as Package)).toBe('Per Class');
  });

  it('falls back to default fallback when package has no plan type', () => {
    expect(resolveRenewalPlanType(null, 'Per Class')).toBe('Per Class');
    expect(resolveRenewalPlanType({} as Package, 'Per Class')).toBe('Per Class');
  });

  it('resolveLatestActivePackage selects the latest non-void active package', () => {
    const packages: Package[] = [
      { package_id: 'pkg_1', status: 'COMPLETED', start_date: '2026-01-01', plan_type: 'Per Class' } as Package,
      { package_id: 'pkg_2', status: 'ACTIVE', start_date: '2026-06-01', plan_type: 'Package (Class Block)' } as Package,
      { package_id: 'pkg_3', status: 'VOID', start_date: '2026-07-01', plan_type: 'Hourly' } as Package,
    ];

    const latest = resolveLatestActivePackage(packages);
    expect(latest?.package_id).toBe('pkg_2');
    expect(resolveRenewalPlanType(latest)).toBe('Package');
  });
});
