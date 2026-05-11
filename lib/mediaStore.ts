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

export type TvCategory = 'caught_up' | 'currently_watching' | 'wishlist';
export type MovieCategory = 'watched' | 'wishlist';

export interface TrackedMovie {
  id: number;
  type: 'movie';
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  streamingDate: string | null;
  streamingProviders: StreamingProviderInfo[];
  watched: boolean;
  categoryOverride: MovieCategory | null; // null = use auto
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
  watchedEpisodes: Record<string, boolean>; // "S1E3" → true
  categoryOverride: TvCategory | null;      // null = use auto
  addedAt: string;
}

export type TrackedMedia = TrackedMovie | TrackedShow;

// ─── Categorization logic ─────────────────────────────────────────────────────

export function getTvCategory(show: TrackedShow): TvCategory {
  if (show.categoryOverride) return show.categoryOverride;

  const watchedCount = getWatchedCount(show);

  if (watchedCount === 0) return 'wishlist';

  // Find the most recently aired season number
  // We use totalSeasons as a proxy — the highest season is the most recent
  const latestSeason = show.totalSeasons;
  if (latestSeason === 0) return 'wishlist';

  // Check if user has watched any episode from the latest season
  const hasWatchedLatestSeason = Object.keys(show.watchedEpisodes).some(key => {
    const match = key.match(/^S(\d+)E\d+$/);
    return match && parseInt(match[1], 10) === latestSeason;
  });

  if (!hasWatchedLatestSeason) return 'wishlist';

  // They've watched something from the latest season —
  // now check if they're fully caught up on all aired episodes.
  // We use nextEpisodeAirDate as a signal: if there's a next episode
  // and they haven't watched through it yet, they're "currently watching".
  // If no next episode (show ended or season gap), check if progress is 100%.
  if (show.nextEpisodeAirDate) {
    // Show is still airing — are they caught up to the very latest?
    // "Caught up" means watched everything up to but not including the next episode
    const nextSeason = show.nextEpisodeSeason ?? latestSeason;
    const nextEp     = show.nextEpisodeNumber ?? 999;

    // Count watched episodes in latest season up to (but not including) next ep
    const watchedUpToNext = Object.keys(show.watchedEpisodes).filter(key => {
      const match = key.match(/^S(\d+)E(\d+)$/);
      if (!match) return false;
      const s = parseInt(match[1], 10);
      const e = parseInt(match[2], 10);
      // Earlier seasons all watched, or current season up to next ep
      return s < nextSeason || (s === nextSeason && e < nextEp);
    }).length;

    // Total episodes that should be watched to be "caught up"
    // = all episodes before the next one to air
    // We estimate: totalEpisodes - remaining unaired
    // Simple heuristic: if they've watched everything aired, they're caught up
    const totalAired = show.totalEpisodes - 1; // at least 1 unaired (the next one)
    const isCaughtUp = watchedCount >= totalAired;

    return isCaughtUp ? 'caught_up' : 'currently_watching';
  } else {
    // No next episode — show may be on hiatus or ended
    // If they've watched all episodes, caught up; otherwise currently watching
    return watchedCount >= show.totalEpisodes ? 'caught_up' : 'currently_watching';
  }
}

export function getMovieCategory(movie: TrackedMovie): MovieCategory {
  if (movie.categoryOverride) return movie.categoryOverride;
  return movie.watched ? 'watched' : 'wishlist';
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface MediaState {
  trackedMovies: Record<number, TrackedMovie>;
  trackedShows: Record<number, TrackedShow>;

  addMovie: (movie: TrackedMovie) => void;
  removeMovie: (id: number) => void;
  toggleMovieWatched: (id: number) => void;
  setMovieCategoryOverride: (id: number, category: MovieCategory | null) => void;

  addShow: (show: TrackedShow) => void;
  removeShow: (id: number) => void;
  markEpisodeWatched: (showId: number, seasonNumber: number, episodeNumber: number, watched: boolean) => void;
  markSeasonWatched: (showId: number, seasonNumber: number, episodeCount: number, watched: boolean) => void;
  setShowCategoryOverride: (id: number, category: TvCategory | null) => void;
  updateShowNextEpisode: (showId: number, updates: Partial<Pick<TrackedShow,
    'nextEpisodeAirDate' | 'nextEpisodeName' | 'nextEpisodeSeason' | 'nextEpisodeNumber'
  >>) => void;
}

export const useMediaStore = create<MediaState>()(
  persist(
    (set) => ({
      trackedMovies: {},
      trackedShows: {},

      addMovie: (movie) =>
        set((state) => ({ trackedMovies: { ...state.trackedMovies, [movie.id]: movie } })),

      removeMovie: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.trackedMovies;
          return { trackedMovies: rest };
        }),

      toggleMovieWatched: (id) =>
        set((state) => ({
          trackedMovies: {
            ...state.trackedMovies,
            [id]: { ...state.trackedMovies[id], watched: !state.trackedMovies[id]?.watched },
          },
        })),

      setMovieCategoryOverride: (id, category) =>
        set((state) => ({
          trackedMovies: {
            ...state.trackedMovies,
            [id]: { ...state.trackedMovies[id], categoryOverride: category },
          },
        })),

      addShow: (show) =>
        set((state) => ({ trackedShows: { ...state.trackedShows, [show.id]: show } })),

      removeShow: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.trackedShows;
          return { trackedShows: rest };
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

      updateShowNextEpisode: (showId, updates) =>
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
