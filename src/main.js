import './style.css';
const PRESET_LOCATIONS = [
    { name: 'Forde', lat: 61.4548, lon: 5.8572 },
    { name: 'Bergen', lat: 60.3913, lon: 5.3221 },
];
let token = null;
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function pickNumber(record, keys) {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string') {
            const parsed = Number.parseFloat(value);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
    }
    return null;
}
function pickString(record, keys) {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            return value;
        }
    }
    return null;
}
function normalizeRow(candidate) {
    if (!isRecord(candidate)) {
        return null;
    }
    const weatherCandidate = candidate.weather_point;
    const weatherPoint = isRecord(weatherCandidate) ? weatherCandidate : candidate;
    const timestamp = pickString(weatherPoint, ['timestamp', 'time', 'datetime', 'date']);
    const temperature = pickNumber(weatherPoint, ['temperature', 'temp']);
    const humidity = pickNumber(weatherPoint, ['humidity']);
    const windSpeed = pickNumber(weatherPoint, ['wind_speed', 'windSpeed', 'wind']);
    const ttf = pickNumber(candidate, ['ttf', 'time_to_fire', 'hours_to_fire']);
    if (!timestamp ||
        temperature === null ||
        humidity === null ||
        windSpeed === null ||
        ttf === null) {
        return null;
    }
    return {
        ttf,
        weather_point: {
            timestamp,
            temperature,
            humidity,
            wind_speed: windSpeed,
        },
    };
}
function pickRows(payload) {
    const queue = [payload];
    const seen = new Set();
    while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined || seen.has(current)) {
            continue;
        }
        seen.add(current);
        if (Array.isArray(current)) {
            const rows = current.map((item) => normalizeRow(item)).filter((item) => item !== null);
            if (rows.length > 0 || current.length === 0) {
                return rows;
            }
            queue.push(...current);
            continue;
        }
        if (isRecord(current)) {
            const row = normalizeRow(current);
            if (row) {
                return [row];
            }
            queue.push(...Object.values(current));
        }
    }
    if (isRecord(payload)) {
        const detail = pickString(payload, ['error_description', 'error', 'detail', 'message']);
        if (detail) {
            throw new Error(`TTF API error: ${detail}`);
        }
    }
    return [];
}
function input(id) {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLInputElement)) {
        throw new Error(`Missing input: ${id}`);
    }
    return element;
}
function value(id) {
    return input(id).value.trim();
}
function setStatus(message, type) {
    const element = document.getElementById('status');
    if (!element)
        return;
    element.textContent = message;
    element.className = `status status-${type}`;
}
async function authenticate() {
    const response = await fetch(`/realms/${value('realm')}/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: value('client-id'),
            username: value('username'),
            password: value('password'),
            grant_type: 'password',
        }),
    });
    if (!response.ok) {
        throw new Error(`Authentication failed (${response.status})`);
    }
    const body = (await response.json());
    if (!body.access_token) {
        throw new Error('Authentication response did not include an access token');
    }
    token = body.access_token;
}
async function fetchTTF(latitude, longitude) {
    if (!token) {
        throw new Error('Login first to query the API');
    }
    const query = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
    });
    const response = await fetch(`/api/v1/ttf/?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 404) {
        return [];
    }
    if (!response.ok) {
        throw new Error(`TTF request failed (${response.status})`);
    }
    const payload = (await response.json());
    return pickRows(payload);
}
function formatTimestamp(timestamp) {
    const splitIndex = timestamp.indexOf('T');
    return splitIndex === -1 ? timestamp : `${timestamp.slice(0, splitIndex)} ${timestamp.slice(splitIndex + 1, splitIndex + 6)}`;
}
function clearResponse() {
    const summary = document.getElementById('response-summary');
    const tableBody = document.getElementById('response-rows');
    const raw = document.getElementById('response-raw');
    if (summary)
        summary.textContent = 'No request made yet.';
    if (tableBody)
        tableBody.innerHTML = '';
    if (raw)
        raw.textContent = '';
}
function renderResponse(latitude, longitude, rows) {
    const summary = document.getElementById('response-summary');
    const tableBody = document.getElementById('response-rows');
    const raw = document.getElementById('response-raw');
    if (!summary || !tableBody || !raw)
        return;
    summary.textContent = `Latitude ${latitude.toFixed(4)}, Longitude ${longitude.toFixed(4)} - ${rows.length} rows returned.`;
    tableBody.innerHTML = rows.slice(0, 24).map((row) => `
    <tr>
      <td>${formatTimestamp(row.weather_point.timestamp)}</td>
      <td>${row.ttf.toFixed(1)}</td>
      <td>${row.weather_point.temperature.toFixed(1)}</td>
      <td>${row.weather_point.humidity.toFixed(0)}</td>
      <td>${row.weather_point.wind_speed.toFixed(1)}</td>
    </tr>
  `).join('');
    raw.textContent = JSON.stringify(rows, null, 2);
}
function parseCoordinate(id) {
    const parsed = Number.parseFloat(value(id));
    if (!Number.isFinite(parsed)) {
        throw new Error(`${id} must be a valid number`);
    }
    if (id === 'latitude' && (parsed < -90 || parsed > 90)) {
        throw new Error('latitude must be between -90 and 90');
    }
    if (id === 'longitude' && (parsed < -180 || parsed > 180)) {
        throw new Error('longitude must be between -180 and 180');
    }
    return parsed;
}
async function onLogin() {
    setStatus('Authenticating...', 'loading');
    try {
        await authenticate();
        setStatus(`Logged in as ${value('username')}`, 'ok');
    }
    catch (error) {
        token = null;
        setStatus(error instanceof Error ? error.message : 'Authentication failed', 'error');
    }
}
async function onQuery() {
    setStatus('Requesting TTF data...', 'loading');
    try {
        const latitude = parseCoordinate('latitude');
        const longitude = parseCoordinate('longitude');
        const rows = await fetchTTF(latitude, longitude);
        renderResponse(latitude, longitude, rows);
        setStatus(`Query succeeded (${rows.length} rows)`, 'ok');
    }
    catch (error) {
        clearResponse();
        setStatus(error instanceof Error ? error.message : 'Query failed', 'error');
    }
}
function setCoordinates(latitude, longitude) {
    input('latitude').value = latitude.toString();
    input('longitude').value = longitude.toString();
}
document.addEventListener('DOMContentLoaded', () => {
    clearResponse();
    setStatus('Waiting for login', 'idle');
    const loginForm = document.getElementById('login-form');
    const queryForm = document.getElementById('query-form');
    loginForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        void onLogin();
    });
    queryForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        void onQuery();
    });
    const presetButtons = document.querySelectorAll('[data-lat][data-lon]');
    for (const button of presetButtons) {
        button.addEventListener('click', () => {
            const lat = Number.parseFloat(button.dataset.lat ?? '');
            const lon = Number.parseFloat(button.dataset.lon ?? '');
            if (!Number.isFinite(lat) || !Number.isFinite(lon))
                return;
            setCoordinates(lat, lon);
            void onQuery();
        });
    }
    if (PRESET_LOCATIONS.length >= 2) {
        setCoordinates(PRESET_LOCATIONS[0].lat, PRESET_LOCATIONS[0].lon);
    }
});
