export type GoogleMapsApi = typeof google;

type GoogleMapsLoaderOptions = {
  apiKey?: string;
  version?: string;
  libraries?: readonly string[];
  datasetKey?: string;
};

const loaderAttribute = 'data-google-maps-loader';

let loaderPromise: Promise<GoogleMapsApi> | null = null;

function waitForScript(script: HTMLScriptElement, removeOnFailure: boolean): Promise<GoogleMapsApi> {
  return new Promise<GoogleMapsApi>((resolve, reject) => {
    const cleanup = (): void => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };

    const handleLoad = (): void => {
      cleanup();
      if (window.google?.maps) {
        resolve(window.google);
        return;
      }

      if (removeOnFailure) {
        script.remove();
      }

      reject(new Error('Google Maps script loaded without the maps namespace.'));
    };

    const handleError = (): void => {
      cleanup();
      if (removeOnFailure) {
        script.remove();
      }

      reject(new Error('Failed to load Google Maps script.'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
  });
}

function createScript(src: string, datasetKey: string): HTMLScriptElement {
  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  script.defer = true;
  script.setAttribute(loaderAttribute, datasetKey);
  return script;
}

function buildSrc(apiKey: string, version: string, libraries: readonly string[]): string {
  const libraryParam = libraries.length > 0
    ? `&libraries=${libraries.map((library) => encodeURIComponent(library)).join(',')}`
    : '';

  return `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=${encodeURIComponent(version)}${libraryParam}`;
}

export function useGoogleMaps(options: GoogleMapsLoaderOptions) {
  const {
    apiKey,
    version = 'weekly',
    libraries = [],
    datasetKey = 'default',
  } = options;

  const load = async (): Promise<GoogleMapsApi> => {
    if (!apiKey) {
      throw new Error('Google Maps API key is not configured.');
    }

    if (typeof window === 'undefined') {
      throw new Error('Google Maps is unavailable in this environment.');
    }

    if (window.google?.maps) {
      return window.google;
    }

    if (loaderPromise) {
      return loaderPromise;
    }

    const selector = `script[${loaderAttribute}="${datasetKey}"]`;
    const existingScript = document.querySelector<HTMLScriptElement>(selector);
    const src = buildSrc(apiKey, version, libraries);
    const script = existingScript ?? createScript(src, datasetKey);

    if (!existingScript) {
      document.head.appendChild(script);
    }

    const promise = waitForScript(script, existingScript === null).catch((error: unknown) => {
      loaderPromise = null;
      throw error;
    });

    loaderPromise = promise;
    return promise;
  };

  return { load };
}
