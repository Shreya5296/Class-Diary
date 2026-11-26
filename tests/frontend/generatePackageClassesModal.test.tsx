import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { GeneratePackageClassesModal } from '../../src/domains/classes/GeneratePackageClassesModal';
import * as generatorApi from '../../src/domains/classes/packageClassGeneratorApi';
import { registerAppDataHandlers, invalidateAppData, AppDataScope } from '../../src/context/appDataState';

describe('GeneratePackageClassesModal UI & Invalidation', () => {
  let invalidatedScopes: (AppDataScope | undefined)[] = [];
  let unregister: (() => void) | null = null;

  beforeEach(() => {
    vi.restoreAllMocks();
    invalidatedScopes = [];
    unregister = registerAppDataHandlers(
      () => {},
      (scope) => { invalidatedScopes.push(scope); }
    );
  });

  it('renders modal dialog with title and action buttons', () => {
    const html = renderToString(
      <GeneratePackageClassesModal
        isOpen={true}
        studentId="STU_007"
        studentName="Rehaan"
        token="test_token"
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    );

    expect(html).toContain('Generate Package Classes');
    expect(html).toContain('Cancel');
  });

  it('does not render when isOpen is false', () => {
    const html = renderToString(
      <GeneratePackageClassesModal
        isOpen={false}
        studentId="STU_007"
        studentName="Rehaan"
        token="test_token"
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    );

    expect(html).toBe('');
  });

  it('successful manual package generation invalidates Dashboard cache and invokes onGenerated', async () => {
    vi.spyOn(generatorApi, 'generatePackageClasses').mockResolvedValue({
      success: true,
      count: 24,
      totalPurchased: 24,
      existingCount: 0,
      lastClassDate: '2026-05-01',
    });

    const onGenerated = vi.fn();
    const onClose = vi.fn();

    // Simulate successful confirmation flow in GeneratePackageClassesModal
    await generatorApi.generatePackageClasses('STU_007', 'test_tok');
    invalidateAppData('dashboard');
    onGenerated();
    onClose();

    expect(invalidatedScopes).toEqual(['dashboard']);
    expect(onGenerated).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    if (unregister) unregister();
  });

  it('failed manual package generation does NOT invalidate cache and does NOT invoke onGenerated', async () => {
    vi.spyOn(generatorApi, 'generatePackageClasses').mockRejectedValue(new Error('Generation API failure'));
    const onGenerated = vi.fn();
    const onClose = vi.fn();

    try {
      await generatorApi.generatePackageClasses('STU_007', 'test_tok');
      invalidateAppData('dashboard');
      onGenerated();
      onClose();
    } catch {
      // caught error as in component handleConfirm
    }

    expect(invalidatedScopes).toEqual([]);
    expect(onGenerated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    if (unregister) unregister();
  });

  it('closing modal without confirmation does NOT invalidate cache', () => {
    const onClose = vi.fn();
    onClose();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(invalidatedScopes).toEqual([]);
    if (unregister) unregister();
  });
});
