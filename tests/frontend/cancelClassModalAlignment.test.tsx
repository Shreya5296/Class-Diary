import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CancelClassModal } from '../../src/domains/classes/CancelClassModal';

describe('CancelClassModal UI & Text Alignment Fix', () => {
  it('renders title, description with wrapping constraints, field label, textarea, and actions in left-aligned container', () => {
    const html = renderToString(
      <CancelClassModal
        isOpen={true}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    // Modal Title
    expect(html).toContain('Cancel Class Session');
    expect(html).toContain('text-align:left');

    // Supporting Description
    expect(html).toContain('Please specify the reason for cancelling this session. The reason will be recorded on the session history.');
    expect(html).toContain('overflow-wrap:break-word');
    expect(html).toContain('white-space:normal');
    expect(html).toContain('max-width:100%');
    expect(html).toContain('width:100%');
    expect(html).toContain('min-width:0');

    // Field Label
    expect(html).toContain('Cancellation Reason');
    expect(html).toContain('*');

    // Textarea
    expect(html).toContain('cancellation-reason-input');
    expect(html).toContain('e.g. Student ill, Family emergency, Scheduling conflict...');
    expect(html).toContain('min-height:90px');
    expect(html).toContain('width:100%');

    // Footer actions
    expect(html).toContain('Cancel');
    expect(html).toContain('Confirm Cancellation');
    expect(html).toContain('justify-content:flex-end');
  });

  it('does not render when isOpen is false', () => {
    const html = renderToString(
      <CancelClassModal
        isOpen={false}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toBe('');
  });
});
