import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Sport = 'nfl' | 'nba' | 'mlb' | 'nhl' | 'soccer' | 'nascar' | 'f1' | 'tennis' | 'golf' | 'ncaafb' | 'ncaamb' | 'mma' | 'wnba' | 'boxing';

export interface Team {
  id: string;
  name: string;
  sport: Sport;
  logo?: string;
}

export interface Tournament {
  id: string;
  name: string;
  sport: Sport;
}

export type TeamSportFilter = 'all' | 'national_tv' | 'my_team' | 'my_team_and_national_tv';
export type TournamentSportFilter = 'majors' | 'all' | 'custom';
export type CombatSportFilter = 'title_fights' | 'main_events' | 'all';
export type F1SessionType = 'FP1' | 'FP2' | 'FP3' | 'SS' | 'SR' | 'Qual' | 'Race';
export type SoccerKnockoutThreshold = 'off' | 'quarterfinals' | 'semifinals' | 'final';

// Club leagues where users can pick teams
export const SOCCER_CLUB_LEAGUES: { id: string; label: string }[] = [
  { id: 'usa.1',  label: 'MLS' },
  { id: 'eng.1',  label: 'Premier League' },
  { id: 'esp.1',  label: 'La Liga' },
  { id: 'ger.1',  label: 'Bundesliga' },
  { id: 'fra.1',  label: 'Ligue 1' },
  { id: 'ita.1',  label: 'Serie A' },
];

// Knockout competitions where users pick a round threshold
export const SOCCER_KNOCKOUT_COMPETITIONS: { id: string; label: string }[] = [
  { id: 'uefa.champions',   label: 'Champions League' },
  { id: 'uefa.europa',      label: 'Europa League' },
  { id: 'fifa.world',       label: 'World Cup' },
  { id: 'fifa.wwc',         label: "Women's World Cup" },
  { id: 'conmebol.america', label: 'Copa America' },
  { id: 'uefa.euro',        label: 'European Championships' },
  { id: 'concacaf.gold',    label: 'Gold Cup' },
];

// All soccer leagues (union of club + knockout)
export const SOCCER_LEAGUES = [...SOCCER_CLUB_LEAGUES, ...SOCCER_KNOCKOUT_COMPETITIONS];

// ESPN round slugs in ascending order of importance
export const KNOCKOUT_ROUND_ORDER = [
  'quarterfinals',
  'semifinals',
  'final',
];

// Human-readable round labels for display in event blocks
export const ROUND_LABELS: Record<string, string> = {
  'quarterfinals': 'Quarterfinal',
  'semifinals':    'Semifinal',
  'final':         'Final',
};

// Sports that have draft events
export const DRAFT_SPORTS: Sport[] = ['nfl', 'nba', 'mlb', 'nhl', 'wnba', 'soccer'];

export interface SportSetting {
  sport: Sport;
  alwaysShowPlayoffs?: boolean;
  showDrafts?: boolean;
  teamFilter?: TeamSportFilter;
  myTeams?: Team[];
  myTeamsByLeague?: Record<string, Team[]>;
  leagueFilters?: Record<string, TeamSportFilter>;
  tournamentFilter?: TournamentSportFilter;
  selectedTournaments?: Tournament[];
  combatFilter?: CombatSportFilter;
  selectedClubLeagues?: string[];
  knockoutThresholds?: Record<string, SoccerKnockoutThreshold>;
  f1ShowPractice?: boolean;
  f1ShowSprintShootout?: boolean;
  f1ShowSprintRace?: boolean;
  f1ShowQualifying?: boolean;
  f1ShowRace?: boolean;
}

export interface SportEvent {
  id: string;
  name: string;
  sport: Sport;
  date: string;
  time?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeAbbrev?: string;
  awayAbbrev?: string;
  homeLogo?: string;
  awayLogo?: string;
  eventLogo?: string;
  channel?: string;
  venue?: string;
  isNationalTv?: boolean;
  isMajor?: boolean;
  isCustom?: boolean;
  isDraft?: boolean;
  gameNumber?: number;
  f1SessionType?: F1SessionType;
  soccerLeagueId?: string;
  soccerRoundSlug?: string;
  soccerCompetitionLabel?: string;
  durationHours?: number;
  isIfNecessary?: boolean;
  seriesSummary?: string;
}

export interface UserPreferences {
  sports: Sport[];
  sportSettings: Record<string, SportSetting>;
  notificationsEnabled: boolean;
  notifyMinutesBefore: number;
}

interface AppState {
  preferences: UserPreferences;
  customEvents: SportEvent[];
  hasCompletedOnboarding: boolean;
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  toggleSport: (sport: Sport) => void;
  updateSportSetting: (sport: Sport, setting: Partial<SportSetting>) => void;
  addCustomEvent: (event: SportEvent) => void;
  updateCustomEvent: (id: string, updates: Partial<SportEvent>) => void;
  deleteCustomEvent: (id: string) => void;
  completeOnboarding: () => void;
  resetPreferences: () => void;
}

const secureStorage = {
  getItem: async (name: string) => await SecureStore.getItemAsync(name),
  setItem: async (name: string, value: string) => await SecureStore.setItemAsync(name, value),
  removeItem: async (name: string) => await SecureStore.deleteItemAsync(name),
};

const defaultPreferences: UserPreferences = {
  sports: [],
  sportSettings: {},
  notificationsEnabled: true,
  notifyMinutesBefore: 30,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      preferences: defaultPreferences,
      customEvents: [],
      hasCompletedOnboarding: false,

      setPreferences: (prefs) =>
        set((state) => ({ preferences: { ...state.preferences, ...prefs } })),

      toggleSport: (sport) =>
        set((state) => {
          const sports = state.preferences.sports.includes(sport)
            ? state.preferences.sports.filter((s) => s !== sport)
            : [...state.preferences.sports, sport];
          const sportSettings = { ...state.preferences.sportSettings };
          if (!sports.includes(sport)) {
            delete sportSettings[sport];
          } else if (!sportSettings[sport]) {
            sportSettings[sport] = {
              sport,
              teamFilter: 'all',
              tournamentFilter: 'majors',
              combatFilter: 'main_events',
              showDrafts: false,
              selectedClubLeagues: sport === 'soccer' ? ['usa.1'] : undefined,
              knockoutThresholds: sport === 'soccer' ? {} : undefined,
              leagueFilters: sport === 'soccer' ? {} : undefined,
              f1ShowPractice: false,
              f1ShowSprintShootout: false,
              f1ShowSprintRace: false,
              f1ShowQualifying: false,
              f1ShowRace: true,
            };
          }
          return { preferences: { ...state.preferences, sports, sportSettings } };
        }),

      updateSportSetting: (sport, setting) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            sportSettings: {
              ...state.preferences.sportSettings,
              [sport]: { ...state.preferences.sportSettings[sport], ...setting },
            },
          },
        })),

      addCustomEvent: (event) =>
        set((state) => ({ customEvents: [...state.customEvents, event] })),

      updateCustomEvent: (id, updates) =>
        set((state) => ({
          customEvents: state.customEvents.map((e) => e.id === id ? { ...e, ...updates } : e),
        })),

      deleteCustomEvent: (id) =>
        set((state) => ({
          customEvents: state.customEvents.filter((e) => e.id !== id),
        })),

      completeOnboarding: () => set({ hasCompletedOnboarding: true }),

      resetPreferences: () => set({ preferences: defaultPreferences, hasCompletedOnboarding: false }),
    }),
    {
      name: 'sports-calendar-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
