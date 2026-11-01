// ==========================================================================
// RECONSTRUYENDO CASACUARÁN — Panel de Gestión en Línea (Móvil y Escritorio)
// Conectado directamente a Netlify Identity + Git Gateway con subida nativa
// de fotografías (optimización instantánea a WebP) y videos (portada automática).
// ==========================================================================

const GIT_GATEWAY_BASE = "/.netlify/git/github";
const MAX_VIDEO_BYTES = 65 * 1024 * 1024; // 65 MB límite seguro para subida móvil

let cloudConfig = DataStore.getConfig();
let cloudPosts = [];
let editingPostId = null;
let isBusy = false;

const ADMIN_TABLE_STEP = 15;
let adminSearchQuery = "";
let adminFilterCat = "todas";
let adminVisibleLimit = ADMIN_TABLE_STEP;

// Estado de archivos seleccionados en el formulario actual
let pendingImageBlob = null;
let pendingImageName = "";
let pendingImagePreviewUrl = "";
let existingImageUrl = "";
let existingImageFallback = "";

let pendingVideoFile = null;
let pendingVideoName = "";
let pendingVideoObjectUrl = "";
let pendingPosterBlob = null;
let pendingPosterPreviewUrl = "";
let existingVideoUrl = "";
let existingVideoFallbackUrl = "";
let existingVideoPoster = "";

document.addEventListener("DOMContentLoaded", () => {
  initIdentityAndPanel();
});

/**
 * 1. Autenticación con Netlify Identity (solo cuentas invitadas pueden entrar)
 */
function initIdentityAndPanel() {
  const loginBtn = document.getElementById("btn-open-login");
  const logoutBtn = document.getElementById("btn-logout");

  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      if (window.netlifyIdentity) {
        window.netlifyIdentity.open("login");
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (window.netlifyIdentity) {
        window.netlifyIdentity.logout();
      }
    });
  }

  setupFormsAndControls();

  // Modo desarrollo local (file:// o localhost) permite previsualizar y probar la interfaz sin bloqueo
  const isLocalDev =
    window.location.protocol === "file:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (isLocalDev) {
    unlockWorkspace(null);
    return;
  }

  if (!window.netlifyIdentity) {
    showAuthGate();
    return;
  }

  if (typeof window.netlifyIdentity.setLocale === "function") {
    try {
      window.netlifyIdentity.setLocale("es");
    } catch (e) {
      // Ignorar si la versión del widget no soporta cambio dinámico
    }
  }

  window.netlifyIdentity.on("init", (user) => {
    if (user) {
      unlockWorkspace(user);
    } else {
      showAuthGate();
      const hash = window.location.hash || "";
      if (
        hash.includes("invite_token=") ||
        hash.includes("recovery_token=") ||
        hash.includes("confirmation_token=")
      ) {
        window.netlifyIdentity.open();
      }
    }
  });

  window.netlifyIdentity.on("login", (user) => {
    window.netlifyIdentity.close();
    unlockWorkspace(user);
  });

  window.netlifyIdentity.on("logout", () => {
    showAuthGate();
  });

  // Respaldo inmediato si el widget ya estaba inicializado
  const current = window.netlifyIdentity.currentUser();
  if (current) {
    unlockWorkspace(current);
  }
}

function showAuthGate() {
  const gate = document.getElementById("auth-gate");
  const workspace = document.getElementById("admin-workspace");
  const emailEl = document.getElementById("admin-user-email");
  const logoutBtn = document.getElementById("btn-logout");

  if (gate) gate.hidden = false;
  if (workspace) workspace.hidden = true;
  if (emailEl) emailEl.hidden = true;
  if (logoutBtn) logoutBtn.hidden = true;
}

async function unlockWorkspace(user) {
  const gate = document.getElementById("auth-gate");
  const workspace = document.getElementById("admin-workspace");
  const emailEl = document.getElementById("admin-user-email");
  const logoutBtn = document.getElementById("btn-logout");

  if (gate) gate.hidden = true;
  if (workspace) workspace.hidden = false;

  if (user && user.email) {
    if (emailEl) {
      emailEl.textContent = user.email;
      emailEl.hidden = false;
    }
    if (logoutBtn) logoutBtn.hidden = false;
  }

  await refreshDataFromCloud();
}

/**
 * 2. Lectura en vivo desde el repositorio (evita caché viejo tras publicar)
 */
