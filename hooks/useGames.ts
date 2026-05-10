import { useQuery } from '@tanstack/react-query';
import { fetchGamesForSports } from '../lib/sportsApi';
import { DRAFT_EVENTS } from '../lib/draftEvents';
import { DRAFT_SPORTS, KNOCKOUT_ROUND_ORDER, SOCCER_CLUB_LEAGUES, SOCCER_KNOCKOUT_COMPETITIONS, SportEvent, useAppStore } from '../lib/store';

const ROUND_RANK: Record<string, number> = {
  'quarterfinals': 0,
  'semifinals':    1,
  'final':         2,
};

function applyFilters(events: SportEvent[], sportSettings: Record<string, any>): SportEvent[] {
  return events.filter((event) => {
    const setting = sportSettings[event.sport];
    if (!setting) return true;

    // Draft events — show only if showDrafts is enabled
    if (event.isDraft) {
      return setting.showDrafts === true;
    }

    if (event.gameNumber && setting.alwaysShowPlayoffs) return true;

    if (event.sport === 'golf' || event.sport === 'tennis') {
      const filter = setting.tournamentFilter;
      if (filter === 'majors') return event.isMajor === true;
      return true;
    }

    if (event.sport === 'f1') {
      const sessionType = event.f1SessionType;
      if (!sessionType) return true;
      if (sessionType === 'FP1' || sessionType === 'FP2' || sessionType === 'FP3') {
        return setting.f1ShowPractice === true;
      }
      if (sessionType === 'SS') return setting.f1ShowSprintShootout === true;
      if (sessionType === 'SR') return setting.f1ShowSprintRace === true;
      if (sessionType === 'Qual') return setting.f1ShowQualifying === true;
      if (sessionType === 'Race') return setting.f1ShowRace !== false;
      return true;
    }

    if (event.sport === 'soccer') {
      const leagueId = event.soccerLeagueId;
      const roundSlug = event.soccerRoundSlug;
      const isClubLeague = SOCCER_CLUB_LEAGUES.some((l) => l.id === leagueId);
      const isKnockoutComp = SOCCER_KNOCKOUT_COMPETITIONS.some((l) => l.id === leagueId);

      const allTrackedTeams: string[] = [];
      const byLeague: Record<string, any[]> = setting.myTeamsByLeague ?? {};
      for (const teams of Object.values(byLeague)) {
        allTrackedTeams.push(...teams.map((t: any) => t.name));
      }

      const teamIsPlaying = allTrackedTeams.length > 0 &&
        allTrackedTeams.some((name) => event.homeTeam === name || event.awayTeam === name);

      if (isClubLeague) {
        const leagueFilters: Record<string, string> = setting.leagueFilters ?? {};
        const filter = leagueFilters[leagueId ?? ''] ?? setting.teamFilter ?? 'all';

        if (filter === 'all') return true;
        if (filter === 'national_tv') return event.isNationalTv === true;

        const leagueTeams = (byLeague[leagueId ?? ''] ?? []).map((t: any) => t.name);

        if (filter === 'my_team') {
          if (leagueTeams.length === 0) return true;
          return leagueTeams.some((name) => event.homeTeam === name || event.awayTeam === name);
        }

        if (filter === 'my_team_and_national_tv') {
          if (leagueTeams.length === 0) return event.isNationalTv === true;
          return (
            event.isNationalTv === true ||
            leagueTeams.some((name) => event.homeTeam === name || event.awayTeam === name)
          );
        }

        return true;
      }

      if (isKnockoutComp) {
        if (teamIsPlaying) return true;

        const thresholds: Record<string, string> = setting.knockoutThresholds ?? {};
        const threshold = thresholds[leagueId ?? ''] ?? 'off';
        if (threshold === 'off') return false;

        const eventRank = ROUND_RANK[roundSlug ?? ''] ?? -1;
        const thresholdRank = ROUND_RANK[threshold] ?? 99;
        return eventRank >= thresholdRank;
      }

      return true;
    }

    const filter = setting.teamFilter;
    if (!filter || filter === 'all') return true;
    if (filter === 'national_tv') return event.isNationalTv === true;

    if (filter === 'my_team') {
      const myTeams = getMyTeamsForEvent(event, setting);
      if (myTeams.length === 0) return true;
      return myTeams.some((name) => event.homeTeam === name || event.awayTeam === name);
    }

    if (filter === 'my_team_and_national_tv') {
      const myTeams = getMyTeamsForEvent(event, setting);
      if (myTeams.length === 0) return event.isNationalTv === true;
      return (
        event.isNationalTv === true ||
        myTeams.some((name) => event.homeTeam === name || event.awayTeam === name)
      );
    }

    return true;
  });
}

function getMyTeamsForEvent(event: SportEvent, setting: any): string[] {
  if (event.sport === 'soccer') {
    const byLeague: Record<string, any[]> = setting.myTeamsByLeague ?? {};
    return Object.values(byLeague).flat().map((t: any) => t.name);
  }
  return (setting.myTeams ?? []).map((t: any) => t.name);
}

export function useGames(year: number, month: number) {
  const sports = useAppStore((s) => s.preferences.sports);
  const sportSettings = useAppStore((s) => s.preferences.sportSettings);
  const customEvents = useAppStore((s) => s.customEvents);
  const preferences = useAppStore((s) => s.preferences);

  const query = useQuery({
    queryKey: ['games', sports, year, month, preferences.sportSettings?.soccer?.selectedClubLeagues],
    queryFn: () => fetchGamesForSports(sports, year, month, preferences),
    staleTime: 1000 * 60 * 60,
    enabled: sports.length > 0,
  });

  const customForMonth = customEvents.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  // Inject draft events for sports the user has enabled
  const draftsForMonth = DRAFT_EVENTS.filter((e) => {
    const d = new Date(e.date);
    return (
      d.getFullYear() === year &&
      d.getMonth() === month &&
      sports.includes(e.sport)
    );
  });

  const filtered = applyFilters(
    [...(query.data ?? []), ...draftsForMonth],
    sportSettings
  );
  const allEvents = [...filtered, ...customForMonth];

  const eventsByDate = allEvents.reduce<Record<string, typeof allEvents>>((acc, event) => {
    if (!acc[event.date]) acc[event.date] = [];
    acc[event.date].push(event);
    return acc;
  }, {});

  return {
    events: allEvents,
    eventsByDate,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
