import { Redirect } from 'expo-router';
import { useAppStore } from '../lib/store';

export default function Index() {
  const hasCompletedOnboarding = useAppStore((s) => s.hasCompletedOnboarding);
  return <Redirect href={hasCompletedOnboarding ? '/(tabs)/calendar' : '/onboarding'} />;
}