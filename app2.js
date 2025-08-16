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

// --- Funzioni di utilità per i cookie ---
function setCookie(name, value, minutes) {
  const d = new Date();
  d.setTime(d.getTime() + minutes * 60 * 1000);
  const expires = "expires=" + d.toUTCString();
  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; ${expires}; path=/; SameSite=Strict${secureFlag}`;
}

function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

// --- Funzione hash SHA-256 ---
async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Imposta il tempo di inizio utilizzo ---
async function setUsageStartTime() {
  const now = Date.now().toString();
  setCookie("usage_start_time", now, TIME_LIMIT_MINUTES);
  const hash = await sha256(now + SECRET_KEY);
  setCookie("usage_hash", hash, TIME_LIMIT_MINUTES);
}

// --- Verifica il limite di tempo e l'integrità del cookie ---
async function checkTimeLimit() {
  const startTime = getCookie("usage_start_time");
  const storedHash = getCookie("usage_hash");

  // Se non ci sono cookie, non c'è limite da applicare
  if (!startTime || !storedHash) {
    return false;
  }

  // Verifica l'integrità del cookie
  const calcHash = await sha256(startTime + SECRET_KEY);
  if (calcHash !== storedHash) {
    return { error: "⚠️ Security violation detected!" };
  }

  // Calcola il tempo trascorso
  const now = Date.now();
  const elapsedMinutes = (now - parseInt(startTime)) / (1000 * 60);

  if (elapsedMinutes >= TIME_LIMIT_MINUTES) {
    return { error: "⏰ Session expired! Please request a new code." };
  }

  return false;
}

// --- Mostra un errore irreversibile ---
function showFatalError(message) {
  // Ferma l'intervallo di controllo
  clearInterval(timeCheckInterval);

  // Sostituisce l'intero body con il messaggio di errore
  document.body.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: #121111;
      color: #ff6b6b;
      font-size: 24px;
      text-align: center;
      padding: 20px;
      z-index: 9999;
    ">
      ${message}
    </div>
  `;
}

// --- Gestione dei click rimanenti ---
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

// --- Popup ---
function showDevicePopup(device, clicksLeft) {
  const popup = document.getElementById(`popup-${device.button_id}`);
  const titleElement = document.getElementById(
    `popup-title-${device.button_id}`
  );
  const textElement = document.getElementById(`popup-text-${device.button_id}`);

  // Formatta il titolo (es: "MainDoor" -> "Main Door")
  const formattedTitle = device.button_id.replace(/([A-Z])/g, " $1").trim();
  titleElement.textContent = formattedTitle;

  textElement.textContent =
    clicksLeft > 0
      ? `You have ${clicksLeft} remaining click${clicksLeft > 1 ? "s" : ""}.`
      : `No clicks remaining. Please contact us.`;

  popup.style.display = "flex";
}

function closePopup(buttonId) {
  const popup = document.getElementById(`popup-${buttonId}`);
  popup.style.display = "none";
}

// --- Attivazione dispositivo Shelly ---
async function activateDevice(device) {
  // Controlla se c'è un errore di tempo
  const timeError = await checkTimeLimit();
  if (timeError) {
    showFatalError(timeError.error);
    return;
  }

  // Controlla i click rimanenti
  let clicksLeft = getClicksLeft(device.cookie_key);
  if (clicksLeft <= 0) {
    showDevicePopup(device, clicksLeft);
    return;
  }

  // Decrementa i click e aggiorna lo stato
  clicksLeft--;
  setClicksLeft(device.cookie_key, clicksLeft);
  updateButtonState(device);
  showDevicePopup(device, clicksLeft);

  // Invia la richiesta per attivare il dispositivo
  try {
    const response = await fetch(BASE_URL_SET, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: device.id,
        auth_key: device.auth_key,
        channel: 0,
        on: true,
        turn: "on",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      console.error("API Error:", data.error);
    }
  } catch (error) {
    console.error("Error activating device:", error);
  }
}

// --- Gestione del codice di autorizzazione ---
async function handleCodeSubmit() {
  const insertedCode = document.getElementById("authCode").value.trim();
  if (insertedCode !== CORRECT_CODE) {
    alert("Incorrect code! Please try again.");
    return;
  }

  // Imposta il tempo di inizio
  await setUsageStartTime();

  // Verifica immediatamente se c'è un errore (ad esempio, manomissione cookie)
  const timeError = await checkTimeLimit();
  if (timeError) {
    showFatalError(timeError.error);
    return;
  }

  // Nascondi il form del codice e mostra il pannello di controllo
  document.getElementById("controlPanel").style.display = "block";
  document.getElementById("authCode").style.display = "none";
  document.getElementById("authCodeh3").style.display = "none";
  document.getElementById("btnCheckCode").style.display = "none";
  document.getElementById("important").style.display = "none";

  // Aggiorna lo stato dei pulsanti
  DEVICES.forEach((device) => updateButtonState(device));
}

// --- Inizializzazione dell'applicazione ---
function init() {
  // Blocca il menu contestuale (tasto destro)
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  // Imposta gli event listener per i pulsanti
  document
    .getElementById("btnCheckCode")
    .addEventListener("click", handleCodeSubmit);

  // Imposta gli event listener per i pulsanti delle porte
  DEVICES.forEach((device) => {
    const button = document.getElementById(device.button_id);
    if (button) {
      button.addEventListener("click", () => activateDevice(device));
    }
  });

  // Controlla se c'è un errore di tempo all'avvio
  checkTimeLimit().then((result) => {
    if (result && result.error) {
      showFatalError(result.error);
    }
  });

  // Controlla periodicamente il limite di tempo
  timeCheckInterval = setInterval(async () => {
    const result = await checkTimeLimit();
    if (result && result.error) {
      showFatalError(result.error);
      clearInterval(timeCheckInterval);
    }
  }, 5000);
}

// Avvia l'applicazione quando il DOM è pronto
document.addEventListener("DOMContentLoaded", init);
