import { CommonActions } from "@react-navigation/native";
import type { LegalDocumentId } from "@/content/legalDocuments";
import { navigationRef } from "@/navigation/navigationRef";

export function openLegalDocument(documentId: LegalDocumentId) {
  const action = CommonActions.navigate({
    name: "LegalDocument",
    params: { documentId },
  });

  if (navigationRef.isReady()) {
    navigationRef.dispatch(action);
    return;
  }

  const unsubscribe = navigationRef.addListener("state", () => {
    if (navigationRef.isReady()) {
      unsubscribe();
      navigationRef.dispatch(action);
    }
  });
}
