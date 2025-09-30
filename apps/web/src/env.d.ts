/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_BROWSER_KEY?: string;
  readonly VITE_DEFAULT_ALERT_THRESHOLD?: string;
  readonly VITE_DEFAULT_FRESHNESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

