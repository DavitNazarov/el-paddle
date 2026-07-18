import { describe, expect, it } from 'vitest';
import { MatchStatus, ScoreAction } from '../../generated/prisma/client.js';
import { applyScoreAction, canViewMatchDetail, shouldRedactMatchResult } from './matches.service.js';

describe('score reducer', () => {
  it('increments and decrements within bounds', () => {
    expect(applyScoreAction(5, ScoreAction.INCREMENT)).toBe(6);
    expect(applyScoreAction(1, ScoreAction.DECREMENT)).toBe(0);
  });

  it('rejects scores outside zero to six', () => {
    expect(() => applyScoreAction(6, ScoreAction.INCREMENT)).toThrow();
    expect(() => applyScoreAction(0, ScoreAction.DECREMENT)).toThrow();
  });
});

describe('match detail visibility', () => {
  const visibility = (overrides: Partial<Parameters<typeof canViewMatchDetail>[0]> = {}) => canViewMatchDetail({
    status: MatchStatus.READY,
    isAdmin: false,
    isParticipant: false,
    bracketPublished: false,
    schedulePublished: false,
    publicLiveScoringEnabled: false,
    resultsPublished: false,
    ...overrides,
  });

  it('shows ready matches from a published bracket or schedule', () => {
    expect(visibility({ bracketPublished: true })).toBe(true);
    expect(visibility({ schedulePublished: true })).toBe(true);
    expect(visibility()).toBe(false);
  });

  it('shows publicly listed in-progress matches only when live scoring is enabled', () => {
    expect(visibility({ status: MatchStatus.IN_PROGRESS, bracketPublished: true, publicLiveScoringEnabled: true })).toBe(true);
    expect(visibility({ status: MatchStatus.IN_PROGRESS, bracketPublished: true })).toBe(false);
    expect(visibility({ status: MatchStatus.IN_PROGRESS, publicLiveScoringEnabled: true })).toBe(false);
  });

  it('keeps publicly listed completed match pages available', () => {
    expect(visibility({ status: MatchStatus.COMPLETED, resultsPublished: true })).toBe(true);
    expect(visibility({ status: MatchStatus.COMPLETED, schedulePublished: true })).toBe(true);
    expect(visibility({ status: MatchStatus.COMPLETED })).toBe(false);
  });

  it('allows admins and participants to view supported unpublished states', () => {
    expect(visibility({ isAdmin: true })).toBe(true);
    expect(visibility({ status: MatchStatus.IN_PROGRESS, isParticipant: true })).toBe(true);
  });

  it('does not expose pending or cancelled matches through this detail route', () => {
    expect(visibility({ status: MatchStatus.PENDING, isAdmin: true })).toBe(false);
    expect(visibility({ status: MatchStatus.CANCELLED, isParticipant: true })).toBe(false);
  });

  it('redacts an unpublished final result only for public viewers', () => {
    const result = (overrides: Partial<Parameters<typeof shouldRedactMatchResult>[0]> = {}) => shouldRedactMatchResult({
      status: MatchStatus.COMPLETED,
      isAdmin: false,
      isParticipant: false,
      resultsPublished: false,
      ...overrides,
    });
    expect(result()).toBe(true);
    expect(result({ resultsPublished: true })).toBe(false);
    expect(result({ isAdmin: true })).toBe(false);
    expect(result({ isParticipant: true })).toBe(false);
    expect(result({ status: MatchStatus.READY })).toBe(false);
  });
});
