import { useQuery } from '@tanstack/react-query';
import { fetchGamesForSports } from '../lib/sportsApi';
import { SportEvent, useAppStore } from '../lib/store';

function applyFilters(events: SportEvent[], sportSettings: Record<string, any>): SportEvent[] {
  return events.filter((event) => {
    const setting = sportSettings[event.sport];
    if (!setting) return true;
    
    // Show playoff games if the toggle is on
    if (event.gameNumber && setting.alwaysShowPlayoffs) return true;

    // Golf/Tennis — filter by majors
    if (event.sport === 'golf' || event.sport === 'tennis') {
      const filter = setting.tournamentFilter;
      if (filter === 'majors') return event.isMajor === true;
      return true;
    }

    // Team sports — filter by team/national TV
    const filter = setting.teamFilter;
    if (!filter || filter === 'all') return true;

    if (filter === 'national_tv') {
      return event.isNationalTv === true;
    }

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

/**
 * Get the list of team names to match against for a given event.
 * For soccer, uses myTeamsByLeague (all leagues combined).
 * For other sports, uses myTeams.
 */
function getMyTeamsForEvent(event: SportEvent, setting: any): string[] {
  if (event.sport === 'soccer') {
    // Flatten all teams across all selected leagues
    const byLeague: Record<string, any[]> = setting.myTeamsByLeague ?? {};
    return Object.values(byLeague)
      .flat()
      .map((t: any) => t.name);
  }
  return (setting.myTeams ?? []).map((t: any) => t.name);
}

export function useGames(year: number, month: number) {
  const sports = useAppStore((s) => s.preferences.sports);
  const sportSettings = useAppStore((s) => s.preferences.sportSettings);
  const customEvents = useAppStore((s) => s.customEvents);
  const preferences = useAppStore((s) => s.preferences);

  const query = useQuery({
    queryKey: ['games', sports, year, month, preferences.sportSettings?.soccer?.selectedSoccerLeagues],
    queryFn: () => fetchGamesForSports(sports, year, month, preferences),
   // staleTime: 1000 * 60 * 60,
   staleTime: 0,
    enabled: sports.length > 0,
  });

  const customForMonth = customEvents.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const filtered = applyFilters(query.data ?? [], sportSettings);
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
