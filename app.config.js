const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

export default {
  expo: {
    name: IS_PREVIEW ? "FlipMantis (Dev)" : "FlipMantis",
    slug: "flipmantis-mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: IS_PREVIEW ? "flipmantis-dev" : "flipmantis",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#10B981"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_PREVIEW
        ? "com.tradeworkspro.flipmantis.preview"
        : "com.tradeworkspro.flipmantis",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: "FlipMantis needs camera access to capture property photos during evaluations and driving for dollars.",
        NSPhotoLibraryUsageDescription: "FlipMantis needs photo library access to upload property images.",
        NSLocationWhenInUseUsageDescription: "FlipMantis needs your location to track driving routes and tag properties.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "FlipMantis needs background location to track your driving route while the app is minimized.",
        NSMicrophoneUsageDescription: "FlipMantis needs microphone access to record voice notes during property evaluations.",
        UIBackgroundModes: ["location", "remote-notification"]
      }
    },
    android: {
      package: IS_PREVIEW
        ? "com.tradeworkspro.flipmantis.preview"
        : "com.tradeworkspro.flipmantis",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundImage: "./assets/adaptive-icon-background.png",
        backgroundColor: "#10B981"
      },
      permissions: [
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_LOCATION",
        "android.permission.RECORD_AUDIO"
      ]
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro"
    },
    updates: {
      url: "https://u.expo.dev/de85de59-8a52-4d6b-bd17-96bcc5aefcd3"
    },
    runtimeVersion: {
      policy: "appVersion"
    },
    plugins: [
      "./plugins/strip-bitcode",
      [
        "expo-build-properties",
        {
          ios: {
            enableBitcode: false
          },
          android: {
            targetSdkVersion: 36,
            compileSdkVersion: 36
          }
        }
      ],
      "expo-router",
      "expo-secure-store",
      [
        "expo-notifications",
        {
          color: "#10B981",
          sounds: [],
          androidMode: "default"
        }
      ],
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsImpl: "mapbox"
        }
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "FlipMantis needs background location to track your driving route.",
          locationAlwaysPermission: "FlipMantis needs background location to track your driving route.",
          locationWhenInUsePermission: "FlipMantis needs your location to tag properties and track routes.",
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true
        }
      ],
      [
        "expo-image-picker",
        {
          cameraPermission: "FlipMantis needs camera access to capture property photos.",
          photosPermission: "FlipMantis needs photo library access to upload property images."
        }
      ],
      [
        "expo-media-library",
        {
          photosPermission: "FlipMantis needs access to save photos to your library.",
          savePhotosPermission: "FlipMantis needs access to save photos to your library.",
          isAccessMediaLocationEnabled: true
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "de85de59-8a52-4d6b-bd17-96bcc5aefcd3"
      },
      n8nWebhookUrl: process.env.EXPO_PUBLIC_N8N_WEBHOOK_URL || "https://boomie05.tradeworkspro.com"
    }
  }
};