async function refreshDataFromCloud() {
  let loaded = null;

  try {
    const token = await getNetlifyJwt();
    if (token) {
      const res = await fetch(`${GIT_GATEWAY_BASE}/contents/content/site-data.json?ref=main&t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json"
        },
        cache: "no-store"
      });
      if (res.ok) {
        const meta = await res.json();
        loaded = JSON.parse(base64ToUtf8(meta.content || ""));
      }
    }
  } catch (e) {
    console.warn("Lectura directa vía Git Gateway no disponible, usando respaldo HTTP:", e);
  }

  if (!loaded) {
    const fallback = await DataStore.initFromRemoteOrLocal();
    loaded = {
      config: fallback.config,
      publications: fallback.publications
    };
  }

  cloudConfig = loaded.config || DataStore.getConfig();
  cloudPosts = sortPostsChronologically(Array.isArray(loaded.publications) ? loaded.publications : []);

  DataStore.saveConfig(cloudConfig);
  DataStore.savePosts(cloudPosts);

  populateUrgentForm();
  renderRegisteredTable();
}

function sortPostsChronologically(posts) {
  return [...posts].sort((a, b) => {
    const da = String(a && a.date ? a.date : "").split("T")[0];
    const db = String(b && b.date ? b.date : "").split("T")[0];
    const cmp = db.localeCompare(da);
    if (cmp !== 0) return cmp;
    return (Number(b && b.id) || 0) - (Number(a && a.id) || 0);
  });
}

/**
 * 3. Configuración de formularios, selectores de archivo y tabla
 */
function setupFormsAndControls() {
  const dateInput = document.getElementById("post-date");
  if (dateInput && !dateInput.value) {
    dateInput.value = getTodayIsoDate();
  }

  // Aviso urgente
  const urgentForm = document.getElementById("urgent-notice-form");
  if (urgentForm) {
    urgentForm.addEventListener("submit", handleUrgentSubmit);
  }

  // Selector de fotografía
  const imageInput = document.getElementById("post-image-file");
  if (imageInput) {
    imageInput.addEventListener("change", handleImageFileSelected);
  }

  const clearImageBtn = document.getElementById("btn-clear-image");
  if (clearImageBtn) {
    clearImageBtn.addEventListener("click", clearImageSelection);
  }

  // Selector de video + deslizador de portada
  const videoInput = document.getElementById("post-video-file");
  if (videoInput) {
    videoInput.addEventListener("change", handleVideoFileSelected);
  }

  const posterSlider = document.getElementById("poster-seek-slider");
  if (posterSlider) {
    posterSlider.addEventListener("change", handlePosterSliderChange);
  }

  const clearVideoBtn = document.getElementById("btn-clear-video");
  if (clearVideoBtn) {
    clearVideoBtn.addEventListener("click", clearVideoSelection);
  }

  // Formulario principal de publicación
  const postForm = document.getElementById("post-form");
  if (postForm) {
    postForm.addEventListener("submit", handlePostSubmit);
  }

  const cancelBtn = document.getElementById("btn-cancel-edit");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", resetPostForm);
  }

  // Buscador y filtro rápido de la tabla de registros
  const adminSearch = document.getElementById("admin-search-input");
  if (adminSearch) {
    adminSearch.addEventListener("input", (e) => {
      adminSearchQuery = e.target.value || "";
      adminVisibleLimit = ADMIN_TABLE_STEP;
      renderRegisteredTable();
    });
  }

  const adminCatSelect = document.getElementById("admin-filter-cat");
  if (adminCatSelect) {
    adminCatSelect.addEventListener("change", (e) => {
      adminFilterCat = e.target.value || "todas";
      adminVisibleLimit = ADMIN_TABLE_STEP;
      renderRegisteredTable();
    });
  }

  // Acciones Editar / Eliminar / Paginación de la tabla
  document.addEventListener("click", (e) => {
    const pageBtn = e.target.closest("[data-admin-page]");
    if (pageBtn) {
      const mode = pageBtn.getAttribute("data-admin-page");
      if (mode === "more") {
        adminVisibleLimit += 20;
      } else if (mode === "all") {
        adminVisibleLimit = cloudPosts.length + 50;
      } else if (mode === "collapse") {
        adminVisibleLimit = ADMIN_TABLE_STEP;
      }
      renderRegisteredTable();
      return;
    }

    const actionBtn = e.target.closest("[data-admin-action]");
    if (!actionBtn || isBusy) return;

    const action = actionBtn.getAttribute("data-admin-action");
    const id = Number(actionBtn.getAttribute("data-id"));
    if (!id) return;

    if (action === "edit") {
      startEditingPost(id);
    } else if (action === "delete") {
      confirmAndDeletePost(id);
    }
  });
}

function populateUrgentForm() {
  const activeEl = document.getElementById("urgent-active");
  const textEl = document.getElementById("urgent-text");
  const notice = (cloudConfig && cloudConfig.urgentNotice) || {};

  if (activeEl) activeEl.checked = Boolean(notice.active);
  if (textEl) textEl.value = notice.text || "";
}

/**
 * 4. Selección y optimización instantánea de fotografía en el navegador (WebP ligero)
 */
async function handleImageFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  hideBanner("post-feedback");

  try {
    const slug = buildSafeFileSlug(file.name);
    const optimized = await optimizeImageInBrowser(file);

    revokeIfBlobUrl(pendingImagePreviewUrl);
    pendingImageBlob = optimized.blob;
    pendingImageName = `${slug}.${optimized.ext}`;
    pendingImagePreviewUrl = URL.createObjectURL(optimized.blob);
    existingImageUrl = "";
    existingImageFallback = "";

    renderImagePreview(
      pendingImagePreviewUrl,
      `${file.name} (${formatBytes(optimized.blob.size)} optimizada)`
    );
  } catch (err) {
    showBanner("post-feedback", `No se pudo procesar la imagen: ${err.message}`, true);
  }
}

function optimizeImageInBrowser(file) {
  return new Promise((resolve, reject) => {
    const tempUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(tempUrl);
      const maxDim = 1600;
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((webpBlob) => {
        if (webpBlob && webpBlob.type === "image/webp") {
          resolve({ blob: webpBlob, ext: "webp" });
        } else {
          canvas.toBlob((jpgBlob) => {
            if (jpgBlob) {
              resolve({ blob: jpgBlob, ext: "jpg" });
            } else {
              resolve({ blob: file, ext: getExtension(file.name, "jpg") });
            }
          }, "image/jpeg", 0.85);
        }
      }, "image/webp", 0.84);
    };

    img.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      // Si el formato (ej. HEIC crudo) no se dibuja en canvas, subir archivo original para que FFmpeg lo convierta
      resolve({ blob: file, ext: getExtension(file.name, "jpg") });
    };

    img.src = tempUrl;
  });
}

function renderImagePreview(srcUrl, metaText) {
  const box = document.getElementById("image-preview-box");
  const imgEl = document.getElementById("image-preview-el");
  const metaEl = document.getElementById("image-preview-meta");
  const labelText = document.getElementById("image-picker-label-text");

  if (imgEl) imgEl.src = srcUrl;
  if (metaEl) metaEl.textContent = metaText;
  if (box) box.hidden = false;
  if (labelText) labelText.textContent = "Cambiar fotografía";
}

function clearImageSelection() {
  revokeIfBlobUrl(pendingImagePreviewUrl);
  pendingImageBlob = null;
  pendingImageName = "";
  pendingImagePreviewUrl = "";
  existingImageUrl = "";
  existingImageFallback = "";

  const input = document.getElementById("post-image-file");
  const box = document.getElementById("image-preview-box");
  const imgEl = document.getElementById("image-preview-el");
  const labelText = document.getElementById("image-picker-label-text");

  if (input) input.value = "";
  if (imgEl) imgEl.removeAttribute("src");
  if (box) box.hidden = true;
  if (labelText) labelText.textContent = "+ Seleccionar fotografía del celular o PC";
}

/**
 * 5. Selección de video y generación instantánea de portada WebP en el navegador
 */
async function handleVideoFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  hideBanner("post-feedback");

  if (file.size > MAX_VIDEO_BYTES) {
    e.target.value = "";
    showBanner(
      "post-feedback",
      `El video seleccionado pesa ${formatBytes(file.size)}. El máximo recomendado desde navegador es 65 MB; recórtalo un poco o envíalo por WhatsApp antes de subirlo.`,
      true
    );
    return;
  }

  revokeIfBlobUrl(pendingVideoObjectUrl);
  revokeIfBlobUrl(pendingPosterPreviewUrl);

  const ext = getExtension(file.name, "mp4");
  const slug = buildSafeFileSlug(file.name);

  pendingVideoFile = file;
  pendingVideoName = `${slug}.${ext}`;
  pendingVideoObjectUrl = URL.createObjectURL(file);
  existingVideoUrl = "";
  existingVideoFallbackUrl = "";
  existingVideoPoster = "";

  const slider = document.getElementById("poster-seek-slider");
  if (slider) slider.value = "45";

  renderVideoPreview(
    pendingVideoObjectUrl,
    `${file.name} (${formatBytes(file.size)})`,
    true
  );

  await capturePosterFromPendingVideo(0.45);
}

async function handlePosterSliderChange(e) {
  if (!pendingVideoObjectUrl) return;
  const pct = Math.max(2, Math.min(96, Number(e.target.value) || 45)) / 100;
  await capturePosterFromPendingVideo(pct);
}

function capturePosterFromPendingVideo(fraction) {
  return new Promise((resolve) => {
    if (!pendingVideoObjectUrl) {
      resolve();
      return;
    }

    const helperVideo = document.createElement("video");
    helperVideo.muted = true;
    helperVideo.playsInline = true;
    helperVideo.preload = "auto";
    helperVideo.src = pendingVideoObjectUrl;

    const cleanup = () => {
      helperVideo.removeAttribute("src");
      helperVideo.load();
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, 6000);

    helperVideo.addEventListener("loadedmetadata", () => {
      const dur = Number(helperVideo.duration) || 0;
      const targetTime = dur > 0.4 ? Math.max(0.1, dur * fraction) : 0.1;
      helperVideo.currentTime = targetTime;

      const previewVid = document.getElementById("video-preview-el");
      if (previewVid && previewVid.readyState >= 1) {
        previewVid.currentTime = targetTime;
      }
    }, { once: true });

    helperVideo.addEventListener("seeked", () => {
      clearTimeout(timeoutId);
      try {
        const vw = helperVideo.videoWidth || 640;
        const vh = helperVideo.videoHeight || 360;
        const maxDim = 960;
        let cw = vw;
        let ch = vh;

        if (cw > maxDim || ch > maxDim) {
          if (cw >= ch) {
            ch = Math.round((ch * maxDim) / cw);
            cw = maxDim;
          } else {
            cw = Math.round((cw * maxDim) / ch);
            ch = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(helperVideo, 0, 0, cw, ch);

        const handleBlob = (blob) => {
          if (blob) {
            revokeIfBlobUrl(pendingPosterPreviewUrl);
            pendingPosterBlob = blob;
            pendingPosterPreviewUrl = URL.createObjectURL(blob);
            const posterEl = document.getElementById("poster-preview-el");
            const strip = document.getElementById("poster-strip");
            if (posterEl) posterEl.src = pendingPosterPreviewUrl;
            if (strip) strip.hidden = false;
          }
          cleanup();
          resolve();
        };

        canvas.toBlob((webpBlob) => {
          if (webpBlob) {
            handleBlob(webpBlob);
          } else {
            canvas.toBlob(handleBlob, "image/jpeg", 0.82);
          }
        }, "image/webp", 0.82);
      } catch (err) {
        cleanup();
        resolve();
      }
    }, { once: true });

    helperVideo.addEventListener("error", () => {
      clearTimeout(timeoutId);
      cleanup();
      resolve();
    }, { once: true });
  });
}

function renderVideoPreview(videoSrc, metaText, showPosterStrip) {
  const box = document.getElementById("video-preview-box");
  const vidEl = document.getElementById("video-preview-el");
  const metaEl = document.getElementById("video-preview-meta");
  const strip = document.getElementById("poster-strip");
  const labelText = document.getElementById("video-picker-label-text");

  if (vidEl) vidEl.src = videoSrc;
  if (metaEl) metaEl.textContent = metaText;
  if (strip) strip.hidden = !showPosterStrip;
  if (box) box.hidden = false;
  if (labelText) labelText.textContent = "Cambiar video";
}

function clearVideoSelection() {
  revokeIfBlobUrl(pendingVideoObjectUrl);
  revokeIfBlobUrl(pendingPosterPreviewUrl);

  pendingVideoFile = null;
  pendingVideoName = "";
  pendingVideoObjectUrl = "";
  pendingPosterBlob = null;
  pendingPosterPreviewUrl = "";
  existingVideoUrl = "";
  existingVideoFallbackUrl = "";
  existingVideoPoster = "";

  const input = document.getElementById("post-video-file");
  const box = document.getElementById("video-preview-box");
  const vidEl = document.getElementById("video-preview-el");
  const strip = document.getElementById("poster-strip");
  const labelText = document.getElementById("video-picker-label-text");

  if (input) input.value = "";
  if (vidEl) {
    vidEl.pause();
    vidEl.removeAttribute("src");
    vidEl.load();
  }
  if (strip) strip.hidden = true;
  if (box) box.hidden = true;
  if (labelText) labelText.textContent = "+ Seleccionar video del celular o PC";
}

/**
 * 6. Guardar Aviso Urgente en la nube
 */
async function handleUrgentSubmit(e) {
  e.preventDefault();
  if (isBusy) return;

  const active = document.getElementById("urgent-active").checked;
  const text = document.getElementById("urgent-text").value.trim();

  if (active && !text) {
    showBanner("urgent-feedback", "Escribe el texto del aviso antes de activarlo.", true);
    return;
  }

  const saveBtn = document.getElementById("btn-save-urgent");
  setBusyState(true);
  if (saveBtn) saveBtn.textContent = "Guardando...";
  hideBanner("urgent-feedback");

  try {
    await commitChangesToCloud({
      filesToUpload: [],
      commitMessage: "feat(gestion): actualizar aviso urgente superior",
      mutateSiteData: (siteData) => {
        const prevNotice = (siteData.config && siteData.config.urgentNotice) || {};
        siteData.config = {
          ...(siteData.config || cloudConfig),
          urgentNotice: {
            ...prevNotice,
            active,
            badge: prevNotice.badge || "Aviso Urgente",
            text,
            linkText: prevNotice.linkText || "Ver detalle"
          }
        };
        return siteData;
      }
    });

    showBanner("urgent-feedback", "Aviso superior actualizado en línea correctamente.", false);
  } catch (err) {
    showBanner("urgent-feedback", `Error al guardar aviso: ${err.message}`, true);
  } finally {
    setBusyState(false);
    if (saveBtn) saveBtn.textContent = "Actualizar Aviso";
  }
}

/**
 * 7. Publicar o Actualizar Historia / Obra / Aviso en la nube
 */
async function handlePostSubmit(e) {
  e.preventDefault();
  if (isBusy) return;

  const title = document.getElementById("post-title").value.trim();
  const category = resolveCategorySlug(document.getElementById("post-category").value);
  const date = document.getElementById("post-date").value || getTodayIsoDate();
  const dateApproximate = Boolean(document.getElementById("post-date-approx") && document.getElementById("post-date-approx").checked);
  const interventionEl = document.getElementById("post-intervention");
  const interventionType = interventionEl ? interventionEl.value : "Actividad comunitaria";
  const location = document.getElementById("post-location").value.trim();
  const status = document.getElementById("post-status").value;
  const summary = document.getElementById("post-summary").value.trim();
  const content = document.getElementById("post-content").value.trim();
  const facebookUrl = document.getElementById("post-facebook-url").value.trim();

  if (!title || !summary) {
    showBanner("post-feedback", "Completa el título y el resumen breve.", true);
    return;
  }

  setBusyState(true);
  hideBanner("post-feedback");
  updateProgress(5, "Preparando archivos para subir...");

  try {
    const filesToUpload = [];
    let finalImageUrl = existingImageUrl;
    let finalImageFallback = existingImageFallback;
    let finalVideoUrl = existingVideoUrl;
    let finalVideoFallback = existingVideoFallbackUrl;
    let finalVideoPoster = existingVideoPoster;

    if (pendingImageBlob && pendingImageName) {
      finalImageUrl = `IMG/${pendingImageName}`;
      finalImageFallback = "";
      filesToUpload.push({
        path: finalImageUrl,
        blob: pendingImageBlob,
        label: "fotografía"
      });
    }

    if (pendingVideoFile && pendingVideoName) {
      finalVideoUrl = `IMG/${pendingVideoName}`;
      finalVideoFallback = "";
      filesToUpload.push({
        path: finalVideoUrl,
        blob: pendingVideoFile,
        label: "video"
      });

      if (pendingPosterBlob) {
        const stem = pendingVideoName.replace(/\.[^.]+$/, "");
        const posterExt = pendingPosterBlob.type === "image/jpeg" ? "jpg" : "webp";
        finalVideoPoster = `IMG/${stem}-poster.${posterExt}`;
        filesToUpload.push({
          path: finalVideoPoster,
          blob: pendingPosterBlob,
          label: "portada del video"
        });
      } else {
        finalVideoPoster = "";
      }
    }

    const isEditing = Boolean(editingPostId);
    const targetEditId = editingPostId;

    await commitChangesToCloud({
      filesToUpload,
      commitMessage: isEditing
        ? `feat(gestion): editar publicacion "${title.slice(0, 48)}"`
        : `feat(gestion): nueva publicacion "${title.slice(0, 48)}"`,
      onProgress: (pct, msg) => updateProgress(pct, msg),
      mutateSiteData: (siteData) => {
        const pubs = Array.isArray(siteData.publications) ? [...siteData.publications] : [];
        let assignedId = targetEditId;

        if (!assignedId) {
          const maxId = pubs.reduce((acc, p) => Math.max(acc, Number(p.id) || 0), 0);
          assignedId = maxId + 1;
        }

        const postRecord = {
          id: assignedId,
          title,
          category,
          categoryLabel: getCategoryLabel(category),
          interventionType,
          date,
          dateApproximate,
          status,
          statusLabel: getStatusLabel(status),
          summary,
          content: content || summary,
          imageUrl: finalImageUrl,
          imagePending: !finalImageUrl,
          location,
          facebookUrl,
          featured: false
        };

        if (finalImageFallback) {
          postRecord.imageFallback = finalImageFallback;
        }
        if (finalVideoUrl) {
          postRecord.videoUrl = finalVideoUrl;
        }
        if (finalVideoFallback) {
          postRecord.videoFallbackUrl = finalVideoFallback;
        }
        if (finalVideoPoster) {
          postRecord.videoPoster = finalVideoPoster;
        }

        const updatedPubs = isEditing
          ? pubs.map(p => (Number(p.id) === Number(assignedId) ? postRecord : p))
          : [postRecord, ...pubs];

        siteData.publications = sortPostsChronologically(updatedPubs);
        return siteData;
      }
    });

    hideProgress();
    resetPostForm();
    showBanner(
      "post-feedback",
      isEditing
        ? "¡Cambios guardados en línea! En unos 30 segundos se actualizará la vista pública."
        : "¡Publicación subida con éxito! En unos 30 segundos estará visible para toda la comunidad.",
      false
    );
  } catch (err) {
    hideProgress();
    showBanner("post-feedback", `No se pudo publicar: ${err.message}`, true);
  } finally {
    setBusyState(false);
  }
}

/**
 * 8. Editar y Eliminar publicaciones existentes en línea
 */
function startEditingPost(id) {
  const post = cloudPosts.find(p => Number(p.id) === Number(id));
  if (!post) return;

  resetPostForm();
  editingPostId = Number(post.id);

  document.getElementById("post-title").value = post.title || "";
  document.getElementById("post-category").value = resolveCategorySlug(post.category);
  document.getElementById("post-date").value = String(post.date || getTodayIsoDate()).split("T")[0];
  const approxCheck = document.getElementById("post-date-approx");
  if (approxCheck) approxCheck.checked = Boolean(post.dateApproximate);
  const interventionEl = document.getElementById("post-intervention");
  if (interventionEl && post.interventionType) interventionEl.value = post.interventionType;
  document.getElementById("post-location").value = post.location || "";
  document.getElementById("post-status").value = post.status || "completed";
  document.getElementById("post-summary").value = post.summary || "";
  document.getElementById("post-content").value = post.content || "";
  document.getElementById("post-facebook-url").value = post.facebookUrl || "";

  if (post.imageUrl && !post.imagePending) {
    existingImageUrl = DataStore.cleanMediaPath(post.imageUrl);
    existingImageFallback = DataStore.cleanMediaPath(post.imageFallback);
    renderImagePreview(existingImageUrl, `Imagen actual: ${existingImageUrl}`);
  }

  if (post.videoUrl) {
    existingVideoUrl = DataStore.cleanMediaPath(post.videoUrl);
    existingVideoFallbackUrl = DataStore.cleanMediaPath(post.videoFallbackUrl);
    existingVideoPoster = DataStore.cleanMediaPath(post.videoPoster) || DataStore.inferVideoPoster(existingVideoUrl);
    renderVideoPreview(existingVideoUrl, `Video actual: ${existingVideoUrl}`, false);
  }

  const modeTitle = document.getElementById("form-mode-title");
  const cancelBtn = document.getElementById("btn-cancel-edit");
  const submitBtn = document.getElementById("btn-submit-post");

  if (modeTitle) modeTitle.textContent = "Editando Publicación";
  if (cancelBtn) cancelBtn.hidden = false;
  if (submitBtn) submitBtn.textContent = "Guardar Cambios en el Portal";

  document.getElementById("form-container").scrollIntoView({ behavior: "smooth" });
}

async function confirmAndDeletePost(id) {
  const post = cloudPosts.find(p => Number(p.id) === Number(id));
  if (!post) return;

  const ok = window.confirm(`¿Deseas eliminar del portal la publicación:\n"${post.title}"?`);
  if (!ok) return;

  setBusyState(true);
  hideBanner("post-feedback");

  try {
    await commitChangesToCloud({
      filesToUpload: [],
      commitMessage: `feat(gestion): eliminar publicacion "${post.title.slice(0, 48)}"`,
      mutateSiteData: (siteData) => {
        const pubs = Array.isArray(siteData.publications) ? siteData.publications : [];
        siteData.publications = pubs.filter(p => Number(p.id) !== Number(id));
        return siteData;
      }
    });

    if (editingPostId === Number(id)) {
      resetPostForm();
    }
    showBanner("post-feedback", "Publicación eliminada del portal correctamente.", false);
  } catch (err) {
    showBanner("post-feedback", `Error al eliminar: ${err.message}`, true);
  } finally {
    setBusyState(false);
  }
}

function resetPostForm() {
  editingPostId = null;

  const form = document.getElementById("post-form");
  if (form) form.reset();

  const dateInput = document.getElementById("post-date");
  if (dateInput) dateInput.value = getTodayIsoDate();

  const approxEl = document.getElementById("post-date-approx");
  if (approxEl) approxEl.checked = false;

  clearImageSelection();
  clearVideoSelection();

  const modeTitle = document.getElementById("form-mode-title");
  const cancelBtn = document.getElementById("btn-cancel-edit");
  const submitBtn = document.getElementById("btn-submit-post");

  if (modeTitle) modeTitle.textContent = "Nueva Publicación";
  if (cancelBtn) cancelBtn.hidden = true;
  if (submitBtn) submitBtn.textContent = "Publicar en el Portal";
}

function formatAdminDate(dateString, isApproximate) {
  if (!dateString) return "";
  const cleanIso = String(dateString).split("T")[0];
  const parts = cleanIso.split("-");
  if (parts.length !== 3) return cleanIso;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const monthsShort = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const monthsFull = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  if (isApproximate) {
    return `${monthsFull[monthIdx] || parts[1]} ${year}`;
  }
  return `${day} ${monthsShort[monthIdx] || parts[1]} ${year}`;
}

function renderRegisteredTable() {
  const tbody = document.getElementById("admin-tbody");
  const countLabel = document.getElementById("posts-count-label");
  const paginationEl = document.getElementById("admin-pagination");
  if (!tbody) return;

  const query = adminSearchQuery.trim().toLowerCase();
  const filtered = cloudPosts.filter(post => {
    const slug = typeof resolveCategorySlug === "function"
      ? resolveCategorySlug(post.category)
      : post.category;
    const catOk = adminFilterCat === "todas" || slug === adminFilterCat;
    if (!catOk) return false;

    if (!query) return true;
    const catLabel = post.categoryLabel || getCategoryLabel(slug);
    const haystack = [
      post.title || "",
      post.location || "",
      catLabel,
      post.interventionType || "",
      post.summary || "",
      post.date || ""
    ].join(" ").toLowerCase();
    return haystack.includes(query);
  });

  if (filtered.length === 0) {
    if (countLabel) {
      countLabel.textContent = `0 de ${cloudPosts.length} registros`;
    }
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="admin-table-empty">
          No se encontraron registros con los filtros actuales.
        </td>
      </tr>
    `;
    if (paginationEl) paginationEl.innerHTML = "";
    return;
  }

  const visible = filtered.slice(0, adminVisibleLimit);
  if (countLabel) {
    countLabel.textContent = `Mostrando ${visible.length} de ${filtered.length} registros`;
  }

  tbody.innerHTML = visible.map(post => {
    const slug = typeof resolveCategorySlug === "function"
      ? resolveCategorySlug(post.category)
      : post.category;
    const mediaTag = post.videoUrl
      ? "Video"
      : (post.imageUrl && !post.imagePending ? "Foto" : "Bitácora");
    const displayDate = formatAdminDate(post.date, Boolean(post.dateApproximate));
    const displayType = post.interventionType || post.statusLabel || getStatusLabel(post.status);

    return `
      <tr>
        <td class="admin-table-date">${escapeHtml(displayDate)}</td>
        <td class="admin-table-title">
          ${escapeHtml(post.title)}
          <span class="admin-media-tag">${mediaTag}</span>
        </td>
        <td>${escapeHtml(post.categoryLabel || getCategoryLabel(slug))}</td>
        <td>${escapeHtml(displayType)}</td>
        <td class="admin-table-actions">
          <button type="button" class="btn-secondary-action admin-btn-small" data-admin-action="edit" data-id="${post.id}">
            Editar
          </button>
          <button type="button" class="btn-secondary-action admin-btn-small admin-btn-danger" data-admin-action="delete" data-id="${post.id}">
            Eliminar
          </button>
        </td>
      </tr>
    `;
  }).join("");

  if (paginationEl) {
    const remaining = filtered.length - visible.length;
    const nextBatch = Math.min(20, remaining);
    const buttons = [];

    if (remaining > 0) {
      buttons.push(`
        <button type="button" class="btn-secondary-action ledger-more-btn" data-admin-page="more">
          Mostrar ${nextBatch} más ↓
        </button>
      `);
      if (remaining > 20) {
        buttons.push(`
          <button type="button" class="btn-secondary-action ledger-more-btn" data-admin-page="all">
            Ver todos (${filtered.length})
          </button>
        `);
      }
    }

    if (visible.length > ADMIN_TABLE_STEP) {
      buttons.push(`
        <button type="button" class="btn-secondary-action ledger-more-btn" data-admin-page="collapse">
          Contraer a ${ADMIN_TABLE_STEP} recientes ↑
        </button>
      `);
    }

    paginationEl.innerHTML = `
      <span class="ledger-count-info">Mostrando <strong>${visible.length}</strong> de <strong>${filtered.length}</strong> actividades</span>
      <div class="ledger-pagination-actions">${buttons.join("")}</div>
    `;
  }
}

/**
 * 9. Motor de subida atómica a GitHub vía Netlify Git Gateway (con barra de progreso real)
 */
async function commitChangesToCloud({ filesToUpload, mutateSiteData, commitMessage, onProgress }) {
  const report = (pct, msg) => {
    if (typeof onProgress === "function") onProgress(pct, msg);
  };

  const isLocalDev =
    window.location.protocol === "file:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  const token = await getNetlifyJwt();
  if (!token) {
    if (isLocalDev) {
      report(60, "Guardando cambios en vista previa local...");
      const localCopy = JSON.parse(JSON.stringify({
        config: cloudConfig,
        publications: cloudPosts
      }));
      const updatedLocal = mutateSiteData(localCopy);
      report(100, "¡Guardado localmente en el navegador!");
      applyUpdatedDataLocally(updatedLocal);
      return;
    }
    if (window.netlifyIdentity) {
      window.netlifyIdentity.open("login");
    }
    throw new Error("Tu sesión expiró. Inicia sesión nuevamente para guardar.");
  }

  // Estrategia principal: Commit atómico único mediante Git Data API (igual que Decap CMS)
  let refRes = await fetch(`${GIT_GATEWAY_BASE}/git/refs/heads/main?t=${Date.now()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json"
    },
    cache: "no-store"
  });

  if (refRes.status === 404) {
    refRes = await fetch(`${GIT_GATEWAY_BASE}/git/ref/heads/main?t=${Date.now()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json"
      },
      cache: "no-store"
    });
  }

  if (!refRes.ok) {
    // Respaldo automático vía Contents API si Git Data refs no responde
    return await commitViaContentsFallback({ filesToUpload, mutateSiteData, commitMessage, token, report });
  }

  const refData = await refRes.json();
  const headCommitSha = refData.object && refData.object.sha;
  if (!headCommitSha) {
    return await commitViaContentsFallback({ filesToUpload, mutateSiteData, commitMessage, token, report });
  }

  const [commitRes, jsonFileRes] = await Promise.all([
    fetch(`${GIT_GATEWAY_BASE}/git/commits/${headCommitSha}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json"
      }
    }),
    fetch(`${GIT_GATEWAY_BASE}/contents/content/site-data.json?ref=${headCommitSha}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json"
      },
      cache: "no-store"
    })
  ]);

  if (!commitRes.ok || !jsonFileRes.ok) {
    return await commitViaContentsFallback({ filesToUpload, mutateSiteData, commitMessage, token, report });
  }

  const commitMeta = await commitRes.json();
  const baseTreeSha = commitMeta.tree.sha;
  const jsonFileMeta = await jsonFileRes.json();
  const currentSiteData = JSON.parse(base64ToUtf8(jsonFileMeta.content || ""));

  const treeEntries = [];
  const totalBytes = filesToUpload.reduce((acc, f) => acc + (f.blob.size || 1), 0) || 1;
  let uploadedBytesBefore = 0;

  for (let i = 0; i < filesToUpload.length; i++) {
    const item = filesToUpload[i];
    report(
      12 + Math.round((uploadedBytesBefore / totalBytes) * 68),
      `Subiendo ${item.label}...`
    );

    const base64Data = await blobToBase64(item.blob);
    const blobRes = await xhrJsonRequest({
      method: "POST",
      url: `${GIT_GATEWAY_BASE}/git/blobs`,
      token,
      bodyObj: {
        content: base64Data,
        encoding: "base64"
      },
      onUploadProgress: (loaded, total) => {
        const fileFraction = total > 0 ? loaded / total : 0;
        const currentOverall = (uploadedBytesBefore + fileFraction * (item.blob.size || 1)) / totalBytes;
        const pct = Math.min(82, 12 + Math.round(currentOverall * 70));
        report(pct, `Subiendo ${item.label} (${Math.round(fileFraction * 100)}%)...`);
      }
    });

    uploadedBytesBefore += item.blob.size || 1;
    treeEntries.push({
      path: item.path,
      mode: "100644",
      type: "blob",
      sha: blobRes.sha
    });
  }

  report(86, "Actualizando registro comunitario...");
  const updatedSiteData = mutateSiteData(currentSiteData);
  const updatedJsonText = JSON.stringify(updatedSiteData, null, 2) + "\n";

  const jsonBlobRes = await xhrJsonRequest({
    method: "POST",
    url: `${GIT_GATEWAY_BASE}/git/blobs`,
    token,
    bodyObj: {
      content: utf8ToBase64(updatedJsonText),
      encoding: "base64"
    }
  });

  treeEntries.push({
    path: "content/site-data.json",
    mode: "100644",
    type: "blob",
    sha: jsonBlobRes.sha
  });

  const newTreeRes = await xhrJsonRequest({
    method: "POST",
    url: `${GIT_GATEWAY_BASE}/git/trees`,
    token,
    bodyObj: {
      base_tree: baseTreeSha,
      tree: treeEntries
    }
  });

  report(93, "Confirmando publicación en el servidor...");
  const newCommitRes = await xhrJsonRequest({
    method: "POST",
    url: `${GIT_GATEWAY_BASE}/git/commits`,
    token,
    bodyObj: {
      message: commitMessage,
      tree: newTreeRes.sha,
      parents: [headCommitSha]
    }
  });

  await xhrJsonRequest({
    method: "PATCH",
    url: `${GIT_GATEWAY_BASE}/git/refs/heads/main`,
    token,
    bodyObj: {
      sha: newCommitRes.sha
    }
  });

  report(100, "¡Completado!");
  applyUpdatedDataLocally(updatedSiteData);
}

