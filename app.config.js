export default {
  expo: {
    name: "DealRoom",
    slug: "dealroom-mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: "dealroom",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#34b55a"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.tradeworkspro.dealroom",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: "DealRoom needs camera access to capture property photos during evaluations and driving for dollars.",
        NSPhotoLibraryUsageDescription: "DealRoom needs photo library access to upload property images.",
        NSLocationWhenInUseUsageDescription: "DealRoom needs your location to track driving routes and tag properties.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "DealRoom needs background location to track your driving route while the app is minimized.",
        NSMicrophoneUsageDescription: "DealRoom needs microphone access to record voice notes during property evaluations.",
        UIBackgroundModes: ["location", "audio"]
      }
    },
    android: {
      package: "com.tradeworkspro.dealroom",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#34b55a"
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
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsImpl: "mapbox"
        }
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "DealRoom needs background location to track your driving route.",
          locationAlwaysPermission: "DealRoom needs background location to track your driving route.",
          locationWhenInUsePermission: "DealRoom needs your location to tag properties and track routes.",
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true
        }
      ],
      [
        "expo-image-picker",
        {
          cameraPermission: "DealRoom needs camera access to capture property photos.",
          photosPermission: "DealRoom needs photo library access to upload property images."
        }
      ],
      [
        "expo-media-library",
        {
          photosPermission: "DealRoom needs access to save photos to your library.",
          savePhotosPermission: "DealRoom needs access to save photos to your library.",
          isAccessMediaLocationEnabled: true
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "c7b90bee-db9a-4a0a-826e-e41540abd16e"
      }
    }
  }
};
