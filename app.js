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
const accountState = document.querySelector("[data-account-state]");
const googleSignInButtons = document.querySelectorAll("[data-google-signin]");
const signOutButtons = document.querySelectorAll("[data-signout]");
const loginRedirectKey = "yuuka_login_redirect_v1";
const loginStatusKey = "yuuka_login_status_v1";
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
      item.style.transform = `translate3d(0, ${offset}px, ${depth * 120}px) rotateX(${depth * 10}deg) rotateY(${depth * -8}deg)`;
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
  initParallax();
  initScrollColors();
  hydrateLoginBanner();
  const ready = await initFirebase();
  if (ready) {
    bindAuthObservers();
  }
};

init();
