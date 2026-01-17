// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCGQDW5I7kRgZR3wgQ1UeB4GRtVCPxstOs",
  authDomain: "yuukalerie.firebaseapp.com",
  projectId: "yuukalerie",
  storageBucket: "yuukalerie.firebasestorage.app",
  messagingSenderId: "323287958771",
  appId: "1:323287958771:web:3b304cc81fd312e4f8a386"
};

let auth = null;
let db = null;
let authApi = null;
let firestoreApi = null;
let firebaseReady = false;

const progressKey = "yuuka_progress_v1";

const progressEls = {
  page: document.getElementById("progressPage"),
  time: document.getElementById("progressTime"),
  status: document.getElementById("progressStatus"),
};

const authMessage = document.getElementById("authMessage");
const userEmail = document.getElementById("userEmail");
const googleSignInBtn = document.getElementById("googleSignInBtn");
const userChips = document.querySelectorAll("[data-user-chip]");
const profileTriggerLabel = document.querySelector("[data-profile-trigger-label]");
const profileName = document.querySelector("[data-profile-name]");
const profileEmail = document.querySelector("[data-profile-email]");
const profileSettings = document.querySelector("[data-profile-settings]");
const accountTriggers = document.querySelectorAll("[data-account-trigger]");
const accountModal = document.querySelector("[data-account-modal]");
const accountCloseButtons = document.querySelectorAll("[data-account-close]");
const themeTriggers = document.querySelectorAll("[data-theme-trigger]");
const themeModal = document.querySelector("[data-theme-modal]");
const themeCloseButtons = document.querySelectorAll("[data-theme-close]");
const themeOptions = document.querySelectorAll("[data-theme-option]");
const themeLabel = document.querySelector("[data-theme-label]");
const historyTriggers = document.querySelectorAll("[data-history-trigger]");
const historyModal = document.querySelector("[data-history-modal]");
const historyCloseButtons = document.querySelectorAll("[data-history-close]");
const accountState = document.querySelector("[data-account-state]");
const googleSignInButtons = document.querySelectorAll("[data-google-signin]");
const signOutButtons = document.querySelectorAll("[data-signout]");
const loginRedirectKey = "yuuka_login_redirect_v1";
const loginStatusKey = "yuuka_login_status_v1";
const themeStorageKey = "yuuka_theme_choice_v1";
const currentPath = window.location.pathname;
const isHomePage = currentPath.endsWith("/") || currentPath.endsWith("index.html");
const isAuthPage = window.location.pathname.endsWith("connexion.html");
const loginBanner = document.querySelector("[data-login-banner]");

const setMessage = (message, tone = "") => {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.className = `alert ${tone}`.trim();
};

const setProgressStatus = (status) => {
  if (progressEls.status) progressEls.status.textContent = status;
};

const storeLoginStatus = (payload) => {
  if (!payload) return;
  localStorage.setItem(loginStatusKey, JSON.stringify(payload));
};

const renderLoginBanner = (payload) => {
  if (!isHomePage || !loginBanner || !payload) return;
  loginBanner.classList.remove("is-success", "is-error");
  if (payload.status === "success") {
    loginBanner.textContent = `✅ Connecté : ${payload.name}`;
    loginBanner.classList.add("is-success");
  } else if (payload.status === "signed-out") {
    loginBanner.textContent = "❌ Tu es déconnecté.";
    loginBanner.classList.add("is-error");
  }
  loginBanner.hidden = false;
};

const getUserLabel = (user) => (user ? (user.displayName || user.email) : "Se connecter");

const updateUserChips = (user) => {
  const label = user ? "Connecté" : "Invité";
  userChips.forEach((chip) => {
    chip.textContent = label;
  });
};

