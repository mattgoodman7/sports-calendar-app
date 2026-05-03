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

// All supported soccer league slugs (ESPN API identifiers)
export const SOCCER_LEAGUES: { id: string; label: string }[] = [
  { id: 'usa.1',            label: 'MLS' },
  { id: 'eng.1',            label: 'Premier League' },
  { id: 'esp.1',            label: 'La Liga' },
  { id: 'ger.1',            label: 'Bundesliga' },
  { id: 'fra.1',            label: 'Ligue 1' },
  { id: 'ita.1',            label: 'Serie A' },
  { id: 'uefa.champions',   label: 'Champions League' },
  { id: 'uefa.europa',      label: 'Europa League' },
  { id: 'fifa.world',       label: 'World Cup' },
  { id: 'fifa.wwc',         label: "Women's World Cup" },
  { id: 'conmebol.america', label: 'Copa America' },
  { id: 'uefa.euro',        label: 'European Championships' },
  { id: 'concacaf.gold',    label: 'Gold Cup' },
];

export interface SportSetting {
  sport: Sport;
  // Team sports
  teamFilter?: TeamSportFilter;
  myTeams?: Team[];                          // for non-soccer team sports
  myTeamsByLeague?: Record<string, Team[]>;  // for soccer, keyed by league id
  // Tournament sports
  tournamentFilter?: TournamentSportFilter;
  selectedTournaments?: Tournament[];
  // Combat sports
  combatFilter?: CombatSportFilter;
  // Soccer
  selectedSoccerLeagues?: string[];
}

export interface SportEvent {
  id: string;
  name: string;
  sport: Sport;
  date: string;
  time?: string;
  homeTeam?: string;
  awayTeam?: string;
  channel?: string;
  venue?: string;
  isNationalTv?: boolean;
  isMajor?: boolean;
  isCustom?: boolean;
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
              selectedSoccerLeagues: sport === 'soccer' ? ['usa.1'] : undefined,
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
