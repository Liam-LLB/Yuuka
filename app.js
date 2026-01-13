import { initializeApp } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithRedirect,
  linkWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.3.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js";

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCGQDW5I7kRgZR3wgQ1UeB4GRtVCPxstOs",
  authDomain: "yuukalerie.firebaseapp.com",
  projectId: "yuukalerie",
  storageBucket: "yuukalerie.firebasestorage.app",
  messagingSenderId: "323287958771",
  appId: "1:323287958771:web:3b304cc81fd312e4f8a386"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const progressKey = "yuuka_progress_v1";

const progressEls = {
  page: document.getElementById("progressPage"),
  time: document.getElementById("progressTime"),
  status: document.getElementById("progressStatus"),
};

const authMessage = document.getElementById("authMessage");
const userEmail = document.getElementById("userEmail");
const verifyEmailBtn = document.getElementById("verifyEmailBtn");
const googleLinkBtn = document.getElementById("googleLinkBtn");
const signOutBtn = document.getElementById("signOutBtn");
const googleSignInBtn = document.getElementById("googleSignInBtn");
const userChips = document.querySelectorAll("[data-user-chip]");

const setMessage = (message, tone = "") => {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.className = `alert ${tone}`.trim();
};

const updateUserChips = (user) => {
  const label = user ? `${user.displayName || user.email}` : "Invité";
  userChips.forEach((chip) => {
    chip.textContent = label;
  });
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
  if (!user) return true;
  try {
    await setDoc(
      doc(db, "progress", user.uid),
      {
        ...data,
        uid: user.uid,
        updatedAt: data.updatedAt || new Date().toISOString(),
        syncedAt: serverTimestamp(),
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
  try {
    const snap = await getDoc(doc(db, "progress", user.uid));
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
  if (auth.currentUser) {
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

const initTabs = () => {
  const buttons = document.querySelectorAll("[data-auth-tab]");
  const forms = document.querySelectorAll("[data-auth-form]");
  if (!buttons.length) return;
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.authTab;
      buttons.forEach((btn) => btn.classList.toggle("active", btn === button));
      forms.forEach((form) => form.classList.toggle("active", form.dataset.authForm === target));
    });
  });
};

const signInForm = document.getElementById("signInForm");
const signUpForm = document.getElementById("signUpForm");
const resetForm = document.getElementById("resetForm");

signInForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = signInForm.querySelector("input[name='email']").value.trim();
  const password = signInForm.querySelector("input[name='password']").value.trim();
  try {
    await signInWithEmailAndPassword(auth, email, password);
    setMessage("Connexion réussie. Heureux de te revoir !", "success");
  } catch (error) {
    setMessage(`Connexion impossible : ${error.message}`);
  }
});

signUpForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = signUpForm.querySelector("input[name='email']").value.trim();
  const password = signUpForm.querySelector("input[name='password']").value.trim();
  const username = signUpForm.querySelector("input[name='username']").value.trim();
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (username) {
      await updateProfile(result.user, { displayName: username });
    }
    await sendEmailVerification(result.user);
    setMessage("Compte créé ! Pense à vérifier tes emails pour activer ton compte.", "success");
  } catch (error) {
    setMessage(`Inscription impossible : ${error.message}`);
  }
});

resetForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = resetForm.querySelector("input[name='email']").value.trim();
  try {
    await sendPasswordResetEmail(auth, email);
    setMessage("Un lien de réinitialisation a été envoyé.", "success");
  } catch (error) {
    setMessage(`Réinitialisation impossible : ${error.message}`);
  }
});

verifyEmailBtn?.addEventListener("click", async () => {
  if (!auth.currentUser) return;
  await sendEmailVerification(auth.currentUser);
  setMessage("Email de vérification renvoyé.", "success");
});

googleSignInBtn?.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithRedirect(auth, provider);
  } catch (error) {
    setMessage(`Connexion Google échouée : ${error.message}`);
  }
});

googleLinkBtn?.addEventListener("click", async () => {
  if (!auth.currentUser) return;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await linkWithRedirect(auth.currentUser, provider);
  } catch (error) {
    setMessage(`Association Google impossible : ${error.message}`);
  }
});

signOutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  setMessage("Déconnexion réussie.", "success");
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

onAuthStateChanged(auth, async (user) => {
  updateUserChips(user);
  if (userEmail) {
    userEmail.textContent = user ? user.email : "Aucun compte connecté";
  }
  if (verifyEmailBtn) {
    verifyEmailBtn.disabled = !user || user.emailVerified;
  }
  if (googleLinkBtn) {
    googleLinkBtn.disabled = !user;
  }
  if (signOutBtn) {
    signOutBtn.disabled = !user;
  }
  await mergeProgress(user);
});

initTabs();

const storedProgress = readProgressLocal();
if (storedProgress) {
  updateProgressUI(storedProgress);
}

getRedirectResult(auth)
  .then((result) => {
    if (!result) return;
    const action = result.operationType === "link" ? "Compte Google associé à ton profil." : "Connexion Google réussie.";
    setMessage(action, "success");
  })
  .catch((error) => {
    if (!error) return;
    setMessage(`Connexion Google échouée : ${error.message}`);
  });
