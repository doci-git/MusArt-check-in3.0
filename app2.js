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
const TIME_LIMIT_HOURS = 1;
const SECRET_KEY = "chiaveSegreta123"; // usata per hash

// --- Cookie utilities ---
function setCookie(name, value, hours) {
  const d = new Date();
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : null;
}

// --- Hash function (SHA-256) ---
async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Blocca pagina ---
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
  const hoursPassed = (now - parseInt(startTime, 10)) / (1000 * 60 * 60);
  if (hoursPassed >= TIME_LIMIT_HOURS) {
       document.head.innerHTML = "";
       document.body.innerHTML = "";
       document.body.style.backgroundColor = "black";
       document.body.style.color = "white";
       document.body.style.display = "flex";
       document.body.style.justifyContent = "center";
       document.body.style.alignItems = "center";
       document.body.style.height = "100vh";
       document.body.style.fontSize = "22px";
       document.body.style.textAlign = "center";
       document.body.textContent = "⏰ Timeout link expired!";
       window.stop();
    return true;
  }
  return false;
}

// --- Set usage start time + hash ---
async function setUsageStartTime() {
  const now = Date.now();
  setCookie("usage_start_time", now, TIME_LIMIT_HOURS);
  const hash = await sha256(now + SECRET_KEY);
  setCookie("usage_hash", hash, TIME_LIMIT_HOURS);
}

// --- Click e popup ---
function getClicksLeft(cookieKey) {
  const stored = getCookie(cookieKey);
  return stored === null ? MAX_CLICKS : parseInt(stored, 10);
}

function setClicksLeft(cookieKey, count) {
  setCookie(cookieKey, count, TIME_LIMIT_HOURS);
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
      : `No clicks remaining.`;
  popup.style.display = "block";
}

function closePopup(buttonId) {
  document.getElementById(`popup-${buttonId}`).style.display = "none";
}

// --- Accendi Shelly ---
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
    if (!text) return;
    const data = JSON.parse(text);
    log(
      data.error
        ? `Errore API: ${JSON.stringify(data.error)}`
        : "Acceso con successo!",
      device.log_id
    );
  } catch (err) {
    log(`Errore fetch: ${err.message}`, device.log_id);
  }
}

// --- Log ---
function log(msg, logElementId) {
  document.getElementById(logElementId).textContent = msg;
}

// --- Abilita pulsanti ---
function abilitaPulsanti() {
  DEVICES.forEach((device) => {
    aggiornaStatoPulsante(device);
    document.getElementById(device.button_id).onclick = () =>
      accendiShelly(device);
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
document.addEventListener("contextmenu", (e) => e.preventDefault(), false);

// --- Controllo automatico ogni minuto ---
setInterval(checkTimeLimit, 60 * 1000);

// --- Controllo immediato su caricamento ---
checkTimeLimit();
