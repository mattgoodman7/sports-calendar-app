import { router } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { requestNotificationPermission } from '../lib/notifications';
import { CombatSportFilter, SOCCER_LEAGUES, Sport, TeamSportFilter, TournamentSportFilter, useAppStore } from '../lib/store';
import TeamPicker from '../components/TeamPicker';

const SPORTS: { key: Sport; label: string; emoji: string; color: string }[] = [
  { key: 'nfl',    label: 'NFL',                emoji: '🏈', color: '#1D3D7B' },
  { key: 'nba',    label: 'NBA',                emoji: '🏀', color: '#C35B10' },
  { key: 'mlb',    label: 'MLB',                emoji: '⚾', color: '#0D5A2A' },
  { key: 'nhl',    label: 'NHL',                emoji: '🏒', color: '#5A1A6B' },
  { key: 'soccer', label: 'Soccer',             emoji: '⚽', color: '#2A5A1A' },
  { key: 'wnba',   label: 'WNBA',               emoji: '🏀', color: '#C35B10' },
  { key: 'ncaafb', label: 'College Football',   emoji: '🏈', color: '#8B4513' },
  { key: 'ncaamb', label: 'College Basketball', emoji: '🏀', color: '#8B0000' },
  { key: 'golf',   label: 'Golf',               emoji: '⛳', color: '#2D5A1B' },
  { key: 'tennis', label: 'Tennis',             emoji: '🎾', color: '#8B6914' },
  { key: 'f1',     label: 'Formula 1',          emoji: '🏎️', color: '#C00000' },
  { key: 'nascar', label: 'NASCAR',             emoji: '🏁', color: '#B8860B' },
  { key: 'mma',    label: 'MMA',                emoji: '🥊', color: '#8B0000' },
  { key: 'boxing', label: 'Boxing',             emoji: '🥊', color: '#4A0000' },
];

const TEAM_SPORTS: Sport[]       = ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'wnba', 'ncaafb', 'ncaamb'];
const TOURNAMENT_SPORTS: Sport[] = ['golf', 'tennis'];
const COMBAT_SPORTS: Sport[]     = ['mma', 'boxing'];
const MOTOR_SPORTS: Sport[]      = ['f1', 'nascar'];
const COLLEGE_SPORTS: Sport[]    = ['ncaafb', 'ncaamb'];

const TEAM_FILTER_OPTIONS: { key: TeamSportFilter; label: string }[] = [
  { key: 'all',                     label: 'All games' },
  { key: 'national_tv',             label: 'National TV only' },
  { key: 'my_team',                 label: 'My team only' },
  { key: 'my_team_and_national_tv', label: 'My team + National TV' },
];

const COLLEGE_FILTER_OPTIONS: { key: TeamSportFilter; label: string }[] = [
  { key: 'national_tv',             label: 'National TV only' },
  { key: 'my_team',                 label: 'My team only' },
  { key: 'my_team_and_national_tv', label: 'My team + National TV' },
];

const TOURNAMENT_FILTER_OPTIONS: { key: TournamentSportFilter; label: string }[] = [
  { key: 'majors', label: 'Majors only' },
  { key: 'all',    label: 'All tournaments' },
];

const COMBAT_FILTER_OPTIONS: { key: CombatSportFilter; label: string }[] = [
  { key: 'title_fights', label: 'Title fights only' },
  { key: 'main_events',  label: 'Main events' },
  { key: 'all',          label: 'All fights' },
];

