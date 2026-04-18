import * as ImagePicker from "expo-image-picker";
import { File as ExpoFile } from "expo-file-system";
import { Platform } from "react-native";
import { supabase } from "@/services/supabase";

export const TASK_EVIDENCE_BUCKET = "task-evidence";

/**
 * Reads a local image URI into ArrayBuffer.
 * `fetch(uri).blob()` is unreliable on Android for `content://` URIs (common after camera + crop).
 * Expo's `File.arrayBuffer()` handles those paths correctly.
 */
async function readLocalImageAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    return response.arrayBuffer();
  }

  try {
    const file = new ExpoFile(uri);
    return await file.arrayBuffer();
  } catch {
    const response = await fetch(uri);
    return response.arrayBuffer();
  }
}

export async function pickTaskPhotoFromCamera(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Camera permission is required to verify this chore.");
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.82,
    allowsEditing: true,
  });

  const legacyCancelled = "cancelled" in result && (result as { cancelled?: boolean }).cancelled === true;
  if (legacyCancelled || result.canceled) {
    return null;
  }

  const asset = result.assets?.[0];
  if (!asset?.uri) {
    return null;
  }

  return asset.uri;
}

/** Uploads to path `{childId}/{taskId}/{timestamp}.jpg` — matches storage RLS policies. */
export async function uploadTaskEvidencePhoto(params: { childId: string; taskId: string; localUri: string }): Promise<string> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const path = `${params.childId}/${params.taskId}/${Date.now()}.jpg`;
  const arrayBuffer = await readLocalImageAsArrayBuffer(params.localUri);
  if (arrayBuffer.byteLength === 0) {
    throw new Error("Could not read the photo. Try again or disable cropping if the problem continues.");
  }

  const { error } = await supabase.storage.from(TASK_EVIDENCE_BUCKET).upload(path, arrayBuffer, {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return path;
}

export async function getEvidenceSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.storage.from(TASK_EVIDENCE_BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw error ?? new Error("Could not create image URL.");
  }
  return data.signedUrl;
}
