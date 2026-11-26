import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AttendanceControl } from '../../src/domains/classes/AttendanceControl';
import { ClassSession } from '../../src/domains/classes/classTypes';

describe('AttendanceControl Future Class Safety & Error Presentation', () => {
  it('renders Attended, No-Show, and Cancel buttons for scheduled session', () => {
    const futureSession: Partial<ClassSession> = {
      session_id: 's_future_1',
      scheduled_start: new Date(Date.now() + 86400000).toISOString(),
      status: 'SCHEDULED',
    };

    const html = renderToString(
      <AttendanceControl
        status="SCHEDULED"
        creditEffect="PENDING"
        session={futureSession}
        onUpdateStatus={vi.fn()}
        onRestoreCredit={vi.fn()}
      />
    );

    expect(html).toContain('Attended');
    expect(html).toContain('No-Show');
    expect(html).toContain('Cancel');
  });

  it('renders completed session status and restore button when consumed', () => {
    const completedSession: Partial<ClassSession> = {
      session_id: 's_comp_1',
      status: 'COMPLETED',
      class_credit_effect: 'CONSUME',
    };

    const html = renderToString(
      <AttendanceControl
        status="COMPLETED"
        creditEffect="CONSUME"
        session={completedSession}
        onUpdateStatus={vi.fn()}
        onRestoreCredit={vi.fn()}
      />
    );

    expect(html).toContain('COMPLETED');
    expect(html).toContain('Restore Credit');
  });
});
