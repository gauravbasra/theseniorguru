/**
 * Weather Service — free, no API key required.
 *
 * Stack:
 *  Zippopotam.us  → zip code → { city, state, lat, lon }   (correct "Highlands Ranch" for 80126)
 *  Open-Meteo     → lat/lon  → current + 3-day forecast
 *
 * WMO weather codes: https://open-meteo.com/en/docs#weathervariables
 */

const ZIPPOPOTAM_BASE = "https://api.zippopotam.us";
const OPENMETEO_GEO    = "https://geocoding-api.open-meteo.com/v1/search";
const OPENMETEO_WEATHER = "https://api.open-meteo.com/v1/forecast";
const REVERSE_GEO_BASE = "https://api.bigdatacloud.net/data/reverse-geocode-client";

const FETCH_TIMEOUT_MS = 6000;

// Simple in-process cache: location lookups and weather are cached for 15 min.
const _cache = new Map(); // key → { data, cachedAt }
const CACHE_TTL_MS = 15 * 60 * 1000;

function _cached(key) {
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.cachedAt < CACHE_TTL_MS) return entry.data;
  return null;
}
function _store(key, data) {
  _cache.set(key, { data, cachedAt: Date.now() });
  return data;
}

async function _get(url, label) {
  const resp = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!resp.ok) throw new Error(`${label} ${resp.status}: ${url}`);
  return resp.json();
}

// ---------------------------------------------------------------------------
// WMO weather code → human description
// ---------------------------------------------------------------------------
function _wmoDescription(code) {
  const c = Number(code);
  if (c === 0)            return "Clear sky";
  if (c === 1)            return "Mainly clear";
  if (c === 2)            return "Partly cloudy";
  if (c === 3)            return "Overcast";
  if (c >= 45 && c <= 48) return "Foggy";
  if (c >= 51 && c <= 57) return "Drizzle";
  if (c >= 61 && c <= 65) return "Rain";
  if (c === 66 || c === 67) return "Freezing rain";
  if (c >= 71 && c <= 77) return "Snow";
  if (c >= 80 && c <= 82) return "Rain showers";
  if (c === 85 || c === 86) return "Snow showers";
  if (c >= 95 && c <= 99) return "Thunderstorm";
  return "Mixed conditions";
}

function _wmoIcon(code) {
  const c = Number(code);
  if (c === 0 || c === 1)          return "☀️";
  if (c === 2 || c === 3)          return "⛅";
  if (c >= 45 && c <= 48)          return "🌫️";
  if (c >= 51 && c <= 57)          return "🌦️";
  if (c >= 61 && c <= 65)          return "🌧️";
  if (c === 66 || c === 67)        return "🌨️";
  if (c >= 71 && c <= 77)          return "❄️";
  if (c >= 80 && c <= 82)          return "🌦️";
  if (c === 85 || c === 86)        return "🌨️";
  if (c >= 95 && c <= 99)          return "⛈️";
  return "🌡️";
}

