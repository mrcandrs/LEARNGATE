/** @param {{ config: import("expo/config").ExpoConfig }} ctx */
module.exports = ({ config }) => {
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? config.extra?.eas?.projectId;
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  return {
    ...config,
    extra: {
      ...config.extra,
      eas: {
        ...(config.extra?.eas ?? {}),
        ...(projectId ? { projectId } : {}),
      },
    },
    plugins: [
      ...(config.plugins ?? []),
      ["./plugins/withGoogleMapsAndroid.js", { apiKey: googleMapsApiKey }],
      "./plugins/withLearnGateNative.js",
    ],
    android: {
      ...config.android,
      config: {
        ...(config.android?.config ?? {}),
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
      googleServicesFile: "./google-services.json",
      permissions: [
        ...(config.android?.permissions ?? []),
        "android.permission.POST_NOTIFICATIONS",
      ],
    },
  };
};
