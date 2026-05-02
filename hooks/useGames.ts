import { useQuery } from '@tanstack/react-query';
import { fetchGamesForSports } from './lib/sportsApi';
import { SportEvent, useAppStore } from './lib/store';

function applyFilters(events: SportEvent[], sportSettings: Record<string, any>): SportEvent[] {
  return events.filter((event) => {
    const setting = sportSettings[event.sport];
    if (!setting) return true;

    // Golf — filter by majors
    if (event.sport === 'golf') {
      const filter = setting.tournamentFilter;
      if (filter === 'majors') return event.isMajor === true;
      return true; // 'all' shows everything
    }

    // Team sports — filter by team/national TV
    const filter = setting.teamFilter;
    if (!filter || filter === 'all') return true;

    if (filter === 'national_tv') {
      return event.isNationalTv === true;
    }

    if (filter === 'my_team') {
      const favTeams: string[] = (setting.favoriteTeams ?? []).map((t: any) => t.name);
      if (favTeams.length === 0) return true;
      return favTeams.some((name) => event.homeTeam === name || event.awayTeam === name);
    }

    if (filter === 'my_team_and_national_tv') {
      const favTeams: string[] = (setting.favoriteTeams ?? []).map((t: any) => t.name);
      if (favTeams.length === 0) return event.isNationalTv === true;
      return (
        event.isNationalTv === true ||
        favTeams.some((name) => event.homeTeam === name || event.awayTeam === name)
      );
    }

    return true;
  });
}

export function useGames(year: number, month: number) {
  const sports = useAppStore((s) => s.preferences.sports);
  const sportSettings = useAppStore((s) => s.preferences.sportSettings);
  const customEvents = useAppStore((s) => s.customEvents);

  const query = useQuery({
    queryKey: ['games', sports, year, month],
    queryFn: () => fetchGamesForSports(sports, year, month),
    staleTime: 1000 * 60 * 60,
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