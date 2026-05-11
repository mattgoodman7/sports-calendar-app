import axios from 'axios';

const API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY;
const BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';

export const posterUrl = (path: string | null, size: 'w185' | 'w342' | 'w500' = 'w342') =>
  path ? `${IMAGE_BASE}/${size}${path}` : null;

export const backdropUrl = (path: string | null) =>
  path ? `${IMAGE_BASE}/w780${path}` : null;

const api = axios.create({
  baseURL: BASE,
  params: { api_key: API_KEY, language: 'en-US' },
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type MediaType = 'movie' | 'tv';

export interface SearchResult {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  overview: string;
  releaseDate: string | null;   // movies
  firstAirDate: string | null;  // tv
  voteAverage: number;
}

export interface MovieDetail {
  id: number;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  runtime: number | null;
  voteAverage: number;
  genres: { id: number; name: string }[];
  status: string; // 'Released', 'In Production', 'Post Production', etc.
  streamingProviders: StreamingProvider[];
}

export interface TvDetail {
  id: number;
  name: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  firstAirDate: string | null;
  lastAirDate: string | null;
  numberOfSeasons: number;
  numberOfEpisodes: number;
  voteAverage: number;
  genres: { id: number; name: string }[];
  status: string; // 'Returning Series', 'Ended', 'Canceled', etc.
  nextEpisodeToAir: EpisodeInfo | null;
  lastEpisodeToAir: EpisodeInfo | null;
  seasons: SeasonSummary[];
  streamingProviders: StreamingProvider[];
}

export interface SeasonSummary {
  id: number;
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  posterPath: string | null;
}

export interface EpisodeInfo {
  id: number;
  name: string;
  seasonNumber: number;
  episodeNumber: number;
  airDate: string | null;
  overview: string;
  stillPath: string | null;
}

export interface SeasonDetail {
  id: number;
  seasonNumber: number;
  name: string;
  overview: string;
  posterPath: string | null;
  airDate: string | null;
  episodes: EpisodeDetail[];
}

export interface EpisodeDetail {
  id: number;
  name: string;
  overview: string;
  episodeNumber: number;
  seasonNumber: number;
  airDate: string | null;
  runtime: number | null;
  stillPath: string | null;
  voteAverage: number;
}

export interface StreamingProvider {
  providerId: number;
  providerName: string;
  logoPath: string | null;
  type: 'flatrate' | 'rent' | 'buy' | 'free';
}

// ─── Search ──────────────────────────────────────────────────────────────────

export async function searchMulti(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  try {
    const res = await api.get('/search/multi', { params: { query, include_adult: false } });
    return (res.data.results ?? [])
      .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
      .map((r: any) => ({
        id: r.id,
        mediaType: r.media_type as MediaType,
        title: r.title ?? r.name ?? 'Unknown',
        posterPath: r.poster_path ?? null,
        overview: r.overview ?? '',
        releaseDate: r.release_date ?? null,
        firstAirDate: r.first_air_date ?? null,
        voteAverage: r.vote_average ?? 0,
      }));
  } catch (err) {
    console.error('TMDB search error:', err);
    return [];
  }
}

// ─── Movie Detail ─────────────────────────────────────────────────────────────

export async function fetchMovieDetail(id: number): Promise<MovieDetail | null> {
  try {
    const [detailRes, providersRes] = await Promise.all([
      api.get(`/movie/${id}`),
      api.get(`/movie/${id}/watch/providers`),
    ]);
    const d = detailRes.data;
    const providerData = providersRes.data.results?.US ?? {};
    const providers = parseProviders(providerData);

    return {
      id: d.id,
      title: d.title,
      overview: d.overview ?? '',
      posterPath: d.poster_path ?? null,
      backdropPath: d.backdrop_path ?? null,
      releaseDate: d.release_date ?? null,
      runtime: d.runtime ?? null,
      voteAverage: d.vote_average ?? 0,
      genres: d.genres ?? [],
      status: d.status ?? '',
      streamingProviders: providers,
    };
  } catch (err) {
    console.error('TMDB movie detail error:', err);
    return null;
  }
}

// ─── TV Detail ───────────────────────────────────────────────────────────────

export async function fetchTvDetail(id: number): Promise<TvDetail | null> {
  try {
    const [detailRes, providersRes] = await Promise.all([
      api.get(`/tv/${id}`),
      api.get(`/tv/${id}/watch/providers`),
    ]);
    const d = detailRes.data;
    const providerData = providersRes.data.results?.US ?? {};
    const providers = parseProviders(providerData);

    return {
      id: d.id,
      name: d.name,
      overview: d.overview ?? '',
      posterPath: d.poster_path ?? null,
      backdropPath: d.backdrop_path ?? null,
      firstAirDate: d.first_air_date ?? null,
      lastAirDate: d.last_air_date ?? null,
      numberOfSeasons: d.number_of_seasons ?? 0,
      numberOfEpisodes: d.number_of_episodes ?? 0,
      voteAverage: d.vote_average ?? 0,
      genres: d.genres ?? [],
      status: d.status ?? '',
      nextEpisodeToAir: d.next_episode_to_air ? parseEpisode(d.next_episode_to_air) : null,
      lastEpisodeToAir: d.last_episode_to_air ? parseEpisode(d.last_episode_to_air) : null,
      seasons: (d.seasons ?? [])
        .filter((s: any) => s.season_number > 0)
        .map((s: any) => ({
          id: s.id,
          seasonNumber: s.season_number,
          name: s.name,
          episodeCount: s.episode_count,
          airDate: s.air_date ?? null,
          posterPath: s.poster_path ?? null,
        })),
      streamingProviders: providers,
    };
  } catch (err) {
    console.error('TMDB TV detail error:', err);
    return null;
  }
}

// ─── Season Detail ───────────────────────────────────────────────────────────

export async function fetchSeasonDetail(tvId: number, seasonNumber: number): Promise<SeasonDetail | null> {
  try {
    const res = await api.get(`/tv/${tvId}/season/${seasonNumber}`);
    const d = res.data;
    return {
      id: d.id,
      seasonNumber: d.season_number,
      name: d.name,
      overview: d.overview ?? '',
      posterPath: d.poster_path ?? null,
      airDate: d.air_date ?? null,
      episodes: (d.episodes ?? []).map((e: any) => ({
        id: e.id,
        name: e.name,
        overview: e.overview ?? '',
        episodeNumber: e.episode_number,
        seasonNumber: e.season_number,
        airDate: e.air_date ?? null,
        runtime: e.runtime ?? null,
        stillPath: e.still_path ?? null,
        voteAverage: e.vote_average ?? 0,
      })),
    };
  } catch (err) {
    console.error('TMDB season detail error:', err);
    return null;
  }
}

// ─── Upcoming Movies ─────────────────────────────────────────────────────────

export async function fetchUpcomingMovies(): Promise<SearchResult[]> {
  try {
    const res = await api.get('/movie/upcoming', { params: { region: 'US' } });
    return (res.data.results ?? []).map((r: any) => ({
      id: r.id,
      mediaType: 'movie' as MediaType,
      title: r.title,
      posterPath: r.poster_path ?? null,
      overview: r.overview ?? '',
      releaseDate: r.release_date ?? null,
      firstAirDate: null,
      voteAverage: r.vote_average ?? 0,
    }));
  } catch (err) {
    console.error('TMDB upcoming movies error:', err);
    return [];
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseEpisode(e: any): EpisodeInfo {
  return {
    id: e.id,
    name: e.name,
    seasonNumber: e.season_number,
    episodeNumber: e.episode_number,
    airDate: e.air_date ?? null,
    overview: e.overview ?? '',
    stillPath: e.still_path ?? null,
  };
}

function parseProviders(providerData: any): StreamingProvider[] {
  const providers: StreamingProvider[] = [];
  const seen = new Set<number>();

  const addProviders = (list: any[], type: StreamingProvider['type']) => {
    for (const p of list ?? []) {
      if (!seen.has(p.provider_id)) {
        seen.add(p.provider_id);
        providers.push({
          providerId: p.provider_id,
          providerName: p.provider_name,
          logoPath: p.logo_path ?? null,
          type,
        });
      }
    }
  };

  addProviders(providerData.flatrate, 'flatrate');
  addProviders(providerData.free, 'free');
  addProviders(providerData.rent, 'rent');
  addProviders(providerData.buy, 'buy');

  return providers;
}