const updateProfileMenu = (user) => {
  const signedIn = Boolean(user);
  if (profileTriggerLabel) {
    profileTriggerLabel.textContent = signedIn ? getUserLabel(user) : "Se connecter";
  }
  if (profileName) {
    profileName.textContent = signedIn ? (user.displayName || user.email) : "Invité";
  }
  if (profileEmail) {
    profileEmail.textContent = signedIn ? user.email : "Connecte-toi avec Google pour synchroniser.";
  }
  if (profileSettings) {
    profileSettings.hidden = !signedIn;
  }
  googleSignInButtons.forEach((button) => {
    button.hidden = signedIn;
  });
  signOutButtons.forEach((button) => {
    button.hidden = !signedIn;
  });
  if (accountState) {
    accountState.textContent = signedIn ? "En ligne" : "Invité";
  }
};

const saveProgressLocal = (data) => {
  localStorage.setItem(progressKey, JSON.stringify(data));
};

const readProgressLocal = () => {
  const stored = localStorage.getItem(progressKey);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

const updateProgressUI = (data) => {
  if (!data) return;
  if (progressEls.page) progressEls.page.textContent = data.page || "-";
  if (progressEls.time) progressEls.time.textContent = data.updatedAt ? new Date(data.updatedAt).toLocaleString("fr-FR") : "-";
  if (progressEls.status && data.source) progressEls.status.textContent = data.source;
};

const syncProgressToCloud = async (user, data) => {
  if (!user || !firebaseReady || !firestoreApi || !db) return true;
  try {
    await firestoreApi.setDoc(
      firestoreApi.doc(db, "progress", user.uid),
      {
        ...data,
        uid: user.uid,
        updatedAt: data.updatedAt || new Date().toISOString(),
        syncedAt: firestoreApi.serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error("Synchronisation Firebase impossible", error);
    setMessage("Synchronisation impossible pour le moment. Mode local activé.", "warning");
    return false;
  }
};

const fetchProgressFromCloud = async (user) => {
  if (!firebaseReady || !firestoreApi || !db) return null;
  try {
    const snap = await firestoreApi.getDoc(firestoreApi.doc(db, "progress", user.uid));
    if (!snap.exists()) return null;
    return snap.data();
  } catch (error) {
    console.error("Lecture Firebase impossible", error);
    setMessage("Lecture des données impossible. Mode local activé.", "warning");
    return null;
  }
};

const updateProgress = async (page) => {
  if (!page) return;
  const data = { page, updatedAt: new Date().toISOString(), source: "Local" };
  saveProgressLocal(data);
  updateProgressUI(data);
  if (auth?.currentUser) {
    const synced = await syncProgressToCloud(auth.currentUser, data);
    if (synced) {
      data.source = "Synchronisé";
      updateProgressUI(data);
    }
  }
};

const pageName = document.body?.dataset?.page;
if (pageName) {
  updateProgress(pageName);
}

const ensureAuthReady = () => {
  if (!firebaseReady || !authApi || !auth) {
    setMessage("Connexion indisponible pour le moment. Mode invité activé.", "warning");
    return false;
  }
  return true;
};

const handleGoogleSignIn = async () => {
  if (!ensureAuthReady()) return;
  if (!isAuthPage) {
    sessionStorage.setItem(loginRedirectKey, window.location.href);
  }
  const provider = new authApi.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await authApi.signInWithRedirect(auth, provider);
  } catch (error) {
    setMessage(`Connexion Google échouée : ${error.message}`);
  }
};

googleSignInBtn?.addEventListener("click", handleGoogleSignIn);
googleSignInButtons.forEach((button) => {
  button.addEventListener("click", handleGoogleSignIn);
});

signOutButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    if (!ensureAuthReady()) return;
    await authApi.signOut(auth);
    setMessage("Déconnexion réussie.", "success");
    storeLoginStatus({
      status: "signed-out",
      updatedAt: new Date().toISOString(),
    });
  });
});

