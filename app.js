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
let storage = null;
let authApi = null;
let firestoreApi = null;
let storageApi = null;
let firebaseReady = false;
const authEnabled = false;

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
const isYuukaleriePage = document.body?.dataset?.page === "Yuukalerie";
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

const getUserLabel = (user) => (user ? (user.displayName || user.email) : "Mode public");

const updateUserChips = (user) => {
  const label = user ? "Connecté" : "Public";
  userChips.forEach((chip) => {
    chip.textContent = label;
  });
};

const updateProfileMenu = (user) => {
  const signedIn = authEnabled && Boolean(user);
  if (profileTriggerLabel) {
    profileTriggerLabel.textContent = signedIn ? getUserLabel(user) : "Mode public";
  }
  if (profileName) {
    profileName.textContent = signedIn ? (user.displayName || user.email) : "Galerie partagée";
  }
  if (profileEmail) {
    profileEmail.textContent = signedIn ? user.email : "Synchronisation publique activée pour tous les appareils.";
  }
  if (profileSettings) {
    profileSettings.hidden = !signedIn;
  }
  googleSignInButtons.forEach((button) => {
    button.hidden = true;
  });
  signOutButtons.forEach((button) => {
    button.hidden = true;
  });
  if (accountState) {
    accountState.textContent = signedIn ? "En ligne" : "Public";
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
  if (!authEnabled) {
    setMessage("Connexion désactivée. Mode public activé.", "warning");
    return false;
  }
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

const galleryStorageKey = "yuuka_gallery_v1";
let yuukalerieBooted = false;
let yuukalerieUserId = null;
let yuukalerieCurrentUser = null;
const yuukalerieGalleryId = "public";

const yuukalerieEls = {
  uploadInput: document.querySelector("[data-yuuka-upload]"),
  uploadTriggers: document.querySelectorAll("[data-yuuka-upload-trigger]"),
  createAlbumButtons: document.querySelectorAll("[data-yuuka-create-album]"),
  albumList: document.querySelector("[data-yuuka-album-list]"),
  grid: document.querySelector("[data-yuuka-grid]"),
  empty: document.querySelector("[data-yuuka-empty]"),
  search: document.querySelector("[data-yuuka-search]"),
  filterButtons: document.querySelectorAll("[data-yuuka-filter]"),
  dropzone: document.querySelector("[data-yuuka-dropzone]"),
  photoCount: document.querySelector("[data-yuuka-photo-count]"),
  detailStatus: document.querySelector("[data-yuuka-detail-status]"),
  preview: document.querySelector("[data-yuuka-preview]"),
  detailName: document.querySelector("[data-yuuka-detail-name]"),
  detailDate: document.querySelector("[data-yuuka-detail-date]"),
  detailSize: document.querySelector("[data-yuuka-detail-size]"),
  detailAlbum: document.querySelector("[data-yuuka-detail-album]"),
  detailMeta: document.querySelector("[data-yuuka-detail-meta]"),
  toggleFavorite: document.querySelector("[data-yuuka-toggle-favorite]"),
  deletePhoto: document.querySelector("[data-yuuka-delete-photo]"),
  deletedSection: document.querySelector("[data-yuuka-deleted]"),
  deletedList: document.querySelector("[data-yuuka-deleted-list]"),
  syncStatus: document.querySelector("[data-yuuka-sync-status]"),
  storageStatus: document.querySelector("[data-yuuka-storage-status]"),
};

const yuukalerieState = {
  albums: [],
  photos: [],
  activeAlbumId: "all",
  filter: "all",
  search: "",
  selectedId: null,
};

const formatBytes = (bytes = 0) => {
  if (!bytes) return "0 Ko";
  const units = ["o", "Ko", "Mo", "Go"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fr-FR");
};

const readGalleryLocal = () => {
  const raw = localStorage.getItem(galleryStorageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveGalleryLocal = () => {
  localStorage.setItem(galleryStorageKey, JSON.stringify({
    albums: yuukalerieState.albums,
    photos: yuukalerieState.photos,
  }));
};

const setYuukalerieStatus = () => {
  if (yuukalerieEls.syncStatus) {
    const synced = firebaseReady;
    yuukalerieEls.syncStatus.innerHTML = synced
      ? '<i class="fa-solid fa-wifi"></i> Sync Firebase public'
      : '<i class="fa-solid fa-plug-circle-xmark"></i> Mode local';
    yuukalerieEls.syncStatus.classList.toggle("success", synced);
    yuukalerieEls.syncStatus.classList.toggle("warning", !synced);
  }
  if (yuukalerieEls.storageStatus) {
    yuukalerieEls.storageStatus.innerHTML = firebaseReady
      ? '<i class="fa-solid fa-cloud"></i> Stockage Firebase partagé'
      : '<i class="fa-solid fa-cloud-slash"></i> Stockage local temporaire';
  }
};

const getGalleryCollection = (collectionName) => (
  firestoreApi.collection(db, "yuukalerie_public", yuukalerieGalleryId, collectionName)
);

const getGalleryDoc = (collectionName, docId) => (
  firestoreApi.doc(db, "yuukalerie_public", yuukalerieGalleryId, collectionName, docId)
);

const getAlbumLabel = (albumId) => {
  const album = yuukalerieState.albums.find((item) => item.id === albumId);
  return album?.name || "Sans album";
};

const buildAlbumOptions = () => {
  if (!yuukalerieEls.detailAlbum) return;
  yuukalerieEls.detailAlbum.innerHTML = "";
  const optionAll = document.createElement("option");
  optionAll.value = "";
  optionAll.textContent = "Sans album";
  yuukalerieEls.detailAlbum.append(optionAll);
  yuukalerieState.albums.forEach((album) => {
    const option = document.createElement("option");
    option.value = album.id;
    option.textContent = album.name;
    yuukalerieEls.detailAlbum.append(option);
  });
};

const setActiveFilterButton = (filter) => {
  yuukalerieEls.filterButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.yuukaFilter === filter);
  });
};

const getFilteredPhotos = () => {
  const query = yuukalerieState.search.trim().toLowerCase();
  return yuukalerieState.photos.filter((photo) => {
    if (yuukalerieState.filter === "deleted" && !photo.isDeleted) return false;
    if (yuukalerieState.filter !== "deleted" && photo.isDeleted) return false;
    if (yuukalerieState.filter === "favorites" && !photo.isFavorite) return false;
    if (yuukalerieState.filter === "recent") {
      const dateValue = new Date(photo.createdAt || photo.createdAtIso || 0);
      const diff = Date.now() - dateValue.getTime();
      if (Number.isNaN(diff) || diff > 1000 * 60 * 60 * 24 * 14) return false;
    }
    if (yuukalerieState.filter !== "deleted") {
      if (yuukalerieState.activeAlbumId !== "all" && yuukalerieState.activeAlbumId !== "favorites") {
        if (photo.albumId !== yuukalerieState.activeAlbumId) return false;
      }
    }
    if (query) {
      const target = `${photo.name || ""} ${photo.albumName || getAlbumLabel(photo.albumId)}`.toLowerCase();
      if (!target.includes(query)) return false;
    }
    return true;
  });
};

const renderAlbums = () => {
  if (!yuukalerieEls.albumList) return;
  yuukalerieEls.albumList.innerHTML = "";
  const baseAlbums = [
    { id: "all", name: "Toutes les photos", subtitle: "Synchronisées" },
    { id: "favorites", name: "Favoris", subtitle: "Repères rapides" },
    { id: "deleted", name: "Supprimés récemment", subtitle: "Récupérables" },
  ];
  const renderAlbum = (album) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "yuukalerie-album";
    button.dataset.albumId = album.id;
    button.innerHTML = `<strong>${album.name}</strong><span>${album.subtitle || "Album personnalisé"}</span>`;
    if (yuukalerieState.activeAlbumId === album.id) {
      button.classList.add("is-active");
    }
    button.addEventListener("click", () => {
      yuukalerieState.activeAlbumId = album.id;
      yuukalerieState.filter = album.id === "deleted" ? "deleted" : album.id === "favorites" ? "favorites" : "all";
      setActiveFilterButton(yuukalerieState.filter);
      renderAlbums();
      renderGallery();
    });
    yuukalerieEls.albumList.append(button);
  };
  baseAlbums.forEach(renderAlbum);
  yuukalerieState.albums.forEach((album) => renderAlbum(album));
};

const renderGallery = () => {
  if (!yuukalerieEls.grid) return;
  const photos = getFilteredPhotos();
  yuukalerieEls.grid.innerHTML = "";
  photos.forEach((photo) => {
    const card = document.createElement("article");
    card.className = "yuukalerie-card";
    card.dataset.photoId = photo.id;
    const imageUrl = photo.url || photo.localUrl || "";
    card.innerHTML = `
      <img src="${imageUrl}" alt="${photo.name || "Photo Yuukalerie"}" loading="lazy" />
      <div class="yuukalerie-card-body">
        <h4>${photo.name || "Sans titre"}</h4>
        <div class="yuukalerie-card-meta">
          <span>${getAlbumLabel(photo.albumId)}</span>
          <span>${formatDate(photo.createdAt || photo.createdAtIso)}</span>
        </div>
        <div class="yuukalerie-card-actions">
          <button type="button" data-action="select"><i class="fa-solid fa-eye"></i></button>
          <button type="button" data-action="favorite"><i class="fa-solid fa-star"></i></button>
          <button type="button" data-action="delete" class="danger"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
    card.addEventListener("click", (event) => {
      const action = event.target.closest("button")?.dataset?.action;
      if (action) {
        if (action === "favorite") {
          toggleFavorite(photo.id);
        } else if (action === "delete") {
          markDeleted(photo.id);
        } else if (action === "select") {
          selectPhoto(photo.id);
        }
        return;
      }
      selectPhoto(photo.id);
    });
    yuukalerieEls.grid.append(card);
  });
  yuukalerieEls.empty?.toggleAttribute("hidden", photos.length > 0);
  if (yuukalerieEls.photoCount) {
    yuukalerieEls.photoCount.textContent = `${photos.length} photo${photos.length > 1 ? "s" : ""}`;
  }
  renderDeletedList();
};

const renderDeletedList = () => {
  if (!yuukalerieEls.deletedList || !yuukalerieEls.deletedSection) return;
  const deleted = yuukalerieState.photos.filter((photo) => photo.isDeleted);
  yuukalerieEls.deletedList.innerHTML = "";
  deleted.forEach((photo) => {
    const item = document.createElement("div");
    item.className = "yuukalerie-deleted-item";
    item.innerHTML = `
      <strong>${photo.name || "Photo supprimée"}</strong>
      <span class="subtitle">${formatDate(photo.deletedAt)}</span>
      <div class="yuukalerie-deleted-actions">
        <button class="btn ghost" type="button" data-action="restore">Restaurer</button>
        <button class="btn ghost danger" type="button" data-action="remove">Supprimer définitivement</button>
      </div>
    `;
    item.addEventListener("click", (event) => {
      const action = event.target.closest("button")?.dataset?.action;
      if (action === "restore") {
        restorePhoto(photo.id);
      } else if (action === "remove") {
        removePhoto(photo.id);
      }
    });
    yuukalerieEls.deletedList.append(item);
  });
  yuukalerieEls.deletedSection.hidden = deleted.length === 0;
};

const renderDetails = (photo) => {
  if (!photo) {
    if (yuukalerieEls.preview) yuukalerieEls.preview.innerHTML = "<span>Choisis une photo</span>";
    if (yuukalerieEls.detailName) yuukalerieEls.detailName.textContent = "—";
    if (yuukalerieEls.detailDate) yuukalerieEls.detailDate.textContent = "—";
    if (yuukalerieEls.detailSize) yuukalerieEls.detailSize.textContent = "—";
    if (yuukalerieEls.detailMeta) yuukalerieEls.detailMeta.textContent = "—";
    if (yuukalerieEls.detailStatus) yuukalerieEls.detailStatus.textContent = "—";
    return;
  }
  if (yuukalerieEls.preview) {
    yuukalerieEls.preview.innerHTML = `<img src="${photo.url || photo.localUrl || ""}" alt="${photo.name || "Photo"}" />`;
  }
  if (yuukalerieEls.detailName) yuukalerieEls.detailName.textContent = photo.name || "Sans titre";
  if (yuukalerieEls.detailDate) yuukalerieEls.detailDate.textContent = formatDate(photo.createdAt || photo.createdAtIso);
  if (yuukalerieEls.detailSize) yuukalerieEls.detailSize.textContent = formatBytes(photo.size);
  if (yuukalerieEls.detailMeta) {
    yuukalerieEls.detailMeta.textContent = photo.isDeleted ? "Supprimée" : photo.isFavorite ? "Favori" : "Active";
  }
  if (yuukalerieEls.detailStatus) {
    yuukalerieEls.detailStatus.textContent = photo.isDeleted ? "Supprimée" : photo.url ? "Synchronisée" : "Local";
  }
  if (yuukalerieEls.detailAlbum) {
    yuukalerieEls.detailAlbum.value = photo.albumId || "";
  }
};

const selectPhoto = (photoId) => {
  yuukalerieState.selectedId = photoId;
  const photo = yuukalerieState.photos.find((item) => item.id === photoId);
  renderDetails(photo);
};

const updatePhoto = async (photoId, updates) => {
  const photoIndex = yuukalerieState.photos.findIndex((item) => item.id === photoId);
  if (photoIndex === -1) return;
  yuukalerieState.photos[photoIndex] = { ...yuukalerieState.photos[photoIndex], ...updates };
  saveGalleryLocal();
  renderGallery();
  if (yuukalerieState.selectedId === photoId) {
    renderDetails(yuukalerieState.photos[photoIndex]);
  }
  if (firebaseReady && firestoreApi && db && yuukalerieUserId) {
    try {
      const docRef = getGalleryDoc("yuukalerie_photos", photoId);
      await firestoreApi.setDoc(docRef, updates, { merge: true });
    } catch (error) {
      console.error("Mise à jour Yuukalerie impossible", error);
      setMessage("Mise à jour distante indisponible. Mode local activé.", "warning");
    }
  }
};

const toggleFavorite = (photoId) => {
  const photo = yuukalerieState.photos.find((item) => item.id === photoId);
  if (!photo) return;
  updatePhoto(photoId, { isFavorite: !photo.isFavorite });
};

const markDeleted = (photoId) => updatePhoto(photoId, { isDeleted: true, deletedAt: new Date().toISOString() });

const restorePhoto = (photoId) => updatePhoto(photoId, { isDeleted: false, deletedAt: null });

const removePhoto = async (photoId) => {
  const photoIndex = yuukalerieState.photos.findIndex((item) => item.id === photoId);
  if (photoIndex === -1) return;
  const photo = yuukalerieState.photos[photoIndex];
  yuukalerieState.photos.splice(photoIndex, 1);
  saveGalleryLocal();
  renderGallery();
  renderDetails(null);
  if (firebaseReady && firestoreApi && db && yuukalerieUserId) {
    try {
      const docRef = getGalleryDoc("yuukalerie_photos", photoId);
      await firestoreApi.deleteDoc(docRef);
    } catch (error) {
      console.error("Suppression Yuukalerie impossible", error);
      setMessage("Suppression distante indisponible. Mode local activé.", "warning");
    }
  }
  if (firebaseReady && storageApi && storage && photo.storagePath) {
    try {
      const storageRef = storageApi.ref(storage, photo.storagePath);
      await storageApi.deleteObject(storageRef);
    } catch (error) {
      console.error("Suppression stockage impossible", error);
    }
  }
};

const createAlbum = async () => {
  const name = window.prompt("Nom du nouvel album :");
  if (!name) return;
  const album = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
  };
  yuukalerieState.albums.push(album);
  saveGalleryLocal();
  renderAlbums();
  buildAlbumOptions();
  if (firebaseReady && firestoreApi && db && yuukalerieUserId) {
    try {
      const docRef = getGalleryDoc("yuukalerie_albums", album.id);
      await firestoreApi.setDoc(docRef, album);
    } catch (error) {
      console.error("Création d'album impossible", error);
      setMessage("Création d'album distante indisponible. Mode local activé.", "warning");
    }
  }
};

const persistPhoto = async (photo) => {
  yuukalerieState.photos.unshift(photo);
  saveGalleryLocal();
  renderGallery();
  if (firebaseReady && firestoreApi && db && yuukalerieUserId) {
    try {
      const docRef = getGalleryDoc("yuukalerie_photos", photo.id);
      await firestoreApi.setDoc(docRef, photo);
    } catch (error) {
      console.error("Sauvegarde Yuukalerie impossible", error);
      setMessage("Sauvegarde distante indisponible. Mode local activé.", "warning");
    }
  }
};

const handleUploadFiles = async (files) => {
  if (!files?.length) return;
  const fileList = Array.from(files);
  for (const file of fileList) {
    const basePhoto = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      createdAt: new Date().toISOString(),
      albumId: "",
      isFavorite: false,
      isDeleted: false,
    };
    if (firebaseReady && storageApi && storage) {
      try {
        const path = `public/yuukalerie/${basePhoto.id}_${file.name}`;
        const storageRef = storageApi.ref(storage, path);
        await storageApi.uploadBytes(storageRef, file);
        const url = await storageApi.getDownloadURL(storageRef);
        await persistPhoto({ ...basePhoto, url, storagePath: path });
      } catch (error) {
        console.error("Upload Firebase impossible", error);
        setMessage("Upload Firebase indisponible. Mode local activé.", "warning");
        const localUrl = URL.createObjectURL(file);
        await persistPhoto({ ...basePhoto, localUrl });
      }
    } else {
      const localUrl = URL.createObjectURL(file);
      await persistPhoto({ ...basePhoto, localUrl });
    }
  }
};

const loadGalleryFromCloud = async () => {
  if (!firebaseReady || !firestoreApi || !db) return false;
  try {
    const albumsSnap = await firestoreApi.getDocs(getGalleryCollection("yuukalerie_albums"));
    const photosSnap = await firestoreApi.getDocs(getGalleryCollection("yuukalerie_photos"));
    yuukalerieState.albums = albumsSnap.docs.map((doc) => doc.data());
    yuukalerieState.photos = photosSnap.docs.map((doc) => doc.data());
    saveGalleryLocal();
    return true;
  } catch (error) {
    console.error("Chargement Yuukalerie impossible", error);
    setMessage("Chargement Yuukalerie indisponible. Mode local activé.", "warning");
    return false;
  }
};

const initYuukalerie = async () => {
  if (!isYuukaleriePage) return;
  if (!yuukalerieBooted) {
    yuukalerieEls.uploadTriggers.forEach((button) => {
      button.addEventListener("click", () => yuukalerieEls.uploadInput?.click());
    });
    yuukalerieEls.uploadInput?.addEventListener("change", (event) => {
      handleUploadFiles(event.target.files);
    });
    yuukalerieEls.createAlbumButtons.forEach((button) => {
      button.addEventListener("click", createAlbum);
    });
    yuukalerieEls.search?.addEventListener("input", (event) => {
      yuukalerieState.search = event.target.value || "";
      renderGallery();
    });
    yuukalerieEls.filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        yuukalerieState.filter = button.dataset.yuukaFilter;
        yuukalerieState.activeAlbumId = "all";
        setActiveFilterButton(yuukalerieState.filter);
        renderAlbums();
        renderGallery();
      });
    });
    yuukalerieEls.dropzone?.addEventListener("dragover", (event) => {
      event.preventDefault();
      yuukalerieEls.dropzone.classList.add("is-dragging");
    });
    yuukalerieEls.dropzone?.addEventListener("dragleave", () => {
      yuukalerieEls.dropzone.classList.remove("is-dragging");
    });
    yuukalerieEls.dropzone?.addEventListener("drop", (event) => {
      event.preventDefault();
      yuukalerieEls.dropzone.classList.remove("is-dragging");
      handleUploadFiles(event.dataTransfer.files);
    });
    yuukalerieEls.detailAlbum?.addEventListener("change", (event) => {
      if (!yuukalerieState.selectedId) return;
      updatePhoto(yuukalerieState.selectedId, { albumId: event.target.value || "" });
    });
    yuukalerieEls.toggleFavorite?.addEventListener("click", () => {
      if (!yuukalerieState.selectedId) return;
      toggleFavorite(yuukalerieState.selectedId);
    });
    yuukalerieEls.deletePhoto?.addEventListener("click", () => {
      if (!yuukalerieState.selectedId) return;
      markDeleted(yuukalerieState.selectedId);
    });
    yuukalerieBooted = true;
  }
  yuukalerieCurrentUser = null;
  setYuukalerieStatus();
  const localData = readGalleryLocal();
  if (localData && (!yuukalerieUserId || yuukalerieUserId === yuukalerieGalleryId)) {
    yuukalerieState.albums = localData.albums || [];
    yuukalerieState.photos = localData.photos || [];
  }
  if (yuukalerieGalleryId !== yuukalerieUserId) {
    yuukalerieUserId = yuukalerieGalleryId;
    await loadGalleryFromCloud();
  }
  buildAlbumOptions();
  setActiveFilterButton(yuukalerieState.filter);
  renderAlbums();
  renderGallery();
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
    if (isYuukaleriePage) {
      await initYuukalerie();
    }
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
  const [appModule, authModule, firestoreModule, storageModule] = await Promise.allSettled([
    import("https://www.gstatic.com/firebasejs/10.3.1/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.3.1/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js"),
    import("https://www.gstatic.com/firebasejs/10.3.1/firebase-storage.js"),
  ]);

  const authReady = authEnabled ? authModule.status === "fulfilled" : true;
  if (appModule.status !== "fulfilled" || !authReady || firestoreModule.status !== "fulfilled" || storageModule.status !== "fulfilled") {
    setProgressStatus("Local (hors ligne)");
    setMessage("Connexion distante indisponible. Tes données restent en local.", "warning");
    return false;
  }

  const { initializeApp } = appModule.value;
  authApi = authModule.status === "fulfilled" ? authModule.value : null;
  firestoreApi = firestoreModule.value;
  storageApi = storageModule.value;

  const app = initializeApp(firebaseConfig);
  if (authEnabled && authApi) {
    auth = authApi.getAuth(app);
    try {
      await authApi.setPersistence(auth, authApi.browserLocalPersistence);
    } catch (error) {
      console.error("Persistance Firebase impossible", error);
      setMessage("Connexion persistante indisponible. Mode local activé.", "warning");
    }
  }
  db = firestoreApi.getFirestore(app);
  storage = storageApi.getStorage(app);
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
      "--bg-soft": "#e2e8f0",
      "--panel": "rgba(255, 255, 255, 0.96)",
      "--panel-strong": "rgba(255, 255, 255, 0.98)",
      "--card": "rgba(248, 250, 252, 0.96)",
      "--border": "rgba(100, 116, 139, 0.4)",
      "--text": "#0b1220",
      "--muted": "#334155",
      "--btn-from": "#1d4ed8",
      "--btn-to": "#3b82f6",
      "--btn-shadow": "rgba(37, 99, 235, 0.25)",
      "--btn-text": "#ffffff",
      "--btn-ghost-bg": "rgba(15, 23, 42, 0.06)",
      "--btn-ghost-border": "rgba(15, 23, 42, 0.16)",
      "--btn-ghost-hover": "rgba(37, 99, 235, 0.12)",
      "--btn-ghost-text": "#0b1220",
      "--ambient-1": "59 130 246",
      "--ambient-2": "139 92 246",
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
  const currentVersion = "v3.2";
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
      const zDirection = item.classList.contains("decor-behind") ? -1 : 1;
      const offset = scrollY * depth;
      item.style.setProperty("--parallax-y", `${offset}px`);
      item.style.setProperty("--parallax-z", `${depth * 120 * zDirection}px`);
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
  updateUserChips(null);
  updateProfileMenu(null);
  const storedTheme = localStorage.getItem(themeStorageKey);
  if (storedTheme && themePresets[storedTheme]) {
    applyTheme(storedTheme, false);
  } else {
    applyTheme("aurore", false);
  }
  const ready = await initFirebase();
  if (ready) {
    if (authEnabled) {
      bindAuthObservers();
    }
    if (isYuukaleriePage) {
      await initYuukalerie();
    }
  } else if (isYuukaleriePage) {
    await initYuukalerie();
  }
};

init();
