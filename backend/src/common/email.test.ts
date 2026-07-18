import { describe, expect, it } from 'vitest';
import { emailButton, emailDetails, emailLayout } from './email.js';

describe('email templates', () => {
  it('renders the shared client-safe structure and preheader', () => {
    const html = emailLayout('Match scheduled', '<p>Your court is ready.</p>', {
      eyebrow: 'Tournament update',
      preheader: 'Your match has been scheduled.',
    });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('role="presentation"');
    expect(html).toContain('/images/el-padel-logo.png');
    expect(html).toContain('alt="El Padel"');
    expect(html).toContain('@media only screen and (max-width: 620px)');
    expect(html).toContain('Your match has been scheduled.');
    expect(html).toContain('Tournament update');
    expect(html).toContain('<p>Your court is ready.</p>');
  });

  it('escapes dynamic layout and button values', () => {
    const html = emailLayout('<Account>', '<p>Trusted template body</p>', {
      eyebrow: 'Club & team',
      preheader: 'A < B',
    });
    const button = emailButton('Open & review', 'https://example.com/?a=1&b="2"');

    expect(html).toContain('&lt;Account&gt;');
    expect(html).toContain('Club &amp; team');
    expect(html).toContain('A &lt; B');
    expect(button).toContain('Open &amp; review');
    expect(button).toContain('a=1&amp;b=&quot;2&quot;');
  });

  it('renders and escapes scan-friendly email details', () => {
    const details = emailDetails([
      { label: 'Tournament', value: 'Summer <Open>' },
      { label: 'Status', value: 'Approved & confirmed' },
    ]);

    expect(details).toContain('Summer &lt;Open&gt;');
    expect(details).toContain('Approved &amp; confirmed');
    expect(details).not.toContain('Summer <Open>');
  });
});