const toTimestamp = (value) => {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const mergeProgress = async (user) => {
  const localProgress = readProgressLocal();
  if (!user) {
    if (localProgress) updateProgressUI(localProgress);
    return;
  }
  const cloudProgress = await fetchProgressFromCloud(user);
  const localTime = toTimestamp(localProgress?.updatedAt);
  const cloudTime = toTimestamp(cloudProgress?.updatedAt);
  if (localTime === 0 && cloudTime === 0) return;

  if (localTime >= cloudTime) {
    const next = {
      page: localProgress?.page || cloudProgress?.page,
      updatedAt: localProgress?.updatedAt || cloudProgress?.updatedAt,
      source: "Synchronisé",
    };
    updateProgressUI(next);
    saveProgressLocal(next);
    await syncProgressToCloud(user, next);
  } else {
    const next = {
      page: cloudProgress.page,
      updatedAt: cloudProgress.updatedAt,
      source: "Synchronisé",
    };
    updateProgressUI(next);
    saveProgressLocal(next);
  }
};

const bindAuthObservers = () => {
  authApi.onAuthStateChanged(auth, async (user) => {
    updateUserChips(user);
    updateProfileMenu(user);
    if (userEmail) {
      userEmail.textContent = user ? user.email : "Aucun compte connecté";
    }
    if (user && isAuthPage) {
      const redirectTarget = sessionStorage.getItem(loginRedirectKey);
      if (redirectTarget) {
        storeLoginStatus({
          status: "success",
          name: user.displayName || user.email || "Compte Google",
          updatedAt: new Date().toISOString(),
        });
        sessionStorage.removeItem(loginRedirectKey);
        window.location.href = redirectTarget;
        return;
      }
    }
    await mergeProgress(user);
  });

  authApi.getRedirectResult(auth)
    .then((result) => {
      if (!result) return;
      const action = result.operationType === "link" ? "Compte Google associé à ton profil." : "Connexion Google réussie.";
      setMessage(action, "success");
      storeLoginStatus({
        status: "success",
        name: result.user?.displayName || result.user?.email || "Compte Google",
        updatedAt: new Date().toISOString(),
      });
      renderLoginBanner({
        status: "success",
        name: result.user?.displayName || result.user?.email || "Compte Google",
      });
    })
    .catch((error) => {
      if (!error) return;
      setMessage(`Connexion Google échouée : ${error.message}`);
    });
};

const hydrateLoginBanner = () => {
  if (!isHomePage || !loginBanner) return;
  const raw = localStorage.getItem(loginStatusKey);
  if (!raw) return;
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    localStorage.removeItem(loginStatusKey);
    return;
  }
  if (!payload) return;
  renderLoginBanner(payload);
  localStorage.removeItem(loginStatusKey);
};

const storedProgress = readProgressLocal();
if (storedProgress) {
  updateProgressUI(storedProgress);
}

const initFirebase = async () => {
  const [appModule, authModule, firestoreModule] = await Promise.allSettled([
    import("https://www.gstatic.com/firebasejs/10.3.1/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.3.1/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js"),
  ]);

  if (appModule.status !== "fulfilled" || authModule.status !== "fulfilled" || firestoreModule.status !== "fulfilled") {
    setProgressStatus("Local (hors ligne)");
    setMessage("Connexion distante indisponible. Tes données restent en local.", "warning");
    return false;
  }

  const { initializeApp } = appModule.value;
  authApi = authModule.value;
  firestoreApi = firestoreModule.value;

  const app = initializeApp(firebaseConfig);
  auth = authApi.getAuth(app);
  try {
    await authApi.setPersistence(auth, authApi.browserLocalPersistence);
  } catch (error) {
    console.error("Persistance Firebase impossible", error);
    setMessage("Connexion persistante indisponible. Mode local activé.", "warning");
  }
  db = firestoreApi.getFirestore(app);
  firebaseReady = true;
  return true;
};