/**
 * Respaldo automático vía endpoint /contents/ por si algún proxy bloquea /git/refs
 */
async function commitViaContentsFallback({ filesToUpload, mutateSiteData, commitMessage, token, report }) {
  for (let i = 0; i < filesToUpload.length; i++) {
    const item = filesToUpload[i];
    const base64Data = await blobToBase64(item.blob);
    await xhrJsonRequest({
      method: "PUT",
      url: `${GIT_GATEWAY_BASE}/contents/${encodeURI(item.path)}`,
      token,
      bodyObj: {
        message: `${commitMessage} (${item.label})`,
        content: base64Data,
        branch: "main"
      },
      onUploadProgress: (loaded, total) => {
        const pct = total > 0 ? Math.round((loaded / total) * 75) + 10 : 50;
        report(pct, `Subiendo ${item.label}...`);
      }
    });
  }

  report(88, "Guardando publicación...");
  const getRes = await fetch(`${GIT_GATEWAY_BASE}/contents/content/site-data.json?ref=main&t=${Date.now()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json"
    },
    cache: "no-store"
  });

  if (!getRes.ok) {
    throw new Error(`No se pudo consultar site-data.json (HTTP ${getRes.status}).`);
  }

  const fileMeta = await getRes.json();
  const currentSiteData = JSON.parse(base64ToUtf8(fileMeta.content || ""));
  const updatedSiteData = mutateSiteData(currentSiteData);
  const updatedJsonText = JSON.stringify(updatedSiteData, null, 2) + "\n";

  await xhrJsonRequest({
    method: "PUT",
    url: `${GIT_GATEWAY_BASE}/contents/content/site-data.json`,
    token,
    bodyObj: {
      message: commitMessage,
      content: utf8ToBase64(updatedJsonText),
      sha: fileMeta.sha,
      branch: "main"
    }
  });

  report(100, "¡Completado!");
  applyUpdatedDataLocally(updatedSiteData);
}

function applyUpdatedDataLocally(updatedSiteData) {
  cloudConfig = updatedSiteData.config || cloudConfig;
  cloudPosts = sortPostsChronologically(updatedSiteData.publications || []);
  DataStore.saveConfig(cloudConfig);
  DataStore.savePosts(cloudPosts);
  populateUrgentForm();
  renderRegisteredTable();
}

function xhrJsonRequest({ method, url, token, bodyObj, onUploadProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Accept", "application/vnd.github.v3+json");
    xhr.setRequestHeader("Content-Type", "application/json");

    if (xhr.upload && typeof onUploadProgress === "function") {
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          onUploadProgress(ev.loaded, ev.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText || "{}"));
        } catch (e) {
          resolve({});
        }
      } else {
        reject(new Error(`Servidor respondió HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Fallo de conexión de red al subir archivos."));
    xhr.send(JSON.stringify(bodyObj));
  });
}

