const { withAndroidManifest, AndroidConfig } = require("@expo/config-plugins");

const META_NAME = "com.google.android.geo.API_KEY";

/**
 * Injects Google Maps API key for react-native-maps.
 * Survives `npx expo prebuild` — set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env.
 */
function withGoogleMapsAndroid(config, { apiKey } = {}) {
  if (!apiKey) {
    console.warn(
      "[withGoogleMapsAndroid] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is missing. " +
        "Add it to .env — enable Maps SDK for Android in Google Cloud.",
    );
  }

  return withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    AndroidConfig.Manifest.removeMetaDataItemFromMainApplication(application, META_NAME);
    if (apiKey) {
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        application,
        META_NAME,
        apiKey,
        "value",
      );
    }
    return mod;
  });
}

module.exports = withGoogleMapsAndroid;