const initAccountModal = () => {
  if (!accountModal) return;
  const openModal = () => {
    accountModal.classList.add("is-visible");
    document.body.classList.add("is-locked");
  };
  const closeModal = () => {
    accountModal.classList.remove("is-visible");
    document.body.classList.remove("is-locked");
  };
  accountTriggers.forEach((trigger) => {
    trigger.addEventListener("click", openModal);
  });
  accountCloseButtons.forEach((button) => {
    button.addEventListener("click", closeModal);
  });
  accountModal.addEventListener("click", (event) => {
    if (event.target === accountModal) {
      closeModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
};

const themePresets = {
  aurore: {
    label: "Aurore brumeuse",
    vars: {
      "--bg": "#0b1120",
      "--bg-soft": "#0f172a",
      "--panel": "rgba(15, 23, 42, 0.88)",
      "--panel-strong": "rgba(15, 23, 42, 0.96)",
      "--card": "rgba(30, 41, 59, 0.82)",
      "--border": "rgba(148, 163, 184, 0.2)",
      "--text": "#e2e8f0",
      "--muted": "#94a3b8",
      "--btn-from": "#2563eb",
      "--btn-to": "#7c3aed",
      "--btn-shadow": "rgba(37, 99, 235, 0.35)",
      "--btn-text": "#ffffff",
      "--btn-ghost-bg": "rgba(255, 255, 255, 0.06)",
      "--btn-ghost-border": "rgba(255, 255, 255, 0.12)",
      "--btn-ghost-hover": "rgba(96, 165, 250, 0.12)",
      "--btn-ghost-text": "#e2e8f0",
      "--ambient-1": "96 165 250",
      "--ambient-2": "168 85 247",
      "--ambient-3": "34 197 94",
    },
  },
  perle: {
    label: "Perle lilas",
    vars: {
      "--bg": "#120b1d",
      "--bg-soft": "#1a1327",
      "--panel": "rgba(20, 14, 32, 0.88)",
      "--panel-strong": "rgba(24, 16, 36, 0.96)",
      "--card": "rgba(33, 25, 49, 0.82)",
      "--border": "rgba(183, 165, 207, 0.2)",
      "--text": "#ebe6f6",
      "--muted": "#b6a6d6",
      "--btn-from": "#7c3aed",
      "--btn-to": "#c084fc",
      "--btn-shadow": "rgba(124, 58, 237, 0.35)",
      "--btn-text": "#ffffff",
      "--btn-ghost-bg": "rgba(255, 255, 255, 0.08)",
      "--btn-ghost-border": "rgba(255, 255, 255, 0.18)",
      "--btn-ghost-hover": "rgba(192, 132, 252, 0.18)",
      "--btn-ghost-text": "#f5f3ff",
      "--ambient-1": "156 121 201",
      "--ambient-2": "203 153 229",
      "--ambient-3": "126 164 209",
    },
  },
  lagon: {
    label: "Lagon doux",
    vars: {
      "--bg": "#091818",
      "--bg-soft": "#0f2424",
      "--panel": "rgba(10, 26, 26, 0.88)",
      "--panel-strong": "rgba(12, 30, 30, 0.96)",
      "--card": "rgba(18, 38, 38, 0.82)",
      "--border": "rgba(140, 196, 192, 0.2)",
      "--text": "#d8f1ef",
      "--muted": "#9bbfbb",
      "--btn-from": "#0f766e",
      "--btn-to": "#14b8a6",
      "--btn-shadow": "rgba(20, 184, 166, 0.3)",
      "--btn-text": "#ffffff",
      "--btn-ghost-bg": "rgba(210, 250, 244, 0.08)",
      "--btn-ghost-border": "rgba(210, 250, 244, 0.2)",
      "--btn-ghost-hover": "rgba(45, 212, 191, 0.18)",
      "--btn-ghost-text": "#e0f2f1",
      "--ambient-1": "95 177 173",
      "--ambient-2": "126 204 198",
      "--ambient-3": "82 143 136",
    },
  },
  sable: {
    label: "Sable nocturne",
    vars: {
      "--bg": "#15100d",
      "--bg-soft": "#221814",
      "--panel": "rgba(23, 18, 15, 0.88)",
      "--panel-strong": "rgba(28, 21, 18, 0.96)",
      "--card": "rgba(36, 27, 22, 0.82)",
      "--border": "rgba(204, 177, 146, 0.2)",
      "--text": "#f2e8dc",
      "--muted": "#c6b3a2",
      "--btn-from": "#b45309",
      "--btn-to": "#a16207",
      "--btn-shadow": "rgba(180, 83, 9, 0.32)",
      "--btn-text": "#ffffff",
      "--btn-ghost-bg": "rgba(255, 255, 255, 0.08)",
      "--btn-ghost-border": "rgba(255, 255, 255, 0.18)",
      "--btn-ghost-hover": "rgba(251, 191, 36, 0.18)",
      "--btn-ghost-text": "#fef3c7",
      "--ambient-1": "201 166 130",
      "--ambient-2": "168 137 112",
      "--ambient-3": "122 97 78",
    },
  },
  clair: {
    label: "Éclat clair",
    vars: {
      "--bg": "#f8fafc",
      "--bg-soft": "#eef2f7",
      "--panel": "rgba(255, 255, 255, 0.9)",
      "--panel-strong": "rgba(255, 255, 255, 0.98)",
      "--card": "rgba(241, 245, 249, 0.9)",
      "--border": "rgba(148, 163, 184, 0.4)",
      "--text": "#0f172a",
      "--muted": "#475569",
      "--btn-from": "#2563eb",
      "--btn-to": "#60a5fa",
      "--btn-shadow": "rgba(37, 99, 235, 0.25)",
      "--btn-text": "#ffffff",
      "--btn-ghost-bg": "rgba(15, 23, 42, 0.08)",
      "--btn-ghost-border": "rgba(15, 23, 42, 0.18)",
      "--btn-ghost-hover": "rgba(37, 99, 235, 0.16)",
      "--btn-ghost-text": "#0f172a",
      "--ambient-1": "59 130 246",
      "--ambient-2": "249 115 22",
      "--ambient-3": "34 197 94",
    },
  },
};

const applyTheme = (key, persist = true) => {
  const theme = themePresets[key];
  if (!theme) return;
  Object.entries(theme.vars).forEach(([name, value]) => {
    document.documentElement.style.setProperty(name, value);
  });
  document.documentElement.dataset.theme = key;
  themeOptions.forEach((option) => {
    option.classList.toggle("is-active", option.dataset.themeOption === key);
  });
  if (themeLabel) {
    themeLabel.textContent = theme.label;
  }
  if (persist) {
    localStorage.setItem(themeStorageKey, key);
  }
};

const initThemeModal = () => {
  if (!themeModal) return;
  const openModal = () => {
    themeModal.classList.add("is-visible");
    document.body.classList.add("is-locked");
  };
  const closeModal = () => {
    themeModal.classList.remove("is-visible");
    document.body.classList.remove("is-locked");
  };
  themeTriggers.forEach((trigger) => {
    trigger.addEventListener("click", openModal);
  });
  themeCloseButtons.forEach((button) => {
    button.addEventListener("click", closeModal);
  });
  themeModal.addEventListener("click", (event) => {
    if (event.target === themeModal) {
      closeModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
  themeOptions.forEach((option) => {
    option.addEventListener("click", () => {
      applyTheme(option.dataset.themeOption);
    });
  });
};

const initHistoryModal = () => {
  if (!historyModal) return;
  const openModal = () => {
    historyModal.classList.add("is-visible");
    document.body.classList.add("is-locked");
  };
  const closeModal = () => {
    historyModal.classList.remove("is-visible");
    document.body.classList.remove("is-locked");
  };
  historyTriggers.forEach((trigger) => {
    trigger.addEventListener("click", openModal);
  });
  historyCloseButtons.forEach((button) => {
    button.addEventListener("click", closeModal);
  });
  historyModal.addEventListener("click", (event) => {
    if (event.target === historyModal) {
      closeModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
  const currentVersion = "v3.1";
  const currentLabel = historyModal.querySelector("[data-current-version]");
  if (currentLabel) currentLabel.textContent = currentVersion;
  historyModal.querySelectorAll("[data-version]").forEach((item) => {
    item.classList.toggle("is-current", item.dataset.version === currentVersion);
  });
};

const initAccessGate = () => {
  const accessKey = "yuuka_access_granted_v1";
  if (localStorage.getItem(accessKey)) return;
  const gate = document.createElement("div");
  gate.className = "access-gate is-visible";
  gate.dataset.accessGate = "true";
  gate.innerHTML = `
    <div class="access-card">
      <span class="eyebrow"><i class="fa-solid fa-lock"></i> Accès sécurisé</span>
      <h1 class="main-title">Bienvenue sur Yuukonline</h1>
      <p class="subtitle">Entre le mot de passe pour passer à l'accueil.</p>
      <form class="access-form" data-access-form>
        <div class="field">
          <label for="accessPassword">Mot de passe</label>
          <input type="password" id="accessPassword" name="accessPassword" placeholder="Mot de passe" required />
        </div>
        <button class="btn" type="submit"><i class="fa-solid fa-arrow-right-to-bracket"></i> Entrer</button>
        <p class="access-error" data-access-error hidden>Mot de passe incorrect. Réessaie.</p>
      </form>
    </div>
  `;
  document.body.appendChild(gate);
  document.body.classList.add("is-locked");
  const form = gate.querySelector("[data-access-form]");
  const error = gate.querySelector("[data-access-error]");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = gate.querySelector("#accessPassword");
    if (input?.value === "Pigeon") {
      localStorage.setItem(accessKey, "granted");
      gate.classList.remove("is-visible");
      document.body.classList.remove("is-locked");
      gate.remove();
      return;
    }
    if (error) error.hidden = false;
    if (input) {
      input.value = "";
      input.focus();
    }
  });
};

const initParallax = () => {
  const items = Array.from(document.querySelectorAll("[data-parallax]"));
  if (!items.length) return;
  const update = () => {
    const scrollY = window.scrollY;
    items.forEach((item) => {
      const depth = Number(item.dataset.depth || 0.1);
      const offset = scrollY * depth;
      item.style.setProperty("--parallax-y", `${offset}px`);
      item.style.setProperty("--parallax-z", `${depth * 120}px`);
    });
  };
  update();
  window.addEventListener("scroll", () => {
    window.requestAnimationFrame(update);
  }, { passive: true });
  window.addEventListener("resize", update);
};

const initScrollColors = () => {
  const root = document.documentElement;
  const update = () => {
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? Math.min(window.scrollY / maxScroll, 1) : 0;
    const hue = 218 + progress * 90;
    const hue2 = (hue + 70) % 360;
    const shift = Math.round(progress * 120);
    root.style.setProperty("--scroll-hue", hue.toFixed(1));
    root.style.setProperty("--scroll-hue-2", hue2.toFixed(1));
    root.style.setProperty("--scroll-shift", `${shift}px`);
  };
  update();
  window.addEventListener("scroll", () => {
    window.requestAnimationFrame(update);
  }, { passive: true });
  window.addEventListener("resize", update);
};

const init = async () => {
  initAccessGate();
  initAccountModal();
  initThemeModal();
  initHistoryModal();
  initParallax();
  initScrollColors();
  hydrateLoginBanner();
  const storedTheme = localStorage.getItem(themeStorageKey);
  if (storedTheme && themePresets[storedTheme]) {
    applyTheme(storedTheme, false);
  } else {
    applyTheme("aurore", false);
  }
  const ready = await initFirebase();
  if (ready) {
    bindAuthObservers();
  }
};

init();