// ---------------------------------------------------------------------------
// Zip → { city, state, lat, lon }
// ---------------------------------------------------------------------------
async function resolveZip(zip) {
  if (!zip) return null;
  const clean = String(zip).replace(/\D/g, "").slice(0, 5);
  if (clean.length !== 5) return null;

  const cacheKey = `zip:${clean}`;
  const cached = _cached(cacheKey);
  if (cached) return cached;

  try {
    // Zippopotam.us correctly returns "Highlands Ranch" for 80126
    const data = await _get(`${ZIPPOPOTAM_BASE}/us/${clean}`, "zippopotam");
    const place = data.places?.[0];
    if (!place) return null;
    const result = {
      zip: clean,
      city: place["place name"],
      state: place.state,
      stateAbbr: place["state abbreviation"],
      lat: parseFloat(place.latitude),
      lon: parseFloat(place.longitude),
      source: "zippopotam"
    };
    return _store(cacheKey, result);
  } catch (err) {
    console.warn("resolveZip zippopotam failed, trying Open-Meteo geocoding:", err.message);
    // Fallback: Open-Meteo geocoding by zip string
    try {
      const geo = await _get(`${OPENMETEO_GEO}?name=${clean}&count=1&language=en&format=json&countryCode=US`, "openmeteo-geo");
      const r = geo.results?.[0];
      if (!r) return null;
      const result = {
        zip: clean,
        city: r.name,
        state: r.admin1 || "",
        stateAbbr: r.admin1_code || "",
        lat: r.latitude,
        lon: r.longitude,
        source: "openmeteo-geo"
      };
      return _store(cacheKey, result);
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Fetch weather for lat/lon
// ---------------------------------------------------------------------------
async function fetchWeather(lat, lon) {
  const cacheKey = `wx:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = _cached(cacheKey);
  if (cached) return cached;

  const url = [
    `${OPENMETEO_WEATHER}?`,
    `latitude=${lat}&longitude=${lon}`,
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weathercode,windspeed_10m,winddirection_10m,is_day`,
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset`,
    `&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch`,
    `&timezone=auto&forecast_days=3`
  ].join("");

  const data = await _get(url, "openmeteo-weather");
  const cur  = data.current;
  const daily = data.daily;

  const current = {
    tempF:           Math.round(cur.temperature_2m),
    feelsLikeF:      Math.round(cur.apparent_temperature),
    humidity:        Math.round(cur.relative_humidity_2m),
    precipitationIn: cur.precipitation,
    precipChancePct: Math.round(cur.precipitation_probability),
    windMph:         Math.round(cur.windspeed_10m),
    windDir:         cur.winddirection_10m,
    weatherCode:     cur.weathercode,
    condition:       _wmoDescription(cur.weathercode),
    icon:            _wmoIcon(cur.weathercode),
    isDay:           cur.is_day === 1,
    timezone:        data.timezone,
    observedAt:      cur.time
  };

  const forecast = (daily.time || []).map((date, i) => ({
    date,
    conditionCode:   daily.weathercode[i],
    condition:       _wmoDescription(daily.weathercode[i]),
    icon:            _wmoIcon(daily.weathercode[i]),
    highF:           Math.round(daily.temperature_2m_max[i]),
    lowF:            Math.round(daily.temperature_2m_min[i]),
    precipChancePct: Math.round(daily.precipitation_probability_max[i]),
    precipIn:        daily.precipitation_sum[i],
    sunrise:         daily.sunrise[i],
    sunset:          daily.sunset[i]
  }));

  const result = { current, forecast, timezone: data.timezone };
  return _store(cacheKey, result);
}

// ---------------------------------------------------------------------------
// Public: resolve zip → location + weather in one call
// ---------------------------------------------------------------------------
async function getWeatherForZip(zip) {
  const location = await resolveZip(zip);
  if (!location) return null;
  const wx = await fetchWeather(location.lat, location.lon);
  return { location, ...wx };
}

// ---------------------------------------------------------------------------
// Lat/lon → { city, stateAbbr, zip } via free reverse-geocoding (no API key)
// ---------------------------------------------------------------------------
async function reverseGeocode(lat, lon) {
  if (lat == null || lon == null) return null;
  const cacheKey = `rgeo:${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`;
  const cached = _cached(cacheKey);
  if (cached) return cached;

  try {
    const data = await _get(
      `${REVERSE_GEO_BASE}?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      "bigdatacloud-reverse-geo"
    );
    const result = {
      city: data.city || data.locality || "",
      state: data.principalSubdivision || "",
      stateAbbr: (data.principalSubdivisionCode || "").split("-").pop() || "",
      zip: data.postcode || null,
      lat: Number(lat),
      lon: Number(lon),
      source: "bigdatacloud"
    };
    return _store(cacheKey, result);
  } catch (err) {
    console.warn("reverseGeocode failed:", err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public: resolve lat/lon directly (for GPS-based queries)
// ---------------------------------------------------------------------------
async function getWeatherForLatLon(lat, lon) {
  const [wx, location] = await Promise.all([
    fetchWeather(lat, lon),
    reverseGeocode(lat, lon)
  ]);
  return location ? { location, ...wx } : wx;
}

// ---------------------------------------------------------------------------
// Build a concise weather summary string for Groq system prompt injection
// ---------------------------------------------------------------------------
function buildWeatherSummary(weatherData) {
  if (!weatherData) return null;
  const { location, current, forecast } = weatherData;
  const lines = [];

  if (location) {
    const zipPart = location.zip ? ` (zip ${location.zip})` : "";
    lines.push(`Location: ${location.city}, ${location.stateAbbr}${zipPart}`);
  }

  if (current) {
    lines.push(
      `Right now (current temperature, NOT today's high): ${current.icon} ${current.condition}, ${current.tempF}°F (feels ${current.feelsLikeF}°F), ` +
      `humidity ${current.humidity}%, wind ${current.windMph} mph, ` +
      `rain chance ${current.precipChancePct}%` +
      (current.precipitationIn > 0 ? `, ${current.precipitationIn}" precipitation` : "")
    );
  }

  if (forecast?.length) {
    const days = forecast.slice(0, 3).map((d, i) => {
      const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.date;
      return `${label}: ${d.icon} ${d.condition}, high ${d.highF}°F / low ${d.lowF}°F, rain chance ${d.precipChancePct}%`;
    });
    lines.push(`Forecast (use these highs/lows when asked about "today's high" or future days):\n${days.join("\n")}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Detect if a message is asking about weather/environment
// ---------------------------------------------------------------------------
const WEATHER_PATTERN = /\b(weather|rain|snow|sunny|cloudy|cold|hot|warm|wind|storm|fog|temp|temperature|forecast|humidity|outdoor|outside|walk|umbrella|coat|jacket|freeze|freez|ice|icy|hail|thunder|lightning|pollen|aqi|air quality)\b/i;

function isWeatherQuery(message) {
  return WEATHER_PATTERN.test(message);
}

module.exports = {
  resolveZip,
  reverseGeocode,
  fetchWeather,
  getWeatherForZip,
  getWeatherForLatLon,
  buildWeatherSummary,
  isWeatherQuery
};
