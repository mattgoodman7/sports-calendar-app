import axios from 'axios';
import { addDays, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { F1SessionType, ROUND_LABELS, SOCCER_CLUB_LEAGUES, SOCCER_KNOCKOUT_COMPETITIONS, Sport, SportEvent, UserPreferences } from './store';

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

const NATIONAL_TV_CHANNELS = new Set([
  'ABC', 'CBS', 'NBC', 'FOX',
  'ESPN', 'ESPN2', 'ESPNU',
  'TNT', 'TBS', 'truTV',
  'FS1', 'FS2',
  'Prime Video', 'Hulu',
  'Peacock', 'Max',
]);

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

const F1_SESSION_MAP: Record<string, { type: F1SessionType; label: string; duration: number }> = {
  FP1:  { type: 'FP1',  label: 'Practice 1',      duration: 1 },
  FP2:  { type: 'FP2',  label: 'Practice 2',       duration: 1 },
  FP3:  { type: 'FP3',  label: 'Practice 3',       duration: 1 },
  SS:   { type: 'SS',   label: 'Sprint Shootout',  duration: 0.5 },
  SR:   { type: 'SR',   label: 'Sprint Race',      duration: 0.5 },
  Qual: { type: 'Qual', label: 'Qualifying',       duration: 1 },
  Race: { type: 'Race', label: 'Race',             duration: 2 },
};

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

function parseDateStr(dateStr: string): { localDate: string; utcDate: string; timeStr: string | undefined } {
  const utcDate = dateStr.slice(0, 10);
  const hasTrueTime = !dateStr.endsWith('T04:00Z') && !dateStr.endsWith('T00:00:00Z');
  const localDate = hasTrueTime ? format(new Date(dateStr), 'yyyy-MM-dd') : utcDate;
  const timeStr = hasTrueTime ? format(new Date(dateStr), 'h:mm a') : undefined;
  return { localDate, utcDate, timeStr };
}

function normalizeEvent(raw: any, sport: Sport, leagueId?: string): SportEvent[] {
  if (sport === 'nba') {
  console.log('NBA EVENT', raw.name, raw.type?.abbreviation, raw.season?.slug);
}
  if (sport === 'f1') {
    const raceName = raw.name ?? raw.shortName ?? 'Grand Prix';
    const eventLogo = 'https://a.espncdn.com/redesign/assets/img/icons/ESPN-icon-racing.png';
    const sessions: SportEvent[] = [];
    for (const competition of raw.competitions ?? []) {
      const abbrev = competition.type?.abbreviation;
      const sessionInfo = F1_SESSION_MAP[abbrev];
      if (!sessionInfo) continue;
      const compDate = competition.date;
      if (!compDate) continue;
      const { localDate, timeStr } = parseDateStr(compDate);
      sessions.push({
        id: `f1-espn-${raw.id}-${abbrev}`,
        name: `${raceName} — ${sessionInfo.label}`,
        sport: 'f1',
        date: localDate,
        time: timeStr,
        eventLogo,
        f1SessionType: sessionInfo.type,
        isNationalTv: (competition.broadcasts ?? []).length > 0,
        channel: competition.broadcasts?.[0]?.names?.[0],
        durationHours: sessionInfo.duration,
      });
    }
    return sessions;
  }

  const competition = raw.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const homeComp = competitors.find((c: any) => c.homeAway === 'home');
  const awayComp = competitors.find((c: any) => c.homeAway === 'away');
  const home = homeComp?.team?.displayName ?? '';
  const away = awayComp?.team?.displayName ?? '';
  const homeAbbrev = homeComp?.team?.abbreviation as string | undefined;
  const awayAbbrev = awayComp?.team?.abbreviation as string | undefined;

  const utcDateStr = raw.date ? raw.date.slice(0, 10) : '';
  const localDateStr = raw.date ? format(new Date(raw.date), 'yyyy-MM-dd') : '';
  const hasTrueTime = raw.date &&
    !raw.date.endsWith('T04:00Z') &&
    !raw.date.endsWith('T00:00:00Z');
  const dateStr = hasTrueTime ? localDateStr : utcDateStr;
  const timeStr = hasTrueTime ? format(new Date(raw.date), 'h:mm a') : undefined;

  const name = home && away
    ? `${away} @ ${home}`
    : (raw.name ?? raw.shortName ?? 'Event');

  const competitionNotes = competition?.notes ?? [];
  const playoffHeadline = competitionNotes.find((n: any) => n.headline)?.headline ?? '';
  const gameNumberMatch = playoffHeadline.match(/Game (\d+)/i);
  const gameNumber = gameNumberMatch ? parseInt(gameNumberMatch[1], 10) : undefined;

  const channel = competition?.broadcasts?.[0]?.names?.[0];
  const broadcasts = competition?.broadcasts ?? [];
  const isNationalTv = broadcasts.some((b: any) =>
    (b.names ?? []).some((name: string) =>
      NATIONAL_TV_CHANNELS.has(name)
    )
  );
  const venue = competition?.venue?.fullName;

  const homeLogo = TEAM_SPORTS.includes(sport) ? getTeamLogo(homeComp?.team) : undefined;
  const awayLogo = TEAM_SPORTS.includes(sport) ? getTeamLogo(awayComp?.team) : undefined;
  const eventLogo = !TEAM_SPORTS.includes(sport) ? getTournamentLogo(raw, sport) : undefined;

  // Soccer: round slug and competition label
  const soccerRoundSlug = sport === 'soccer' ? (raw.season?.slug ?? undefined) : undefined;
  let soccerCompetitionLabel: string | undefined;
  if (sport === 'soccer' && leagueId) {
    const isKnockout = SOCCER_KNOCKOUT_COMPETITIONS.some((c) => c.id === leagueId);
    if (isKnockout && soccerRoundSlug && ROUND_LABELS[soccerRoundSlug]) {
      const compName = SOCCER_KNOCKOUT_COMPETITIONS.find((c) => c.id === leagueId)?.label ?? '';
      soccerCompetitionLabel = `${compName} — ${ROUND_LABELS[soccerRoundSlug]}`;
    }
  }

  if (sport === 'golf') {
    const isMajor = isMajorTournament(name, sport);
    const startDate = parseISO(utcDateStr);
    return [0, 1, 2, 3].map((offset) => ({
      id: `golf-espn-${raw.id}-day${offset + 1}`,
      name: `${name} — Round ${offset + 1}`,
      sport,
      date: format(addDays(startDate, offset), 'yyyy-MM-dd'),
      time: offset === 0 ? timeStr : undefined,
      venue, channel, isNationalTv, isMajor, eventLogo,
    }));
  }

if (sport === 'tennis') {
  const isMajor = isMajorTournament(name, sport);
  const startDate = parseISO(utcDateStr);

  let duration: number;
if (raw.endDate) {
  const end = new Date(raw.endDate);
  const start = new Date(utcDateStr + 'T12:00:00');
  duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
} else {
  duration = isMajor ? 14 : 7;
}

  return Array.from({ length: duration }, (_, offset) => ({
    id: `tennis-espn-${raw.id}-day${offset + 1}`,
    name: `${name} — Day ${offset + 1}`,
    sport,
    date: format(addDays(startDate, offset), 'yyyy-MM-dd'),
    time: undefined,
    venue, channel, isNationalTv, isMajor, eventLogo,
  }));
}

  return [{
    id: `${sport}-espn-${raw.id}`,
    name, gameNumber, sport,
    date: dateStr, time: timeStr,
    homeTeam: home || undefined,
    awayTeam: away || undefined,
    homeAbbrev, awayAbbrev,
    homeLogo, awayLogo, eventLogo,
    venue, channel, isNationalTv,
    isMajor: false,
    soccerLeagueId: leagueId,
    soccerRoundSlug,
    soccerCompetitionLabel,
  }];
}

async function fetchLeague(
  path: string,
  sport: Sport,
  year: number,
  month: number,
  extraParams: Record<string, any> = {},
  leagueId?: string,
): Promise<SportEvent[]> {
  const from = format(startOfMonth(new Date(year, month)), 'yyyyMMdd');
  const to = format(endOfMonth(new Date(year, month)), 'yyyyMMdd');
  const dateParam = extraParams.dates ?? `${from}-${to}`;
  const { dates: _, ...otherParams } = extraParams;
  try {
    const response = await axios.get(`${BASE}/${path}/scoreboard`, {
      params: { dates: dateParam, limit: 200, ...otherParams },
    });
    const events = (response.data?.events ?? []).flatMap((e: any) => normalizeEvent(e, sport, leagueId));
    return events;
  } catch (err) {
    console.error(`Failed to fetch ${path}:`, err);
    return [];
  }
}
async function fetchLeagueByWeek(
  sport: Sport,
  year: number,
  month: number,
): Promise<SportEvent[]> {
  const start = startOfMonth(new Date(year, month));
  const end = endOfMonth(new Date(year, month));
  const weeks: Date[] = [];
  let current = start;
  while (current <= end) {
    weeks.push(new Date(current));
    current = addDays(current, 7);
  }

  const results = await Promise.allSettled(
    weeks.map((weekStart) => {
      const weekEnd = addDays(weekStart, 6);
      const from = format(weekStart, 'yyyyMMdd');
      const to = format(weekEnd > end ? end : weekEnd, 'yyyyMMdd');
      return fetchLeague(ESPN_PATHS[sport], sport, year, month, { dates: `${from}-${to}` });
    })
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
export async function fetchGamesForMonth(
  sport: Sport,
  year: number,
  month: number,
  preferences?: UserPreferences
): Promise<SportEvent[]> {
  if (sport === 'soccer') {
    const setting = preferences?.sportSettings?.[sport];
    const clubLeagues = setting?.selectedClubLeagues?.length ? setting.selectedClubLeagues : ['usa.1'];
    const knockoutLeagues = SOCCER_KNOCKOUT_COMPETITIONS.map((c) => c.id);
    const allLeagues = [...new Set([...clubLeagues, ...knockoutLeagues])];

    const results = await Promise.allSettled(
      allLeagues.map((leagueId) =>
        fetchLeague(`soccer/${leagueId}`, sport, year, month, {}, leagueId)
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
  if (sport === 'mlb' || sport === 'nhl' || sport === 'nba') {
    return fetchLeagueByWeek(sport, year, month);
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
