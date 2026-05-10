import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TeamPicker from '../components/TeamPicker';
import {
  CombatSportFilter,
  DRAFT_SPORTS,
  SOCCER_CLUB_LEAGUES,
  SOCCER_KNOCKOUT_COMPETITIONS,
  SoccerKnockoutThreshold,
  Sport,
  Team,
  TeamSportFilter,
  TournamentSportFilter,
  useAppStore,
} from '../lib/store';

const SPORT_LABELS: Record<Sport, string> = {
  nfl: 'NFL', nba: 'NBA', mlb: 'MLB', nhl: 'NHL', soccer: 'Soccer',
  wnba: 'WNBA', ncaafb: 'College Football', ncaamb: 'College Basketball',
  golf: 'Golf', tennis: 'Tennis', f1: 'Formula 1', nascar: 'NASCAR', mma: 'MMA',
  boxing: 'Boxing',
};

const SPORT_EMOJIS: Record<Sport, string> = {
  nfl: '🏈', nba: '🏀', mlb: '⚾', nhl: '🏒', soccer: '⚽',
  wnba: '🏀', ncaafb: '🏈', ncaamb: '🏀',
  golf: '⛳', tennis: '🎾', f1: '🏎️', nascar: '🏁', mma: '🥊',
  boxing: '🥊',
};

const SPORT_COLORS: Record<Sport, string> = {
  nfl:    '#1D3D7B', nba:    '#C35B10', mlb:    '#0D5A2A', nhl:    '#5A1A6B',
  soccer: '#2A5A1A', nascar: '#FFD700', f1:     '#E8002D', tennis: '#4A90D9',
  golf:   '#3A7D44', ncaafb: '#8B2FC9', ncaamb: '#C9A22F', mma:    '#C0392B',
  wnba:   '#FF6B35', boxing: '#2C3E50',
};

const TEAM_SPORTS: Sport[]       = ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'wnba', 'ncaafb', 'ncaamb'];
const TOURNAMENT_SPORTS: Sport[] = ['golf', 'tennis'];
const COMBAT_SPORTS: Sport[]     = ['mma', 'boxing'];
const COLLEGE_SPORTS: Sport[]    = ['ncaafb', 'ncaamb'];

const TEAM_FILTER_OPTIONS: { key: TeamSportFilter; label: string; description: string }[] = [
  { key: 'all',                     label: 'All games',             description: 'Show every game' },
  { key: 'national_tv',             label: 'National TV only',      description: 'Only games on national broadcast' },
  { key: 'my_team',                 label: 'My team only',          description: 'Only games featuring your teams' },
  { key: 'my_team_and_national_tv', label: 'My team + National TV', description: 'Your teams plus national broadcasts' },
];

const COLLEGE_FILTER_OPTIONS: { key: TeamSportFilter; label: string; description: string }[] = [
  { key: 'national_tv',             label: 'National TV only',      description: 'Only games on national broadcast' },
  { key: 'my_team',                 label: 'My team only',          description: 'Only games featuring your teams' },
  { key: 'my_team_and_national_tv', label: 'My team + National TV', description: 'Your teams plus national broadcasts' },
];

const TOURNAMENT_FILTER_OPTIONS: { key: TournamentSportFilter; label: string; description: string }[] = [
  { key: 'majors', label: 'Majors only',     description: 'Only the biggest tournaments' },
  { key: 'all',    label: 'All tournaments', description: 'Every tournament on the schedule' },
];

const COMBAT_FILTER_OPTIONS: { key: CombatSportFilter; label: string; description: string }[] = [
  { key: 'title_fights', label: 'Title fights only', description: 'Championship bouts only' },
  { key: 'main_events',  label: 'Main events',       description: 'Headlining fights' },
  { key: 'all',          label: 'All fights',        description: 'Every scheduled bout' },
];

const F1_SESSION_OPTIONS: { key: string; label: string; description: string }[] = [
  { key: 'f1ShowPractice',       label: 'Practice',        description: 'Practice sessions (FP1, FP2, FP3)' },
  { key: 'f1ShowSprintShootout', label: 'Sprint Shootout', description: 'Sprint qualifying session' },
  { key: 'f1ShowSprintRace',     label: 'Sprint Race',     description: 'Sprint race' },
  { key: 'f1ShowQualifying',     label: 'Qualifying',      description: 'Qualifying session' },
  { key: 'f1ShowRace',           label: 'Race',            description: 'Main race' },
];

