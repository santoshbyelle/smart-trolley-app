// ============================================
// API Service — ESP32 + Raspberry Pi Communication
// MODIFIED v3: Face Recognition APIs added
//   - /start-recognition, /add-face, /faces,
//     /remove-face, /auth-status, /deauth
//   - Dynamic Pi URL with mDNS fallback
//   - Old HOG SVM auth endpoints removed
// ============================================

// ─── ESP32 Base URL (Trolley motor/sensor controller) ───────────────────────
const ESP32_URL = 'http://192.168.4.1';

// ─── Raspberry Pi URL (Face recognition server) ────────────────────────────
// Try mDNS first, fallback to static IP
let PI_URL = 'http://raspberrypi.local:5000';
let _piUrlResolved = false;

const PI_FALLBACK_IPS = [
  'http://raspberrypi.local:5000',
  'http://smarttrolley.local:5000',
  'http://192.168.4.3:5000',
  'http://192.168.43.100:5000',
  'http://192.168.1.100:5000',
  'http://172.20.10.2:5000',
];

const TIMEOUT = 5000;
const PI_TIMEOUT = 8000;

// ─── Helpers ────────────────────────────────────────────────────────────────
const fetchWithTimeout = async (url, options = {}, timeout = TIMEOUT) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    clearTimeout(id);
    return { success: false, error: err.message };
  }
};

// ─── Pi Auto-Discovery ─────────────────────────────────────────────────────
export const discoverPi = async () => {
  for (const url of PI_FALLBACK_IPS) {
    try {
      const result = await fetchWithTimeout(`${url}/ping`, {}, 3000);
      if (result.success && result.data?.device === 'smarttrolley-pi') {
        PI_URL = url;
        _piUrlResolved = true;
        console.log(`Pi discovered at: ${url}`);
        return { success: true, url };
      }
    } catch {}
  }
  return { success: false, error: 'Raspberry Pi not found on network' };
};

export const setPiUrl = (url) => {
  PI_URL = url.replace(/\/+$/, '');
  _piUrlResolved = true;
};

export const getPiUrl = () => PI_URL;
export const isPiResolved = () => _piUrlResolved;

// ─── Pi Request Helper ─────────────────────────────────────────────────────
const piRequest = async (path, method = 'GET', body = null, timeout = PI_TIMEOUT) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const opts = {
      method,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${PI_URL}${path}`, opts);
    clearTimeout(id);
    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    clearTimeout(id);
    return { success: false, error: err.message };
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// FACE RECOGNITION APIs (Raspberry Pi)
// ═════════════════════════════════════════════════════════════════════════════

// GET /ping — health check for auto-discovery
export const pingPi = () => fetchWithTimeout(`${PI_URL}/ping`, {}, 3000);

// POST /start-recognition — Pi camera scans & recognizes face
// Returns: { recognized: bool, person_name, confidence, error }
export const startRecognition = () =>
  piRequest('/start-recognition', 'POST', null, 15000);

// POST /add-face — send captured image + name to Pi
// Body: { name: string, image: base64_string }
// Returns: { success, face_id, name, total_faces }
export const addFace = (name, imageBase64) =>
  piRequest('/add-face', 'POST', { name, image: imageBase64 }, 15000);

// GET /faces — list all registered faces
// Returns: { faces: [{ id, name, date, image }], total }
export const getFaces = () => piRequest('/faces');

// DELETE /remove-face/:id — remove a registered face
export const removeFace = (faceId) =>
  piRequest(`/remove-face/${faceId}`, 'DELETE');

// GET /auth-status — current authentication state
// Returns: { authenticated, user, follow_enabled, status, fps }
export const getAuthStatus = () => piRequest('/auth-status');

// POST /deauth — lock trolley / clear authentication
export const deauth = () => piRequest('/deauth', 'POST');


// ═════════════════════════════════════════════════════════════════════════════
// ESP32 APIs (Motor control, sensors)
// ═════════════════════════════════════════════════════════════════════════════

// ---- STATUS ----
export const getFullStatus = () => fetchWithTimeout(`${ESP32_URL}/status`);
export const getBattery = () => fetchWithTimeout(`${ESP32_URL}/status`);
export const getDistance = () => fetchWithTimeout(`${ESP32_URL}/status`);

// ---- MOTOR CONTROL ----
export const move = (dir) => fetchWithTimeout(`${ESP32_URL}/control?cmd=${dir}`);
export const setSpeed = (spd) => fetchWithTimeout(`${ESP32_URL}/control?speed=${spd}`);
export const startFollow = () => fetchWithTimeout(`${ESP32_URL}/control?cmd=follow`);
export const stopTrolley = () => fetchWithTimeout(`${ESP32_URL}/control?cmd=stop`);
export const emergencyStop = () => fetchWithTimeout(`${ESP32_URL}/emergency`);
export const lockMotors = () => fetchWithTimeout(`${ESP32_URL}/lock`);

// ---- SECURITY ----
export const armSecurity = () => fetchWithTimeout(`${ESP32_URL}/security?action=arm`);
export const disarmSecurity = () => fetchWithTimeout(`${ESP32_URL}/security?action=disarm`);
export const clearAlert = () => fetchWithTimeout(`${ESP32_URL}/security?action=alert`);
export const sendTestSMS = () => fetchWithTimeout(`${ESP32_URL}/gsm/test`);

// ---- BUZZER / PID ----
export const setBuzzer = (on) => fetchWithTimeout(`${ESP32_URL}/buzzer?state=${on ? 'on' : 'off'}`);
export const setPIDGain = (kp) => fetchWithTimeout(`${ESP32_URL}/setPID?kp=${kp}`);

// ── Legacy aliases ──
export const setMode = (mode) => fetchWithTimeout(`${ESP32_URL}/control?cmd=${mode}`);
export const returnToUser = () => fetchWithTimeout(`${ESP32_URL}/control?cmd=stop`);
export const getSecurity = () => fetchWithTimeout(`${ESP32_URL}/status`);
export const setSensitivity = (mode) =>
  fetchWithTimeout(`${ESP32_URL}/setPID?kp=${mode === 'high' ? 0.7 : mode === 'low' ? 0.3 : 0.5}`);
export const setPID = (kp) => fetchWithTimeout(`${ESP32_URL}/setPID?kp=${kp}`);
export const getWeight = () => fetchWithTimeout(`${ESP32_URL}/status`);
export const getCameraStream = () => fetchWithTimeout(`${ESP32_URL}/status`);
export const lockUser = () => fetchWithTimeout(`${ESP32_URL}/lock`);

// ---- MOCK DATA ----
export const getMockStatus = () => ({
  success: true,
  data: {
    mode: 'manual', speed: 220, weight: 18.4, frontDist: 45, rearDist: 120,
    gpsLat: 28.5562, gpsLng: 77.1000, accelX: 120, accelY: 80,
    encL: 0, encR: 0, gsmReady: true, antitheft: false, alert: false,
  },
});
