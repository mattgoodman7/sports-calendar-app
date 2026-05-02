import axios from 'axios';
import { endOfMonth, format, startOfMonth } from 'date-fns';
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

function normalizeEvent(raw: any, sport: Sport): SportEvent {
  const competition = raw.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((c: any) => c.homeAway === 'home')?.team?.displayName ?? '';
  const away = competitors.find((c: any) => c.homeAway === 'away')?.team?.displayName ?? '';
  const dateStr = (raw.date ?? '').slice(0, 10);
  const name = home && away
    ? `${away} @ ${home}`
    : (raw.name ?? raw.shortName ?? 'Event');

  return {
    id: `${sport}-espn-${raw.id}`,
    name,
    sport,
    date: dateStr,
    time: raw.date ? format(new Date(raw.date), 'h:mm a') : undefined,
    homeTeam: home || undefined,
    awayTeam: away || undefined,
    venue: competition?.venue?.fullName,
    isNationalTv: (competition?.broadcasts ?? []).length > 0,
    channel: competition?.broadcasts?.[0]?.names?.[0],
  };
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
    return (response.data?.events ?? []).map((e: any) => normalizeEvent(e, sport));
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