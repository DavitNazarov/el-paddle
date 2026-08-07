import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JsonLd, jsonLdPayload } from './JsonLd';

// The payload is injected with dangerouslySetInnerHTML, so a literal `</script`
// anywhere in it ends the block and turns user-controlled club or player names
// into markup.
describe('jsonLdPayload', () => {
  it('escapes a </script> breakout in a user-controlled value', () => {
    const payload = jsonLdPayload({
      '@type': 'SportsClub',
      name: '</script><script>alert(1)</script>',
    });
    expect(payload).not.toContain('</script');
    expect(payload).not.toContain('<');
    expect(JSON.parse(payload).name).toBe('</script><script>alert(1)</script>');
  });

  it('escapes values nested inside arrays and objects', () => {
    const payload = jsonLdPayload([
      { '@type': 'Person', name: 'a<b', memberOf: { name: '</script>' } },
    ]);
    expect(payload).not.toContain('<');
    expect(JSON.parse(payload)[0].memberOf.name).toBe('</script>');
  });

  it('leaves output byte-identical when no angle bracket is present', () => {
    const data = { '@type': 'SportsClub', name: 'Padel Tbilisi', url: 'https://example.test' };
    expect(jsonLdPayload(data)).toBe(JSON.stringify(data));
  });

  it('emits a script block a hostile club name cannot escape', () => {
    const html = renderToStaticMarkup(
      createElement(JsonLd, {
        data: { '@type': 'SportsClub', name: '</script><img src=x onerror=alert(1)>' },
      }),
    );
    // Exactly one opening and one closing tag: the payload did not split the block.
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html.endsWith('</script>')).toBe(true);
  });
});
