const DEVICES = [
  {
    id: "e4b063f0c38c",
    auth_key:
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    storage_key: "shelly_clicks_left_1",
    button_id: "MainDoor",
    log_id: "log1",
    popup_id: "popup_MainDoor",
  },
  {
    id: "34945478d595",
    auth_key:
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    storage_key: "shelly_clicks_left_2",
    button_id: "AptDoor",
    log_id: "log2",
    popup_id: "popup_AptDoor",
  },
];

const MAX_CLICKS = 30;
const BASE_URL_SET =
  "https://shelly-73-eu.shelly.cloud/v2/devices/api/set/switch";
const CORRECT_CODE = "2245";

// PROVA: tempo massimo 1 minuto
const TIME_LIMIT_MINUTES = 1;

// ========== BLOCCO TOTALE ==========
function blockPageCompletely() {
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
  document.body.textContent = "⏰ Tempo di prova scaduto! Pagina bloccata.";
  window.stop();
}

function checkTimeLimit() {
  const startTime = localStorage.getItem("usage_start_time");
  if (!startTime) return false;
  const elapsedMinutes = (Date.now() - parseInt(startTime, 10)) / (1000 * 60);
  if (elapsedMinutes >= TIME_LIMIT_MINUTES) {
    blockPageCompletely();
    return true;
  }
  return false;
}

// ========== GESTIONE CLICK ==========
function log(msg, logElementId) {
  document.getElementById(logElementId).textContent = msg;
}

function getClicksLeft(storageKey) {
  const stored = localStorage.getItem(storageKey);
  return stored === null ? MAX_CLICKS : parseInt(stored, 10);
}

function setClicksLeft(storageKey, count) {
  localStorage.setItem(storageKey, count);
}

function showDevicePopup(popupId, clicksLeft) {
  const popup = document.getElementById(popupId);
  if (!popup) return;
  popup.querySelector(".popup-message").textContent =
    clicksLeft <= 0
      ? "Hai esaurito i click. Contatta il supporto."
      : `Ti restano ${clicksLeft} click.`;
  popup.style.display = "flex";
}

function closeAllPopups() {
  document.querySelectorAll(".popup").forEach((p) => {
    p.style.display = "none";
  });
}

function aggiornaStatoPulsante(clicksLeft, buttonId, popupId) {
  const btn = document.getElementById(buttonId);
  if (clicksLeft <= 0) {
    btn.disabled = true;
    showDevicePopup(popupId, clicksLeft);
  } else {
    btn.disabled = false;
  }
}

async function accendiShelly(device) {
  if (checkTimeLimit()) return;

  if (!localStorage.getItem("usage_start_time")) {
    localStorage.setItem("usage_start_time", Date.now());
  }

  let clicksLeft = getClicksLeft(device.storage_key);
  if (clicksLeft <= 0) {
    aggiornaStatoPulsante(clicksLeft, device.button_id, device.popup_id);
    return;
  }

  clicksLeft--;
  setClicksLeft(device.storage_key, clicksLeft);
  aggiornaStatoPulsante(clicksLeft, device.button_id, device.popup_id);

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

function abilitaPulsanti() {
  DEVICES.forEach((device) => {
    aggiornaStatoPulsante(
      getClicksLeft(device.storage_key),
      device.button_id,
      device.popup_id
    );
    document.getElementById(device.button_id).onclick = () =>
      accendiShelly(device);
  });
}

document.getElementById("btnCheckCode").onclick = () => {
  if (checkTimeLimit()) return;

  const insertedCode = document.getElementById("authCode").value.trim();
  if (insertedCode === CORRECT_CODE) {
    document.getElementById("controlPanel").style.display = "block";
    document.getElementById("authCode").style.display = "none";
    document.getElementById("authCodeh3").style.display = "none";
    document.getElementById("btnCheckCode").style.display = "none";
    abilitaPulsanti();
    document.getElementById("authCode").disabled = true;
    document.getElementById("btnCheckCode").disabled = true;
  } else {
    alert("Codice errato!.");
  }
};

// Avvio
if (!checkTimeLimit()) {
  closeAllPopups();
}
