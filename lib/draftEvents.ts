import { SportEvent } from './store';

// ─── Draft Events ─────────────────────────────────────────────────────────────
// Update these annually when new draft dates are announced.
// Last updated: 2026 season

export const DRAFT_EVENTS: SportEvent[] = [

  // ── NBA ──────────────────────────────────────────────────────────────────
  {
    id: 'draft-nba-2026-lottery',
    name: 'NBA Draft Lottery',
    sport: 'nba',
    date: '2026-05-10',
    isDraft: true,
  },
  {
    id: 'draft-nba-2026-day1',
    name: 'NBA Draft — Round 1',
    sport: 'nba',
    date: '2026-06-23',
    isDraft: true,
  },
  {
    id: 'draft-nba-2026-day2',
    name: 'NBA Draft — Round 2',
    sport: 'nba',
    date: '2026-06-24',
    isDraft: true,
  },

  // ── NFL ──────────────────────────────────────────────────────────────────
  {
    id: 'draft-nfl-2026-day1',
    name: 'NFL Draft — Day 1',
    sport: 'nfl',
    date: '2026-04-23',
    isDraft: true,
  },
  {
    id: 'draft-nfl-2026-day2',
    name: 'NFL Draft — Day 2',
    sport: 'nfl',
    date: '2026-04-24',
    isDraft: true,
  },
  {
    id: 'draft-nfl-2026-day3',
    name: 'NFL Draft — Day 3',
    sport: 'nfl',
    date: '2026-04-25',
    isDraft: true,
  },

  // ── NHL ──────────────────────────────────────────────────────────────────
  {
    id: 'draft-nhl-2026-lottery',
    name: 'NHL Draft Lottery',
    sport: 'nhl',
    date: '2026-05-05',
    isDraft: true,
  },
  {
    id: 'draft-nhl-2026-day1',
    name: 'NHL Draft — Round 1',
    sport: 'nhl',
    date: '2026-06-26',
    isDraft: true,
  },
  {
    id: 'draft-nhl-2026-day2',
    name: 'NHL Draft — Rounds 2-7',
    sport: 'nhl',
    date: '2026-06-27',
    isDraft: true,
  },

  // ── MLB ──────────────────────────────────────────────────────────────────
  {
    id: 'draft-mlb-2025-lottery',
    name: 'MLB Draft Lottery',
    sport: 'mlb',
    date: '2025-12-09',
    isDraft: true,
  },
  {
    id: 'draft-mlb-2026-day1',
    name: 'MLB Draft — Day 1',
    sport: 'mlb',
    date: '2026-07-11',
    isDraft: true,
  },
  {
    id: 'draft-mlb-2026-day2',
    name: 'MLB Draft — Day 2',
    sport: 'mlb',
    date: '2026-07-12',
    isDraft: true,
  },
  {
    id: 'draft-mlb-2026-day3',
    name: 'MLB Draft — Day 3',
    sport: 'mlb',
    date: '2026-07-13',
    isDraft: true,
  },

  // ── WNBA ─────────────────────────────────────────────────────────────────
  {
    id: 'draft-wnba-2025-lottery',
    name: 'WNBA Draft Lottery',
    sport: 'wnba',
    date: '2025-11-23',
    isDraft: true,
  },
  {
    id: 'draft-wnba-2026-draft',
    name: 'WNBA Draft',
    sport: 'wnba',
    date: '2026-04-13',
    isDraft: true,
  },

  // ── MLS ──────────────────────────────────────────────────────────────────
  {
    id: 'draft-mls-2026-draft',
    name: 'MLS SuperDraft',
    sport: 'soccer',
    date: '2025-12-18',
    isDraft: true,
  },
];
