import axios from 'axios';
import { addDays, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { Sport, SportEvent } from './store';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports';

const ESPN_PATHS: Record<Sport, string> = {
  nfl:    'football/nfl',
  nba:    'basketball/nba',
  mlb:    'baseball/mlb',
  nhl:    'hockey/nhl',
  soccer: 'soccer/usa.1',
  wnba:   'basketball/wnba',
  ncaafb: 'football/college-football',
  ncaamb: 'basketball/mens-college-basketball',
  golf:   'golf/pga',
  tennis: 'tennis/atp',
  f1:     'racing/f1',
  nascar: 'racing/nascar-premier-series',
  mma:    'mma/ufc',
  boxing: 'boxing/boxing',
};

const GOLF_MAJORS = [
  'masters', 'u.s. open', 'us open', 'the open', 'british open', 'pga championship'
];

function isMajorTournament(name: string): boolean {
  const lower = name.toLowerCase();
  return GOLF_MAJORS.some((m) => lower.includes(m));
}

function normalizeEvent(raw: any, sport: Sport): SportEvent[] {
  const competition = raw.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((c: any) => c.homeAway === 'home')?.team?.displayName ?? '';
  const away = competitors.find((c: any) => c.homeAway === 'away')?.team?.displayName ?? '';
  const dateStr = (raw.date ?? '').slice(0, 10);
  const name = home && away
    ? `${away} @ ${home}`
    : (raw.name ?? raw.shortName ?? 'Event');
  const channel = competition?.broadcasts?.[0]?.names?.[0];
  const isNationalTv = (competition?.broadcasts ?? []).length > 0;
  const venue = competition?.venue?.fullName;

  // For golf, expand the single event across Thu–Sun (4 days)
  if (sport === 'golf') {
    const isMajor = isMajorTournament(name);
    const startDate = parseISO(dateStr);
    return [0, 1, 2, 3].map((offset) => ({
      id: `golf-espn-${raw.id}-day${offset + 1}`,
      name: `${name} — Round ${offset + 1}`,
      sport,
      date: format(addDays(startDate, offset), 'yyyy-MM-dd'),
      time: offset === 0 && raw.date ? format(new Date(raw.date), 'h:mm a') : undefined,
      venue,
      channel,
      isNationalTv,
      isMajor,
    }));
  }

  return [{
    id: `${sport}-espn-${raw.id}`,
    name,
    sport,
    date: dateStr,
    time: raw.date ? format(new Date(raw.date), 'h:mm a') : undefined,
    homeTeam: home || undefined,
    awayTeam: away || undefined,
    venue,
    channel,
    isNationalTv,
    isMajor: false,
  }];
}

export async function fetchGamesForMonth(
  sport: Sport,
  year: number,
  month: number
): Promise<SportEvent[]> {
  const path = ESPN_PATHS[sport];
  const from = format(startOfMonth(new Date(year, month)), 'yyyyMMdd');
  const to = format(endOfMonth(new Date(year, month)), 'yyyyMMdd');

  try {
    const response = await axios.get(`${BASE}/${path}/scoreboard`, {
      params: { dates: `${from}-${to}`, limit: 200 },
    });
    return (response.data?.events ?? []).flatMap((e: any) => normalizeEvent(e, sport));
  } catch (err) {
    console.error(`Failed to fetch ${sport} games:`, err);
    return [];
  }
}

export async function fetchGamesForSports(
  sports: Sport[],
  year: number,
  month: number
): Promise<SportEvent[]> {
  const results = await Promise.allSettled(
    sports.map((sport) => fetchGamesForMonth(sport, year, month))
  );
  return results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => a.date.localeCompare(b.date));
}