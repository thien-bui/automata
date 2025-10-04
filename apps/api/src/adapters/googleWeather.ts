export interface GoogleWeatherQuery {
  location: string;
}

export interface GoogleWeatherResult {
  hourlyData: HourlyWeatherData[];
  provider: 'google-weather';
  lastUpdatedIso: string;
}

export interface HourlyWeatherData {
  timestamp: string;
  temperatureCelsius: number;
  temperatureFahrenheit: number;
  condition: string;
  humidityPercent?: number;
  windSpeedKph?: number;
  precipitationProbability?: number;
}

interface OpenWeatherMapResponse {
  list: Array<{
    dt_txt: string;
    main: {
      temp: number;
      humidity: number;
    };
    weather: Array<{
      description: string;
    }>;
    wind?: {
      speed: number;
    };
    pop: number;
  }>;
}

export async function fetchGoogleWeather(
  query: GoogleWeatherQuery,
): Promise<GoogleWeatherResult> {
  const apiKey = process.env.VITE_GOOGLE_WEATHER_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GOOGLE_WEATHER_API_KEY is not configured.');
  }

  // Google Weather API endpoint (using OpenWeatherMap as a proxy since Google doesn't have a direct weather API)
  // Note: This is a placeholder implementation. In a real scenario, you'd use Google's actual weather API
  // or a service like OpenWeatherMap, AccuWeather, etc.
  const weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(query.location)}&units=metric&appid=${apiKey}`;

  const response = await fetch(weatherUrl);
  
  if (!response.ok) {
    throw new Error(`Weather API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as OpenWeatherMapResponse;
  
  if (!data.list || !Array.isArray(data.list)) {
    throw new Error('Invalid weather data response');
  }

  // Get the next 24 hours of data (3-hour intervals, so we need 8 data points)
  const hourlyData = data.list
    .slice(0, 8) // First 8 entries = 24 hours (3 hours each)
    .map((entry) => ({
      timestamp: entry.dt_txt,
      temperatureCelsius: Math.round(entry.main.temp * 10) / 10,
      temperatureFahrenheit: Math.round((entry.main.temp * 9/5 + 32) * 10) / 10,
      condition: entry.weather[0]?.description || 'unknown',
      humidityPercent: entry.main.humidity,
      windSpeedKph: entry.wind?.speed ? Math.round(entry.wind.speed * 3.6 * 10) / 10 : undefined,
      precipitationProbability: Math.round(entry.pop * 100),
    }));

  const lastUpdatedIso = new Date().toISOString();

  return {
    hourlyData,
    provider: 'google-weather',
    lastUpdatedIso,
  };
}
