import { File as ExpoFile } from "expo-file-system";
import { Platform } from "react-native";
import { supabase } from "@/services/supabase";
import {
  IMAGE_PICKER_REBUILD_HINT,
  isImagePickerNativeLinked,
  requestCameraPhoto,
} from "@/services/photoCapture";

export const CHILD_AVATAR_BUCKET = "child-avatars";

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

export async function pickChildAvatarFromLibrary(): Promise<string | null> {
  if (!isImagePickerNativeLinked()) {
    return requestCameraPhoto({
      facing: "front",
      title: "Profile photo",
      hint: IMAGE_PICKER_REBUILD_HINT,
    });
  }

  const ImagePicker = await import("expo-image-picker");
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Gallery permission is required to upload profile photo.");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    allowsEditing: Platform.OS === "ios",
    aspect: [1, 1],
  });
  if (result.canceled) {
    return null;
  }
  return result.assets?.[0]?.uri ?? null;
}

export async function uploadChildAvatar(params: { childId: string; localUri: string }): Promise<string> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  const path = `${params.childId}/avatar-${Date.now()}.jpg`;
  const arrayBuffer = await readLocalImageAsArrayBuffer(params.localUri);
  const { error } = await supabase.storage.from(CHILD_AVATAR_BUCKET).upload(path, arrayBuffer, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) {
    throw error;
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from(CHILD_AVATAR_BUCKET).getPublicUrl(path);
  return publicUrl;
}
