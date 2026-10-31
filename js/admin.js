// ==========================================================================
// RECONSTRUYENDO CASACUARÁN — Puente de Sincronización a la Nube y Redirección
// Redirige automáticamente al CMS oficial (admin/index.html) salvo que existan
// borradores locales pendientes de publicar en el servidor.
// ==========================================================================

let cachedRemoteData = null;
let pendingDrafts = [];

document.addEventListener("DOMContentLoaded", () => {
  initSyncOrRedirect();
});

async function initSyncOrRedirect() {
  try {
    const res = await fetch("./content/site-data.json", { cache: "no-cache" });
    if (res.ok) {
      cachedRemoteData = await res.json();
    }
  } catch (e) {
    console.warn("No fue posible consultar content/site-data.json:", e);
  }

  const remotePubs = (cachedRemoteData && Array.isArray(cachedRemoteData.publications))
    ? cachedRemoteData.publications
    : [];

  pendingDrafts = DataStore.getLocalOnlyDrafts(remotePubs).map(cleanDraftForCloud);

  // Si no hay borradores locales pendientes, redirigir de inmediato al panel oficial con selector de archivos
  if (pendingDrafts.length === 0) {
    window.location.replace("admin/index.html");
    return;
  }

  const redirectPanel = document.getElementById("redirect-panel");
  const syncPanel = document.getElementById("sync-panel");
  if (redirectPanel) redirectPanel.hidden = true;
  if (syncPanel) syncPanel.hidden = false;

  renderPendingDrafts();
  setupSyncActions();
}

function cleanDraftForCloud(raw) {
  let cleanVid = DataStore.cleanMediaPath(raw.videoUrl);
  let cleanImg = DataStore.cleanMediaPath(raw.imageUrl);
  if (/\.(mp4|mov|m4v|webm)$/i.test(cleanImg) && !cleanVid) {
    cleanVid = cleanImg;
    cleanImg = "";
  }
  const cleanPoster = DataStore.cleanMediaPath(raw.videoPoster) || DataStore.inferVideoPoster(cleanVid);

  const post = {
    id: Number(raw.id) || Date.now(),
    title: String(raw.title || "").trim(),
    category: raw.category || "obras",
    categoryLabel: raw.categoryLabel || getCategoryLabel(raw.category),
    date: String(raw.date || new Date().toISOString().split("T")[0]).split("T")[0],
    status: raw.status || "completed",
    statusLabel: raw.statusLabel || getStatusLabel(raw.status),
    summary: String(raw.summary || "").trim(),
    content: String(raw.content || raw.summary || "").trim(),
    imageUrl: cleanImg,
    imagePending: !cleanImg,
    location: String(raw.location || "").trim(),
    facebookUrl: String(raw.facebookUrl || "").trim(),
    featured: Boolean(raw.featured)
  };

  if (cleanVid) {
    post.videoUrl = cleanVid;
  }
  if (cleanPoster) {
    post.videoPoster = cleanPoster;
  }
  return post;
}

