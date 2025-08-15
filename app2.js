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
const SECRET_KEY = "q1w2e3r4t5"; // chiave segreta per hash cookie

// --- Utility Cookie + Hash ---
function setCookie(name, value, hours) {
  let expires = "";
  if (hours) {
    const date = new Date();
    date.setTime(date.getTime() + hours * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + value + expires + "; path=/";
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : null;
}

// --- Hash SHA-256 ---
async function sha256(msg) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(msg)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Gestione log ---
function log(msg, logElementId) {
  document.getElementById(logElementId).textContent = msg;
}

// --- Popup ---
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

// --- Gestione Click ---
function getClicksLeft(cookieKey) {
  const stored = getCookie(cookieKey);
  return stored === null ? MAX_CLICKS : parseInt(stored, 10);
}

function setClicksLeft(cookieKey, count) {
  setCookie(cookieKey, count, TIME_LIMIT_HOURS); // scade insieme al limite
}

function aggiornaStatoPulsante(device) {
  const btn = document.getElementById(device.button_id);
  const clicksLeft = getClicksLeft(device.cookie_key);
  btn.disabled = clicksLeft <= 0;
}

// --- Blocco pagina con hash ---
async function checkTimeLimit() {
  const startTime = getCookie("usage_start_time");
  const storedHash = getCookie("usage_hash");

  if (!startTime || !storedHash) return false;

  const calcHash = await sha256(startTime + SECRET_KEY);
  if (calcHash !== storedHash) {
    document.body.innerHTML = "⚠️ Cookie manomesso!";
    return true;
  }

  const now = Date.now();
  const hoursPassed = (now - parseInt(startTime, 10)) / (1000 * 60 * 60);
  if (hoursPassed >= TIME_LIMIT_HOURS) {
    document.head.innerHTML = "";
    document.body.innerHTML = "⏰ Timeout link expired!";
    document.body.style.backgroundColor = "black";
    document.body.style.color = "white";
    return true;
  }
  return false;
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

    if (!response.ok) {
      log(`Errore HTTP: ${response.status}`, device.log_id);
      return;
    }

    const text = await response.text();
    if (!text) {
      log("door open", device.log_id);
      return;
    }

    const data = JSON.parse(text);
    if (data.error) {
      log(`Errore API: ${JSON.stringify(data.error)}`, device.log_id);
    } else {
      log("acceso con successo!", device.log_id);
    }
  } catch (err) {
    log(`Errore fetch: ${err.message}`, device.log_id);
  }
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
    if (!getCookie("usage_start_time")) {
      const now = Date.now();
      setCookie("usage_start_time", now, TIME_LIMIT_HOURS);
      const hash = await sha256(now + SECRET_KEY);
      setCookie("usage_hash", hash, TIME_LIMIT_HOURS);
    }

    if (await checkTimeLimit()) return;

    document.getElementById("controlPanel").style.display = "block";
    document.getElementById("authCode").style.display = "none";
    document.getElementById("authCodeh3").style.display = "none";
    document.getElementById("btnCheckCode").style.display = "none";
    document.getElementById("important").style.display = "none";
    abilitaPulsanti();
  } else {
    alert("Codice errato!.");
  }
};

// --- Blocco tasto destro ---
document.addEventListener(
  "contextmenu",
  function (e) {
    e.preventDefault();
  },
  false
);

// Controllo immediato su caricamento
checkTimeLimit();
