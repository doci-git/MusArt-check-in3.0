// --- Configurazione ---
const DEVICES = [
  {
    id: "e4b063f0c38c",
    auth_key:
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    cookie_key: "clicks_MainDoor",
    button_id: "MainDoor",
  },
  {
    id: "34945478d595",
    auth_key:
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    cookie_key: "clicks_AptDoor",
    button_id: "AptDoor",
  },
];

const MAX_CLICKS = 3;
const BASE_URL_SET =
  "https://shelly-73-eu.shelly.cloud/v2/devices/api/set/switch";
const CORRECT_CODE = "2245";
const TIME_LIMIT_MINUTES = 2;
const SECRET_KEY = "chiaveSegreta123";
let timeCheckInterval;

// --- Cookie utilities ---
function setCookie(name, value, minutes) {
  const d = new Date();
  d.setTime(d.getTime() + minutes * 60 * 1000);
  const secureFlag = location.protocol === "https:" ? ";secure" : "";
  document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/;samesite=strict${secureFlag}`;
}

function getCookie(name) {
  const cookies = document.cookie.split(";");
  for (let cookie of cookies) {
    const [cookieName, cookieValue] = cookie.split("=").map((c) => c.trim());
    if (cookieName === name) return cookieValue;
  }
  return null;
}

// --- Hash function ---
async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Gestione tempo ---
async function setUsageStartTime() {
  const now = Date.now();
  setCookie("usage_start_time", now, TIME_LIMIT_MINUTES);
  const hash = await sha256(`${now}${SECRET_KEY}`);
  setCookie("usage_hash", hash, TIME_LIMIT_MINUTES);
}

async function validateTime() {
  const startTime = getCookie("usage_start_time");
  const storedHash = getCookie("usage_hash");

  if (!startTime || !storedHash) return { valid: false };

  const calcHash = await sha256(`${startTime}${SECRET_KEY}`);
  if (calcHash !== storedHash) {
    return { valid: false, error: "⚠️ Cookie manomesso!" };
  }

  const now = Date.now();
  const minutesPassed = (now - parseInt(startTime, 10)) / (1000 * 60);

  if (minutesPassed >= TIME_LIMIT_MINUTES) {
    return { valid: false, error: "⏰ Timeout link expired!" };
  }

  return { valid: true, timeLeft: TIME_LIMIT_MINUTES - minutesPassed };
}

async function checkTimeLimit() {
  const validation = await validateTime();

  if (!validation.valid && validation.error) {
    document.body.innerHTML = `<div class="error-message">${validation.error}</div>`;
    clearInterval(timeCheckInterval);
    return true;
  }

  return !validation.valid;
}

// --- Gestione click ---
function getClicksLeft(cookieKey) {
  const stored = getCookie(cookieKey);
  return stored === null ? MAX_CLICKS : parseInt(stored, 10);
}

function setClicksLeft(cookieKey, count) {
  setCookie(cookieKey, count, TIME_LIMIT_MINUTES);
}

function updateButtonState(device) {
  const btn = document.getElementById(device.button_id);
  const clicksLeft = getClicksLeft(device.cookie_key);
  btn.disabled = clicksLeft <= 0;
}

function showDevicePopup(device, clicksLeft) {
  const popup = document.getElementById(`popup-${device.button_id}`);
  document.getElementById(`popup-title-${device.button_id}`).textContent =
    device.button_id.replace(/([A-Z])/g, " $1").trim();

  document.getElementById(`popup-text-${device.button_id}`).textContent =
    clicksLeft > 0
      ? `You have ${clicksLeft} remaining click${clicksLeft > 1 ? "s" : ""}.`
      : `No clicks remaining. Please contact us.`;

  popup.style.display = "flex";
}

function closePopup(buttonId) {
  document.getElementById(`popup-${buttonId}`).style.display = "none";
}

// --- Accensione Shelly ---
async function activateDevice(device) {
  if (await checkTimeLimit()) return;

  let clicksLeft = getClicksLeft(device.cookie_key);
  if (clicksLeft <= 0) {
    showDevicePopup(device, clicksLeft);
    updateButtonState(device);
    return;
  }

  clicksLeft--;
  setClicksLeft(device.cookie_key, clicksLeft);
  updateButtonState(device);
  showDevicePopup(device, clicksLeft);

  try {
    const response = await fetch(BASE_URL_SET, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: device.id,
        auth_key: device.auth_key,
        channel: 0,
        on: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      console.error(`API Error: ${JSON.stringify(data.error)}`);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
  }
}

// --- Abilita pulsanti ---
function enableButtons() {
  DEVICES.forEach((device) => {
    updateButtonState(device);
    const btn = document.getElementById(device.button_id);
    btn.addEventListener("click", async () => {
      if (await checkTimeLimit()) return;
      activateDevice(device);
    });
  });
}

// --- Inizializzazione ---
function init() {
  // Blocca tasto destro
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  // Controllo codice
  document
    .getElementById("btnCheckCode")
    .addEventListener("click", async () => {
      const insertedCode = document.getElementById("authCode").value.trim();
      if (insertedCode === CORRECT_CODE) {
        if (!getCookie("usage_start_time") || !getCookie("usage_hash")) {
          await setUsageStartTime();
        }

        if (await checkTimeLimit()) return;

        document.getElementById("controlPanel").style.display = "block";
        document.getElementById("authCode").style.display = "none";
        document.getElementById("authCodeh3").style.display = "none";
        document.getElementById("btnCheckCode").style.display = "none";
        document.getElementById("important").style.display = "none";

        enableButtons();
      } else {
        alert("Incorrect code!");
      }
    });

  // Controllo automatico ogni 5 secondi
  timeCheckInterval = setInterval(checkTimeLimit, 5000);

  // Controllo iniziale
  checkTimeLimit().then((blocked) => {
    if (!blocked) {
      DEVICES.forEach((device) => updateButtonState(device));
    }
  });
}

// Avvio quando la pagina è caricata
window.addEventListener("DOMContentLoaded", init);