async function getNetlifyJwt() {
  if (window.netlifyIdentity) {
    const user = window.netlifyIdentity.currentUser();
    if (user) {
      try {
        return await user.jwt();
      } catch (e) {
        return await user.jwt(true);
      }
    }
  }

  try {
    const rawGotrue = localStorage.getItem("gotrue.user");
    if (rawGotrue) {
      const parsed = JSON.parse(rawGotrue);
      if (parsed && parsed.token && parsed.token.access_token) {
        return parsed.token.access_token;
      }
    }
  } catch (e) {
    // Sin sesión local
  }
  return null;
}

/**
 * 10. Utilidades de interfaz y codificación
 */
function setBusyState(busy) {
  isBusy = busy;
  const submitBtn = document.getElementById("btn-submit-post");
  const urgentBtn = document.getElementById("btn-save-urgent");
  if (submitBtn) submitBtn.disabled = busy;
  if (urgentBtn) urgentBtn.disabled = busy;
}

function updateProgress(percent, text) {
  const box = document.getElementById("publish-progress-box");
  const fill = document.getElementById("publish-progress-fill");
  const label = document.getElementById("publish-progress-text");

  if (box) box.hidden = false;
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  if (label) label.textContent = text;
}

function hideProgress() {
  const box = document.getElementById("publish-progress-box");
  const fill = document.getElementById("publish-progress-fill");
  if (box) box.hidden = true;
  if (fill) fill.style.width = "0%";
}

