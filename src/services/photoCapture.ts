import { requireOptionalNativeModule } from "expo-modules-core";

export type CameraFacing = "front" | "back";

export type CameraCaptureRequest = {
  facing: CameraFacing;
  title: string;
  hint?: string;
};

type CaptureHandler = (request: CameraCaptureRequest) => void;

let captureHandler: CaptureHandler | null = null;
let pendingResolve: ((uri: string | null) => void) | null = null;

export function registerCameraCaptureHandler(handler: CaptureHandler | null) {
  captureHandler = handler;
}

export function isImagePickerNativeLinked(): boolean {
  return Boolean(requireOptionalNativeModule("ExponentImagePicker"));
}

export const IMAGE_PICKER_REBUILD_HINT =
  "Install the latest LearnGate build (npm run android or a new APK). Gallery pick needs a rebuild; you can use the camera instead.";

export function requestCameraPhoto(request: CameraCaptureRequest): Promise<string | null> {
  if (!captureHandler) {
    return Promise.reject(new Error("Camera capture is not ready. Restart the app."));
  }
  return new Promise((resolve) => {
    pendingResolve = resolve;
    captureHandler?.(request);
  });
}

export function finishCameraPhoto(uri: string | null) {
  pendingResolve?.(uri);
  pendingResolve = null;
}
