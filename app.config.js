import 'dotenv/config';

export default {
  expo: {
    name: 'Momentum',
    slug: 'momentum',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    updates: {
      url: 'https://u.expo.dev/9aa3909a-d1ee-4fbd-ba1a-520512f75d7f',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.momentum.fitnessapp',
      infoPlist: {
        NSUserNotificationsUsageDescription:
          'Momentum uses notifications to alert you when rest timers complete and when friends interact with you.',
        LSApplicationQueriesSchemes: ['instagram', 'instagram-stories'],
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.momentum.fitnessapp',
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0066E6',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      softwareKeyboardLayoutMode: 'resize',
      permissions: [
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      geminiApiKey: process.env.GEMINI_API_KEY,
      eas: {
        projectId: '9aa3909a-d1ee-4fbd-ba1a-520512f75d7f',
      },
    },
    plugins: [
      'expo-font',
      [
        'expo-notifications',
        {
          sounds: [],
        },
      ],
      [
        'expo-media-library',
        {
          photosPermission: 'Momentum needs access to save workout cards for sharing.',
          savePhotosPermission: 'Momentum needs access to save workout cards for sharing.',
          isAccessMediaLocationEnabled: false,
        },
      ],
    ],
  },
};
