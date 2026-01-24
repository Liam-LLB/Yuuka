const spotifyManualTokenKey = "yuuka_spotify_manual_token_v1";
const spotifyAuthKey = "yuuka_spotify_auth_v1";
const spotifyClientIdKey = "yuuka_spotify_client_id_v1";
const spotifyRedirectKey = "yuuka_spotify_redirect_uri_v1";
const spotifyViewKey = "yuuka_spotify_view_v1";
const spotifyPkceVerifierKey = "yuuka_spotify_pkce_verifier_v1";
const spotifyPkceStateKey = "yuuka_spotify_pkce_state_v1";

const spotifyScopes = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
].join(" ");

const dom = {
  authStatus: document.querySelector("[data-spotify-auth-status]"),
  userLabel: document.querySelector("[data-spotify-user]"),
  hint: document.querySelector("[data-spotify-hint]"),
  clientIdInput: document.querySelector("[data-spotify-client-id]"),
  redirectInput: document.querySelector("[data-spotify-redirect-uri]"),
  tokenInput: document.querySelector("[data-spotify-token]"),
  connectButton: document.querySelector("[data-spotify-connect]"),
  saveButton: document.querySelector("[data-spotify-save]"),
  clearButton: document.querySelector("[data-spotify-clear]"),
  refreshButton: document.querySelector("[data-spotify-refresh]"),
  viewButtons: document.querySelectorAll("[data-spotify-view]"),
  viewPanes: document.querySelectorAll("[data-spotify-view-pane]"),
  searchInput: document.querySelector("[data-spotify-search-input]"),
  featuredGrid: document.querySelector("[data-spotify-featured-grid]"),
  releaseGrid: document.querySelector("[data-spotify-release-grid]"),
  searchTracks: document.querySelector("[data-spotify-search-tracks]"),
  searchPlaylists: document.querySelector("[data-spotify-search-playlists]"),
  libraryGrid: document.querySelector("[data-spotify-library-grid]"),
  libraryPreview: document.querySelector("[data-spotify-library-preview]"),
  nowCover: document.querySelector("[data-spotify-now-cover]"),
  nowTitle: document.querySelector("[data-spotify-now-title]"),
  nowArtist: document.querySelector("[data-spotify-now-artist]"),
  nowAlbum: document.querySelector("[data-spotify-now-album]"),
  toggleButton: document.querySelector("[data-spotify-toggle]"),
  deviceLabel: document.querySelector("[data-spotify-device]"),
  transferButton: document.querySelector("[data-spotify-transfer]"),
  prevButton: document.querySelector("[data-spotify-prev]"),
  nextButton: document.querySelector("[data-spotify-next]"),
  shuffleButton: document.querySelector("[data-spotify-shuffle]"),
  repeatButton: document.querySelector("[data-spotify-repeat]"),
};

let spotifyPlayer = null;
let spotifyDeviceId = null;
let shuffleEnabled = false;
let repeatMode = "off";

