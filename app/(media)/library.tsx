import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useQuery } from '@tanstack/react-query';
import { format, isAfter, parseISO } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fetchMovieDetail,
  fetchSeasonDetail,
  fetchTvDetail,
  posterUrl,
  searchMulti,
  SearchResult,
  SeasonDetail,
} from '../../lib/tmdb';
import {
  applyOrder,
  getCurrentSeasonAiredPercent,
  getCurrentSeasonWatchedCount,
  getCurrentSeasonWatchedPercent,
  getMovieCategory,
  getProgressPercent,
  getTvCategory,
  getWatchedCount,
  isEpisodeWatched,
  isSeasonWatched,
  MovieCategory,
  shouldRefreshShow,
  TrackedMovie,
  TrackedShow,
  TvCategory,
  useMediaStore,
} from '../../lib/mediaStore';

const PURPLE = '#A78BFA';
const DARK   = '#0a0a0a';
const CARD   = '#141414';
const BORDER = '#222';
const GREEN  = '#4ade80';
const ORANGE = '#f97316';
const RED    = '#ef4444';

// ─── Background refresh hook ──────────────────────────────────────────────────

function useShowRefresh() {
  const { trackedShows, refreshShow } = useMediaStore();

  useEffect(() => {
    const showsToRefresh = Object.values(trackedShows).filter(shouldRefreshShow);
    if (showsToRefresh.length === 0) return;

    showsToRefresh.forEach((show, i) => {
      setTimeout(async () => {
        try {
          const detail = await fetchTvDetail(show.id);
          if (!detail) return;

          const seasons = detail.seasons ?? [];
          const currentSeason = seasons.length > 0 ? seasons[seasons.length - 1] : null;
          const currentSeasonNumber   = currentSeason?.seasonNumber ?? 0;
          const currentSeasonEpisodes = currentSeason?.episodeCount ?? 0;

          let currentSeasonAiredEpisodes = currentSeasonEpisodes;
          if (detail.nextEpisodeToAir) {
            const next = detail.nextEpisodeToAir;
            if (next.seasonNumber === currentSeasonNumber) {
              currentSeasonAiredEpisodes = Math.max(0, next.episodeNumber - 1);
            }
          }

          refreshShow(show.id, {
            status: detail.status,
            totalSeasons: detail.numberOfSeasons,
            totalEpisodes: detail.numberOfEpisodes,
            streamingProviders: detail.streamingProviders,
            nextEpisodeAirDate: detail.nextEpisodeToAir?.airDate ?? null,
            nextEpisodeName: detail.nextEpisodeToAir?.name ?? null,
            nextEpisodeSeason: detail.nextEpisodeToAir?.seasonNumber ?? null,
            nextEpisodeNumber: detail.nextEpisodeToAir?.episodeNumber ?? null,
            currentSeasonNumber,
            currentSeasonEpisodes,
            currentSeasonAiredEpisodes,
            lastRefreshedAt: new Date().toISOString(),
          });
        } catch (e) {
          // Silently fail — retry next time
        }
      }, i * 500);
    });
  }, []);
}

// ─── Search Bar ───────────────────────────────────────────────────────────────

