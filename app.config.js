/** @param {{ config: import("expo/config").ExpoConfig }} ctx */
module.exports = ({ config }) => {
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? config.extra?.eas?.projectId;

  return {
    ...config,
    extra: {
      ...config.extra,
      eas: {
        ...(config.extra?.eas ?? {}),
        ...(projectId ? { projectId } : {}),
      },
    },
    android: {
      ...config.android,
      googleServicesFile: "./google-services.json",
      permissions: [
        ...(config.android?.permissions ?? []),
        "android.permission.POST_NOTIFICATIONS",
      ],
    },
  };
};