const readStorageJson = (key) => {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeStorageJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const setStatus = (label, tone) => {
  if (!dom.authStatus) return;
  dom.authStatus.innerHTML = `<i class="fa-solid fa-circle"></i> ${label}`;
  dom.authStatus.classList.remove("success", "warning", "danger");
  if (tone) dom.authStatus.classList.add(tone);
};

const setHint = (message) => {
  if (!dom.hint) return;
  dom.hint.textContent = message;
};

const getManualToken = () => localStorage.getItem(spotifyManualTokenKey)?.trim();

const storeManualToken = (token) => {
  if (!token) {
    localStorage.removeItem(spotifyManualTokenKey);
    return;
  }
  localStorage.setItem(spotifyManualTokenKey, token);
};

const getAuthData = () => readStorageJson(spotifyAuthKey) || {};

const storeAuthData = (payload) => {
  if (!payload) {
    localStorage.removeItem(spotifyAuthKey);
    return;
  }
  writeStorageJson(spotifyAuthKey, payload);
};

const getClientId = () => localStorage.getItem(spotifyClientIdKey)?.trim();
const getRedirectUri = () => localStorage.getItem(spotifyRedirectKey)?.trim();

const updateInputs = () => {
  if (dom.clientIdInput) dom.clientIdInput.value = getClientId() || "";
  if (dom.redirectInput) dom.redirectInput.value = getRedirectUri() || window.location.href.split("#")[0];
  if (dom.tokenInput) dom.tokenInput.value = getManualToken() || "";
};

const setNowPlaying = ({ title, artist, album, coverUrl }) => {
  if (dom.nowTitle) dom.nowTitle.textContent = title || "Lecture en attente";
  if (dom.nowArtist) dom.nowArtist.textContent = artist || "Choisis un titre pour commencer.";
  if (dom.nowAlbum) dom.nowAlbum.textContent = album || "";
  if (dom.nowCover) {
    dom.nowCover.innerHTML = coverUrl
      ? `<img src="${coverUrl}" alt="${title || "Cover"}" />`
      : '<i class="fa-solid fa-record-vinyl"></i>';
  }
};

const refreshStatus = async () => {
  const token = await getSpotifyToken();
  if (!token) {
    setStatus("Non connecté", "warning");
    if (dom.userLabel) dom.userLabel.textContent = "Connecte ton compte Spotify premium.";
    return;
  }
  setStatus("Connecté", "success");
};

const getSpotifyToken = async () => {
  const manualToken = getManualToken();
  if (manualToken) return manualToken;

  const authData = getAuthData();
  if (authData.access_token && authData.expires_at && Date.now() < authData.expires_at) {
    return authData.access_token;
  }

  if (authData.refresh_token && getClientId()) {
    const refreshed = await refreshAccessToken(authData.refresh_token, getClientId());
    return refreshed?.access_token || null;
  }

  return null;
};

const refreshAccessToken = async (refreshToken, clientId) => {
  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    storeAuthData({
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_at: expiresAt,
      scope: data.scope,
      token_type: data.token_type,
    });
    return data;
  } catch (error) {
    console.error("Erreur de refresh Spotify", error);
    return null;
  }
};

const base64UrlEncode = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const createCodeVerifier = () => {
  const array = new Uint8Array(56);
  window.crypto.getRandomValues(array);
  return Array.from(array)
    .map((value) => (value % 36).toString(36))
    .join("");
};

const createCodeChallenge = async (verifier) => {
  const data = new TextEncoder().encode(verifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
};

const startPkceFlow = async () => {
  const clientId = dom.clientIdInput?.value.trim();
  const redirectUri = dom.redirectInput?.value.trim();
  if (!clientId || !redirectUri) {
    setHint("Ajoute un Client ID et une Redirect URI pour démarrer la connexion.");
    return;
  }

  localStorage.setItem(spotifyClientIdKey, clientId);
  localStorage.setItem(spotifyRedirectKey, redirectUri);

  const verifier = createCodeVerifier();
  const challenge = await createCodeChallenge(verifier);
  const state = Math.random().toString(36).slice(2);

  localStorage.setItem(spotifyPkceVerifierKey, verifier);
  localStorage.setItem(spotifyPkceStateKey, state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: spotifyScopes,
    state,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
};

const exchangeCodeForToken = async (code) => {
  const clientId = getClientId();
  const redirectUri = getRedirectUri();
  const verifier = localStorage.getItem(spotifyPkceVerifierKey);

  if (!clientId || !redirectUri || !verifier) return false;

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: verifier,
      }),
    });

    if (!response.ok) return false;
    const data = await response.json();
    const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;

    storeAuthData({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
      scope: data.scope,
      token_type: data.token_type,
    });

    localStorage.removeItem(spotifyPkceVerifierKey);
    localStorage.removeItem(spotifyPkceStateKey);
    storeManualToken("");
    return true;
  } catch (error) {
    console.error("Erreur d'échange Spotify", error);
    return false;
  }
};

