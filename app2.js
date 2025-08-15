// --- Configurazione ---
const DEVICES = [
  {
    id: "e4b063f0c38c",
    auth_key:
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    cookie_key: "clicks_MainDoor",
    button_id: "MainDoor",
    log_id: "log1",
  },
  {
    id: "34945478d595",
    auth_key:
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    cookie_key: "clicks_AptDoor",
    button_id: "AptDoor",
    log_id: "log2",
  },
];

const MAX_CLICKS = 3;
const BASE_URL_SET =
  "https://shelly-73-eu.shelly.cloud/v2/devices/api/set/switch";
const CORRECT_CODE = "2245";
const TIME_LIMIT_MINUTES = 20; // per test rapido
const SECRET_KEY = "chiaveSegreta123";

// --- Cookie utilities ---
function setCookie(name, value, minutes) {
  const d = new Date();
  d.setTime(d.getTime() + minutes * 60 * 1000);
  document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : null;
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
  const hash = await sha256(now + SECRET_KEY);
  setCookie("usage_hash", hash, TIME_LIMIT_MINUTES);
}

async function checkTimeLimit() {
  const startTime = getCookie("usage_start_time");
  const storedHash = getCookie("usage_hash");

  if (!startTime || !storedHash) return false;

  const calcHash = await sha256(startTime + SECRET_KEY);
  if (calcHash !== storedHash) {
    document.body.innerHTML = "⚠️ Cookie manomesso!";
    window.stop();
    return true;
  }

  const now = Date.now();
  const minutesPassed = (now - parseInt(startTime, 10)) / (1000 * 60);
  if (minutesPassed >= TIME_LIMIT_MINUTES) {
    document.head.innerHTML = "";
    document.body.innerHTML = "⏰ Timeout link expired!";
    window.stop();
    return true;
  }
  return false;
}

// --- Gestione click ---
function getClicksLeft(cookieKey) {
  const stored = getCookie(cookieKey);
  return stored === null ? MAX_CLICKS : parseInt(stored, 10);
}

function setClicksLeft(cookieKey, count) {
  setCookie(cookieKey, count, TIME_LIMIT_MINUTES);
}

function aggiornaStatoPulsante(device) {
  const btn = document.getElementById(device.button_id);
  const clicksLeft = getClicksLeft(device.cookie_key);
  btn.disabled = clicksLeft <= 0;
}

function showDevicePopup(device, clicksLeft) {
  const popup = document.getElementById(`popup-${device.button_id}`);
  document.getElementById(`popup-title-${device.button_id}`).innerText =
    device.button_id;
  document.getElementById(`popup-text-${device.button_id}`).innerText =
    clicksLeft > 0
      ? `You have ${clicksLeft} remaining click.`
      : `No clicks remaining. Please contact us.`;
  popup.style.display = "block";
}

function closePopup(buttonId) {
  document.getElementById(`popup-${buttonId}`).style.display = "none";
}

// --- Accensione Shelly ---
async function accendiShelly(device) {
  if (await checkTimeLimit()) return;

  let clicksLeft = getClicksLeft(device.cookie_key);
  if (clicksLeft <= 0) {
    showDevicePopup(device, clicksLeft);
    aggiornaStatoPulsante(device);
    return;
  }

  clicksLeft--;
  setClicksLeft(device.cookie_key, clicksLeft);
  aggiornaStatoPulsante(device);
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

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (data.error) {
      console.error(`Errore API: ${JSON.stringify(data.error)}`);
    } else {
      console.log("acceso con successo!");
    }
  } catch (err) {
    console.error(`Errore fetch: ${err.message}`);
  }
}

// --- Abilita pulsanti ---
function abilitaPulsanti() {
  DEVICES.forEach((device) => {
    aggiornaStatoPulsante(device);
    const btn = document.getElementById(device.button_id);
    btn.onclick = async () => {
      if (await checkTimeLimit()) return;
      accendiShelly(device);
    };
  });
}

// --- Controllo codice ---
document.getElementById("btnCheckCode").onclick = async () => {
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

    abilitaPulsanti();
  } else {
    alert("Codice errato!");
  }
};

// --- Blocca tasto destro ---
document.addEventListener("contextmenu", (e) => e.preventDefault());

// --- Controllo automatico ogni 5 secondi ---
setInterval(checkTimeLimit, 5000);

// --- Controllo immediato su caricamento ---
window.addEventListener("load", async () => {
  const blocked = await checkTimeLimit();
  if (!blocked) {
    DEVICES.forEach((device) => aggiornaStatoPulsante(device));
  }
});
