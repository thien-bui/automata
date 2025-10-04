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

export async function fetchGoogleWeather(
  query: GoogleWeatherQuery,
): Promise<GoogleWeatherResult> {
  const apiKey = process.env.GOOGLE_WEATHER_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_WEATHER_API_KEY is not configured.');
  }

  // Use coordinates from environment variables
  const latitude = parseFloat(process.env.WEATHER_LATITUDE || '47.3809335');
  const longitude = parseFloat(process.env.WEATHER_LONGITUDE || '-122.2348431');
  
  // Google Weather API endpoint for hourly forecast
  const weatherUrl = `https://weather.googleapis.com/v1/forecast/hours:lookup?key=${apiKey}&location.latitude=${latitude}&location.longitude=${longitude}&hours=24`;

  const response = await fetch(weatherUrl);
  
  if (!response.ok) {
    throw new Error(`Google Weather API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as GoogleWeatherResponse;
  
  if (!data.forecastHours || !Array.isArray(data.forecastHours)) {
    throw new Error('Invalid weather data response from Google Weather API');
  }

  // Transform the Google Weather API response to our expected format
  const hourlyData = data.forecastHours.map((entry) => {
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

  const lastUpdatedIso = new Date().toISOString();

  return {
    hourlyData,
    provider: 'google-weather',
    lastUpdatedIso,
  };
}
