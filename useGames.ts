import { useQuery } from '@tanstack/react-query';
import { fetchGamesForSports } from '../lib/sportsApi';
import { useAppStore } from '../lib/store';

export function useGames(year: number, month: number) {
  const sports = useAppStore((s) => s.preferences.sports);
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

  const allEvents = [...(query.data ?? []), ...customForMonth];

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