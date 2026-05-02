import axios from 'axios';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { Sport, SportEvent } from './store';

const API_KEY = process.env.EXPO_PUBLIC_API_SPORTS_KEY ?? 'YOUR_API_KEY_HERE';

const SPORT_ENDPOINTS: Record<Sport, string> = {
  nfl: 'https://v1.american-football.api-sports.io',
  nba: 'https://v1.basketball.api-sports.io',
  mlb: 'https://v1.baseball.api-sports.io',
  nhl: 'https://v1.hockey.api-sports.io',
  soccer: 'https://v3.football.api-sports.io',
};

const LEAGUE_IDS: Record<Sport, number> = {
  nfl: 1,
  nba: 12,
  mlb: 1,
  nhl: 57,
  soccer: 253,
};

const SEASONS: Record<Sport, number> = {
  nfl: 2025,
  nba: 2024,
  mlb: 2025,
  nhl: 2024,
  soccer: 2025,
};

function normalizeGame(raw: any, sport: Sport): SportEvent {
  const home = raw.teams?.home?.name ?? 'Home';
  const away = raw.teams?.away?.name ?? 'Away';
  const dateStr = (raw.date ?? raw.game?.date ?? '').slice(0, 10);
  return {
    id: `${sport}-${raw.id ?? raw.game?.id ?? Math.random()}`,
    name: `${away} @ ${home}`,
    sport,
    date: dateStr,
    time: raw.time ?? raw.game?.time,
    homeTeam: home,
    awayTeam: away,
    venue: raw.venue?.name,
  };
}

export async function fetchGamesForMonth(sport: Sport, year: number, month: number): Promise<SportEvent[]> {
  if (API_KEY === 'YOUR_API_KEY_HERE') return [];
  const baseURL = SPORT_ENDPOINTS[sport];
  const from = format(startOfMonth(new Date(year, month)), 'yyyy-MM-dd');
  const to = format(endOfMonth(new Date(year, month)), 'yyyy-MM-dd');
  try {
    const response = await axios.get(`${baseURL}/games`, {
      headers: { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': new URL(baseURL).host },
      params: { league: LEAGUE_IDS[sport], season: SEASONS[sport], from, to },
    });
    return (response.data?.response ?? []).map((g: any) => normalizeGame(g, sport));
  } catch (err) {
    console.error(`Failed to fetch ${sport} games:`, err);
    return [];
  }
}

export async function fetchGamesForSports(sports: Sport[], year: number, month: number): Promise<SportEvent[]> {
  const results = await Promise.allSettled(sports.map((sport) => fetchGamesForMonth(sport, year, month)));
  return results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => a.date.localeCompare(b.date));
}