function SearchBar({
  value, onChange, onFocus, onBlur,
}: {
  value: string; onChange: (v: string) => void; onFocus?: () => void; onBlur?: () => void;
}) {
  return (
    <View style={styles.searchBar}>
      <Text style={styles.searchIcon}>🔍</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Search..."
        placeholderTextColor="#555"
        value={value}
        onChangeText={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        returnKeyType="search"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChange('')}>
          <Text style={styles.searchClear}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Search Result Item ───────────────────────────────────────────────────────

function SearchResultItem({
  item, isTracked, onAdd, disabled,
}: {
  item: SearchResult; isTracked: boolean; onAdd: () => void; disabled?: boolean;
}) {
  const year   = item.releaseDate?.slice(0, 4) ?? item.firstAirDate?.slice(0, 4) ?? '';
  const poster = posterUrl(item.posterPath, 'w185');

  return (
    <View style={styles.searchResultItem}>
      {poster ? (
        <Image source={{ uri: poster }} style={styles.searchResultPoster} />
      ) : (
        <View style={[styles.searchResultPoster, styles.noPoster]}>
          <Text style={{ fontSize: 24 }}>{item.mediaType === 'movie' ? '🎬' : '📺'}</Text>
        </View>
      )}
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.searchResultMeta}>
          {item.mediaType === 'movie' ? '🎬 Movie' : '📺 TV Show'}{year ? `  ·  ${year}` : ''}
        </Text>
        {item.overview ? (
          <Text style={styles.searchResultOverview} numberOfLines={2}>{item.overview}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={[styles.addBtn, isTracked && styles.addBtnTracked]}
        onPress={onAdd}
        disabled={isTracked || disabled}
      >
        <Text style={[styles.addBtnText, isTracked && styles.addBtnTextTracked]}>
          {isTracked ? '✓' : '+'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
// markerPercent: white aired-episodes marker
// seasonBoundaries: array of percentages where season dividers should appear

function ProgressBar({
  percent,
  markerPercent,
  seasonBoundaries,
}: {
  percent: number;
  markerPercent?: number;
  seasonBoundaries?: number[];
}) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.min(percent, 100)}%` }]} />
      {seasonBoundaries?.map((bp, i) =>
        bp > 0 && bp < 100 ? (
          <View key={i} style={[styles.seasonBoundaryMarker, { left: `${bp}%` }]} />
        ) : null
      )}
      {markerPercent !== undefined && markerPercent > 0 && markerPercent <= 100 && (
        <View style={[styles.progressMarker, { left: `${Math.min(markerPercent, 100)}%` }]} />
      )}
    </View>
  );
}

// ─── Category Badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: TvCategory | MovieCategory }) {
  const config: Record<string, { label: string; bg: string; color: string }> = {
    caught_up:          { label: 'Caught Up',  bg: '#1a3a1a', color: GREEN },
    currently_watching: { label: 'Watching',   bg: '#1a1a3a', color: PURPLE },
    wishlist:           { label: 'Wishlist',   bg: '#2a1a1a', color: ORANGE },
    watched:            { label: 'Watched',    bg: '#1a3a1a', color: GREEN },
    finished:           { label: 'Finished',   bg: '#1a2a3a', color: '#60a5fa' },
    ditched:            { label: 'Ditched',    bg: '#2a1a1a', color: RED },
    upcoming:           { label: 'Upcoming',   bg: '#1a1a2a', color: '#f59e0b' },
  };
  const c = config[category] ?? config.wishlist;
  return (
    <View style={[styles.categoryBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.categoryBadgeText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

// ─── Show Card ────────────────────────────────────────────────────────────────

function ShowCard({
  show, onPress, drag, isActive,
}: {
  show: TrackedShow; onPress: () => void; drag?: () => void; isActive?: boolean;
}) {
  const poster    = posterUrl(show.posterPath, 'w185');
  const percent   = getProgressPercent(show);
  const watched   = getWatchedCount(show);
  const category  = getTvCategory(show);
  const streaming = show.streamingProviders.filter(p => p.type === 'flatrate' || p.type === 'free');

  const curWatched       = getCurrentSeasonWatchedCount(show);
  const curWatchedPct    = getCurrentSeasonWatchedPercent(show);
  const curAiredPct      = getCurrentSeasonAiredPercent(show);
  const hasCurrentSeason = show.currentSeasonEpisodes > 0;

  const unairedEpisodes = hasCurrentSeason ? show.currentSeasonEpisodes - show.currentSeasonAiredEpisodes : 0;
  const overallAiredPct = show.totalEpisodes > 0
    ? Math.round(((show.totalEpisodes - unairedEpisodes) / show.totalEpisodes) * 100)
    : 0;

  return (
    <TouchableOpacity
      style={[styles.mediaCard, isActive && styles.mediaCardDragging]}
      onPress={onPress}
      onLongPress={drag}
      delayLongPress={200}
      activeOpacity={0.8}
    >
      {poster ? (
        <Image source={{ uri: poster }} style={styles.mediaPoster} />
      ) : (
        <View style={[styles.mediaPoster, styles.noPoster]}>
          <Text style={{ fontSize: 32 }}>📺</Text>
        </View>
      )}
      <View style={styles.mediaInfo}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.mediaTitle} numberOfLines={2}>{show.name}</Text>
          {show.categoryOverride && <Text style={styles.overrideIndicator}>✎</Text>}
          {drag && <Text style={styles.dragHandle}>⠿</Text>}
        </View>
        <Text style={styles.mediaMeta}>📺 {show.totalSeasons} season{show.totalSeasons !== 1 ? 's' : ''}</Text>
        {streaming.length > 0 && (
          <Text style={styles.mediaMeta} numberOfLines={1}>🎞 {streaming.map(p => p.providerName).join(', ')}</Text>
        )}
        {show.nextEpisodeAirDate && category !== 'caught_up' && category !== 'finished' && (
          <Text style={styles.nextEpisodeText}>
            Next: S{show.nextEpisodeSeason}E{show.nextEpisodeNumber} · {format(parseISO(show.nextEpisodeAirDate), 'MMM d')}
          </Text>
        )}
        <View style={styles.progressRow}>
          <ProgressBar percent={percent} markerPercent={overallAiredPct} />
          <Text style={styles.progressText}>{watched}/{show.totalEpisodes}</Text>
        </View>
        {hasCurrentSeason && (
          <View style={styles.progressRow}>
            <View style={styles.seasonProgressLabel}>
              <Text style={styles.seasonProgressLabelText}>S{show.currentSeasonNumber}</Text>
            </View>
            <ProgressBar percent={curWatchedPct} markerPercent={curAiredPct} />
            <Text style={styles.progressText}>{curWatched}/{show.currentSeasonEpisodes}</Text>
          </View>
        )}
        <CategoryBadge category={category} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Movie Card ───────────────────────────────────────────────────────────────

function MovieCard({
  movie, onPress, drag, isActive,
}: {
  movie: TrackedMovie; onPress: () => void; drag?: () => void; isActive?: boolean;
}) {
  const poster    = posterUrl(movie.posterPath, 'w185');
  const category  = getMovieCategory(movie);
  const streaming = movie.streamingProviders.filter(p => p.type === 'flatrate' || p.type === 'free');

  return (
    <TouchableOpacity
      style={[styles.mediaCard, isActive && styles.mediaCardDragging]}
      onPress={onPress}
      onLongPress={drag}
      delayLongPress={200}
      activeOpacity={0.8}
    >
      {poster ? (
        <Image source={{ uri: poster }} style={styles.mediaPoster} />
      ) : (
        <View style={[styles.mediaPoster, styles.noPoster]}>
          <Text style={{ fontSize: 32 }}>🎬</Text>
        </View>
      )}
      <View style={styles.mediaInfo}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.mediaTitle} numberOfLines={2}>{movie.title}</Text>
          {drag && <Text style={styles.dragHandle}>⠿</Text>}
        </View>
        <Text style={styles.mediaMeta}>🎬 Movie</Text>
        {movie.releaseDate && (
          <Text style={styles.mediaMeta}>🎭 {format(parseISO(movie.releaseDate), 'MMM d, yyyy')}</Text>
        )}
        {streaming.length > 0 && (
          <Text style={styles.mediaMeta} numberOfLines={1}>📺 {streaming.map(p => p.providerName).join(', ')}</Text>
        )}
        <CategoryBadge category={category} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Category Section (collapsible + draggable) ───────────────────────────────

function TvCategorySection({
  title, items, onPress, onDragEnd,
}: {
  title: string;
  items: TrackedShow[];
  onPress: (id: number) => void;
  onDragEnd: (orderedIds: number[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  return (
    <View style={styles.categorySection}>
      <TouchableOpacity style={styles.categorySectionHeader} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        <Text style={styles.categorySectionTitle}>{title}</Text>
        <View style={styles.categorySectionRight}>
          <View style={styles.categoryCountBadge}>
            <Text style={styles.categoryCountText}>{items.length}</Text>
          </View>
          <Text style={styles.categorySectionChevron}>{expanded ? '▾' : '›'}</Text>
        </View>
      </TouchableOpacity>
      {expanded && (
        <DraggableFlatList
          data={items}
          keyExtractor={item => `show-${item.id}`}
          onDragEnd={({ data }) => onDragEnd(data.map(s => s.id))}
          renderItem={({ item, drag, isActive }: RenderItemParams<TrackedShow>) => (
            <ScaleDecorator>
              <ShowCard
                show={item}
                onPress={() => onPress(item.id)}
                drag={drag}
                isActive={isActive}
              />
            </ScaleDecorator>
          )}
          scrollEnabled={false}
          activationDistance={5}
        />
      )}
    </View>
  );
}

function MovieCategorySection({
  title, items, onPress, onDragEnd,
}: {
  title: string;
  items: TrackedMovie[];
  onPress: (id: number) => void;
  onDragEnd: (orderedIds: number[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  return (
    <View style={styles.categorySection}>
      <TouchableOpacity style={styles.categorySectionHeader} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        <Text style={styles.categorySectionTitle}>{title}</Text>
        <View style={styles.categorySectionRight}>
          <View style={styles.categoryCountBadge}>
            <Text style={styles.categoryCountText}>{items.length}</Text>
          </View>
          <Text style={styles.categorySectionChevron}>{expanded ? '▾' : '›'}</Text>
        </View>
      </TouchableOpacity>
      {expanded && (
        <DraggableFlatList
          data={items}
          keyExtractor={item => `movie-${item.id}`}
          onDragEnd={({ data }) => onDragEnd(data.map(m => m.id))}
          renderItem={({ item, drag, isActive }: RenderItemParams<TrackedMovie>) => (
            <ScaleDecorator>
              <MovieCard
                movie={item}
                onPress={() => onPress(item.id)}
                drag={drag}
                isActive={isActive}
              />
            </ScaleDecorator>
          )}
          scrollEnabled={false}
          activationDistance={5}
        />
      )}
    </View>
  );
}

// ─── Show Detail Modal ────────────────────────────────────────────────────────

function ShowDetailModal({ showId, onClose }: { showId: number; onClose: () => void }) {
  const { trackedShows, markEpisodeWatched, markSeasonWatched, removeShow, setShowCategoryOverride } = useMediaStore();
  const show = trackedShows[showId];
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);
  const [seasonData, setSeasonData]         = useState<Record<number, SeasonDetail>>({});
  const [loadingSeason, setLoadingSeason]   = useState<number | null>(null);
  const [bulkLoading, setBulkLoading]       = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['tv-detail', showId],
    queryFn: () => fetchTvDetail(showId),
    staleTime: 1000 * 60 * 30,
  });

  const handleSeasonPress = async (seasonNumber: number) => {
    if (expandedSeason === seasonNumber) { setExpandedSeason(null); return; }
    setExpandedSeason(seasonNumber);
    if (!seasonData[seasonNumber]) {
      setLoadingSeason(seasonNumber);
      const data = await fetchSeasonDetail(showId, seasonNumber);
      if (data) setSeasonData(prev => ({ ...prev, [seasonNumber]: data }));
      setLoadingSeason(null);
    }
  };

  const handleMarkPastSeasonsWatched = async () => {
    if (!detail || !show) return;
    setBulkLoading(true);
    const currentSeasonNumber = detail.nextEpisodeToAir?.seasonNumber ?? detail.numberOfSeasons;
    const pastSeasons = detail.seasons.filter(s => s.seasonNumber < currentSeasonNumber);
    for (const season of pastSeasons) {
      let sData = seasonData[season.seasonNumber];
      if (!sData) {
        const fetched = await fetchSeasonDetail(showId, season.seasonNumber);
        if (fetched) { sData = fetched; setSeasonData(prev => ({ ...prev, [season.seasonNumber]: fetched })); }
      }
      markSeasonWatched(showId, season.seasonNumber, sData?.episodes.length ?? season.episodeCount, true);
    }
    setBulkLoading(false);
  };

  const handleMarkCaughtUp = async () => {
    if (!detail || !show) return;
    setBulkLoading(true);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    for (const season of detail.seasons) {
      let sData = seasonData[season.seasonNumber];
      if (!sData) {
        const fetched = await fetchSeasonDetail(showId, season.seasonNumber);
        if (fetched) { sData = fetched; setSeasonData(prev => ({ ...prev, [season.seasonNumber]: fetched })); }
      }
      if (!sData) continue;
      for (const ep of sData.episodes) {
        if (ep.airDate && !isAfter(parseISO(ep.airDate), today)) {
          markEpisodeWatched(showId, ep.seasonNumber, ep.episodeNumber, true);
        }
      }
    }
    setBulkLoading(false);
  };

  // Compute season boundary markers for the overall progress bar
  // e.g. if S1=8eps, S2=12eps, total=30 → markers at 8/30 and 20/30
  const seasonBoundaries: number[] = [];
  if (detail && show.totalEpisodes > 0) {
    let cumulative = 0;
    detail.seasons.forEach((season, i) => {
      cumulative += season.episodeCount;
      // Don't add a marker at the very end
      if (i < detail.seasons.length - 1) {
        seasonBoundaries.push(Math.round((cumulative / show.totalEpisodes) * 100));
      }
    });
  }

  const streaming = detail?.streamingProviders.filter(p => p.type === 'flatrate' || p.type === 'free') ?? [];
  const percent   = show ? getProgressPercent(show) : 0;
  const watched   = show ? getWatchedCount(show) : 0;
  const category  = show ? getTvCategory(show) : 'wishlist';
  const today     = new Date();
  today.setHours(23, 59, 59, 999);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalHeaderTitle} numberOfLines={1}>{show?.name}</Text>
          <TouchableOpacity onPress={() => { removeShow(showId); onClose(); }}>
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.centered}><ActivityIndicator color={PURPLE} size="large" /></View>
        ) : detail && show ? (
          <ScrollView contentContainerStyle={styles.detailScroll}>
            {detail.backdropPath && (
              <Image source={{ uri: `https://image.tmdb.org/t/p/w780${detail.backdropPath}` }} style={styles.backdrop} />
            )}
            <View style={styles.detailContent}>
              <Text style={styles.detailTitle}>{detail.name}</Text>
              <Text style={styles.detailMeta}>📺 {detail.status}</Text>
              <Text style={styles.detailMeta}>⭐ {detail.voteAverage.toFixed(1)}/10</Text>

              <View style={styles.categoryRow}>
                <CategoryBadge category={category} />
              </View>

              {/* Overall progress with season boundary markers */}
              <View style={styles.overallProgress}>
                <View style={styles.overallProgressRow}>
                  <Text style={styles.overallProgressLabel}>Overall Progress</Text>
                  <Text style={styles.overallProgressCount}>{watched} / {show.totalEpisodes} episodes</Text>
                </View>
                <ProgressBar percent={percent} seasonBoundaries={seasonBoundaries} />
              </View>

              <View style={styles.shortcutSection}>
                <Text style={styles.shortcutLabel}>Quick actions</Text>
                <View style={styles.shortcutRow}>
                  <TouchableOpacity
                    style={[styles.shortcutBtn, bulkLoading && styles.shortcutBtnDisabled]}
                    onPress={handleMarkPastSeasonsWatched}
                    disabled={bulkLoading}
                  >
                    {bulkLoading ? <ActivityIndicator color={PURPLE} size="small" /> : (
                      <>
                        <Text style={styles.shortcutBtnIcon}>⏮</Text>
                        <Text style={styles.shortcutBtnText}>Mark past seasons watched</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.shortcutBtn, bulkLoading && styles.shortcutBtnDisabled]}
                    onPress={handleMarkCaughtUp}
                    disabled={bulkLoading}
                  >
                    {bulkLoading ? <ActivityIndicator color={PURPLE} size="small" /> : (
                      <>
                        <Text style={styles.shortcutBtnIcon}>✓✓</Text>
                        <Text style={styles.shortcutBtnText}>Mark as caught up</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {detail.nextEpisodeToAir && (
                <View style={styles.nextEpisodeCard}>
                  <Text style={styles.nextEpisodeLabel}>Next Episode</Text>
                  <Text style={styles.nextEpisodeTitle}>
                    S{detail.nextEpisodeToAir.seasonNumber}E{detail.nextEpisodeToAir.episodeNumber} · {detail.nextEpisodeToAir.name}
                  </Text>
                  {detail.nextEpisodeToAir.airDate && (
                    <Text style={styles.nextEpisodeMeta}>
                      Airs {format(parseISO(detail.nextEpisodeToAir.airDate), 'MMMM d, yyyy')}
                    </Text>
                  )}
                </View>
              )}

              {streaming.length > 0 && (
                <View style={styles.providerSection}>
                  <Text style={styles.providerLabel}>Where to Watch</Text>
                  <View style={styles.providerRow}>
                    {streaming.map(p => (
                      <View key={p.providerId} style={styles.providerChip}>
                        {p.logoPath && <Image source={{ uri: `https://image.tmdb.org/t/p/w45${p.logoPath}` }} style={styles.providerLogo} />}
                        <Text style={styles.providerName}>{p.providerName}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {detail.overview ? <Text style={styles.detailOverview}>{detail.overview}</Text> : null}

              <Text style={styles.seasonsTitle}>Seasons</Text>
              {detail.seasons.map(season => {
                const isExpanded  = expandedSeason === season.seasonNumber;
                const sData       = seasonData[season.seasonNumber];
                const isLoading_  = loadingSeason === season.seasonNumber;
                const allWatched  = isSeasonWatched(show, season.seasonNumber, season.episodeCount);
                const watchedInSeason = Array.from({ length: season.episodeCount }, (_, i) =>
                  isEpisodeWatched(show, season.seasonNumber, i + 1)
                ).filter(Boolean).length;

                return (
                  <View key={season.seasonNumber} style={styles.seasonBlock}>
                    <TouchableOpacity style={styles.seasonHeader} onPress={() => handleSeasonPress(season.seasonNumber)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.seasonTitle}>{season.name}</Text>
                        <Text style={styles.seasonMeta}>{watchedInSeason}/{season.episodeCount} episodes watched</Text>
                        <ProgressBar percent={season.episodeCount > 0 ? Math.round(watchedInSeason / season.episodeCount * 100) : 0} />
                      </View>
                      <TouchableOpacity
                        style={[styles.markSeasonBtn, allWatched && styles.markSeasonBtnActive]}
                        onPress={() => markSeasonWatched(showId, season.seasonNumber, season.episodeCount, !allWatched)}
                      >
                        <Text style={styles.markSeasonBtnText}>{allWatched ? '✓' : 'All'}</Text>
                      </TouchableOpacity>
                      <Text style={styles.seasonChevron}>{isExpanded ? '▾' : '›'}</Text>
                    </TouchableOpacity>

                    {isExpanded && (
                      isLoading_ ? (
                        <View style={styles.seasonLoading}><ActivityIndicator color={PURPLE} size="small" /></View>
                      ) : sData ? (
                        <View style={styles.episodeList}>
                          {sData.episodes.map(ep => {
                            const watched_  = isEpisodeWatched(show, ep.seasonNumber, ep.episodeNumber);
                            const isFuture  = ep.airDate ? isAfter(parseISO(ep.airDate), today) : false;
                            return (
                              <TouchableOpacity
                                key={ep.id}
                                style={[styles.episodeRow, isFuture && styles.episodeRowFuture]}
                                onPress={() => {
                                  if (isFuture) return;
                                  markEpisodeWatched(showId, ep.seasonNumber, ep.episodeNumber, !watched_);
                                }}
                                activeOpacity={isFuture ? 1 : 0.7}
                              >
                                <View style={[
                                  styles.episodeCheck,
                                  watched_ && styles.episodeCheckActive,
                                  isFuture && styles.episodeCheckFuture,
                                ]}>
                                  {watched_ && <Text style={styles.episodeCheckMark}>✓</Text>}
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.episodeTitle, isFuture && styles.episodeTitleFuture]}>
                                    E{ep.episodeNumber}  {ep.name}
                                  </Text>
                                  {ep.airDate && (
                                    <Text style={styles.episodeMeta}>
                                      {isFuture
                                        ? `Airs ${format(parseISO(ep.airDate), 'MMM d, yyyy')}`
                                        : format(parseISO(ep.airDate), 'MMM d, yyyy')
                                      }
                                    </Text>
                                  )}
                                </View>
                                {isFuture && <Text style={styles.futureLabel}>Upcoming</Text>}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ) : null
                    )}
                  </View>
                );
              })}

              {/* Ditch / Un-ditch */}
              <TouchableOpacity
                style={[styles.ditchBtn, show.categoryOverride === 'ditched' && styles.ditchBtnActive]}
                onPress={() => setShowCategoryOverride(showId, show.categoryOverride === 'ditched' ? null : 'ditched')}
              >
                <Text style={[styles.ditchBtnText, show.categoryOverride === 'ditched' && styles.ditchBtnTextActive]}>
                  {show.categoryOverride === 'ditched' ? '↩ Un-ditch Show' : '🗑 Ditch Show'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.centered}><Text style={styles.errorText}>Could not load details.</Text></View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Movie Detail Modal ───────────────────────────────────────────────────────

function MovieDetailModal({ movieId, onClose }: { movieId: number; onClose: () => void }) {
  const { trackedMovies, toggleMovieWatched, removeMovie } = useMediaStore();
  const movie = trackedMovies[movieId];

  const { data: detail, isLoading } = useQuery({
    queryKey: ['movie-detail', movieId],
    queryFn: () => fetchMovieDetail(movieId),
    staleTime: 1000 * 60 * 30,
  });

  const streaming = detail?.streamingProviders.filter(p => p.type === 'flatrate' || p.type === 'free') ?? [];
  const rent      = detail?.streamingProviders.filter(p => p.type === 'rent' || p.type === 'buy') ?? [];
  const category  = movie ? getMovieCategory(movie) : 'wishlist';

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalHeaderTitle} numberOfLines={1}>{movie?.title}</Text>
          <TouchableOpacity onPress={() => { removeMovie(movieId); onClose(); }}>
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.centered}><ActivityIndicator color={PURPLE} size="large" /></View>
        ) : detail ? (
          <ScrollView contentContainerStyle={styles.detailScroll}>
            {detail.backdropPath && (
              <Image source={{ uri: `https://image.tmdb.org/t/p/w780${detail.backdropPath}` }} style={styles.backdrop} />
            )}
            <View style={styles.detailContent}>
              <Text style={styles.detailTitle}>{detail.title}</Text>
              {detail.releaseDate && (
                <Text style={styles.detailMeta}>🎭 In theaters: {format(parseISO(detail.releaseDate), 'MMMM d, yyyy')}</Text>
              )}
              {detail.runtime && <Text style={styles.detailMeta}>⏱ {detail.runtime} min</Text>}
              <Text style={styles.detailMeta}>⭐ {detail.voteAverage.toFixed(1)}/10</Text>

              <View style={styles.categoryRow}>
                <CategoryBadge category={category} />
              </View>

              {detail.overview ? <Text style={styles.detailOverview}>{detail.overview}</Text> : null}

              <TouchableOpacity
                style={[styles.watchedToggle, movie?.watched && styles.watchedToggleActive]}
                onPress={() => toggleMovieWatched(movieId)}
              >
                <Text style={styles.watchedToggleText}>
                  {movie?.watched ? '✓ Marked as Watched' : 'Mark as Watched'}
                </Text>
              </TouchableOpacity>

              {streaming.length > 0 && (
                <View style={styles.providerSection}>
                  <Text style={styles.providerLabel}>Stream</Text>
                  <View style={styles.providerRow}>
                    {streaming.map(p => (
                      <View key={p.providerId} style={styles.providerChip}>
                        {p.logoPath && <Image source={{ uri: `https://image.tmdb.org/t/p/w45${p.logoPath}` }} style={styles.providerLogo} />}
                        <Text style={styles.providerName}>{p.providerName}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {rent.length > 0 && (
                <View style={styles.providerSection}>
                  <Text style={styles.providerLabel}>Rent / Buy</Text>
                  <View style={styles.providerRow}>
                    {rent.map(p => (
                      <View key={p.providerId} style={styles.providerChip}>
                        {p.logoPath && <Image source={{ uri: `https://image.tmdb.org/t/p/w45${p.logoPath}` }} style={styles.providerLogo} />}
                        <Text style={styles.providerName}>{p.providerName}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {streaming.length === 0 && rent.length === 0 && (
                <Text style={styles.noProviders}>No streaming info available for your region.</Text>
              )}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.centered}><Text style={styles.errorText}>Could not load details.</Text></View>
        )}
      </SafeAreaView>

    </Modal>
  );
}

// ─── TV Tab ───────────────────────────────────────────────────────────────────

function TvTab() {
  const [query, setQuery]               = useState('');
  const [selectedShow, setSelectedShow] = useState<number | null>(null);
  const { trackedShows, addShow, tvCategoryOrder, setTvCategoryOrder } = useMediaStore();

  useShowRefresh();

  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ['media-search-tv', query],
    queryFn: () => searchMulti(query),
    enabled: query.trim().length > 1,
    staleTime: 1000 * 60 * 5,
  });

  const tvResults = (searchResults ?? []).filter(r => r.mediaType === 'tv');
  const [adding, setAdding] = useState<number | null>(null);

  const handleAdd = useCallback(async (item: SearchResult) => {
    if (adding === item.id) return;
    if (trackedShows[item.id]) return;
    setAdding(item.id);
    const detail = await fetchTvDetail(item.id);

    const seasons = detail?.seasons ?? [];
    const currentSeason             = seasons.length > 0 ? seasons[seasons.length - 1] : null;
    const currentSeasonNumber       = currentSeason?.seasonNumber ?? 0;
    const currentSeasonEpisodes     = currentSeason?.episodeCount ?? 0;
    let currentSeasonAiredEpisodes  = currentSeasonEpisodes;

    if (detail?.nextEpisodeToAir) {
      const next = detail.nextEpisodeToAir;
      if (next.seasonNumber === currentSeasonNumber) {
        currentSeasonAiredEpisodes = Math.max(0, next.episodeNumber - 1);
      }
    }

    addShow({
      id: item.id,
      type: 'tv',
      name: item.title,
      posterPath: item.posterPath,
      firstAirDate: item.firstAirDate,
      status: detail?.status ?? '',
      totalSeasons: detail?.numberOfSeasons ?? 0,
      totalEpisodes: detail?.numberOfEpisodes ?? 0,
      streamingProviders: detail?.streamingProviders ?? [],
      nextEpisodeAirDate: detail?.nextEpisodeToAir?.airDate ?? null,
      nextEpisodeName: detail?.nextEpisodeToAir?.name ?? null,
      nextEpisodeSeason: detail?.nextEpisodeToAir?.seasonNumber ?? null,
      nextEpisodeNumber: detail?.nextEpisodeToAir?.episodeNumber ?? null,
      currentSeasonNumber,
      currentSeasonEpisodes,
      currentSeasonAiredEpisodes,
      watchedEpisodes: {},
      categoryOverride: null,
      addedAt: new Date().toISOString(),
      lastRefreshedAt: new Date().toISOString(),
    });
    setAdding(null);
    setSelectedShow(item.id);
  }, [trackedShows, addShow, adding]);

  const allShows   = Object.values(trackedShows).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const watching   = applyOrder(allShows.filter(s => getTvCategory(s) === 'currently_watching'), tvCategoryOrder['currently_watching'] ?? []);
  const caughtUp   = applyOrder(allShows.filter(s => getTvCategory(s) === 'caught_up'),          tvCategoryOrder['caught_up'] ?? []);
  const finished   = applyOrder(allShows.filter(s => getTvCategory(s) === 'finished'),           tvCategoryOrder['finished'] ?? []);
  const wishlist   = applyOrder(allShows.filter(s => getTvCategory(s) === 'wishlist'),           tvCategoryOrder['wishlist'] ?? []);
  const ditched    = applyOrder(allShows.filter(s => getTvCategory(s) === 'ditched'),            tvCategoryOrder['ditched'] ?? []);
  const isSearching = query.trim().length > 1;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SearchBar value={query} onChange={setQuery} />

      {isSearching ? (
        <View style={{ flex: 1 }}>
          {searching ? (
            <View style={styles.centered}><ActivityIndicator color={PURPLE} /></View>
          ) : (
            <FlatList
              data={tvResults}
              keyExtractor={item => `tv-${item.id}`}
              contentContainerStyle={{ paddingBottom: 32 }}
              ListEmptyComponent={<View style={styles.centered}><Text style={styles.emptyText}>No TV shows found</Text></View>}
              renderItem={({ item }) => (
                <SearchResultItem
                  item={item}
                  isTracked={!!trackedShows[item.id]}
                  onAdd={() => handleAdd(item)}
                  disabled={adding === item.id}
                />
              )}
            />
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          {allShows.length === 0 && (
            <View style={styles.emptyLibrary}>
              <Text style={styles.emptyEmoji}>📺</Text>
              <Text style={styles.emptyTitle}>No TV shows yet</Text>
              <Text style={styles.emptySubtitle}>Search for shows above to start tracking them</Text>
            </View>
          )}
          <TvCategorySection title="Currently Watching" items={watching}
            onPress={id => setSelectedShow(id)}
            onDragEnd={ids => setTvCategoryOrder('currently_watching', ids)} />
          <TvCategorySection title="Caught Up" items={caughtUp}
            onPress={id => setSelectedShow(id)}
            onDragEnd={ids => setTvCategoryOrder('caught_up', ids)} />
          <TvCategorySection title="Finished" items={finished}
            onPress={id => setSelectedShow(id)}
            onDragEnd={ids => setTvCategoryOrder('finished', ids)} />
          <TvCategorySection title="Wishlist" items={wishlist}
            onPress={id => setSelectedShow(id)}
            onDragEnd={ids => setTvCategoryOrder('wishlist', ids)} />
          <TvCategorySection title="Ditched" items={ditched}
            onPress={id => setSelectedShow(id)}
            onDragEnd={ids => setTvCategoryOrder('ditched', ids)} />
        </ScrollView>
      )}

      {selectedShow !== null && (
        <ShowDetailModal showId={selectedShow} onClose={() => setSelectedShow(null)} />
      )}
    </GestureHandlerRootView>
  );
}

// ─── Movies Tab ───────────────────────────────────────────────────────────────

function MoviesTab() {
  const [query, setQuery]               = useState('');
  const [selectedMovie, setSelectedMovie] = useState<number | null>(null);
  const { trackedMovies, addMovie, movieCategoryOrder, setMovieCategoryOrder } = useMediaStore();

  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ['media-search-movies', query],
    queryFn: () => searchMulti(query),
    enabled: query.trim().length > 1,
    staleTime: 1000 * 60 * 5,
  });

  const movieResults = (searchResults ?? []).filter(r => r.mediaType === 'movie');
  const [adding, setAdding] = useState<number | null>(null);

  const handleAdd = useCallback(async (item: SearchResult) => {
    if (adding === item.id) return;
    if (trackedMovies[item.id]) return;
    setAdding(item.id);
    const detail = await fetchMovieDetail(item.id);
    addMovie({
      id: item.id,
      type: 'movie',
      title: item.title,
      posterPath: item.posterPath,
      releaseDate: item.releaseDate,
      streamingDate: null,
      streamingProviders: detail?.streamingProviders ?? [],
      watched: false,
      addedAt: new Date().toISOString(),
    });
    setAdding(null);
    setSelectedMovie(item.id);
  }, [trackedMovies, addMovie, adding]);

  const allMovies = Object.values(trackedMovies).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const watched   = applyOrder(allMovies.filter(m => getMovieCategory(m) === 'watched'),   movieCategoryOrder['watched'] ?? []);
  const wishlist  = applyOrder(allMovies.filter(m => getMovieCategory(m) === 'wishlist'),  movieCategoryOrder['wishlist'] ?? []);
  const upcoming  = applyOrder(allMovies.filter(m => getMovieCategory(m) === 'upcoming'),  movieCategoryOrder['upcoming'] ?? []);
  const isSearching = query.trim().length > 1;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SearchBar value={query} onChange={setQuery} />

      {isSearching ? (
        <View style={{ flex: 1 }}>
          {searching ? (
            <View style={styles.centered}><ActivityIndicator color={PURPLE} /></View>
          ) : (
            <FlatList
              data={movieResults}
              keyExtractor={item => `movie-${item.id}`}
              contentContainerStyle={{ paddingBottom: 32 }}
              ListEmptyComponent={<View style={styles.centered}><Text style={styles.emptyText}>No movies found</Text></View>}
              renderItem={({ item }) => (
                <SearchResultItem
                  item={item}
                  isTracked={!!trackedMovies[item.id]}
                  onAdd={() => handleAdd(item)}
                  disabled={adding === item.id}
                />
              )}
            />
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          {allMovies.length === 0 && (
            <View style={styles.emptyLibrary}>
              <Text style={styles.emptyEmoji}>🎬</Text>
              <Text style={styles.emptyTitle}>No movies yet</Text>
              <Text style={styles.emptySubtitle}>Search for movies above to start tracking them</Text>
            </View>
          )}
          <MovieCategorySection title="Upcoming" items={upcoming}
            onPress={id => setSelectedMovie(id)}
            onDragEnd={ids => setMovieCategoryOrder('upcoming', ids)} />
          <MovieCategorySection title="Wishlist" items={wishlist}
            onPress={id => setSelectedMovie(id)}
            onDragEnd={ids => setMovieCategoryOrder('wishlist', ids)} />
          <MovieCategorySection title="Watched" items={watched}
            onPress={id => setSelectedMovie(id)}
            onDragEnd={ids => setMovieCategoryOrder('watched', ids)} />
        </ScrollView>
      )}

      {selectedMovie !== null && (
        <MovieDetailModal movieId={selectedMovie} onClose={() => setSelectedMovie(null)} />
      )}
    </GestureHandlerRootView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const [activeTab, setActiveTab] = useState<'tv' | 'movies'>('tv');

  return (
    <View style={styles.safe}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tv' && styles.tabActive]}
          onPress={() => setActiveTab('tv')}
        >
          <Text style={[styles.tabText, activeTab === 'tv' && styles.tabTextActive]}>📺 TV Shows</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'movies' && styles.tabActive]}
          onPress={() => setActiveTab('movies')}
        >
          <Text style={[styles.tabText, activeTab === 'movies' && styles.tabTextActive]}>🎬 Movies</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'tv' ? <TvTab /> : <MoviesTab />}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DARK },

  tabBar:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER },
  tab:          { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: PURPLE },
  tabText:      { fontSize: 14, fontWeight: '600', color: '#555' },
  tabTextActive:{ color: PURPLE },

  searchBar:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', margin: 16, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: BORDER },
  searchIcon:   { fontSize: 16, marginRight: 8 },
  searchInput:  { flex: 1, fontSize: 15, color: '#fff' },
  searchClear:  { fontSize: 14, color: '#555', paddingLeft: 8 },

  searchResultItem:     { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: BORDER, alignItems: 'flex-start', gap: 12 },
  searchResultPoster:   { width: 56, height: 84, borderRadius: 6, backgroundColor: '#1a1a1a' },
  searchResultInfo:     { flex: 1 },
  searchResultTitle:    { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 4 },
  searchResultMeta:     { fontSize: 12, color: '#888', marginBottom: 4 },
  searchResultOverview: { fontSize: 12, color: '#666', lineHeight: 17 },
  addBtn:               { width: 32, height: 32, borderRadius: 16, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
  addBtnTracked:        { backgroundColor: '#222' },
  addBtnText:           { fontSize: 18, color: '#fff', fontWeight: '700', lineHeight: 22 },
  addBtnTextTracked:    { fontSize: 14 },

  categorySection:        { marginTop: 20 },
  categorySectionHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  categorySectionTitle:   { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  categorySectionRight:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryCountBadge:     { backgroundColor: '#222', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  categoryCountText:      { fontSize: 11, fontWeight: '700', color: '#888' },
  categorySectionChevron: { fontSize: 18, color: '#555', width: 16, textAlign: 'center' },

  mediaCard:        { flexDirection: 'row', backgroundColor: CARD, borderRadius: 14, marginBottom: 12, marginTop: 12, overflow: 'hidden', borderWidth: 1, borderColor: BORDER },
  mediaCardDragging:{ opacity: 0.85, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10 },
  mediaPoster:      { width: 80, height: 120 },
  noPoster:         { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a' },
  mediaInfo:        { flex: 1, padding: 12, gap: 4 },
  cardTitleRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  mediaTitle:       { flex: 1, fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 2 },
  overrideIndicator:{ fontSize: 11, color: '#555', marginTop: 2 },
  dragHandle:       { fontSize: 16, color: '#444', marginTop: 2 },
  mediaMeta:        { fontSize: 12, color: '#888' },
  nextEpisodeText:  { fontSize: 11, color: PURPLE, fontWeight: '600' },

  progressRow:             { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack:           { flex: 1, height: 4, backgroundColor: '#222', borderRadius: 2, overflow: 'visible', position: 'relative' },
  progressFill:            { height: 4, backgroundColor: PURPLE, borderRadius: 2 },
  progressMarker:          { position: 'absolute', top: -3, width: 2, height: 10, backgroundColor: '#fff', borderRadius: 1, marginLeft: -1 },
  seasonBoundaryMarker:    { position: 'absolute', top: -2, width: 1, height: 8, backgroundColor: '#555', borderRadius: 1, marginLeft: -0.5 },
  progressText:            { fontSize: 10, color: '#666' },
  seasonProgressLabel:     { width: 20, alignItems: 'flex-start' },
  seasonProgressLabelText: { fontSize: 10, color: '#555', fontWeight: '600' },

  categoryBadge:     { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryBadgeText: { fontSize: 11, fontWeight: '700' },

  emptyLibrary:  { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyEmoji:    { fontSize: 48, marginBottom: 16 },
  emptyTitle:    { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  emptyText:     { color: '#666', fontSize: 15 },

  modalSafe:        { flex: 1, backgroundColor: DARK },
  modalHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  modalCloseBtn:    { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalCloseText:   { fontSize: 16, color: '#888' },
  modalHeaderTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#fff', textAlign: 'center', marginHorizontal: 8 },
  removeText:       { fontSize: 14, color: RED },

  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText:  { color: '#888', fontSize: 15 },

  detailScroll:  { paddingBottom: 48 },
  backdrop:      { width: '100%', height: 200 },
  detailContent: { padding: 20 },
  detailTitle:   { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8 },
  detailMeta:    { fontSize: 14, color: '#888', marginBottom: 4 },
  detailOverview:{ fontSize: 14, color: '#aaa', lineHeight: 22, marginTop: 12 },

  categoryRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 4, flexWrap: 'wrap' },
  autoLabel:           { fontSize: 11, color: '#555', fontStyle: 'italic' },
  moveCategoryBtn:     { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: BORDER },
  moveCategoryBtnText: { fontSize: 12, color: '#888' },

  watchedToggle:       { marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: '#1a1a1a', alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  watchedToggleActive: { backgroundColor: '#1a3a1a', borderColor: GREEN },
  watchedToggleText:   { fontSize: 15, fontWeight: '600', color: '#fff' },

  shortcutSection:     { marginTop: 16 },
  shortcutLabel:       { fontSize: 12, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  shortcutRow:         { flexDirection: 'row', gap: 10 },
  shortcutBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1a1a2e', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2a2a5a', minHeight: 52 },
  shortcutBtnDisabled: { opacity: 0.5 },
  shortcutBtnIcon:     { fontSize: 14, color: PURPLE },
  shortcutBtnText:     { fontSize: 12, fontWeight: '600', color: PURPLE, textAlign: 'center', flex: 1 },

  providerSection: { marginTop: 16 },
  providerLabel:   { fontSize: 12, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  providerRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  providerChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: BORDER },
  providerLogo:    { width: 24, height: 24, borderRadius: 4 },
  providerName:    { fontSize: 12, color: '#ccc', fontWeight: '500' },
  noProviders:     { marginTop: 12, fontSize: 13, color: '#555', fontStyle: 'italic' },

  overallProgress:      { marginTop: 16, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER },
  overallProgressRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  overallProgressLabel: { fontSize: 13, fontWeight: '600', color: '#fff' },
  overallProgressCount: { fontSize: 13, color: '#888' },

  nextEpisodeCard:  { marginTop: 12, backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2a2a5a' },
  nextEpisodeLabel: { fontSize: 11, fontWeight: '700', color: PURPLE, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  nextEpisodeTitle: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
  nextEpisodeMeta:  { fontSize: 12, color: '#888' },

  seasonsTitle:        { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 20, marginBottom: 12 },
  seasonBlock:         { backgroundColor: '#141414', borderRadius: 12, marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: BORDER },
  seasonHeader:        { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  seasonTitle:         { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
  seasonMeta:          { fontSize: 12, color: '#666', marginBottom: 6 },
  markSeasonBtn:       { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: BORDER },
  markSeasonBtnActive: { backgroundColor: '#1a3a1a', borderColor: GREEN },
  markSeasonBtnText:   { fontSize: 12, fontWeight: '600', color: '#fff' },
  seasonChevron:       { fontSize: 18, color: '#555', width: 20, textAlign: 'center' },
  seasonLoading:       { padding: 20, alignItems: 'center' },

  episodeList:          { borderTopWidth: 1, borderTopColor: BORDER },
  episodeRow:           { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingLeft: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  episodeRowFuture:     { opacity: 0.45 },
  episodeCheck:         { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  episodeCheckActive:   { backgroundColor: PURPLE, borderColor: PURPLE },
  episodeCheckFuture:   { borderColor: '#2a2a2a', backgroundColor: 'transparent' },
  episodeCheckMark:     { fontSize: 12, color: '#fff', fontWeight: '700' },
  episodeTitle:         { fontSize: 13, fontWeight: '500', color: '#ccc' },
  episodeTitleFuture:   { color: '#555' },
  episodeMeta:          { fontSize: 11, color: '#555', marginTop: 2 },
  futureLabel:          { fontSize: 10, color: '#444', fontStyle: 'italic' },

  ditchBtn:           { marginTop: 20, padding: 14, borderRadius: 12, backgroundColor: '#1a1a1a', alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  ditchBtnActive:     { backgroundColor: '#2a1010', borderColor: RED },
  ditchBtnText:       { fontSize: 15, fontWeight: '600', color: '#666' },
  ditchBtnTextActive: { color: RED },

  overrideBackdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  overrideContainer:   { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, width: '100%', borderWidth: 1, borderColor: BORDER },
  overrideTitle:       { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  overrideSubtitle:    { fontSize: 14, color: '#666', marginBottom: 16 },
  overrideOption:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: BORDER },
  overrideOptionActive:{ backgroundColor: '#1a1a2e', marginHorizontal: -20, paddingHorizontal: 20 },
  overrideOptionLabel: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 2 },
  overrideOptionDesc:  { fontSize: 12, color: '#666' },
  overrideCheck:       { fontSize: 16, color: PURPLE, marginLeft: 8 },
});