const handleAuthRedirect = async () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const storedState = localStorage.getItem(spotifyPkceStateKey);
  if (!code || !state || state !== storedState) return false;

  const success = await exchangeCodeForToken(code);
  window.history.replaceState({}, document.title, window.location.pathname);
  return success;
};

const spotifyApiFetch = async (endpoint, options = {}) => {
  const token = await getSpotifyToken();
  if (!token) throw new Error("Token manquant");

  const response = await fetch(`https://api.spotify.com/v1/${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Erreur Spotify API");
  }

  if (response.status === 204) return null;
  return response.json();
};

const createMediaCard = (item, type) => {
  const card = document.createElement("div");
  card.className = "spotify-media-card";

  const coverUrl = item.images?.[0]?.url;
  const subtitle = type === "album" ? item.artists?.map((artist) => artist.name).join(", ") : item.owner?.display_name;

  card.innerHTML = `
    <div class="spotify-media-cover">
      ${coverUrl ? `<img src="${coverUrl}" alt="${item.name}" />` : '<i class="fa-solid fa-music"></i>'}
    </div>
    <div class="spotify-media-meta">
      <strong>${item.name}</strong>
      <span>${subtitle || "Spotify"}</span>
    </div>
    <div class="spotify-media-actions">
      <button class="btn" type="button" data-spotify-play-uri="${item.uri}" data-spotify-play-type="${type}">
        <i class="fa-solid fa-play"></i> Lire
      </button>
      <button class="btn ghost" type="button" data-spotify-view="library">
        <i class="fa-solid fa-layer-group"></i> Voir
      </button>
    </div>
  `;

  return card;
};

const createTrackRow = (track) => {
  const li = document.createElement("li");
  li.className = "spotify-track-item";
  const artists = track.artists?.map((artist) => artist.name).join(", ");
  li.innerHTML = `
    <span class="track-index">${track.track_number || "-"}</span>
    <div>
      <strong>${track.name}</strong>
      <span class="spotify-track-meta">${artists || ""} · ${track.album?.name || ""}</span>
    </div>
    <button class="btn ghost" type="button" data-spotify-play-uri="${track.uri}" data-spotify-play-type="track">
      <i class="fa-solid fa-play"></i>
    </button>
  `;
  return li;
};

const renderGrid = (container, items, type, emptyText) => {
  if (!container) return;
  container.innerHTML = "";
  if (!items || !items.length) {
    container.innerHTML = `<div class="spotify-empty"><p>${emptyText}</p></div>`;
    return;
  }
  items.forEach((item) => {
    container.appendChild(createMediaCard(item, type));
  });
};

const renderTracks = (container, tracks, emptyText) => {
  if (!container) return;
  container.innerHTML = "";
  if (!tracks || !tracks.length) {
    container.innerHTML = `<li>${emptyText}</li>`;
    return;
  }
  tracks.forEach((track) => container.appendChild(createTrackRow(track)));
};

const loadHome = async () => {
  const featured = await spotifyApiFetch("browse/featured-playlists?limit=8");
  const releases = await spotifyApiFetch("browse/new-releases?limit=8");
  renderGrid(dom.featuredGrid, featured?.playlists?.items || [], "playlist", "Aucune playlist pour le moment.");
  renderGrid(dom.releaseGrid, releases?.albums?.items || [], "album", "Aucune nouveauté pour le moment.");
};

const loadLibrary = async () => {
  const playlists = await spotifyApiFetch("me/playlists?limit=12");
  renderGrid(dom.libraryGrid, playlists?.items || [], "playlist", "Aucune playlist trouvée.");

  if (dom.libraryPreview) {
    dom.libraryPreview.innerHTML = "";
    const previewItems = playlists?.items?.slice(0, 5) || [];
    if (!previewItems.length) {
      dom.libraryPreview.innerHTML = "<li>Aucune playlist trouvée.</li>";
      return;
    }
    previewItems.forEach((playlist) => {
      const li = document.createElement("li");
      li.textContent = playlist.name;
      dom.libraryPreview.appendChild(li);
    });
  }
};

const performSearch = async (query) => {
  if (!query) {
    renderTracks(dom.searchTracks, [], "Utilise la barre de recherche pour afficher des titres.");
    if (dom.searchPlaylists) dom.searchPlaylists.innerHTML = "";
    return;
  }

  const token = await getSpotifyToken();
  if (!token) {
    setHint("Connecte-toi à Spotify pour lancer une recherche.");
    return;
  }

  const results = await spotifyApiFetch(
    `search?q=${encodeURIComponent(query)}&type=track,playlist&limit=6`
  );

  renderTracks(dom.searchTracks, results?.tracks?.items || [], "Aucun titre trouvé.");
  renderGrid(dom.searchPlaylists, results?.playlists?.items || [], "playlist", "Aucune playlist trouvée.");
};

const loadProfile = async () => {
  try {
    const profile = await spotifyApiFetch("me");
    if (dom.userLabel) {
      dom.userLabel.textContent = profile.display_name
        ? `Connecté : ${profile.display_name}`
        : "Compte Spotify connecté";
    }
  } catch (error) {
    console.error("Erreur profil Spotify", error);
  }
};

const switchView = (view) => {
  localStorage.setItem(spotifyViewKey, view);
  dom.viewButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.spotifyView === view);
  });
  dom.viewPanes.forEach((pane) => {
    const isActive = pane.dataset.spotifyViewPane === view;
    pane.hidden = !isActive;
    pane.classList.toggle("is-active", isActive);
  });
};

const playUri = async (uri, type) => {
  if (!spotifyDeviceId) {
    setHint("Active d'abord la sortie Yuusiques pour lancer la lecture.");
    return;
  }
  try {
    const body = type === "track" ? { uris: [uri] } : { context_uri: uri };
    await spotifyApiFetch(`me/player/play?device_id=${spotifyDeviceId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("Erreur lecture Spotify", error);
    setHint("Impossible de lancer la lecture. Vérifie les scopes de lecture.");
  }
};

const transferPlayback = async () => {
  if (!spotifyDeviceId) {
    setHint("Le player n'est pas prêt. Réessaie dans quelques secondes.");
    return;
  }
  try {
    await spotifyApiFetch("me/player", {
      method: "PUT",
      body: JSON.stringify({ device_ids: [spotifyDeviceId], play: false }),
    });
    setHint("Sortie Yuusiques activée. Tu peux lancer un titre.");
  } catch (error) {
    console.error("Erreur transfert Spotify", error);
    setHint("Impossible d'activer la sortie. Vérifie ton compte premium.");
  }
};

const initPlayer = () => {
  if (!window.Spotify || spotifyPlayer) return;
  const tokenProvider = async (cb) => {
    const token = await getSpotifyToken();
    if (token) cb(token);
  };

  spotifyPlayer = new Spotify.Player({
    name: "Yuusiques Web Player",
    getOAuthToken: tokenProvider,
    volume: 0.7,
  });

  spotifyPlayer.addListener("ready", ({ device_id }) => {
    spotifyDeviceId = device_id;
    if (dom.deviceLabel) {
      dom.deviceLabel.textContent = `Appareil Spotify : ${device_id}`;
    }
    setHint("Active la sortie Yuusiques pour écouter dans cette page.");
  });

  spotifyPlayer.addListener("not_ready", ({ device_id }) => {
    if (dom.deviceLabel) {
      dom.deviceLabel.textContent = `Appareil déconnecté : ${device_id}`;
    }
  });

  spotifyPlayer.addListener("player_state_changed", (state) => {
    if (!state) return;
    const track = state.track_window.current_track;
    setNowPlaying({
      title: track?.name,
      artist: track?.artists?.map((artist) => artist.name).join(", "),
      album: track?.album?.name,
      coverUrl: track?.album?.images?.[0]?.url,
    });

    if (dom.toggleButton) {
      const icon = dom.toggleButton.querySelector("i");
      const label = dom.toggleButton.querySelector("span");
      if (icon) icon.className = `fa-solid fa-${state.paused ? "play" : "pause"}`;
      if (label) label.textContent = state.paused ? "Play" : "Pause";
    }
  });

  spotifyPlayer.connect();
};

const initData = async () => {
  const token = await getSpotifyToken();
  if (!token) return;

  await refreshStatus();
  await loadProfile();

  try {
    await Promise.all([loadHome(), loadLibrary()]);
  } catch (error) {
    console.error("Erreur chargement Spotify", error);
    setHint("Impossible de charger certaines données Spotify.");
  }
};

const handleControls = () => {
  if (dom.toggleButton) {
    dom.toggleButton.addEventListener("click", () => {
      spotifyPlayer?.togglePlay();
    });
  }
  dom.prevButton?.addEventListener("click", () => spotifyPlayer?.previousTrack());
  dom.nextButton?.addEventListener("click", () => spotifyPlayer?.nextTrack());

  dom.shuffleButton?.addEventListener("click", async () => {
    shuffleEnabled = !shuffleEnabled;
    try {
      await spotifyApiFetch(`me/player/shuffle?state=${shuffleEnabled}`, { method: "PUT" });
      dom.shuffleButton.classList.toggle("is-active", shuffleEnabled);
    } catch (error) {
      console.error("Erreur shuffle", error);
    }
  });

  dom.repeatButton?.addEventListener("click", async () => {
    repeatMode = repeatMode === "off" ? "context" : repeatMode === "context" ? "track" : "off";
    try {
      await spotifyApiFetch(`me/player/repeat?state=${repeatMode}`, { method: "PUT" });
    } catch (error) {
      console.error("Erreur repeat", error);
    }
  });

  dom.transferButton?.addEventListener("click", transferPlayback);
};

const bindEvents = () => {
  dom.saveButton?.addEventListener("click", () => {
    const clientId = dom.clientIdInput?.value.trim();
    const redirectUri = dom.redirectInput?.value.trim();
    const token = dom.tokenInput?.value.trim();
    if (clientId) localStorage.setItem(spotifyClientIdKey, clientId);
    if (redirectUri) localStorage.setItem(spotifyRedirectKey, redirectUri);
    storeManualToken(token);
    setHint("Paramètres enregistrés. Lance la connexion ou recharge les données.");
    refreshStatus();
  });

  dom.clearButton?.addEventListener("click", () => {
    storeManualToken("");
    storeAuthData(null);
    setHint("Tokens effacés. Ajoute de nouvelles infos pour te reconnecter.");
    refreshStatus();
  });

  dom.connectButton?.addEventListener("click", startPkceFlow);
  dom.refreshButton?.addEventListener("click", initData);

  if (dom.searchInput) {
    let debounceId = null;
    dom.searchInput.addEventListener("input", (event) => {
      const query = event.target.value.trim();
      clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        performSearch(query).catch((error) => console.error(error));
      }, 350);
    });
  }

  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-spotify-view]");
    if (viewButton) {
      switchView(viewButton.dataset.spotifyView);
    }

    const button = event.target.closest("[data-spotify-play-uri]");
    if (!button) return;
    const uri = button.dataset.spotifyPlayUri;
    const type = button.dataset.spotifyPlayType;
    playUri(uri, type);
  });
};

const init = async () => {
  updateInputs();
  bindEvents();
  handleControls();
  initPlayer();

  const restoredView = localStorage.getItem(spotifyViewKey) || "home";
  switchView(restoredView);

  const authSuccess = await handleAuthRedirect();
  if (authSuccess) {
    setHint("Connexion Spotify réussie. Tu peux naviguer et écouter maintenant.");
  }

  await refreshStatus();
  await initData();
};

window.onSpotifyWebPlaybackSDKReady = () => {
  initPlayer();
};

init();
