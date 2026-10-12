import { describe, expect, it } from 'vitest';
import { tournamentCopy } from '@/lib/i18n/tournament';
import type { EventWorkspaceSignals } from '@/hooks/useEventWorkspaceSignals';
import type { EventDto, EventOperationsDto } from '@/types/admin';
import { operationsAsSignals } from './operationsSignals';
import { agendaAllClear, eventAgenda } from './eventAgenda';

const copy = tournamentCopy.en.admin.event;

const event = (status: EventDto['status']) => ({ id: 'e1', status }) as EventDto;

/** Nothing waiting anywhere — each test adds only the pressure it is about. */
const quiet: EventWorkspaceSignals = {
  registrations: { approved: 8, pending: 0 },
  requests: { awaiting: 0, total: 4 },
  brackets: { locked: 2, published: 2, total: 2 },
  schedule: { courts: 3, queued: 12, courtsIdle: 0, unscheduled: 0 },
  control: { live: 3, ready: 0 },
};

const signals = (patch: Partial<EventWorkspaceSignals>): EventWorkspaceSignals => ({ ...quiet, ...patch });

const keys = (items: { key: string }[]) => items.map((item) => item.key);

describe('what the agenda puts first', () => {
  it('puts an idle court above every decision queue — it is the only one costing time now', () => {
    const agenda = eventAgenda(
      event('ONGOING'),
      signals({
        schedule: { courts: 3, queued: 12, courtsIdle: 1, unscheduled: 0 },
        registrations: { approved: 8, pending: 5 },
        requests: { awaiting: 3, total: 4 },
      }),
      copy,
    );
    expect(agenda[0]?.key).toBe('courts-idle');
    expect(agenda[0]?.tone).toBe('urgent');
  });

  it('does not also ask for ready matches while a court is idle — it is the same instruction twice', () => {
    const agenda = eventAgenda(
      event('ONGOING'),
      signals({ schedule: { courts: 3, queued: 12, courtsIdle: 2, unscheduled: 0 }, control: { live: 1, ready: 4 } }),
      copy,
    );
    expect(keys(agenda)).toEqual(['courts-idle']);
  });

  it('names ready matches once no court is standing idle', () => {
    const agenda = eventAgenda(event('ONGOING'), signals({ control: { live: 1, ready: 4 } }), copy);
    expect(agenda[0]?.headline).toBe('4 matches are ready to start.');
  });

  it('demotes the review queues once play has begun — they no longer hold anything up', () => {
    const before = eventAgenda(event('REGISTRATION_OPEN'), signals({ registrations: { approved: 8, pending: 2 } }), copy);
    const during = eventAgenda(event('ONGOING'), signals({ registrations: { approved: 8, pending: 2 } }), copy);
    expect(before[0]?.tone).toBe('urgent');
    expect(during[0]?.tone).toBe('todo');
  });
});

describe('what the agenda withholds', () => {
  it('says nothing at all about a finished event', () => {
    const agenda = eventAgenda(
      event('COMPLETED'),
      signals({ registrations: { approved: 8, pending: 6 }, requests: { awaiting: 2, total: 4 } }),
      copy,
    );
    expect(agenda).toEqual([]);
  });

  it('does not call a missing draw overdue while registration is still open', () => {
    const open = signals({ brackets: { locked: 0, published: 0, total: 0 } });
    expect(keys(eventAgenda(event('REGISTRATION_OPEN'), open, copy))).not.toContain('draw-missing');
    expect(keys(eventAgenda(event('REGISTRATION_CLOSED'), open, copy))).toContain('draw-missing');
  });

  it('does not ask for courts before there is a locked draw to put on them', () => {
    const noDraw = signals({
      brackets: { locked: 0, published: 0, total: 1 },
      schedule: { courts: 0, queued: 0, courtsIdle: 0, unscheduled: 0 },
    });
    expect(keys(eventAgenda(event('REGISTRATION_CLOSED'), noDraw, copy))).not.toContain('courts-missing');

    const locked = signals({
      brackets: { locked: 1, published: 0, total: 1 },
      schedule: { courts: 0, queued: 0, courtsIdle: 0, unscheduled: 0 },
    });
    expect(keys(eventAgenda(event('REGISTRATION_CLOSED'), locked, copy))).toContain('courts-missing');
  });

  it('stays silent on a stage it cannot read rather than reporting it as empty', () => {
    // An organiser is refused some of these reads; a refused read is a missing
    // number, never "nothing is waiting".
    const blind = signals({ registrations: null, requests: null, brackets: null, schedule: null, control: null });
    expect(eventAgenda(event('ONGOING'), blind, copy)).toEqual([]);
  });
});

