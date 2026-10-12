import { describe, expect, it } from 'vitest';
import { pgConnectionConfig } from './pg-connection.js';

describe('pgConnectionConfig', () => {
  it('leaves an internal URL unchanged', () => {
    const url = 'postgresql://elpadel_app:secret@dpg-abc-a/elpadel_prod?schema=public';
    expect(pgConnectionConfig(url)).toEqual({ connectionString: url });
  });

  it('enables SSL for sslmode=require and drops channel_binding', () => {
    const url =
      'postgresql://elpadel_app:secret@dpg-abc.frankfurt-postgres.render.com/elpadel_prod?schema=public&sslmode=require&channel_binding=require';
    expect(pgConnectionConfig(url)).toEqual({
      connectionString:
        'postgresql://elpadel_app:secret@dpg-abc.frankfurt-postgres.render.com/elpadel_prod?schema=public',
      ssl: { rejectUnauthorized: false },
    });
  });
});