export default function Onboarding() {
  const { preferences, toggleSport, setPreferences, updateSportSetting, completeOnboarding } = useAppStore();

  const handleFinish = async () => {
    if (preferences.notificationsEnabled) {
      const granted = await requestNotificationPermission();
      if (!granted) setPreferences({ notificationsEnabled: false });
    }
    completeOnboarding();
    router.replace('/(tabs)/calendar');
  };

  const toggleSoccerLeague = (leagueId: string, currentLeagues: string[]) => {
    const updated = currentLeagues.includes(leagueId)
      ? currentLeagues.filter((l) => l !== leagueId)
      : [...currentLeagues, leagueId];
    if (updated.length === 0) return;
    updateSportSetting('soccer', { selectedSoccerLeagues: updated });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Your Sports Calendar</Text>
      <Text style={styles.subtitle}>
        Pick the sports you want to follow and we'll auto-fill your calendar with upcoming games.
      </Text>

      <Text style={styles.sectionLabel}>Choose your sports</Text>

      {SPORTS.map((sport) => {
        const selected = preferences.sports.includes(sport.key);
        const setting  = (preferences.sportSettings ?? {})[sport.key];

        return (
          <View key={sport.key} style={styles.sportBlock}>
            {/* Sport card toggle */}
            <TouchableOpacity
              style={[styles.sportCard, selected && { backgroundColor: sport.color, borderColor: sport.color }]}
              onPress={() => toggleSport(sport.key)}
            >
              <Text style={styles.sportEmoji}>{sport.emoji}</Text>
              <Text style={[styles.sportLabel, selected && { color: '#fff' }]}>{sport.label}</Text>
              {selected && <Text style={styles.sportCheck}>✓</Text>}
            </TouchableOpacity>

            {/* Inline settings when selected */}
            {selected && (
              <View style={[styles.sportSettings, { borderColor: sport.color }]}>

                {/* Soccer — league picker + team filter */}
                {sport.key === 'soccer' && (
                  <>
                    <Text style={styles.settingLabel}>Leagues</Text>
                    <View style={styles.chipRow}>
                      {SOCCER_LEAGUES.map((league) => {
                        const isSelected = (setting?.selectedSoccerLeagues ?? ['usa.1']).includes(league.id);
                        return (
                          <TouchableOpacity
                            key={league.id}
                            style={[styles.chip, isSelected && { backgroundColor: sport.color, borderColor: sport.color }]}
                            onPress={() => toggleSoccerLeague(league.id, setting?.selectedSoccerLeagues ?? ['usa.1'])}
                          >
                            <Text style={[styles.chipText, isSelected && { color: '#fff' }]}>
                              {league.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <Text style={[styles.settingLabel, { marginTop: 12 }]}>Show</Text>
                    <View style={styles.chipRow}>
                      {TEAM_FILTER_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.chip, setting?.teamFilter === opt.key && { backgroundColor: sport.color, borderColor: sport.color }]}
                          onPress={() => updateSportSetting(sport.key, { teamFilter: opt.key })}
                        >
                          <Text style={[styles.chipText, setting?.teamFilter === opt.key && { color: '#fff' }]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {(setting?.teamFilter === 'my_team' || setting?.teamFilter === 'my_team_and_national_tv') && (
                      <TeamPicker
                        sport={sport.key}
                        selectedTeams={setting?.favoriteTeams ?? []}
                        onSelect={(teams) => updateSportSetting(sport.key, { favoriteTeams: teams })}
                      />
                    )}
                  </>
                )}

                {/* Other team sports */}
                {TEAM_SPORTS.includes(sport.key) && sport.key !== 'soccer' && (
                  <>
                    <Text style={styles.settingLabel}>Show</Text>
                    <View style={styles.chipRow}>
                      {(COLLEGE_SPORTS.includes(sport.key) ? COLLEGE_FILTER_OPTIONS : TEAM_FILTER_OPTIONS).map((opt) => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.chip, setting?.teamFilter === opt.key && { backgroundColor: sport.color, borderColor: sport.color }]}
                          onPress={() => updateSportSetting(sport.key, { teamFilter: opt.key })}
                        >
                          <Text style={[styles.chipText, setting?.teamFilter === opt.key && { color: '#fff' }]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {(setting?.teamFilter === 'my_team' || setting?.teamFilter === 'my_team_and_national_tv') && (
                      <TeamPicker
                        sport={sport.key}
                        selectedTeams={setting?.favoriteTeams ?? []}
                        onSelect={(teams) => updateSportSetting(sport.key, { favoriteTeams: teams })}
                      />
                    )}
                  </>
                )}

                {/* Tournament sports */}
                {TOURNAMENT_SPORTS.includes(sport.key) && (
                  <>
                    <Text style={styles.settingLabel}>Show</Text>
                    <View style={styles.chipRow}>
                      {TOURNAMENT_FILTER_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.chip, setting?.tournamentFilter === opt.key && { backgroundColor: sport.color, borderColor: sport.color }]}
                          onPress={() => updateSportSetting(sport.key, { tournamentFilter: opt.key })}
                        >
                          <Text style={[styles.chipText, setting?.tournamentFilter === opt.key && { color: '#fff' }]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {/* Motor sports */}
                {MOTOR_SPORTS.includes(sport.key) && (
                  <Text style={styles.settingNote}>All races included automatically</Text>
                )}

                {/* Combat sports */}
                {COMBAT_SPORTS.includes(sport.key) && (
                  <>
                    <Text style={styles.settingLabel}>Show</Text>
                    <View style={styles.chipRow}>
                      {COMBAT_FILTER_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.chip, setting?.combatFilter === opt.key && { backgroundColor: sport.color, borderColor: sport.color }]}
                          onPress={() => updateSportSetting(sport.key, { combatFilter: opt.key })}
                        >
                          <Text style={[styles.chipText, setting?.combatFilter === opt.key && { color: '#fff' }]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Notifications */}
      <Text style={styles.sectionLabel}>Notifications</Text>
      <View style={styles.notifCard}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Game reminders</Text>
          <Switch
            value={preferences.notificationsEnabled}
            onValueChange={(v) => setPreferences({ notificationsEnabled: v })}
          />
        </View>
        {preferences.notificationsEnabled && (
          <View style={[styles.row, styles.rowTop]}>
            <Text style={styles.rowLabel}>Remind me</Text>
            <View style={styles.chipRow}>
              {[15, 30, 60].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[styles.chip, preferences.notifyMinutesBefore === mins && styles.chipSelected]}
                  onPress={() => setPreferences({ notifyMinutesBefore: mins })}
                >
                  <Text style={[styles.chipText, preferences.notifyMinutesBefore === mins && { color: '#fff' }]}>
                    {mins}m before
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[styles.button, preferences.sports.length === 0 && styles.buttonDisabled]}
        onPress={handleFinish}
        disabled={preferences.sports.length === 0}
      >
        <Text style={styles.buttonLabel}>Let's go →</Text>
      </TouchableOpacity>
      {preferences.sports.length === 0 && (
        <Text style={styles.hint}>Pick at least one sport to continue</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { padding: 24, paddingTop: 72, paddingBottom: 48 },
  title:          { fontSize: 32, fontWeight: '700', marginBottom: 12 },
  subtitle:       { fontSize: 16, color: '#666', lineHeight: 24, marginBottom: 32 },
  sectionLabel:   { fontSize: 13, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 8 },

  // Sport block
  sportBlock:     { marginBottom: 8 },
  sportCard:      { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sportEmoji:     { fontSize: 20 },
  sportLabel:     { flex: 1, fontSize: 15, fontWeight: '500', color: '#222' },
  sportCheck:     { fontSize: 14, color: '#fff', fontWeight: '700' },

  // Inline sport settings
  sportSettings:  { borderLeftWidth: 2, borderBottomWidth: 1, borderBottomColor: '#eee', borderRightWidth: 1, borderRightColor: '#eee', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: 14, paddingTop: 12, backgroundColor: '#fafafa' },
  settingLabel:   { fontSize: 12, color: '#999', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  settingNote:    { fontSize: 13, color: '#999', fontStyle: 'italic' },
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip:           { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  chipSelected:   { backgroundColor: '#378ADD', borderColor: '#378ADD' },
  chipText:       { fontSize: 12, fontWeight: '500', color: '#555' },

  // Notifications
  notifCard:      { backgroundColor: '#fff', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#eee', marginBottom: 32, overflow: 'hidden' },
  row:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  rowTop:         { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eee' },
  rowLabel:       { fontSize: 16, color: '#222' },

  // CTA
  button:         { backgroundColor: '#378ADD', borderRadius: 14, padding: 18, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#ccc' },
  buttonLabel:    { color: '#fff', fontSize: 17, fontWeight: '600' },
  hint:           { textAlign: 'center', color: '#aaa', marginTop: 12, fontSize: 14 },
});
