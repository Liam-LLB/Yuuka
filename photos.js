const firebaseConfig = window.YUUKA_FIREBASE_CONFIG || null;
const ownerId = window.YUUKA_DEMO_OWNER_ID || "demo-user";

const firebaseStatus = document.getElementById("firebaseStatus");
const emptyState = document.getElementById("emptyState");
const photoGrid = document.getElementById("photoGrid");
const openUploader = document.getElementById("openUploader");
const uploadSheet = document.getElementById("uploadSheet");
const sheetBackdrop = document.getElementById("sheetBackdrop");
const closeUploader = document.getElementById("closeUploader");
const photoInput = document.getElementById("photoInput");
const uploadBtn = document.getElementById("uploadBtn");
const albumSelect = document.getElementById("albumSelect");
const viewer = document.getElementById("viewer");
const viewerImage = document.getElementById("viewerImage");
const closeViewer = document.getElementById("closeViewer");
const deletePhotoBtn = document.getElementById("deletePhoto");

let app = null;
let db = null;
let storage = null;
let firestoreApi = null;
let storageApi = null;
let activePhotoId = null;
let activePhotoUrl = null;
let uploading = false;

function setStatus(message, ok = true) {
  firebaseStatus.textContent = message;
  firebaseStatus.style.color = ok ? "#a5b4fc" : "#fca5a5";
}

function toggleSheet(open) {
  uploadSheet.classList.toggle("active", open);
  uploadSheet.setAttribute("aria-hidden", String(!open));
}

function toggleViewer(open) {
  viewer.classList.toggle("active", open);
  viewer.setAttribute("aria-hidden", String(!open));
}

function updateEmptyState() {
  const hasPhotos = photoGrid.children.length > 0;
  emptyState.hidden = hasPhotos;
}

function createTile(photo) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "photo-tile";

  const img = document.createElement("img");
  img.src = photo.downloadUrl;
  img.alt = "";
  img.loading = "lazy";

  button.appendChild(img);

  button.addEventListener("mousemove", (event) => {
    const rect = button.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const rotY = (x - 0.5) * 10;
    const rotX = (0.5 - y) * 10;
    button.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(8px)`;
  });

  button.addEventListener("mouseleave", () => {
    button.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)";
  });

  button.addEventListener("click", () => {
    activePhotoId = photo.id;
    activePhotoUrl = photo.downloadUrl;
    viewerImage.src = activePhotoUrl;
    toggleViewer(true);
  });

  return button;
}

async function listLatestPhotos(max = 160) {
  const photosRef = firestoreApi.collection(db, "photos");
  const q = firestoreApi.query(
    photosRef,
    firestoreApi.where("ownerId", "==", ownerId),
    firestoreApi.where("isDeleted", "==", false),
    firestoreApi.orderBy("createdAt", "desc"),
    firestoreApi.limit(max)
  );
  const snapshot = await firestoreApi.getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function refreshPhotos() {
  if (!db) return;
  photoGrid.innerHTML = "";
  const photos = await listLatestPhotos(160);
  photos.forEach((photo) => {
    photoGrid.appendChild(createTile(photo));
  });
  updateEmptyState();
}

async function uploadPhotos(files, albumId) {
  for (const file of files) {
    const docRef = await firestoreApi.addDoc(
      firestoreApi.collection(db, "photos"),
      {
        ownerId,
        albumId,
        storagePath: "",
        downloadUrl: "",
        createdAt: firestoreApi.serverTimestamp(),
        tags: [],
        isDeleted: false,
        deletedAt: null,
        bytes: file.size,
      }
    );

    const storagePath = `users/${ownerId}/photos/${docRef.id}/original`;
    const storageRef = storageApi.ref(storage, storagePath);

    await new Promise((resolve, reject) => {
      const task = storageApi.uploadBytesResumable(storageRef, file);
      task.on("state_changed", undefined, reject, () => resolve());
    });

    const downloadUrl = await storageApi.getDownloadURL(storageRef);
    await firestoreApi.updateDoc(firestoreApi.doc(db, "photos", docRef.id), {
      storagePath,
      downloadUrl,
    });
  }
}

async function softDeletePhoto(photoId) {
  await firestoreApi.updateDoc(firestoreApi.doc(db, "photos", photoId), {
    isDeleted: true,
    deletedAt: firestoreApi.serverTimestamp(),
  });
}

async function initFirebase() {
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    setStatus("Ajoute tes identifiants Firebase dans bouton8.html pour activer la synchronisation.", false);
    updateEmptyState();
    return;
  }

  const [{ initializeApp }, firestoreModule, storageModule] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js"),
  ]);

  firestoreApi = firestoreModule;
  storageApi = storageModule;

  app = initializeApp(firebaseConfig);
  db = firestoreModule.getFirestore(app);
  storage = storageModule.getStorage(app);

  setStatus("Connexion Firebase : active.");
  await refreshPhotos();
}

openUploader.addEventListener("click", () => toggleSheet(true));
closeUploader.addEventListener("click", () => !uploading && toggleSheet(false));
sheetBackdrop.addEventListener("click", () => !uploading && toggleSheet(false));

uploadBtn.addEventListener("click", () => photoInput.click());

photoInput.addEventListener("change", async (event) => {
  if (!db || uploading) return;
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  uploading = true;
  uploadBtn.textContent = "Upload...";
  try {
    await uploadPhotos(files, albumSelect.value || null);
    toggleSheet(false);
    await refreshPhotos();
  } finally {
    uploading = false;
    uploadBtn.textContent = "Choisir des photos";
    photoInput.value = "";
  }
});

closeViewer.addEventListener("click", () => {
  toggleViewer(false);
  activePhotoId = null;
  activePhotoUrl = null;
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && viewer.classList.contains("active")) {
    toggleViewer(false);
    activePhotoId = null;
    activePhotoUrl = null;
  }
});

deletePhotoBtn.addEventListener("click", async () => {
  if (!activePhotoId || !db) return;
  await softDeletePhoto(activePhotoId);
  toggleViewer(false);
  activePhotoId = null;
  activePhotoUrl = null;
  await refreshPhotos();
});

initFirebase();
