import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MediaType } from './tmdb';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StreamingProviderInfo {
  providerId: number;
  providerName: string;
  logoPath: string | null;
  type: 'flatrate' | 'rent' | 'buy' | 'free';
}

export type TvCategory = 'caught_up' | 'currently_watching' | 'wishlist' | 'finished' | 'ditched';
export type MovieCategory = 'watched' | 'wishlist' | 'upcoming';

export interface TrackedMovie {
  id: number;
  type: 'movie';
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  streamingDate: string | null;
  streamingProviders: StreamingProviderInfo[];
  watched: boolean;
  addedAt: string;
}

export interface TrackedShow {
  id: number;
  type: 'tv';
  name: string;
  posterPath: string | null;
  firstAirDate: string | null;
  status: string;
  totalSeasons: number;
  totalEpisodes: number;
  streamingProviders: StreamingProviderInfo[];
  nextEpisodeAirDate: string | null;
  nextEpisodeName: string | null;
  nextEpisodeSeason: number | null;
  nextEpisodeNumber: number | null;
  currentSeasonNumber: number;
  currentSeasonEpisodes: number;
  currentSeasonAiredEpisodes: number;
  watchedEpisodes: Record<string, boolean>;
  categoryOverride: TvCategory | null;
  addedAt: string;
  lastRefreshedAt: string | null;
}

export type TrackedMedia = TrackedMovie | TrackedShow;

// TMDB status strings that mean a show is permanently over
const FINISHED_STATUSES = new Set(['Ended', 'Canceled', 'Cancelled']);

// ─── Categorization logic ─────────────────────────────────────────────────────

export function getTvCategory(show: TrackedShow): TvCategory {
  if (show.categoryOverride) return show.categoryOverride;

  const watchedCount = getWatchedCount(show);
  if (watchedCount === 0) return 'wishlist';

  const latestSeason = show.totalSeasons;
  if (latestSeason === 0) return 'wishlist';

  const hasWatchedLatestSeason = Object.keys(show.watchedEpisodes).some(key => {
    const match = key.match(/^S(\d+)E\d+$/);
    if (!match) return false;
    const s = parseInt(match[1], 10);
    return s >= 1 && s <= (show.currentSeasonNumber || latestSeason);
  });

  if (!hasWatchedLatestSeason) return 'wishlist';

  if (show.nextEpisodeAirDate) {
    const totalAired = show.totalEpisodes - 1;
    const isCaughtUp = watchedCount >= totalAired;
    return isCaughtUp ? 'caught_up' : 'currently_watching';
  } else {
    const unairedInCurrentSeason = Math.max(
      0,
      (show.currentSeasonEpisodes ?? 0) - (show.currentSeasonAiredEpisodes ?? 0)
    );
    const totalAired = show.totalEpisodes - unairedInCurrentSeason;
    const isCaughtUp = watchedCount >= totalAired;
    if (!isCaughtUp) return 'currently_watching';
    return FINISHED_STATUSES.has(show.status) ? 'finished' : 'caught_up';
  }
}