const KNOCKOUT_THRESHOLD_OPTIONS: { key: SoccerKnockoutThreshold; label: string; description: string }[] = [
  { key: 'off',           label: 'Off',                    description: "Don't show based on round" },
  { key: 'quarterfinals', label: 'Quarterfinals & beyond', description: 'Show from quarterfinals onwards' },
  { key: 'semifinals',    label: 'Semifinals & beyond',    description: 'Show from semifinals onwards' },
  { key: 'final',         label: 'Final only',             description: 'Only the final' },
];

export default function SportSettingsScreen() {
  const { sport: sportParam } = useLocalSearchParams<{ sport: string }>();
  const sport = sportParam as Sport;
  const { preferences, updateSportSetting } = useAppStore();
  const setting = (preferences.sportSettings ?? {})[sport];
  const color = SPORT_COLORS[sport] ?? '#378ADD';
  const scrollRef = useRef<ScrollView>(null);

  const showMyTeams =
    setting?.teamFilter === 'my_team' ||
    setting?.teamFilter === 'my_team_and_national_tv';

  const toggleClubLeague = (leagueId: string) => {
    const current = setting?.selectedClubLeagues ?? ['usa.1'];
    const updated = current.includes(leagueId)
      ? current.filter((l) => l !== leagueId)
      : [...current, leagueId];
    if (updated.length === 0) return;
    updateSportSetting(sport, { selectedClubLeagues: updated });
  };

  const updateLeagueTeams = (leagueId: string, teams: Team[]) => {
    const current = setting?.myTeamsByLeague ?? {};
    updateSportSetting(sport, { myTeamsByLeague: { ...current, [leagueId]: teams } });
  };

  const setLeagueFilter = (leagueId: string, filter: TeamSportFilter) => {
    const current = setting?.leagueFilters ?? {};
    updateSportSetting(sport, { leagueFilters: { ...current, [leagueId]: filter } });
  };

  const setKnockoutThreshold = (compId: string, threshold: SoccerKnockoutThreshold) => {
    const current = setting?.knockoutThresholds ?? {};
    updateSportSetting(sport, { knockoutThresholds: { ...current, [compId]: threshold } });
  };

  if (!sport || !SPORT_LABELS[sport]) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.error}>Invalid sport</Text>
      </SafeAreaView>
    );
  }

  const selectedClubLeagues = setting?.selectedClubLeagues ?? ['usa.1'];
  const knockoutThresholds = setting?.knockoutThresholds ?? {};
  const leagueFilters = setting?.leagueFilters ?? {};
  const hasDraft = DRAFT_SPORTS.includes(sport);
  const f1Values: Record<string, boolean> = {
    f1ShowPractice:       setting?.f1ShowPractice ?? false,
    f1ShowSprintShootout: setting?.f1ShowSprintShootout ?? false,
    f1ShowSprintRace:     setting?.f1ShowSprintRace ?? false,
    f1ShowQualifying:     setting?.f1ShowQualifying ?? false,
    f1ShowRace:           setting?.f1ShowRace ?? true,
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ── */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.sportEmoji}>{SPORT_EMOJIS[sport]}</Text>
            <Text style={styles.header}>{SPORT_LABELS[sport]}</Text>
          </View>

          {/* ── Soccer: Club leagues with inline filter + team picker ── */}
          {sport === 'soccer' && (
            <>
              <Text style={styles.sectionLabel}>Club Leagues</Text>
              {SOCCER_CLUB_LEAGUES.map((league) => {
                const isSelected = selectedClubLeagues.includes(league.id);
                const leagueFilter = leagueFilters[league.id] ?? 'all';
                const showTeamPicker =
                  leagueFilter === 'my_team' || leagueFilter === 'my_team_and_national_tv';

                return (
                  <View key={league.id} style={styles.leagueBlock}>
                    <TouchableOpacity
                      style={styles.leagueHeaderRow}
                      onPress={() => toggleClubLeague(league.id)}
                    >
                      <Text style={[styles.leagueHeaderLabel, isSelected && { color }]}>
                        {league.label}
                      </Text>
                      {isSelected && (
                        <View style={[styles.checkCircle, { backgroundColor: color }]}>
                          <Text style={styles.checkMark}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    {isSelected && (
                      <>
                        <View style={styles.section}>
                          {TEAM_FILTER_OPTIONS.map((opt, i, arr) => {
                            const isFilterSelected = leagueFilter === opt.key;
                            const isLast = i === arr.length - 1;
                            return (
                              <TouchableOpacity
                                key={opt.key}
                                style={[styles.optionRow, !isLast && styles.rowBorder]}
                                onPress={() => setLeagueFilter(league.id, opt.key)}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.optionLabel, isFilterSelected && { color }]}>
                                    {opt.label}
                                  </Text>
                                  <Text style={styles.optionDescription}>{opt.description}</Text>
                                </View>
                                {isFilterSelected && (
                                  <View style={[styles.checkCircle, { backgroundColor: color }]}>
                                    <Text style={styles.checkMark}>✓</Text>
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {showTeamPicker && (
                          <View style={styles.teamPickerWrapper}>
                            <TeamPicker
                              sport="soccer"
                              leagueId={league.id}
                              leagueLabel={league.label}
                              selectedTeams={(setting?.myTeamsByLeague ?? {})[league.id] ?? []}
                              onSelect={(teams) => updateLeagueTeams(league.id, teams)}
                              scrollRef={scrollRef}
                            />
                          </View>
                        )}
                      </>
                    )}
                  </View>
                );
              })}

              {/* Knockout competitions */}
              <Text style={styles.sectionLabel}>Cup Competitions</Text>
              {SOCCER_KNOCKOUT_COMPETITIONS.map((comp) => {
                const threshold = knockoutThresholds[comp.id] ?? 'off';
                return (
                  <View key={comp.id}>
                    <Text style={styles.knockoutCompLabel}>{comp.label}</Text>
                    <View style={styles.section}>
                      {KNOCKOUT_THRESHOLD_OPTIONS.map((opt, i, arr) => {
                        const isSelected = threshold === opt.key;
                        const isLast = i === arr.length - 1;
                        return (
                          <TouchableOpacity
                            key={opt.key}
                            style={[styles.optionRow, !isLast && styles.rowBorder]}
                            onPress={() => setKnockoutThreshold(comp.id, opt.key)}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.optionLabel, isSelected && { color }]}>{opt.label}</Text>
                              <Text style={styles.optionDescription}>{opt.description}</Text>
                            </View>
                            {isSelected && (
                              <View style={[styles.checkCircle, { backgroundColor: color }]}>
                                <Text style={styles.checkMark}>✓</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}

              {/* Drafts toggle for MLS */}
              {hasDraft && (
                <>
                  <Text style={styles.sectionLabel}>Draft</Text>
                  <View style={styles.section}>
                    <TouchableOpacity
                      style={styles.optionRow}
                      onPress={() => updateSportSetting(sport, { showDrafts: !setting?.showDrafts })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionLabel, setting?.showDrafts && { color }]}>SuperDraft</Text>
                        <Text style={styles.optionDescription}>Show the MLS SuperDraft on the calendar</Text>
                      </View>
                      {setting?.showDrafts && (
                        <View style={[styles.checkCircle, { backgroundColor: color }]}>
                          <Text style={styles.checkMark}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </>
          )}

          {/* ── Non-soccer team sports ── */}
          {TEAM_SPORTS.includes(sport) && sport !== 'soccer' && (
            <>
              <Text style={styles.sectionLabel}>Show</Text>
              <View style={styles.section}>
                {(COLLEGE_SPORTS.includes(sport) ? COLLEGE_FILTER_OPTIONS : TEAM_FILTER_OPTIONS).map((opt) => {
                  const isSelected = setting?.teamFilter === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.optionRow, styles.rowBorder]}
                      onPress={() => updateSportSetting(sport, { teamFilter: opt.key })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionLabel, isSelected && { color }]}>{opt.label}</Text>
                        <Text style={styles.optionDescription}>{opt.description}</Text>
                      </View>
                      {isSelected && (
                        <View style={[styles.checkCircle, { backgroundColor: color }]}>
                          <Text style={styles.checkMark}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.optionRow, hasDraft && styles.rowBorder]}
                  onPress={() => updateSportSetting(sport, { alwaysShowPlayoffs: !setting?.alwaysShowPlayoffs })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, setting?.alwaysShowPlayoffs && { color }]}>
                      {sport === 'ncaamb' ? 'March Madness' : sport === 'ncaafb' ? 'CFP' : 'Playoffs'}
                    </Text>
                    <Text style={styles.optionDescription}>Show all playoff games regardless of other filters</Text>
                  </View>
                  {setting?.alwaysShowPlayoffs && (
                    <View style={[styles.checkCircle, { backgroundColor: color }]}>
                      <Text style={styles.checkMark}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Drafts toggle — inside Show section for non-soccer sports */}
                {hasDraft && (
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => updateSportSetting(sport, { showDrafts: !setting?.showDrafts })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, setting?.showDrafts && { color }]}>Draft</Text>
                      <Text style={styles.optionDescription}>Show draft lottery and draft days</Text>
                    </View>
                    {setting?.showDrafts && (
                      <View style={[styles.checkCircle, { backgroundColor: color }]}>
                        <Text style={styles.checkMark}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {/* ── Non-soccer team sports: Team picker ── */}
          {TEAM_SPORTS.includes(sport) && sport !== 'soccer' && showMyTeams && (
            <>
              <Text style={styles.sectionLabel}>My Teams</Text>
              <View style={styles.teamPickerWrapper}>
                <TeamPicker
                  sport={sport}
                  selectedTeams={setting?.myTeams ?? []}
                  onSelect={(teams) => updateSportSetting(sport, { myTeams: teams })}
                  scrollRef={scrollRef}
                />
              </View>
            </>
          )}

          {/* ── Tournament sports ── */}
          {TOURNAMENT_SPORTS.includes(sport) && (
            <>
              <Text style={styles.sectionLabel}>Show</Text>
              <View style={styles.section}>
                {TOURNAMENT_FILTER_OPTIONS.map((opt, i, arr) => {
                  const isSelected = setting?.tournamentFilter === opt.key;
                  const isLast = i === arr.length - 1;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.optionRow, !isLast && styles.rowBorder]}
                      onPress={() => updateSportSetting(sport, { tournamentFilter: opt.key })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionLabel, isSelected && { color }]}>{opt.label}</Text>
                        <Text style={styles.optionDescription}>{opt.description}</Text>
                      </View>
                      {isSelected && (
                        <View style={[styles.checkCircle, { backgroundColor: color }]}>
                          <Text style={styles.checkMark}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* ── F1 ── */}
          {sport === 'f1' && (
            <>
              <Text style={styles.sectionLabel}>Show</Text>
              <View style={styles.section}>
                {F1_SESSION_OPTIONS.map((opt, i, arr) => {
                  const isSelected = f1Values[opt.key];
                  const isLast = i === arr.length - 1;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.optionRow, !isLast && styles.rowBorder]}
                      onPress={() => updateSportSetting(sport, { [opt.key]: !isSelected })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionLabel, isSelected && { color }]}>{opt.label}</Text>
                        <Text style={styles.optionDescription}>{opt.description}</Text>
                      </View>
                      {isSelected && (
                        <View style={[styles.checkCircle, { backgroundColor: color }]}>
                          <Text style={styles.checkMark}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* ── NASCAR ── */}
          {sport === 'nascar' && (
            <>
              <Text style={styles.sectionLabel}>Coverage</Text>
              <View style={styles.section}>
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>All races included automatically</Text>
                </View>
              </View>
            </>
          )}

          {/* ── Combat sports ── */}
          {COMBAT_SPORTS.includes(sport) && (
            <>
              <Text style={styles.sectionLabel}>Show</Text>
              <View style={styles.section}>
                {COMBAT_FILTER_OPTIONS.map((opt, i, arr) => {
                  const isSelected = setting?.combatFilter === opt.key;
                  const isLast = i === arr.length - 1;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.optionRow, !isLast && styles.rowBorder]}
                      onPress={() => updateSportSetting(sport, { combatFilter: opt.key })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionLabel, isSelected && { color }]}>{opt.label}</Text>
                        <Text style={styles.optionDescription}>{opt.description}</Text>
                      </View>
                      {isSelected && (
                        <View style={[styles.checkCircle, { backgroundColor: color }]}>
                          <Text style={styles.checkMark}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: '#f8f8f8' },
  scrollContent:     { paddingBottom: 48 },
  error:             { padding: 24, fontSize: 16, color: '#999' },

  headerRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 8 },
  backBtn:           { paddingRight: 4 },
  backArrow:         { fontSize: 32, color: '#378ADD', lineHeight: 36 },
  sportEmoji:        { fontSize: 28 },
  header:            { fontSize: 26, fontWeight: '700', color: '#111' },

  sectionLabel:      { fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 },
  knockoutCompLabel: { fontSize: 14, fontWeight: '600', color: '#444', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 },
  section:           { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#eee', overflow: 'hidden' },

  leagueBlock:       { marginHorizontal: 16, marginBottom: 8 },
  leagueHeaderRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4 },
  leagueHeaderLabel: { fontSize: 15, fontWeight: '600', color: '#333' },

  optionRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowBorder:         { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  optionLabel:       { fontSize: 16, color: '#111', fontWeight: '500' },
  optionDescription: { fontSize: 13, color: '#999', marginTop: 2 },

  checkCircle:       { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkMark:         { color: '#fff', fontSize: 13, fontWeight: '700' },

  teamPickerWrapper: { marginBottom: 8, marginLeft: 16 },
});