describe('how the agenda words itself', () => {
  it('uses a singular sentence for one, and never "1 entries"', () => {
    const one = eventAgenda(event('REGISTRATION_OPEN'), signals({ registrations: { approved: 8, pending: 1 } }), copy);
    expect(one[0]?.headline).toBe('One entry is waiting for your decision.');

    const many = eventAgenda(event('REGISTRATION_OPEN'), signals({ registrations: { approved: 8, pending: 3 } }), copy);
    expect(many[0]?.headline).toBe('3 entries are waiting for your decision.');
  });

  it('sends each item to the screen that resolves it', () => {
    const agenda = eventAgenda(
      event('REGISTRATION_CLOSED'),
      signals({ requests: { awaiting: 1, total: 2 }, brackets: { locked: 0, published: 0, total: 2 } }),
      copy,
    );
    expect(agenda.find((item) => item.key === 'requests-awaiting')?.href).toBe('/admin/events/e1/opponent-requests');
    expect(agenda.find((item) => item.key === 'draw-unlocked')?.href).toBe('/admin/events/e1/bracket');
  });

  it('answers an empty agenda with what the current stage is waiting for', () => {
    expect(agendaAllClear(event('REGISTRATION_OPEN'), copy)).toMatch(/Close registration when the field is final/);
    expect(agendaAllClear(event('ONGOING'), copy)).toMatch(/Every court is busy/);
    expect(agendaAllClear(event('COMPLETED'), copy)).toMatch(/finished and read-only/);
  });
});

describe('the board and the workspace speak with one voice', () => {
  it('turns the grouped board counts into the same headline the workspace would give', () => {
    // The board reads one grouped endpoint and the workspace reads four; the
    // mapping between them is what keeps a row and the screen behind it from
    // describing the same event two different ways.
    const operation = {
      eventId: 'e1',
      registrations: { pending: 3, approved: 8, total: 11 },
      requests: { awaiting: 0, total: 4 },
      brackets: { total: 2, locked: 2, published: 1 },
      courts: { total: 3, staffed: 2, idle: 1 },
      schedule: { queued: 12 },
      matches: { total: 20, live: 2, ready: 4, completed: 6 },
    } as EventOperationsDto;

    const fromBoard = eventAgenda(event('ONGOING'), operationsAsSignals(operation), copy);
    const fromWorkspace = eventAgenda(
      event('ONGOING'),
      signals({
        registrations: { approved: 8, pending: 3 },
        requests: { awaiting: 0, total: 4 },
        brackets: { locked: 2, published: 1, total: 2 },
        schedule: { courts: 3, queued: 12, courtsIdle: 1, unscheduled: 0 },
        control: { live: 2, ready: 4 },
      }),
      copy,
    );
    expect(fromBoard[0]?.headline).toBe(fromWorkspace[0]?.headline);
    expect(fromBoard[0]?.key).toBe('courts-idle');
  });

  it('never claims a match has no court, which the grouped read cannot know', () => {
    const operation = {
      eventId: 'e1',
      registrations: { pending: 0, approved: 8, total: 8 },
      requests: { awaiting: 0, total: 0 },
      brackets: { total: 1, locked: 1, published: 0 },
      courts: { total: 2, staffed: 0, idle: 0 },
      schedule: { queued: 0 },
      matches: { total: 8, live: 0, ready: 0, completed: 0 },
    } as EventOperationsDto;

    const agenda = eventAgenda(event('REGISTRATION_CLOSED'), operationsAsSignals(operation), copy);
    expect(agenda.map((item) => item.key)).not.toContain('matches-unscheduled');
  });
});
