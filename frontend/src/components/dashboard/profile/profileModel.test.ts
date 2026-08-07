import { describe, expect, it } from 'vitest';
import {
  accountStateKey,
  accountStateTone,
  hasPublicPlayerPage,
  recordArcs,
  winRate,
} from './profileModel';

describe('winRate', () => {
  it('has no answer before a match is completed', () => {
    expect(winRate({ matchesPlayed: 0, wins: 0, losses: 0 })).toBeNull();
  });

  it('rounds to a whole percent', () => {
    expect(winRate({ matchesPlayed: 3, wins: 2, losses: 1 })).toBe(67);
    expect(winRate({ matchesPlayed: 8, wins: 3, losses: 5 })).toBe(38);
    expect(winRate({ matchesPlayed: 4, wins: 4, losses: 0 })).toBe(100);
  });
});

describe('recordArcs', () => {
  it('draws nothing when nothing has been played', () => {
    expect(recordArcs({ matchesPlayed: 0, wins: 0, losses: 0 })).toEqual([]);
  });

  it('closes the ring, so the two arcs always sum to the whole', () => {
    const arcs = recordArcs({ matchesPlayed: 3, wins: 2, losses: 1 });
    expect(arcs.reduce((sum, arc) => sum + arc.share, 0)).toBeCloseTo(100);
    expect(arcs[0]).toEqual({ tone: 'win', share: (2 / 3) * 100, offset: 25 });
    expect(arcs[1]?.tone).toBe('loss');
  });

  it('starts the losing arc where the winning arc finished', () => {
    const [win, loss] = recordArcs({ matchesPlayed: 4, wins: 1, losses: 3 });
    expect(win.offset).toBe(25);
    expect(loss.offset).toBe(25 - win.share);
  });

  it('drops an arc with no matches behind it rather than drawing a zero-length stub', () => {
    expect(recordArcs({ matchesPlayed: 2, wins: 2, losses: 0 })).toEqual([
      { tone: 'win', share: 100, offset: 25 },
    ]);
    expect(recordArcs({ matchesPlayed: 2, wins: 0, losses: 2 })).toEqual([
      { tone: 'loss', share: 100, offset: 25 },
    ]);
  });
});

describe('accountStateKey', () => {
  it('names every state the server can send', () => {
    expect(accountStateKey('ACTIVE')).toBe('stateActive');
    expect(accountStateKey('PENDING_VERIFICATION')).toBe('statePendingVerification');
    expect(accountStateKey('INVITED')).toBe('stateInvited');
    expect(accountStateKey('INACTIVE')).toBe('stateInactive');
  });

  it('treats everything short of active as still waiting on something', () => {
    expect(accountStateTone('ACTIVE')).toBe('positive');
    expect(accountStateTone('PENDING_VERIFICATION')).toBe('warning');
    expect(accountStateTone('INVITED')).toBe('warning');
    expect(accountStateTone('INACTIVE')).toBe('warning');
  });
});

describe('hasPublicPlayerPage', () => {
  it('offers the public page only where the public directory would serve one', () => {
    expect(hasPublicPlayerPage({ role: 'USER', status: 'ACTIVE' })).toBe(true);
    expect(hasPublicPlayerPage({ role: 'USER', status: 'PENDING_VERIFICATION' })).toBe(false);
    expect(hasPublicPlayerPage({ role: 'USER', status: 'INACTIVE' })).toBe(false);
    expect(hasPublicPlayerPage({ role: 'JUDGE', status: 'ACTIVE' })).toBe(false);
  });
});
