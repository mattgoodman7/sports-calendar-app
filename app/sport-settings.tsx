import { router, useLocalSearchParams } from 'expo-router';
import {
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
  SOCCER_LEAGUES,
  Sport,
  Team,
  TeamSportFilter,
  TournamentSportFilter,
  useAppStore,
} from '../lib/store';

// ─── Sport metadata ───────────────────────────────────────────────────────────

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
  nfl:    '#1D3D7B',
  nba:    '#C35B10',
  mlb:    '#0D5A2A',
  nhl:    '#5A1A6B',
  soccer: '#2A5A1A',
  nascar: '#FFD700',
  f1:     '#E8002D',
  tennis: '#4A90D9',
  golf:   '#3A7D44',
  ncaafb: '#8B2FC9',
  ncaamb: '#C9A22F',
  mma:    '#C0392B',
  wnba:   '#FF6B35',
  boxing: '#2C3E50',
};

// ─── Filter options ───────────────────────────────────────────────────────────

const TEAM_SPORTS: Sport[]       = ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'wnba', 'ncaafb', 'ncaamb'];
const TOURNAMENT_SPORTS: Sport[] = ['golf', 'tennis'];
const MOTOR_SPORTS: Sport[]      = ['f1', 'nascar'];
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SportSettingsScreen() {
  const { sport: sportParam } = useLocalSearchParams<{ sport: string }>();
  const sport = sportParam as Sport;
  const { preferences, updateSportSetting } = useAppStore();
  const setting = (preferences.sportSettings ?? {})[sport];
  const color = SPORT_COLORS[sport] ?? '#378ADD';

  const showMyTeams =
    setting?.teamFilter === 'my_team' ||
    setting?.teamFilter === 'my_team_and_national_tv';

  const toggleSoccerLeague = (leagueId: string) => {
    const current = setting?.selectedSoccerLeagues ?? ['usa.1'];
    const updated = current.includes(leagueId)
      ? current.filter((l) => l !== leagueId)
      : [...current, leagueId];
    if (updated.length === 0) return;
    updateSportSetting(sport, { selectedSoccerLeagues: updated });
  };

  const updateSoccerLeagueTeams = (leagueId: string, teams: Team[]) => {
    const current = setting?.myTeamsByLeague ?? {};
    updateSportSetting(sport, {
      myTeamsByLeague: { ...current, [leagueId]: teams },
    });
  };

  if (!sport || !SPORT_LABELS[sport]) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.error}>Invalid sport</Text>
      </SafeAreaView>
    );
  }

  const selectedLeagues = setting?.selectedSoccerLeagues ?? ['usa.1'];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.sportEmoji}>{SPORT_EMOJIS[sport]}</Text>
          <Text style={styles.header}>{SPORT_LABELS[sport]}</Text>
        </View>

        {/* ── Soccer: League picker ── */}
        {sport === 'soccer' && (
          <>
            <Text style={styles.sectionLabel}>Leagues</Text>
            <View style={styles.section}>
              {SOCCER_LEAGUES.map((league, i) => {
                const isSelected = selectedLeagues.includes(league.id);
                const isLast = i === SOCCER_LEAGUES.length - 1;
                return (
                  <TouchableOpacity
                    key={league.id}
                    style={[styles.optionRow, !isLast && styles.rowBorder]}
                    onPress={() => toggleSoccerLeague(league.id)}
                  >
                    <Text style={styles.optionLabel}>{league.label}</Text>
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

        {/* ── Team sports: Filter ── */}
        {TEAM_SPORTS.includes(sport) && (
          <>
            <Text style={styles.sectionLabel}>Show</Text>
            <View style={styles.section}>
              {(COLLEGE_SPORTS.includes(sport) ? COLLEGE_FILTER_OPTIONS : TEAM_FILTER_OPTIONS).map((opt, i, arr) => {
                const isSelected = setting?.teamFilter === opt.key;
                const isLast = i === arr.length - 1;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.optionRow, !isLast && styles.rowBorder]}
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
            </View>
          </>
        )}

        {/* ── Soccer: Per-league team pickers ── */}
        {sport === 'soccer' && showMyTeams && (
          <>
            <Text style={styles.sectionLabel}>My Teams</Text>
            {SOCCER_LEAGUES.filter((l) => selectedLeagues.includes(l.id)).map((league) => (
              <View key={league.id} style={styles.teamPickerWrapper}>
                <TeamPicker
                  sport="soccer"
                  leagueId={league.id}
                  leagueLabel={league.label}
                  selectedTeams={(setting?.myTeamsByLeague ?? {})[league.id] ?? []}
                  onSelect={(teams) => updateSoccerLeagueTeams(league.id, teams)}
                />
              </View>
            ))}
          </>
        )}

        {/* ── Non-soccer team sports: single team picker ── */}
        {TEAM_SPORTS.includes(sport) && sport !== 'soccer' && showMyTeams && (
          <>
            <Text style={styles.sectionLabel}>My Teams</Text>
            <View style={styles.teamPickerWrapper}>
              <TeamPicker
                sport={sport}
                selectedTeams={setting?.myTeams ?? []}
                onSelect={(teams) => updateSportSetting(sport, { myTeams: teams })}
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

        {/* ── Motor sports ── */}
        {MOTOR_SPORTS.includes(sport) && (
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
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: '#f8f8f8' },
  scrollContent:     { paddingBottom: 48 },
  error:             { padding: 24, fontSize: 16, color: '#999' },

  // Header
  headerRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 8 },
  backBtn:           { paddingRight: 4 },
  backArrow:         { fontSize: 32, color: '#378ADD', lineHeight: 36 },
  sportEmoji:        { fontSize: 28 },
  header:            { fontSize: 26, fontWeight: '700', color: '#111' },

  // Section
  sectionLabel:      { fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 },
  section:           { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#eee', overflow: 'hidden' },

  // Option rows
  optionRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowBorder:         { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  optionLabel:       { fontSize: 16, color: '#111', fontWeight: '500' },
  optionDescription: { fontSize: 13, color: '#999', marginTop: 2 },

  // Check indicator
  checkCircle:       { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkMark:         { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Team picker
  teamPickerWrapper: { marginHorizontal: 16, marginBottom: 8 },
});
