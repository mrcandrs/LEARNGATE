export type ChildProfileRow = {
  id: string;
  name: string;
  age: number;
  difficulty_level: number;
  stars: number;
  stars_lifetime?: number;
  daily_limit_minutes: number;
  screen_limit_enabled: boolean;
  bedtime_enabled: boolean;
  bedtime_start: string;
  bedtime_end: string;
  avatar_url: string | null;
  audio_guide_enabled: boolean;
  audio_guide_rate: number;
  blocked_apps_json: string[];
};
