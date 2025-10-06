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

interface GoogleWeatherResponse {
  forecastHours: Array<{
    interval: {
      startTime: string;
      endTime: string;
    };
    temperature: {
      unit: string;
      degrees: number;
    };
    weatherCondition: {
      description: {
        text: string;
        languageCode: string;
      };
      type: string;
    };
    relativeHumidity?: number;
    wind?: {
      speed: {
        unit: string;
        value: number;
      };
    };
    precipitation?: {
      probability: {
        type: string;
        percent: number;
      };
    };
  }>;
}

interface GoogleHistoryResponse {
  historyHours: Array<{
    interval: {
      startTime: string;
      endTime: string;
    };
    temperature: {
      unit: string;
      degrees: number;
    };
    weatherCondition: {
      description: {
        text: string;
        languageCode: string;
      };
      type: string;
    };
    relativeHumidity?: number;
    wind?: {
      speed: {
        unit: string;
        value: number;
      };
    };
    precipitation?: {
      probability: {
        type: string;
        percent: number;
      };
    };
  }>;
}

async function fetchGoogleHistoricalWeather(
  query: GoogleWeatherQuery,
): Promise<HourlyWeatherData[]> {
  const apiKey = process.env.GOOGLE_WEATHER_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_WEATHER_API_KEY is not configured.');
  }

  // Use coordinates from environment variables
  const latitude = parseFloat(process.env.WEATHER_LATITUDE || '47.3809335');
  const longitude = parseFloat(process.env.WEATHER_LONGITUDE || '-122.2348431');
  
  // Google Weather API endpoint for historical data
  const historyUrl = `https://weather.googleapis.com/v1/history/hours:lookup?key=${apiKey}&location.latitude=${latitude}&location.longitude=${longitude}&hours=3`;

  const response = await fetch(historyUrl);
  
  if (!response.ok) {
    throw new Error(`Google Weather History API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as GoogleHistoryResponse;
  
  if (!data.historyHours || !Array.isArray(data.historyHours)) {
    throw new Error('Invalid historical weather data response from Google Weather API');
  }

  // Transform the Google Weather History API response to our expected format
  return data.historyHours.map((entry) => {
    const tempCelsius = entry.temperature.degrees;
    return {
      timestamp: entry.interval.startTime,
      temperatureCelsius: Math.round(tempCelsius * 10) / 10,
      temperatureFahrenheit: Math.round((tempCelsius * 9/5 + 32) * 10) / 10,
      condition: entry.weatherCondition?.description?.text || 'unknown',
      humidityPercent: entry.relativeHumidity,
      windSpeedKph: entry.wind?.speed?.unit === 'KILOMETERS_PER_HOUR' 
        ? Math.round(entry.wind.speed.value * 10) / 10 
        : undefined,
      precipitationProbability: entry.precipitation?.probability?.percent,
    };
  });
}

async function fetchGoogleUpcomingWeather(
  query: GoogleWeatherQuery,
): Promise<HourlyWeatherData[]> {
  const apiKey = process.env.GOOGLE_WEATHER_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_WEATHER_API_KEY is not configured.');
  }

  // Use coordinates from environment variables
  const latitude = parseFloat(process.env.WEATHER_LATITUDE || '47.3809335');
  const longitude = parseFloat(process.env.WEATHER_LONGITUDE || '-122.2348431');
  
  // Google Weather API endpoint for hourly forecast
  const weatherUrl = `https://weather.googleapis.com/v1/forecast/hours:lookup?key=${apiKey}&location.latitude=${latitude}&location.longitude=${longitude}&hours=12`;

  const response = await fetch(weatherUrl);
  
  if (!response.ok) {
    throw new Error(`Google Weather API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as GoogleWeatherResponse;
  
  if (!data.forecastHours || !Array.isArray(data.forecastHours)) {
    throw new Error('Invalid weather data response from Google Weather API');
  }

  // Transform the Google Weather API response to our expected format
  return data.forecastHours.map((entry) => {
    const tempCelsius = entry.temperature.degrees;
    return {
      timestamp: entry.interval.startTime,
      temperatureCelsius: Math.round(tempCelsius * 10) / 10,
      temperatureFahrenheit: Math.round((tempCelsius * 9/5 + 32) * 10) / 10,
      condition: entry.weatherCondition?.description?.text || 'unknown',
      humidityPercent: entry.relativeHumidity,
      windSpeedKph: entry.wind?.speed?.unit === 'KILOMETERS_PER_HOUR' 
        ? Math.round(entry.wind.speed.value * 10) / 10 
        : undefined,
      precipitationProbability: entry.precipitation?.probability?.percent,
    };
  });
}

export async function fetchGoogleWeather(
  query: GoogleWeatherQuery,
): Promise<GoogleWeatherResult> {
  // Make both calls in parallel for better performance
  const [historicalData, upcomingData] = await Promise.all([
    fetchGoogleHistoricalWeather(query),
    fetchGoogleUpcomingWeather(query),
  ]);

  // Combine historical and upcoming data
  const hourlyData = [...historicalData, ...upcomingData];

  // Sort the combined data chronologically by timestamp
  hourlyData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const lastUpdatedIso = new Date().toISOString();

  return {
    hourlyData,
    provider: 'google-weather',
    lastUpdatedIso,
  };
}