function showBanner(elementId, message, isError) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle("admin-feedback-msg--error", Boolean(isError));
}

function hideBanner(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.hidden = true;
    el.textContent = "";
  }
}

function buildSafeFileSlug(originalName) {
  const base = String(originalName || "archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "media";
  const stamp = Date.now().toString(36).slice(-5);
  return `${base}-${stamp}`;
}

function getExtension(filename, fallback) {
  const match = String(filename || "").match(/\.([a-zA-Z0-9]{2,5})$/);
  return match ? match[1].toLowerCase() : fallback;
}

function formatBytes(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function revokeIfBlobUrl(url) {
  if (typeof url === "string" && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function getTodayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo seleccionado."));
    reader.readAsDataURL(blob);
  });
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const clean = String(b64 || "").replace(/\s+/g, "");
  if (!clean) return "{}";
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function getCategoryLabel(category) {
  if (typeof resolveCategoryLabel === "function") {
    return resolveCategoryLabel(category);
  }
  return "Infraestructura y servicios";
}

function getStatusLabel(status) {
  switch (status) {
    case "completed": return "Concluida";
    case "in_progress": return "Convocatoria Abierta";
    case "upcoming": return "Próximo Evento";
    case "notice": return "Aviso Oficial";
    default: return "Registrada";
  }
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
