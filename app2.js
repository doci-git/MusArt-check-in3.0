// ====== CONFIG ======
const DEVICES = [
  {
    id: "e4b063f0c38c",
    auth_key:
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    storage_key: "shelly_clicks_left_1",
    button_id: "MainDoor",
    log_id: "log1",
  },
  {
    id: "34945478d595",
    auth_key:
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    storage_key: "shelly_clicks_left_2",
    button_id: "AptDoor",
    log_id: "log2",
  },
];

const MAX_CLICKS = 3;
const BASE_URL_SET =
  "https://shelly-73-eu.shelly.cloud/v2/devices/api/set/switch";
const CORRECT_CODE = "2245";
const TIME_LIMIT_HOURS = 24;
const SECRET_KEY = "s3gr3t0Intern0"; // Cambialo in qualcosa di tuo

// ====== COOKIE UTILS ======
function setCookie(name, value, hours) {
  const d = new Date();
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
}

function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let c of ca) {
    while (c.charAt(0) === " ") c = c.substring(1);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
  }
  return null;
}

// ====== HASH (semplice SHA-256) ======
async function hashString(str) {
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ====== BLOCCO PAGINA ======
function blockPage(message) {
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
  document.body.textContent = message;
  window.stop();
}

// ====== CHECK TEMPO LIMITE ======
async function checkTimeLimit() {
  const startTime = getCookie("usage_start_time");
  const savedHash = getCookie("usage_hash");

  if (!startTime || !savedHash) return false;

  const expectedHash = await hashString(startTime + SECRET_KEY);
  if (expectedHash !== savedHash) {
    blockPage("⚠️ Accesso non valido o cookie manomesso.");
    return true;
  }

  const now = Date.now();
  const hoursPassed = (now - parseInt(startTime, 10)) / (1000 * 60 * 60);
  if (hoursPassed >= TIME_LIMIT_HOURS) {
    blockPage("⏰ Timeout link expired!.");
    return true;
  }
  return false;
}

// ====== CLICK STORAGE ======
function getClicksLeft(storageKey) {
  const stored = localStorage.getItem(storageKey);
  return stored === null ? MAX_CLICKS : parseInt(stored, 10);
}

function setClicksLeft(storageKey, count) {
  localStorage.setItem(storageKey, count);
}

// ====== POPUP ======
function showDevicePopup(device, clicksLeft) {
  const popup = document.getElementById(`popup-${device.button_id}`);
  document.getElementById(`popup-title-${device.button_id}`).innerText =
    device.button_id;
  document.getElementById(`popup-text-${device.button_id}`).innerText =
    clicksLeft > 0
      ? `You have ${clicksLeft} clicks remaining.`
      : `No clicks remaining. Please contact us.`;
  popup.style.display = "block";
}

function closePopup(buttonId) {
  document.getElementById(`popup-${buttonId}`).style.display = "none";
}

// ====== SHELLY CONTROL ======
async function accendiShelly(device) {
  if (await checkTimeLimit()) return;

  let clicksLeft = getClicksLeft(device.storage_key);
  if (clicksLeft <= 0) {
    showDevicePopup(device, clicksLeft);
    return;
  }

  clicksLeft--;
  setClicksLeft(device.storage_key, clicksLeft);
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
      document.getElementById(
        device.log_id
      ).textContent = `Errore HTTP: ${response.status}`;
      return;
    }
    document.getElementById(device.log_id).textContent = "acceso con successo!";
  } catch (err) {
    document.getElementById(
      device.log_id
    ).textContent = `Errore fetch: ${err.message}`;
  }
}

// ====== INIT ======
function abilitaPulsanti() {
  DEVICES.forEach((device) => {
    document.getElementById(device.button_id).onclick = () =>
      accendiShelly(device);
  });
}

document.getElementById("btnCheckCode").onclick = async () => {
  const insertedCode = document.getElementById("authCode").value.trim();
  if (insertedCode === CORRECT_CODE) {
    if (!getCookie("usage_start_time")) {
      const now = Date.now().toString();
      const hash = await hashString(now + SECRET_KEY);
      setCookie("usage_start_time", now, TIME_LIMIT_HOURS);
      setCookie("usage_hash", hash, TIME_LIMIT_HOURS);
    }

    if (await checkTimeLimit()) return;

    document.getElementById("controlPanel").style.display = "block";
    document.getElementById("authCode").style.display = "none";
    document.getElementById("authCodeh3").style.display = "none";
    document.getElementById("btnCheckCode").style.display = "none";
    abilitaPulsanti();
  } else {
    alert("Codice errato!.");
  }
};
