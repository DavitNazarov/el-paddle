import { describe, expect, it } from 'vitest';
import { wwwToApexRedirect } from './canonical-host';

describe('wwwToApexRedirect', () => {
  it('sends www to the apex and keeps the path', () => {
    expect(
      wwwToApexRedirect('www.elpadell.com', 'https://elpadell.com', '/events?tab=live'),
    ).toBe('https://elpadell.com/events?tab=live');
  });

  it('leaves the apex, localhost, and a Render hostname alone', () => {
    expect(wwwToApexRedirect('elpadell.com', 'https://elpadell.com', '/')).toBeNull();
    expect(wwwToApexRedirect('localhost:3000', 'https://elpadell.com', '/')).toBeNull();
    expect(wwwToApexRedirect('elpadel-web.onrender.com', 'https://elpadell.com', '/')).toBeNull();
  });
});
