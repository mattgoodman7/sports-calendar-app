import axios from 'axios';
import { addDays, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { Sport, SportEvent, UserPreferences } from './store';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports';

const ESPN_PATHS: Record<Sport, string> = {
  nfl:    'football/nfl',
  nba:    'basketball/nba',
  mlb:    'baseball/mlb',
  nhl:    'hockey/nhl',
  soccer: 'soccer',
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

const TEAM_SPORTS: Sport[] = ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'wnba', 'ncaafb', 'ncaamb'];

const EXTRA_PARAMS: Partial<Record<Sport, Record<string, any>>> = {
  ncaafb: { groups: 80 },
  ncaamb: { groups: 100 },
};

const GOLF_MAJORS = [
  'masters', 'u.s. open', 'us open', 'the open', 'british open', 'pga championship',
];

const TENNIS_MAJORS = [
  'australian open', 'french open', 'roland garros', 'wimbledon', 'us open',
];

function isMajorTournament(name: string, sport: Sport): boolean {
  const lower = name.toLowerCase();
  if (sport === 'tennis') return TENNIS_MAJORS.some((m) => lower.includes(m));
  return GOLF_MAJORS.some((m) => lower.includes(m));
}

function getTeamLogo(team?: any): string | undefined {
  if (!team) return undefined;
  if (typeof team.logo === 'string' && team.logo) return team.logo;
  if (Array.isArray(team.logos) && team.logos.length > 0) {
    const preferred = team.logos.find((l: any) =>
      l.rel?.includes('default') || l.rel?.includes('full')
    );
    return (preferred ?? team.logos[0])?.href;
  }
  return undefined;
}

function getTournamentLogo(raw: any, sport: Sport): string | undefined {
  if (sport === 'golf') return 'https://a.espncdn.com/redesign/assets/img/icons/ESPN-icon-golf.png';
  if (sport === 'tennis') return 'https://a.espncdn.com/redesign/assets/img/icons/ESPN-icon-tennis.png';
  return undefined;
}

function normalizeEvent(raw: any, sport: Sport): SportEvent[] {
  if (sport === 'f1') {
  console.log('F1 RAW', JSON.stringify({
    name: raw.name,
    shortName: raw.shortName,
    type: raw.type,
    competitions: raw.competitions?.map((c: any) => ({
      type: c.type,
      name: c.name,
      notes: c.notes,
    })),
  }, null, 2));
}
  const competition = raw.competitions?.[0];

  const competitors = competition?.competitors ?? [];
  const homeComp = competitors.find((c: any) => c.homeAway === 'home');
  const awayComp = competitors.find((c: any) => c.homeAway === 'away');
  const home = homeComp?.team?.displayName ?? '';
  const away = awayComp?.team?.displayName ?? '';
  const homeAbbrev = homeComp?.team?.abbreviation as string | undefined;
  const awayAbbrev = awayComp?.team?.abbreviation as string | undefined;

  // ── Timezone fix: always use the raw UTC date string, never convert through new Date() ──
  const utcDateStr = raw.date ? raw.date.slice(0, 10) : '';
  const localDateStr = raw.date ? format(new Date(raw.date), 'yyyy-MM-dd') : '';

    // Only show a time if the game has an actual scheduled time (not TBD/midnight UTC)
  // ESPN uses T00:00Z for TBD games, so we treat that as no time
  const hasTrueTime = raw.date &&
    !raw.date.endsWith('T04:00Z') &&
    !raw.date.endsWith('T00:00:00Z');


  // TBD games use T00:00Z or T04:00Z — use UTC date for those
  // Real games use local date since a 9:30 PM ET game is still "that night" locally
  const dateStr = hasTrueTime ? localDateStr : utcDateStr;

  const timeStr = hasTrueTime ? format(new Date(raw.date), 'h:mm a') : undefined;

  const name = home && away
    ? `${away} @ ${home}`
    : (raw.name ?? raw.shortName ?? 'Event');
  // Extract game number for playoff games
  const competitionNotes = competition?.notes ?? [];
  const playoffHeadline = competitionNotes.find((n: any) => n.headline)?.headline ?? '';
if (sport === 'nba') {
  console.log('NOTES', JSON.stringify(competitionNotes), playoffHeadline);
}
  const gameNumberMatch = playoffHeadline.match(/Game (\d+)/i);
  const gameNumber = gameNumberMatch ? parseInt(gameNumberMatch[1], 10) : undefined;

  // Append game number to name for playoff games
  const displayName = gameNumber
    ? `${name} — Game ${gameNumber}`
    : name;  
  const channel = competition?.broadcasts?.[0]?.names?.[0];
  const isNationalTv = (competition?.broadcasts ?? []).length > 0;
  const venue = competition?.venue?.fullName;

  const homeLogo = TEAM_SPORTS.includes(sport) ? getTeamLogo(homeComp?.team) : undefined;
  const awayLogo = TEAM_SPORTS.includes(sport) ? getTeamLogo(awayComp?.team) : undefined;
  const eventLogo = !TEAM_SPORTS.includes(sport)
    ? getTournamentLogo(raw, sport)
    : undefined;

  if (sport === 'golf') {
    const isMajor = isMajorTournament(name, sport);
    const startDate = parseISO(utcDateStr);
    return [0, 1, 2, 3].map((offset) => ({
      id: `golf-espn-${raw.id}-day${offset + 1}`,
      name: `${name} — Round ${offset + 1}`,
      sport,
      date: format(addDays(startDate, offset), 'yyyy-MM-dd'),
      time: offset === 0 ? timeStr : undefined,
      venue,
      channel,
      isNationalTv,
      isMajor,
      eventLogo,
    }));
  }

  if (sport === 'tennis') {
    const isMajor = isMajorTournament(name, sport);
    const startDate = parseISO(utcDateStr);
    const duration = isMajor ? 14 : 7;
    return Array.from({ length: duration }, (_, offset) => ({
      id: `tennis-espn-${raw.id}-day${offset + 1}`,
      name: `${name} — Day ${offset + 1}`,
      sport,
      date: format(addDays(startDate, offset), 'yyyy-MM-dd'),
      time: undefined,
      venue,
      channel,
      isNationalTv,
      isMajor,
      eventLogo,
    }));
  }

  return [{
    id: `${sport}-espn-${raw.id}`,
    name,
    gameNumber,
    sport,
    date: dateStr,
    time: timeStr,
    homeTeam: home || undefined,
    awayTeam: away || undefined,
    homeAbbrev,
    awayAbbrev,
    homeLogo,
    awayLogo,
    eventLogo,
    venue,
    channel,
    isNationalTv,
    isMajor: false,
  }];
}

async function fetchLeague(
  path: string,
  sport: Sport,
  year: number,
  month: number,
  extraParams: Record<string, any> = {}
): Promise<SportEvent[]> {
  const from = format(startOfMonth(new Date(year, month)), 'yyyyMMdd');
  const to = format(endOfMonth(new Date(year, month)), 'yyyyMMdd');
  const dateParam = extraParams.dates ?? `${from}-${to}`;
  const { dates: _, ...otherParams } = extraParams;
  try {
    const response = await axios.get(`${BASE}/${path}/scoreboard`, {
      params: { dates: dateParam, limit: 200, ...otherParams },
    });
    return (response.data?.events ?? []).flatMap((e: any) => normalizeEvent(e, sport));
  } catch (err) {
    console.error(`Failed to fetch ${path}:`, err);
    return [];
  }
}

export async function fetchGamesForMonth(
  sport: Sport,
  year: number,
  month: number,
  preferences?: UserPreferences
): Promise<SportEvent[]> {
  if (sport === 'soccer') {
    const setting = preferences?.sportSettings?.[sport];
    const leagues = setting?.selectedSoccerLeagues?.length
      ? setting.selectedSoccerLeagues
      : ['usa.1'];

    const results = await Promise.allSettled(
      leagues.map((leagueId) => fetchLeague(`soccer/${leagueId}`, sport, year, month))
    );

    const seen = new Set<string>();
    return results
      .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      .filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
  }

  if (sport === 'ncaafb' || sport === 'ncaamb') {
    const extraParams = EXTRA_PARAMS[sport] ?? {};
    const saturdays: Date[] = [];
    const start = startOfMonth(new Date(year, month));
    const end = endOfMonth(new Date(year, month));
    let current = start;
    while (current <= end) {
      if (current.getDay() === 6) saturdays.push(new Date(current));
      current = addDays(current, 1);
    }

    const results = await Promise.allSettled(
      saturdays.map((saturday) =>
        fetchLeague(ESPN_PATHS[sport], sport, year, month, {
          ...extraParams,
          dates: format(saturday, 'yyyyMMdd'),
        })
      )
    );

    const seen = new Set<string>();
    return results
      .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      .filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
  }

  const extraParams = EXTRA_PARAMS[sport] ?? {};
  return fetchLeague(ESPN_PATHS[sport], sport, year, month, extraParams);
}

export async function fetchGamesForSports(
  sports: Sport[],
  year: number,
  month: number,
  preferences?: UserPreferences
): Promise<SportEvent[]> {
  const results = await Promise.allSettled(
    sports.map((sport) => fetchGamesForMonth(sport, year, month, preferences))
  );
  return results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => a.date.localeCompare(b.date));
}
