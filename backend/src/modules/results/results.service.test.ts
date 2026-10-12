import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '../../common/csv.js';

/**
 * The export is written from names people chose, so a cell is never trusted to
 * be data. A club called `=HYPERLINK(...)` is a formula the moment a spreadsheet
 * opens the file, and the club that named itself is not the attacker's problem
 * to solve.
 */
describe('CSV cells', () => {
  it('quotes separators, quotes and newlines', () => {
    expect(csvCell('Smith, John')).toBe('"Smith, John"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });

  it('neutralises anything a spreadsheet would run as a formula', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+44 555')).toBe("'+44 555");
    expect(csvCell('-lead')).toBe("'-lead");
    expect(csvCell('@handle')).toBe("'@handle");
  });

  it('leaves ordinary values alone and renders empties as empty', () => {
    expect(csvCell('Padel Club')).toBe('Padel Club');
    expect(csvCell(3)).toBe('3');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('joins rows with CRLF so every spreadsheet reads the same rows', () => {
    expect(toCsv(['A', 'B'], [[1, 'x'], [2, 'y']])).toBe('A,B\r\n1,x\r\n2,y');
  });
});
