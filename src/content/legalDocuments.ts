export type LegalDocumentId = "privacy" | "terms";

export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
  /** Paragraphs shown after bullet lists. */
  footer?: string[];
};

export type LegalDocument = {
  id: LegalDocumentId;
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
};

export const APP_LEGAL_NAME = "LearnGate";
export const APP_PACKAGE = "com.pipsjacob.learngate";
export const LEGAL_LAST_UPDATED = "July 5, 2026";
export const LEGAL_CONTACT_EMAIL = "support@learngate.app";

export const PRIVACY_POLICY: LegalDocument = {
  id: "privacy",
  title: "Privacy Policy",
  lastUpdated: LEGAL_LAST_UPDATED,
  intro:
    "LearnGate helps parents manage their children's learning activities, screen time, and safety settings. This Privacy Policy explains what information we collect, how we use it, and the choices available to parents.",
  sections: [
    {
      title: "1. Who this policy applies to",
      paragraphs: [
        "LearnGate has two roles: Parent accounts (guardians who create and manage child profiles) and Child accounts (used on a child's device with a name and PIN).",
        "Parents are responsible for creating child accounts and enabling monitoring features. By registering a child, you confirm that you are the parent or legal guardian with authority to collect and review that child's information.",
      ],
    },
    {
      title: "2. Information we collect",
      paragraphs: ["We collect the following categories of information when you use LearnGate:"],
      bullets: [
        "Parent account: email address, password (stored securely by our auth provider), optional full name, and Google account details if you sign in with Google.",
        "Child profile: name, birthday (used to calculate age), child login email, a parent-assigned PIN, avatar photo, difficulty and audio settings, stars/points, and screen-time rules (daily limits, bedtime).",
        "Learning & activity data: assigned tasks, game progress, exercise sessions, chore photos submitted for review, achievements, and activity logs.",
        "Location (child device): GPS coordinates, accuracy, speed, heading, and timestamps when the child is signed in and location sharing is active. Parents can view live location on a map.",
        "App usage (Android): names/labels of apps opened, foreground/background events, and duration—used for parental visibility and app blocking.",
        "Photos: chore verification images (stored privately) and profile avatars (stored for display). Exercise camera frames are processed on-device for rep counting and are not uploaded.",
        "Device & notifications: push notification tokens and platform type so we can deliver alerts you enable.",
        "AI insight summaries: a JSON snapshot of aggregated child activity (tasks, stars, app time, etc.) sent to Google Gemini to generate coaching text for parents. Raw photos and live camera feeds are not sent to Gemini.",
      ],
    },
    {
      title: "3. How we use information",
      paragraphs: ["We use collected information to:"],
      bullets: [
        "Provide account sign-in, child login, and role-based access.",
        "Let parents assign tasks, review chore photos, set screen limits, block apps, and view location and usage.",
        "Track learning progress, stars, streaks, and achievements for children.",
        "Send in-app and push notifications you opt into (task reminders, daily reports, alerts).",
        "Generate optional AI-assisted parent insights.",
        "Maintain security, troubleshoot issues, and improve the service.",
      ],
    },
    {
      title: "4. Device permissions (Android)",
      paragraphs: [
        "LearnGate may request the following permissions on a child's device when monitoring or safety features are used:",
      ],
      bullets: [
        "Location (when in use): share the child's location with the linked parent account.",
        "Camera: chore photo verification, optional profile photos, and on-device exercise tracking.",
        "Notifications: task reminders and parent alerts.",
        "Usage access: report which apps are used and for how long.",
        "Accessibility service: enforce screen-time lock and blocked apps by detecting the foreground app. We do not collect the contents of other apps—only package identifiers needed for blocking.",
      ],
    },
    {
      title: "5. Third-party services",
      paragraphs: ["LearnGate relies on trusted service providers, including:"],
      bullets: [
        "Supabase — authentication, database, file storage, and realtime updates.",
        "Google — optional OAuth sign-in for parents; Google Maps for location display; Firebase Cloud Messaging for Android push delivery.",
        "Google Gemini — generates text-based parent insights from aggregated activity summaries.",
        "Expo Push Notification service — routes push messages to devices.",
        "Geoapify — map tiles and reverse geocoding for location labels.",
      ],
      footer: [
        "These providers process data according to their own terms and privacy policies. We configure access so child data is visible only to the linked parent account unless you explicitly use a sharing feature.",
      ],
    },
    {
      title: "6. Data storage & security",
      paragraphs: [
        "Data is stored in Supabase (cloud database and storage). Row-level security limits each parent to their own children and each child to their own profile and tasks.",
        "Auth sessions and some preferences are stored locally on the device. Screen-time usage for daily limits is tracked on the child's device and resets when the parent saves updated limit settings.",
        "No third-party advertising or analytics SDKs are built into the LearnGate app.",
      ],
    },
    {
      title: "7. Data retention & deletion",
      paragraphs: [
        "We retain account and child data while your account is active. Parents can remove a child profile from Manage Children, which deletes associated tasks and history as described in the app.",
        "To request deletion of a parent account or additional data, contact us at the email below. We will respond within a reasonable time.",
      ],
    },
    {
      title: "8. Your choices",
      paragraphs: ["Parents can:"],
      bullets: [
        "Update or remove child profiles, screen limits, and blocked apps.",
        "Clear recorded app usage history for a child.",
        "Turn notifications on or off in Settings.",
        "Disable screen limits or bedtime rules.",
        "Review AI insights without sharing photos externally.",
      ],
      footer: [
        "Children can toggle audio guide and notification preferences on their device where available. Some safety permissions are managed by the parent on the child's device.",
      ],
    },
    {
      title: "9. Children's privacy",
      paragraphs: [
        "LearnGate is designed for use by parents supervising children ages 3–13. We do not knowingly permit children to create standalone parent accounts.",
        "We collect child information only to provide features requested by the parent. Location, app usage, and photos are visible to the linked parent account.",
      ],
    },
    {
      title: "10. Changes to this policy",
      paragraphs: [
        "We may update this Privacy Policy from time to time. The \"Last updated\" date at the top will change when we do. Continued use of LearnGate after changes means you accept the updated policy.",
      ],
    },
    {
      title: "11. Contact",
      paragraphs: [`Questions about privacy? Email us at ${LEGAL_CONTACT_EMAIL}.`],
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDocument = {
  id: "terms",
  title: "Terms & Conditions",
  lastUpdated: LEGAL_LAST_UPDATED,
  intro:
    "These Terms & Conditions govern your use of LearnGate. By creating an account or using the app, you agree to these terms.",
  sections: [
    {
      title: "1. Acceptance of terms",
      paragraphs: [
        "By signing up, signing in, or using LearnGate, you agree to these Terms & Conditions and our Privacy Policy. If you do not agree, do not use the app.",
      ],
    },
    {
      title: "2. Eligibility & accounts",
      paragraphs: [
        "Parent accounts must be created by an adult who is the parent or legal guardian of any child they register.",
        "Child accounts are created by a parent and accessed on a child's device using the child's display name and parent-assigned PIN. Keep the PIN confidential.",
        "You are responsible for maintaining the security of your login credentials and for all activity under your account.",
      ],
    },
    {
      title: "3. Parent responsibilities",
      paragraphs: ["As a parent user, you agree to:"],
      bullets: [
        "Provide accurate information when creating child profiles.",
        "Obtain any consent required in your jurisdiction before enabling location tracking, app monitoring, or accessibility features on a child's device.",
        "Configure screen-time, bedtime, and app-blocking rules appropriately for your child.",
        "Review chore photos and task submissions in a timely and respectful manner.",
        "Supervise your child's use of LearnGate and their device.",
      ],
    },
    {
      title: "4. Monitoring & safety features",
      paragraphs: [
        "LearnGate includes optional parental controls: live location, app usage reporting, app blocking, daily screen limits, and bedtime lock (Android).",
        "These features require device permissions and, on Android, may require enabling LearnGate in system Settings (Accessibility, Usage access).",
        "Monitoring features are tools to assist parents—they are not a substitute for direct supervision or emergency services. LearnGate does not guarantee real-time accuracy of location or usage data.",
      ],
    },
    {
      title: "5. Acceptable use",
      paragraphs: ["You agree not to:"],
      bullets: [
        "Use LearnGate to harass, abuse, or harm any person.",
        "Attempt to access another parent's or child's account without authorization.",
        "Reverse engineer, disrupt, or overload the service.",
        "Upload unlawful, offensive, or unrelated content through chore or profile features.",
        "Use the app in violation of applicable laws, including children's privacy laws in your region.",
      ],
    },
    {
      title: "6. Learning content & AI insights",
      paragraphs: [
        "Games, tasks, and difficulty levels are provided for educational and motivational purposes. Results may vary by child and are not guaranteed.",
        "AI-generated parent insights (powered by Google Gemini) are suggestions only—not professional medical, psychological, or educational advice. You are responsible for decisions you make based on insights.",
      ],
    },
    {
      title: "7. Intellectual property",
      paragraphs: [
        "LearnGate, its branding, and original content are owned by the app developer. You receive a limited, personal, non-transferable license to use the app for lawful family use.",
      ],
    },
    {
      title: "8. Service availability",
      paragraphs: [
        "We strive to keep LearnGate available but do not guarantee uninterrupted access. Features may change, and maintenance or third-party outages may occur.",
        "Demo mode (without Supabase configuration) is for development only and does not store real cloud data.",
      ],
    },
    {
      title: "9. Disclaimer & limitation of liability",
      paragraphs: [
        "LearnGate is provided \"as is\" without warranties of any kind. To the fullest extent permitted by law, we are not liable for indirect, incidental, or consequential damages arising from your use of the app, including reliance on location data, screen-time enforcement, or AI insights.",
      ],
    },
    {
      title: "10. Termination",
      paragraphs: [
        "You may stop using LearnGate at any time by logging out and, if desired, requesting account deletion.",
        "We may suspend or terminate access if you violate these terms or if required by law.",
        "Removing a child profile deletes associated app data as implemented in the service.",
      ],
    },
    {
      title: "11. Changes to these terms",
      paragraphs: [
        "We may update these Terms & Conditions. Material changes will be reflected in the \"Last updated\" date. Continued use after changes constitutes acceptance.",
      ],
    },
    {
      title: "12. Contact",
      paragraphs: [`Questions about these terms? Email us at ${LEGAL_CONTACT_EMAIL}.`],
    },
  ],
};

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  privacy: PRIVACY_POLICY,
  terms: TERMS_OF_SERVICE,
};

export function legalDocumentLabel(id: LegalDocumentId): string {
  return LEGAL_DOCUMENTS[id].title;
}
