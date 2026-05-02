import { router } from 'expo-router';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TeamPicker from '../../components/TeamPicker';
import { CombatSportFilter, Sport, TeamSportFilter, TournamentSportFilter, useAppStore } from '../../lib/store';

const TEAM_SPORTS: Sport[] = ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'wnba', 'ncaafb', 'ncaamb'];
const TOURNAMENT_SPORTS: Sport[] = ['golf', 'tennis'];
const MOTOR_SPORTS: Sport[] = ['f1', 'nascar'];
const COMBAT_SPORTS: Sport[] = ['mma','boxing'];

const SPORT_LABELS: Record<Sport, string> = {
  nfl: 'NFL', nba: 'NBA', mlb: 'MLB', nhl: 'NHL', soccer: 'Soccer / MLS',
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

const TEAM_FILTER_OPTIONS: { key: TeamSportFilter; label: string }[] = [
  { key: 'all', label: 'All games' },
  { key: 'national_tv', label: 'National TV only' },
  { key: 'my_team', label: 'My team only' },
  { key: 'my_team_and_national_tv', label: 'My team + National TV' },
];

const TOURNAMENT_FILTER_OPTIONS: { key: TournamentSportFilter; label: string }[] = [
  { key: 'majors', label: 'Majors only' },
  { key: 'all', label: 'All tournaments' },
  { key: 'custom', label: 'Custom selection' },
];

const COMBAT_FILTER_OPTIONS: { key: CombatSportFilter; label: string }[] = [
  { key: 'title_fights', label: 'Title fights only' },
  { key: 'main_events', label: 'Main events' },
  { key: 'all', label: 'All fights' },
];

export default function SettingsScreen() {
  const { preferences, toggleSport, setPreferences, updateSportSetting, resetPreferences } = useAppStore();

  const handleReset = () => {
    Alert.alert(
      'Reset preferences',
      'This will clear all your preferences and take you back to onboarding.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetPreferences();
            router.replace('/onboarding');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView>
        <Text style={styles.header}>Settings</Text>

        {/* Sports toggles */}
        <Text style={styles.sectionLabel}>My Sports</Text>
        <View style={styles.section}>
          {Object.entries(SPORT_LABELS).map(([key, label], i) => {
            const sport = key as Sport;
            const isLast = i === Object.entries(SPORT_LABELS).length - 1;
            const isEnabled = preferences.sports.includes(sport);
            const setting = (preferences.sportSettings ?? {})[sport];

            return (
              <View key={sport}>
                <TouchableOpacity
                  style={[styles.row, !isLast && styles.rowBorder]}
                  onPress={() => toggleSport(sport)}
                >
                  <Text style={styles.sportEmoji}>{SPORT_EMOJIS[sport]}</Text>
                  <Text style={styles.rowLabel}>{label}</Text>
                  <Switch
                    value={isEnabled}
                    onValueChange={() => toggleSport(sport)}
                    trackColor={{ true: '#378ADD' }}
                  />
                </TouchableOpacity>

                {/* Per-sport settings */}
                {isEnabled && TEAM_SPORTS.includes(sport) && (
                  <View style={styles.subSection}>
                    <Text style={styles.subSectionLabel}>Show</Text>
                    <View style={styles.chipRow}>
                      {TEAM_FILTER_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.chip, setting?.teamFilter === opt.key && styles.chipSelected]}
                          onPress={() => updateSportSetting(sport, { teamFilter: opt.key })}
                        >
                          <Text style={[styles.chipText, setting?.teamFilter === opt.key && { color: '#fff' }]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {(setting?.teamFilter === 'my_team' || setting?.teamFilter === 'my_team_and_national_tv') && (
                        <TeamPicker
                        sport={sport}
                        selectedTeams={setting?.favoriteTeams ?? []}
                        onSelect={(teams) => updateSportSetting(sport, { favoriteTeams: teams })}
                      />
                    )}
                  </View>
                )}

                {isEnabled && TOURNAMENT_SPORTS.includes(sport) && (
                  <View style={styles.subSection}>
                    <Text style={styles.subSectionLabel}>Show</Text>
                    <View style={styles.chipRow}>
                      {TOURNAMENT_FILTER_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.chip, setting?.tournamentFilter === opt.key && styles.chipSelected]}
                          onPress={() => updateSportSetting(sport, { tournamentFilter: opt.key })}
                        >
                          <Text style={[styles.chipText, setting?.tournamentFilter === opt.key && { color: '#fff' }]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {isEnabled && MOTOR_SPORTS.includes(sport) && (
                  <View style={styles.subSection}>
                    <Text style={styles.subSectionLabel}>All races included automatically</Text>
                  </View>
                )}

                {isEnabled && COMBAT_SPORTS.includes(sport) && (
                  <View style={styles.subSection}>
                    <Text style={styles.subSectionLabel}>Show</Text>
                    <View style={styles.chipRow}>
                      {COMBAT_FILTER_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.chip, setting?.combatFilter === opt.key && styles.chipSelected]}
                          onPress={() => updateSportSetting(sport, { combatFilter: opt.key })}
                        >
                          <Text style={[styles.chipText, setting?.combatFilter === opt.key && { color: '#fff' }]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Notifications */}
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.section}>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowLabel}>Game reminders</Text>
            <Switch
              value={preferences.notificationsEnabled}
              onValueChange={(v) => setPreferences({ notificationsEnabled: v })}
              trackColor={{ true: '#378ADD' }}
            />
          </View>
          {preferences.notificationsEnabled && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Remind me before</Text>
              <View style={styles.chipRow}>
                {[15, 30, 60].map((mins) => (
                  <TouchableOpacity
                    key={mins}
                    style={[styles.chip, preferences.notifyMinutesBefore === mins && styles.chipSelected]}
                    onPress={() => setPreferences({ notifyMinutesBefore: mins })}
                  >
                    <Text style={[styles.chipText, preferences.notifyMinutesBefore === mins && { color: '#fff' }]}>
                      {mins}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Account */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.row} onPress={handleReset}>
            <Text style={[styles.rowLabel, { color: '#e24b4a' }]}>Reset preferences</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Sports data from API-Sports.io{'\n'}
          Set your API key in .env as EXPO_PUBLIC_API_SPORTS_KEY
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f8' },
  header: { fontSize: 24, fontWeight: '700', padding: 20, paddingBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 },
  section: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#eee', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  sportEmoji: { fontSize: 18 },
  rowLabel: { flex: 1, fontSize: 16, color: '#111' },
  subSection: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fafafa', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  subSectionLabel: { fontSize: 12, color: '#999', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  chipSelected: { backgroundColor: '#378ADD', borderColor: '#378ADD' },
  chipText: { fontSize: 12, color: '#555' },
  footer: { textAlign: 'center', fontSize: 12, color: '#bbb', padding: 24, lineHeight: 18 },
});