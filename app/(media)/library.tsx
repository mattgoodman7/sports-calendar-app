import { useQuery } from '@tanstack/react-query';
import { format, isAfter, parseISO } from 'date-fns';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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
  getMovieCategory,
  getProgressPercent,
  getTvCategory,
  getWatchedCount,
  isEpisodeWatched,
  isSeasonWatched,
  MovieCategory,
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

function ProgressBar({ percent }: { percent: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.min(percent, 100)}%` }]} />
    </View>
  );
}

// ─── Category Badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: TvCategory | MovieCategory }) {
  const config = {
    caught_up:         { label: 'Caught Up',         bg: '#1a3a1a', color: GREEN },
    currently_watching:{ label: 'Watching',           bg: '#1a1a3a', color: PURPLE },
    wishlist:          { label: 'Wishlist',           bg: '#2a1a1a', color: '#f97316' },
    watched:           { label: 'Watched',            bg: '#1a3a1a', color: GREEN },
  }[category];

  return (
    <View style={[styles.categoryBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.categoryBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

// ─── Show Card ────────────────────────────────────────────────────────────────

function ShowCard({ show, onPress }: { show: TrackedShow; onPress: () => void }) {
  const poster    = posterUrl(show.posterPath, 'w185');
  const percent   = getProgressPercent(show);
  const watched   = getWatchedCount(show);
  const category  = getTvCategory(show);
  const streaming = show.streamingProviders.filter(p => p.type === 'flatrate' || p.type === 'free');

  return (
    <TouchableOpacity style={styles.mediaCard} onPress={onPress} activeOpacity={0.8}>
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
        </View>
        <Text style={styles.mediaMeta}>📺 {show.totalSeasons} season{show.totalSeasons !== 1 ? 's' : ''}</Text>
        {streaming.length > 0 && (
          <Text style={styles.mediaMeta} numberOfLines={1}>🎞 {streaming.map(p => p.providerName).join(', ')}</Text>
        )}
        {show.nextEpisodeAirDate && category !== 'caught_up' && (
          <Text style={styles.nextEpisodeText}>
            Next: S{show.nextEpisodeSeason}E{show.nextEpisodeNumber} · {format(parseISO(show.nextEpisodeAirDate), 'MMM d')}
          </Text>
        )}
        <View style={styles.progressRow}>
          <ProgressBar percent={percent} />
          <Text style={styles.progressText}>{watched}/{show.totalEpisodes}</Text>
        </View>
        <CategoryBadge category={category} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Movie Card ───────────────────────────────────────────────────────────────

function MovieCard({ movie, onPress }: { movie: TrackedMovie; onPress: () => void }) {
  const poster    = posterUrl(movie.posterPath, 'w185');
  const category  = getMovieCategory(movie);
  const streaming = movie.streamingProviders.filter(p => p.type === 'flatrate' || p.type === 'free');

  return (
    <TouchableOpacity style={styles.mediaCard} onPress={onPress} activeOpacity={0.8}>
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
          {movie.categoryOverride && <Text style={styles.overrideIndicator}>✎</Text>}
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

// ─── Category Section ─────────────────────────────────────────────────────────

function CategorySection<T>({
  title, items, renderItem, emptyText,
}: {
  title: string; items: T[]; renderItem: (item: T) => React.ReactNode; emptyText: string;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.categorySection}>
      <Text style={styles.categorySectionTitle}>{title}</Text>
      {items.map((item, i) => <View key={i}>{renderItem(item)}</View>)}
    </View>
  );
}

// ─── Category Override Modal ──────────────────────────────────────────────────

function TvCategoryOverrideModal({
  show, onClose,
}: {
  show: TrackedShow; onClose: () => void;
}) {
  const { setShowCategoryOverride } = useMediaStore();
  const auto = getTvCategory({ ...show, categoryOverride: null });

  const options: { category: TvCategory | null; label: string; desc: string }[] = [
    { category: null,               label: 'Auto',              desc: `Automatically determined: "${auto.replace('_', ' ')}"` },
    { category: 'caught_up',        label: 'Caught Up',         desc: 'You\'re up to date with all aired episodes' },
    { category: 'currently_watching', label: 'Currently Watching', desc: 'You\'re actively working through this show' },
    { category: 'wishlist',         label: 'Wishlist',          desc: 'Haven\'t started yet or saving for later' },
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overrideBackdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.overrideContainer}>
          <Text style={styles.overrideTitle}>Move to category</Text>
          <Text style={styles.overrideSubtitle}>{show.name}</Text>
          {options.map(opt => {
            const isActive = show.categoryOverride === opt.category;
            return (
              <TouchableOpacity
                key={String(opt.category)}
                style={[styles.overrideOption, isActive && styles.overrideOptionActive]}
                onPress={() => { setShowCategoryOverride(show.id, opt.category); onClose(); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.overrideOptionLabel, isActive && { color: PURPLE }]}>{opt.label}</Text>
                  <Text style={styles.overrideOptionDesc}>{opt.desc}</Text>
                </View>
                {isActive && <Text style={styles.overrideCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function MovieCategoryOverrideModal({
  movie, onClose,
}: {
  movie: TrackedMovie; onClose: () => void;
}) {
  const { setMovieCategoryOverride } = useMediaStore();
  const auto = getMovieCategory({ ...movie, categoryOverride: null });

  const options: { category: MovieCategory | null; label: string; desc: string }[] = [
    { category: null,      label: 'Auto',     desc: `Automatically determined: "${auto}"` },
    { category: 'watched', label: 'Watched',  desc: 'You\'ve seen this movie' },
    { category: 'wishlist',label: 'Wishlist', desc: 'Want to watch or haven\'t seen it yet' },
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overrideBackdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.overrideContainer}>
          <Text style={styles.overrideTitle}>Move to category</Text>
          <Text style={styles.overrideSubtitle}>{movie.title}</Text>
          {options.map(opt => {
            const isActive = movie.categoryOverride === opt.category;
            return (
              <TouchableOpacity
                key={String(opt.category)}
                style={[styles.overrideOption, isActive && styles.overrideOptionActive]}
                onPress={() => { setMovieCategoryOverride(movie.id, opt.category); onClose(); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.overrideOptionLabel, isActive && { color: PURPLE }]}>{opt.label}</Text>
                  <Text style={styles.overrideOptionDesc}>{opt.desc}</Text>
                </View>
                {isActive && <Text style={styles.overrideCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Show Detail Modal ────────────────────────────────────────────────────────

function ShowDetailModal({ showId, onClose }: { showId: number; onClose: () => void }) {
  const { trackedShows, markEpisodeWatched, markSeasonWatched, removeShow } = useMediaStore();
  const show = trackedShows[showId];
  const [expandedSeason, setExpandedSeason]   = useState<number | null>(null);
  const [seasonData, setSeasonData]           = useState<Record<number, SeasonDetail>>({});
  const [loadingSeason, setLoadingSeason]     = useState<number | null>(null);
  const [bulkLoading, setBulkLoading]         = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

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

  const streaming = detail?.streamingProviders.filter(p => p.type === 'flatrate' || p.type === 'free') ?? [];
  const percent   = show ? getProgressPercent(show) : 0;
  const watched   = show ? getWatchedCount(show) : 0;
  const category  = show ? getTvCategory(show) : 'wishlist';

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

              {/* Category + override */}
              <View style={styles.categoryRow}>
                <CategoryBadge category={category} />
                {show.categoryOverride && <Text style={styles.autoLabel}>Manual override</Text>}
                <TouchableOpacity style={styles.moveCategoryBtn} onPress={() => setShowCategoryModal(true)}>
                  <Text style={styles.moveCategoryBtnText}>Move to category</Text>
                </TouchableOpacity>
              </View>

              {/* Progress */}
              <View style={styles.overallProgress}>
                <View style={styles.overallProgressRow}>
                  <Text style={styles.overallProgressLabel}>Overall Progress</Text>
                  <Text style={styles.overallProgressCount}>{watched} / {show.totalEpisodes} episodes</Text>
                </View>
                <ProgressBar percent={percent} />
              </View>

              {/* Quick actions */}
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

              {/* Next episode */}
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

              {/* Streaming */}
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

              {/* Seasons */}
              <Text style={styles.seasonsTitle}>Seasons</Text>
              {detail.seasons.map(season => {
                const isExpanded = expandedSeason === season.seasonNumber;
                const sData      = seasonData[season.seasonNumber];
                const isLoading_ = loadingSeason === season.seasonNumber;
                const allWatched = isSeasonWatched(show, season.seasonNumber, season.episodeCount);
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
                            const watched_ = isEpisodeWatched(show, ep.seasonNumber, ep.episodeNumber);
                            return (
                              <TouchableOpacity
                                key={ep.id}
                                style={styles.episodeRow}
                                onPress={() => markEpisodeWatched(showId, ep.seasonNumber, ep.episodeNumber, !watched_)}
                              >
                                <View style={[styles.episodeCheck, watched_ && styles.episodeCheckActive]}>
                                  {watched_ && <Text style={styles.episodeCheckMark}>✓</Text>}
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.episodeTitle}>E{ep.episodeNumber}  {ep.name}</Text>
                                  {ep.airDate && (
                                    <Text style={styles.episodeMeta}>{format(parseISO(ep.airDate), 'MMM d, yyyy')}</Text>
                                  )}
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ) : null
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.centered}><Text style={styles.errorText}>Could not load details.</Text></View>
        )}
      </SafeAreaView>

      {showCategoryModal && show && (
        <TvCategoryOverrideModal show={show} onClose={() => setShowCategoryModal(false)} />
      )}
    </Modal>
  );
}

// ─── Movie Detail Modal ────────────────────────────────────────────────────────

function MovieDetailModal({ movieId, onClose }: { movieId: number; onClose: () => void }) {
  const { trackedMovies, toggleMovieWatched, removeMovie } = useMediaStore();
  const movie = trackedMovies[movieId];
  const [showCategoryModal, setShowCategoryModal] = useState(false);

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

              {/* Category + override */}
              <View style={styles.categoryRow}>
                <CategoryBadge category={category} />
                {movie?.categoryOverride && <Text style={styles.autoLabel}>Manual override</Text>}
                <TouchableOpacity style={styles.moveCategoryBtn} onPress={() => setShowCategoryModal(true)}>
                  <Text style={styles.moveCategoryBtnText}>Move to category</Text>
                </TouchableOpacity>
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

      {showCategoryModal && movie && (
        <MovieCategoryOverrideModal movie={movie} onClose={() => setShowCategoryModal(false)} />
      )}
    </Modal>
  );
}

// ─── TV Tab ───────────────────────────────────────────────────────────────────

function TvTab() {
  const [query, setQuery]           = useState('');
  const [selectedShow, setSelectedShow] = useState<number | null>(null);
  const { trackedShows, addShow }   = useMediaStore();
  const { trackedMovies }           = useMediaStore();

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
  addShow({
    id: item.id, type: 'tv', name: item.title,
    posterPath: item.posterPath, firstAirDate: item.firstAirDate,
    status: detail?.status ?? '', totalSeasons: detail?.numberOfSeasons ?? 0,
    totalEpisodes: detail?.numberOfEpisodes ?? 0,
    streamingProviders: detail?.streamingProviders ?? [],
    nextEpisodeAirDate: detail?.nextEpisodeToAir?.airDate ?? null,
    nextEpisodeName: detail?.nextEpisodeToAir?.name ?? null,
    nextEpisodeSeason: detail?.nextEpisodeToAir?.seasonNumber ?? null,
    nextEpisodeNumber: detail?.nextEpisodeToAir?.episodeNumber ?? null,
    watchedEpisodes: {}, categoryOverride: null,
    addedAt: new Date().toISOString(),
  });
  setAdding(null);
}, [trackedShows, addShow, adding]);

  const shows = Object.values(trackedShows).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const caughtUp  = shows.filter(s => getTvCategory(s) === 'caught_up');
  const watching  = shows.filter(s => getTvCategory(s) === 'currently_watching');
  const wishlist  = shows.filter(s => getTvCategory(s) === 'wishlist');
  const isSearching = query.trim().length > 1;

  return (
    <View style={{ flex: 1 }}>
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
          {shows.length === 0 && (
            <View style={styles.emptyLibrary}>
              <Text style={styles.emptyEmoji}>📺</Text>
              <Text style={styles.emptyTitle}>No TV shows yet</Text>
              <Text style={styles.emptySubtitle}>Search for shows above to start tracking them</Text>
            </View>
          )}

          <CategorySection
            title="Currently Watching"
            items={watching}
            renderItem={show => <ShowCard show={show} onPress={() => setSelectedShow(show.id)} />}
            emptyText=""
          />
          <CategorySection
            title="Caught Up"
            items={caughtUp}
            renderItem={show => <ShowCard show={show} onPress={() => setSelectedShow(show.id)} />}
            emptyText=""
          />
          <CategorySection
            title="Wishlist"
            items={wishlist}
            renderItem={show => <ShowCard show={show} onPress={() => setSelectedShow(show.id)} />}
            emptyText=""
          />
        </ScrollView>
      )}

      {selectedShow !== null && (
        <ShowDetailModal showId={selectedShow} onClose={() => setSelectedShow(null)} />
      )}
    </View>
  );
}

// ─── Movies Tab ───────────────────────────────────────────────────────────────

function MoviesTab() {
  const [query, setQuery]             = useState('');
  const [selectedMovie, setSelectedMovie] = useState<number | null>(null);
  const { trackedMovies, addMovie }   = useMediaStore();

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
    id: item.id, type: 'movie', title: item.title,
    posterPath: item.posterPath, releaseDate: item.releaseDate,
    streamingDate: null, streamingProviders: detail?.streamingProviders ?? [],
    watched: false, categoryOverride: null,
    addedAt: new Date().toISOString(),
  });
  setAdding(null);
}, [trackedMovies, addMovie, adding]);

  const movies  = Object.values(trackedMovies).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const watched  = movies.filter(m => getMovieCategory(m) === 'watched');
  const wishlist = movies.filter(m => getMovieCategory(m) === 'wishlist');
  const isSearching = query.trim().length > 1;

  return (
    <View style={{ flex: 1 }}>
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
          {movies.length === 0 && (
            <View style={styles.emptyLibrary}>
              <Text style={styles.emptyEmoji}>🎬</Text>
              <Text style={styles.emptyTitle}>No movies yet</Text>
              <Text style={styles.emptySubtitle}>Search for movies above to start tracking them</Text>
            </View>
          )}

          <CategorySection
            title="Watched"
            items={watched}
            renderItem={movie => <MovieCard movie={movie} onPress={() => setSelectedMovie(movie.id)} />}
            emptyText=""
          />
          <CategorySection
            title="Wishlist"
            items={wishlist}
            renderItem={movie => <MovieCard movie={movie} onPress={() => setSelectedMovie(movie.id)} />}
            emptyText=""
          />
        </ScrollView>
      )}

      {selectedMovie !== null && (
        <MovieDetailModal movieId={selectedMovie} onClose={() => setSelectedMovie(null)} />
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const [activeTab, setActiveTab] = useState<'tv' | 'movies'>('tv');

  return (
    <View style={styles.safe}>
      {/* Tab switcher */}
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

  // Tab bar
  tabBar:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER },
  tab:          { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: PURPLE },
  tabText:      { fontSize: 14, fontWeight: '600', color: '#555' },
  tabTextActive:{ color: PURPLE },

  // Search
  searchBar:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', margin: 16, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: BORDER },
  searchIcon:   { fontSize: 16, marginRight: 8 },
  searchInput:  { flex: 1, fontSize: 15, color: '#fff' },
  searchClear:  { fontSize: 14, color: '#555', paddingLeft: 8 },

  // Search results
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

  // Category sections
  categorySection:      { marginTop: 20 },
  categorySectionTitle: { fontSize: 13, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },

  // Media cards
  mediaCard:        { flexDirection: 'row', backgroundColor: CARD, borderRadius: 14, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: BORDER },
  mediaPoster:      { width: 80, height: 120 },
  noPoster:         { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a' },
  mediaInfo:        { flex: 1, padding: 12, gap: 4 },
  cardTitleRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  mediaTitle:       { flex: 1, fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 2 },
  overrideIndicator:{ fontSize: 11, color: '#555', marginTop: 2 },
  mediaMeta:        { fontSize: 12, color: '#888' },
  nextEpisodeText:  { fontSize: 11, color: PURPLE, fontWeight: '600' },

  progressRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { flex: 1, height: 4, backgroundColor: '#222', borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: 4, backgroundColor: PURPLE, borderRadius: 2 },
  progressText:  { fontSize: 10, color: '#666' },

  categoryBadge:     { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryBadgeText: { fontSize: 11, fontWeight: '700' },

  // Empty states
  emptyLibrary:  { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyEmoji:    { fontSize: 48, marginBottom: 16 },
  emptyTitle:    { fontSize: 20, fontWeight: '600', color: '#fff', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  emptyText:     { color: '#666', fontSize: 15 },

  // Modal
  modalSafe:        { flex: 1, backgroundColor: DARK },
  modalHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  modalCloseBtn:    { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalCloseText:   { fontSize: 16, color: '#888' },
  modalHeaderTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#fff', textAlign: 'center', marginHorizontal: 8 },
  removeText:       { fontSize: 14, color: '#ef4444' },

  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText:  { color: '#888', fontSize: 15 },

  detailScroll:  { paddingBottom: 48 },
  backdrop:      { width: '100%', height: 200 },
  detailContent: { padding: 20 },
  detailTitle:   { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8 },
  detailMeta:    { fontSize: 14, color: '#888', marginBottom: 4 },
  detailOverview:{ fontSize: 14, color: '#aaa', lineHeight: 22, marginTop: 12 },

  // Category row in detail
  categoryRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 4, flexWrap: 'wrap' },
  autoLabel:         { fontSize: 11, color: '#555', fontStyle: 'italic' },
  moveCategoryBtn:   { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: BORDER },
  moveCategoryBtnText: { fontSize: 12, color: '#888' },

  watchedToggle:       { marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: '#1a1a1a', alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  watchedToggleActive: { backgroundColor: '#1a3a1a', borderColor: GREEN },
  watchedToggleText:   { fontSize: 15, fontWeight: '600', color: '#fff' },

  // Shortcuts
  shortcutSection:     { marginTop: 16 },
  shortcutLabel:       { fontSize: 12, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  shortcutRow:         { flexDirection: 'row', gap: 10 },
  shortcutBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1a1a2e', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2a2a5a', minHeight: 52 },
  shortcutBtnDisabled: { opacity: 0.5 },
  shortcutBtnIcon:     { fontSize: 14, color: PURPLE },
  shortcutBtnText:     { fontSize: 12, fontWeight: '600', color: PURPLE, textAlign: 'center', flex: 1 },

  // Providers
  providerSection: { marginTop: 16 },
  providerLabel:   { fontSize: 12, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  providerRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  providerChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: BORDER },
  providerLogo:    { width: 24, height: 24, borderRadius: 4 },
  providerName:    { fontSize: 12, color: '#ccc', fontWeight: '500' },
  noProviders:     { marginTop: 12, fontSize: 13, color: '#555', fontStyle: 'italic' },

  // Progress
  overallProgress:      { marginTop: 16, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER },
  overallProgressRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  overallProgressLabel: { fontSize: 13, fontWeight: '600', color: '#fff' },
  overallProgressCount: { fontSize: 13, color: '#888' },

  nextEpisodeCard:  { marginTop: 12, backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2a2a5a' },
  nextEpisodeLabel: { fontSize: 11, fontWeight: '700', color: PURPLE, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  nextEpisodeTitle: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
  nextEpisodeMeta:  { fontSize: 12, color: '#888' },

  // Seasons
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

  episodeList:        { borderTopWidth: 1, borderTopColor: BORDER },
  episodeRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingLeft: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  episodeCheck:       { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  episodeCheckActive: { backgroundColor: PURPLE, borderColor: PURPLE },
  episodeCheckMark:   { fontSize: 12, color: '#fff', fontWeight: '700' },
  episodeTitle:       { fontSize: 13, fontWeight: '500', color: '#ccc' },
  episodeMeta:        { fontSize: 11, color: '#555', marginTop: 2 },

  // Category override modal
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
