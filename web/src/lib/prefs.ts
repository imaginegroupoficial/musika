export type Prefs = {
  n_lancamentos?: boolean;
  n_shows?: boolean;
  n_posts?: boolean;
  n_avisos?: boolean;
  push?: boolean;
  email?: boolean;
  audio?: 'auto' | 'economia' | 'alta';
};

export const PREF_DEFAULTS: Required<Prefs> = {
  n_lancamentos: true,
  n_shows: true,
  n_posts: true,
  n_avisos: true,
  push: true,
  email: false,
  audio: 'auto',
};

export const readPrefs = (p: unknown): Required<Prefs> => ({ ...PREF_DEFAULTS, ...((p && typeof p === 'object' ? p : {}) as Prefs) });
