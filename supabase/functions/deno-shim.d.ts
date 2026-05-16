/** Minimal types for Supabase Edge Functions (Deno). Not used by the React Native app. */
declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  env: {
    get(key: string): string | undefined;
  };
};