export function getMovieCategory(movie: TrackedMovie): MovieCategory {
  if (movie.watched) return 'watched';
  if (movie.releaseDate) {
    const release = new Date(movie.releaseDate);
    release.setHours(23, 59, 59, 999);
    if (release > new Date()) return 'upcoming';
  }
  return 'wishlist';
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface MediaState {
  trackedMovies: Record<number, TrackedMovie>;
  trackedShows: Record<number, TrackedShow>;

  // Drag order: maps category → ordered array of IDs
  // IDs not present in order array fall to the end in addedAt order
  tvCategoryOrder: Record<string, number[]>;
  movieCategoryOrder: Record<string, number[]>;

  addMovie: (movie: TrackedMovie) => void;
  removeMovie: (id: number) => void;
  toggleMovieWatched: (id: number) => void;
  setMovieCategoryOrder: (category: string, orderedIds: number[]) => void;

  addShow: (show: TrackedShow) => void;
  removeShow: (id: number) => void;
  markEpisodeWatched: (showId: number, seasonNumber: number, episodeNumber: number, watched: boolean) => void;
  markSeasonWatched: (showId: number, seasonNumber: number, episodeCount: number, watched: boolean) => void;
  setShowCategoryOverride: (id: number, category: TvCategory | null) => void;
  setTvCategoryOrder: (category: string, orderedIds: number[]) => void;
  refreshShow: (showId: number, updates: Partial<Pick<TrackedShow,
    | 'status'
    | 'totalSeasons'
    | 'totalEpisodes'
    | 'streamingProviders'
    | 'nextEpisodeAirDate'
    | 'nextEpisodeName'
    | 'nextEpisodeSeason'
    | 'nextEpisodeNumber'
    | 'currentSeasonNumber'
    | 'currentSeasonEpisodes'
    | 'currentSeasonAiredEpisodes'
    | 'lastRefreshedAt'
  >>) => void;
}

export const useMediaStore = create<MediaState>()(
  persist(
    (set) => ({
      trackedMovies: {},
      trackedShows: {},
      tvCategoryOrder: {},
      movieCategoryOrder: {},

      addMovie: (movie) =>
        set((state) => ({ trackedMovies: { ...state.trackedMovies, [movie.id]: movie } })),

      removeMovie: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.trackedMovies;
          // Remove from all category orders
          const movieCategoryOrder = Object.fromEntries(
            Object.entries(state.movieCategoryOrder).map(([cat, ids]) => [cat, ids.filter(i => i !== id)])
          );
          return { trackedMovies: rest, movieCategoryOrder };
        }),

      toggleMovieWatched: (id) =>
        set((state) => ({
          trackedMovies: {
            ...state.trackedMovies,
            [id]: { ...state.trackedMovies[id], watched: !state.trackedMovies[id]?.watched },
          },
        })),


      setMovieCategoryOrder: (category, orderedIds) =>
        set((state) => ({
          movieCategoryOrder: { ...state.movieCategoryOrder, [category]: orderedIds },
        })),

      addShow: (show) =>
        set((state) => ({ trackedShows: { ...state.trackedShows, [show.id]: show } })),

      removeShow: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.trackedShows;
          // Remove from all category orders
          const tvCategoryOrder = Object.fromEntries(
            Object.entries(state.tvCategoryOrder).map(([cat, ids]) => [cat, ids.filter(i => i !== id)])
          );
          return { trackedShows: rest, tvCategoryOrder };
        }),

      markEpisodeWatched: (showId, seasonNumber, episodeNumber, watched) =>
        set((state) => {
          const show = state.trackedShows[showId];
          if (!show) return state;
          const key = `S${seasonNumber}E${episodeNumber}`;
          const watchedEpisodes = { ...show.watchedEpisodes };
          if (watched) { watchedEpisodes[key] = true; }
          else { delete watchedEpisodes[key]; }
          return { trackedShows: { ...state.trackedShows, [showId]: { ...show, watchedEpisodes } } };
        }),

      markSeasonWatched: (showId, seasonNumber, episodeCount, watched) =>
        set((state) => {
          const show = state.trackedShows[showId];
          if (!show) return state;
          const watchedEpisodes = { ...show.watchedEpisodes };
          for (let ep = 1; ep <= episodeCount; ep++) {
            const key = `S${seasonNumber}E${ep}`;
            if (watched) { watchedEpisodes[key] = true; }
            else { delete watchedEpisodes[key]; }
          }
          return { trackedShows: { ...state.trackedShows, [showId]: { ...show, watchedEpisodes } } };
        }),

      setShowCategoryOverride: (id, category) =>
        set((state) => ({
          trackedShows: {
            ...state.trackedShows,
            [id]: { ...state.trackedShows[id], categoryOverride: category },
          },
        })),

      setTvCategoryOrder: (category, orderedIds) =>
        set((state) => ({
          tvCategoryOrder: { ...state.tvCategoryOrder, [category]: orderedIds },
        })),

      refreshShow: (showId, updates) =>
        set((state) => {
          const show = state.trackedShows[showId];
          if (!show) return state;
          return { trackedShows: { ...state.trackedShows, [showId]: { ...show, ...updates } } };
        }),
    }),
    {
      name: 'media-calendar-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ─── Selectors ────────────────────────────────────────────────────────────────

export function getWatchedCount(show: TrackedShow): number {
  return Object.values(show.watchedEpisodes).filter(Boolean).length;
}

export function getProgressPercent(show: TrackedShow): number {
  if (show.totalEpisodes === 0) return 0;
  return Math.round((getWatchedCount(show) / show.totalEpisodes) * 100);
}

export function isEpisodeWatched(show: TrackedShow, seasonNumber: number, episodeNumber: number): boolean {
  return show.watchedEpisodes[`S${seasonNumber}E${episodeNumber}`] === true;
}

export function isSeasonWatched(show: TrackedShow, seasonNumber: number, episodeCount: number): boolean {
  for (let ep = 1; ep <= episodeCount; ep++) {
    if (!show.watchedEpisodes[`S${seasonNumber}E${ep}`]) return false;
  }
  return true;
}

// ─── Current season helpers ───────────────────────────────────────────────────

export function getCurrentSeasonWatchedCount(show: TrackedShow): number {
  const s = show.currentSeasonNumber;
  if (!s) return 0;
  return Object.keys(show.watchedEpisodes).filter(key => {
    const match = key.match(/^S(\d+)E\d+$/);
    return match && parseInt(match[1], 10) === s;
  }).length;
}

export function getCurrentSeasonWatchedPercent(show: TrackedShow): number {
  if (!show.currentSeasonEpisodes) return 0;
  return Math.round((getCurrentSeasonWatchedCount(show) / show.currentSeasonEpisodes) * 100);
}

export function getCurrentSeasonAiredPercent(show: TrackedShow): number {
  if (!show.currentSeasonEpisodes) return 0;
  return Math.round((show.currentSeasonAiredEpisodes / show.currentSeasonEpisodes) * 100);
}

// ─── Ordering helper ──────────────────────────────────────────────────────────
// Given a list of items and a stored order (array of IDs), returns items
// sorted by the stored order. Items not in the order array appear at the end
// in their natural (addedAt) order.

export function applyOrder<T extends { id: number }>(items: T[], order: number[]): T[] {
  const orderMap = new Map(order.map((id, i) => [id, i]));
  return [...items].sort((a, b) => {
    const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : Infinity;
    const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : Infinity;
    return ai - bi;
  });
}

// ─── Refresh eligibility ──────────────────────────────────────────────────────

const REFRESH_STALE_HOURS = 24;
const REFRESH_LOOKAHEAD_DAYS = 7;

export function shouldRefreshShow(show: TrackedShow): boolean {
  if (FINISHED_STATUSES.has(show.status)) return false;

  const now = new Date();

  if (show.lastRefreshedAt) {
    const hoursSince = (now.getTime() - new Date(show.lastRefreshedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSince < REFRESH_STALE_HOURS) return false;
  }

  if (show.nextEpisodeAirDate) {
    const daysUntil = (new Date(show.nextEpisodeAirDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntil <= REFRESH_LOOKAHEAD_DAYS;
  }

  return true;
}
