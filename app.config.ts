import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Slate',
  slug: 'slate-app',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.yourname.slate',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#0a0a0a',
    },
    package: 'com.yourname.slate',
    softwareKeyboardLayoutMode: 'pan',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-notifications',
  ],
  experiments: {
    typedRoutes: true,
  },
  scheme: 'slate-app',
});