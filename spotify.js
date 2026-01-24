const spotifyTokenStorageKey = "yuuka_spotify_token_v1";
const defaultSpotifyToken = "BQATGBCUsBv6l3QjZ66RPMgV320qwM64C-CIq_vXmmMQPPP87S7suhq3e7IB5Wn2ED-1O1tZL_LUBLHfSn-i0xWWE2lEo4gA8r2PGT5A2TPUuKKVUJpaifu-xiF4eEUyCN0TaOvVonQ1ji7eXWca5B00RcRGxbE3ZtctHoHZ8X-WoXTOHePLGVpVSYcBUst9BMTe9C9xNjd0JC18riN2fCvS3JTj0hbFp_a0Fftb2Mu0oOmMqW30ZB9-UCr-vZZwxnboOF9M6TWpuKbRPFDwhqMwm60wMBL-6M7_mtPY24I_8stUC4q2bwmc9s2U3QA1EnAHQICQmF_huEaZK87lRsVsuwIH2QiIswCR34eIYNQwoRC-iJIMU3b8a7MgkDm2zSyqRoPTE2dFJU1Fo1-vt5o0nq4";

const getSpotifyToken = () => {
  const stored = localStorage.getItem(spotifyTokenStorageKey);
  return stored?.trim() || defaultSpotifyToken;
};

const setStatus = (element, label, tone) => {
  if (!element) return;
  element.innerHTML = `<i class="fa-solid fa-bolt"></i> ${label}`;
  element.classList.remove("success", "warning", "danger");
  if (tone) {
    element.classList.add(tone);
  }
};

window.onSpotifyWebPlaybackSDKReady = () => {
  const statusBadge = document.querySelector("[data-spotify-status]");
  const deviceLabel = document.querySelector("[data-spotify-device]");
  const hint = document.querySelector("[data-spotify-hint]");
  const toggleButton = document.querySelector("[data-spotify-toggle]");
  const toggleIcon = toggleButton?.querySelector("i");
  const toggleLabel = toggleButton?.querySelector("span");
  const token = getSpotifyToken();

  if (!token) {
    setStatus(statusBadge, "Token manquant", "danger");
    if (hint) {
      hint.textContent = "Ajoute un token Spotify valide pour activer la lecture Web Playback SDK.";
    }
    return;
  }

  const player = new Spotify.Player({
    name: "Yuusiques Web Player",
    getOAuthToken: (cb) => cb(token),
    volume: 0.6,
  });

  player.addListener("ready", ({ device_id }) => {
    setStatus(statusBadge, "Connecté à Spotify", "success");
    if (deviceLabel) {
      deviceLabel.textContent = `Appareil Spotify : ${device_id}`;
    }
    if (hint) {
      hint.textContent = "Sélectionne “Yuusiques Web Player” dans Spotify Connect pour écouter ici.";
    }
  });

  player.addListener("not_ready", ({ device_id }) => {
    setStatus(statusBadge, "Hors ligne", "warning");
    if (deviceLabel) {
      deviceLabel.textContent = `Appareil déconnecté : ${device_id}`;
    }
  });

  player.addListener("initialization_error", ({ message }) => {
    console.error(message);
    setStatus(statusBadge, "Erreur d'initialisation", "danger");
  });

  player.addListener("authentication_error", ({ message }) => {
    console.error(message);
    setStatus(statusBadge, "Erreur d'authentification", "danger");
  });

  player.addListener("account_error", ({ message }) => {
    console.error(message);
    setStatus(statusBadge, "Erreur de compte", "danger");
  });

  player.addListener("player_state_changed", (state) => {
    if (!state || !toggleButton) return;
    const isPaused = state.paused;
    if (toggleIcon) {
      toggleIcon.className = `fa-solid fa-${isPaused ? "play" : "pause"}`;
    }
    if (toggleLabel) {
      toggleLabel.textContent = isPaused ? "Play" : "Pause";
    }
  });

  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      player.togglePlay();
    });
  }

  player.connect();
};