function renderPendingDrafts() {
  const container = document.getElementById("drafts-container");
  if (!container) return;

  if (pendingDrafts.length === 0) {
    window.location.replace("admin/index.html");
    return;
  }

  container.innerHTML = pendingDrafts.map(draft => {
    const mediaInfo = draft.videoUrl
      ? `Video vinculado: ${draft.videoUrl}${draft.videoPoster ? ` (Portada: ${draft.videoPoster})` : ""}`
      : (draft.imageUrl ? `Fotografía vinculada: ${draft.imageUrl}` : "Formato boletín tipográfico (sin foto/video)");

    return `
      <article class="admin-draft-item">
        <div>
          <p class="admin-draft-meta">${escapeHtml(draft.date)} &bull; ${escapeHtml(draft.categoryLabel)}</p>
          <h3 class="admin-draft-name">${escapeHtml(draft.title)}</h3>
          <p class="admin-draft-summary">${escapeHtml(draft.summary)}</p>
          <p class="admin-draft-media">${escapeHtml(mediaInfo)}</p>
        </div>
        <div class="admin-draft-btns">
          <button type="button" class="btn-secondary-action" data-draft-action="copy" data-id="${draft.id}">
            Copiar texto
          </button>
          <button type="button" class="btn-secondary-action" data-draft-action="discard" data-id="${draft.id}">
            Descartar
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function setupSyncActions() {
  const publishBtn = document.getElementById("btn-publish-cloud");
  if (publishBtn) {
    publishBtn.addEventListener("click", publishDraftsToGitGateway);
  }

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-draft-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-draft-action");
    const id = Number(btn.getAttribute("data-id"));
    const draft = pendingDrafts.find(d => Number(d.id) === id);
    if (!draft) return;

    if (action === "copy") {
      const fullText = `${draft.title}\nFecha: ${draft.date}\nUbicación: ${draft.location}\n\nResumen:\n${draft.summary}\n\nContenido:\n${draft.content}`;
      try {
        await navigator.clipboard.writeText(fullText);
        showFeedback("Texto copiado al portapapeles.", false);
      } catch (err) {
        showFeedback("No se pudo copiar automáticamente.", true);
      }
    } else if (action === "discard") {
      DataStore.deletePost(id);
      pendingDrafts = pendingDrafts.filter(d => Number(d.id) !== id);
      renderPendingDrafts();
    }
  });
}

async function getNetlifyJwt() {
  if (window.netlifyIdentity) {
    const user = window.netlifyIdentity.currentUser();
    if (user) {
      return await user.jwt();
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
    const rawCms = localStorage.getItem("netlify-cms-user");
    if (rawCms) {
      const parsed = JSON.parse(rawCms);
      if (parsed && parsed.token) {
        return parsed.token;
      }
    }
  } catch (e) {
    console.warn("No se encontró sesión local de Identity:", e);
  }
  return null;
}

async function publishDraftsToGitGateway() {
  const publishBtn = document.getElementById("btn-publish-cloud");
  showFeedback("Conectando con el servidor de Casacuarán...", false);

  let token = await getNetlifyJwt();
  if (!token) {
    if (window.netlifyIdentity) {
      showFeedback("Inicia sesión con tu cuenta de administrador para publicar en la nube.", true);
      window.netlifyIdentity.open("login");
      window.netlifyIdentity.on("login", () => {
        window.netlifyIdentity.close();
        publishDraftsToGitGateway();
      });
      return;
    }
    showFeedback("Abre primero el Panel Oficial para iniciar sesión.", true);
    return;
  }

  if (publishBtn) publishBtn.disabled = true;

  try {
    const endpoint = "/.netlify/git/github/contents/content/site-data.json";
    const getRes = await fetch(`${endpoint}?ref=main`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json"
      }
    });

    if (!getRes.ok) {
      throw new Error(`No se pudo leer el repositorio remoto (HTTP ${getRes.status}).`);
    }

    const fileMeta = await getRes.json();
    const currentJsonStr = base64ToUtf8(fileMeta.content || "");
    const currentData = JSON.parse(currentJsonStr);
    const existingPubs = Array.isArray(currentData.publications) ? currentData.publications : [];

    // Re-filtrar para evitar duplicados y asignar IDs consecutivos limpios
    const freshDrafts = DataStore.getLocalOnlyDrafts(existingPubs).map(cleanDraftForCloud);
    let maxId = existingPubs.reduce((acc, p) => Math.max(acc, Number(p.id) || 0), 0);
    const preparedDrafts = freshDrafts.map(d => {
      maxId += 1;
      const copy = { ...d, id: maxId };
      delete copy._isLocalDraft;
      return copy;
    });

    const combined = [...preparedDrafts, ...existingPubs];
    combined.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    const updatedData = {
      config: currentData.config || DataStore.getConfig(),
      publications: combined
    };

    const encodedContent = utf8ToBase64(JSON.stringify(updatedData, null, 2) + "\n");

    const putRes = await fetch(endpoint, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "feat(cms): publicar comunicados pendientes en el portal publico",
        content: encodedContent,
        sha: fileMeta.sha,
        branch: "main"
      })
    });

    if (!putRes.ok) {
      throw new Error(`No se pudo guardar en el servidor (HTTP ${putRes.status}).`);
    }

    DataStore.savePosts(combined);
    showFeedback("¡Publicaciones subidas con éxito! En ~30 segundos estarán visibles para todo el público. Redirigiendo...", false);

    setTimeout(() => {
      window.location.replace("index.html");
    }, 1800);
  } catch (err) {
    if (publishBtn) publishBtn.disabled = false;
    showFeedback(`Error al sincronizar: ${err.message}`, true);
  }
}

function showFeedback(msg, isError) {
  const el = document.getElementById("sync-feedback");
  if (!el) return;
  el.hidden = false;
  el.textContent = msg;
  el.classList.toggle("admin-sync-status--error", Boolean(isError));
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
  const clean = b64.replace(/\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function getCategoryLabel(category) {
  switch (category) {
    case "obras": return "Obras Públicas";
    case "faenas": return "Faenas Comunitarias";
    case "salud": return "Salud y Bienestar";
    case "cultura": return "Tradición y Cultura";
    case "avisos": return "Avisos Delegacionales";
    default: return "Comunidad";
  }
}

function getStatusLabel(status) {
  switch (status) {
    case "completed": return "Concluida";
    case "in_progress": return "En ejecución";
    case "upcoming": return "En preparación";
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
