import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MeetingLinkButton } from '../../src/domains/meeting-links/MeetingLinkButton';

describe('Fix L9: Meeting Link Pill Color to Yellow', () => {
  it('renders Google Meet link with yellow background and dark readable text', () => {
    const html = renderToString(
      React.createElement(MeetingLinkButton, {
        url: 'https://meet.google.com/abc-xyz-pqr',
        compact: true,
      })
    );

    expect(html).toContain('background-color:#fef3c7');
    expect(html).toContain('color:#78350f');
    expect(html).toContain('border:1px solid #fcd34d');
  });

  it('renders Zoom link with the same yellow background and dark readable text', () => {
    const html = renderToString(
      React.createElement(MeetingLinkButton, {
        url: 'https://zoom.us/j/987654321',
        compact: true,
      })
    );

    expect(html).toContain('background-color:#fef3c7');
    expect(html).toContain('color:#78350f');
    expect(html).toContain('border:1px solid #fcd34d');
  });
});
