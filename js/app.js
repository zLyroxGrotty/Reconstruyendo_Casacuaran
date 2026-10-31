// ==========================================================================
// RECONSTRUYENDO CASACUARÁN — Lógica del Portal Público
// Diseño Editorial y Minimalismo Cívico (City Bureau / Casa Wabi)
// ==========================================================================

let currentCategory = "todas";
let currentSearch = "";
let allPosts = [];
let siteConfig = {};

// Redirección automática de tokens de invitación/recuperación de Netlify Identity hacia /admin/
(function checkNetlifyIdentityRedirect() {
  const hash = window.location.hash || "";
  if (
    hash.includes("invite_token=") ||
    hash.includes("confirmation_token=") ||
    hash.includes("recovery_token=") ||
    hash.includes("email_change_token=")
  ) {
    window.location.replace("admin/index.html" + hash);
  }
})();

document.addEventListener("DOMContentLoaded", () => {
  initPortal();
});

async function initPortal() {
  const data = await DataStore.initFromRemoteOrLocal();
  siteConfig = data.config || DataStore.getConfig();
  allPosts = normalizePublications(data.publications || DataStore.getPosts());

  renderUrgentBanner();
  renderStats();
  renderPublications();
  renderWorksTable();

  setupHeaderScroll();
  setupMobileMenu();
  setupHeroVideoControl();
  setupFiltersAndSearch();
  setupActionDelegation();
  setupModalEvents();
}

/**
 * Normaliza entradas creadas desde Decap CMS (asigna ID único, etiquetas y rutas limpias)
 */
function normalizePublications(posts) {
  if (!Array.isArray(posts)) return [];

  const categoryLabels = {
    obras: "Obras Públicas",
    faenas: "Faenas Comunitarias",
    salud: "Salud y Bienestar",
    cultura: "Tradición y Cultura",
    avisos: "Avisos Delegacionales"
  };

  const statusLabels = {
    completed: "Concluida",
    in_progress: "En ejecución",
    upcoming: "En preparación",
    notice: "Aviso Oficial"
  };

  const usedIds = new Set();
  const cleanPath = (val) => (typeof val === "string" ? val.trim().replace(/^\/+/, "") : "");

  return posts.map((raw, idx) => {
    const post = { ...raw };
    let candidateId = Number(post.id);
    if (!candidateId || usedIds.has(candidateId)) {
      candidateId = idx + 1;
      while (usedIds.has(candidateId)) candidateId++;
    }
    usedIds.add(candidateId);
    post.id = candidateId;

    post.imageUrl = cleanPath(post.imageUrl);
    post.imageFallback = cleanPath(post.imageFallback);
    post.videoUrl = cleanPath(post.videoUrl);
    post.videoFallbackUrl = cleanPath(post.videoFallbackUrl);
    post.videoPoster = cleanPath(post.videoPoster);

    if (!post.categoryLabel) {
      post.categoryLabel = categoryLabels[post.category] || "Comunidad";
    }
    if (!post.statusLabel) {
      post.statusLabel = statusLabels[post.status] || "Registrada";
    }
    return post;
  });
}

/**
 * 1. Cintillo superior de aviso urgente
 */
function renderUrgentBanner() {
  const banner = document.getElementById("urgent-banner");
  if (!banner) return;

  const dismissed = sessionStorage.getItem("casacuaran_urgent_dismissed") === "1";
  const notice = siteConfig.urgentNotice;

  if (!dismissed && notice && notice.active && notice.text) {
    banner.hidden = false;
    banner.innerHTML = `
      <div class="container urgent-bar-inner">
        <div class="urgent-bar-lead">
          <span class="urgent-bar-badge">${escapeHtml(notice.badge || "Aviso")}</span>
          <span class="urgent-bar-text">${escapeHtml(notice.text)}</span>
        </div>
        <div class="urgent-bar-actions">
          ${notice.postId ? `
            <button type="button" class="urgent-bar-link" data-action="open-post" data-id="${notice.postId}">
              ${escapeHtml(notice.linkText || "Ver detalle")}
            </button>
          ` : ""}
          <button type="button" class="urgent-bar-close" data-action="dismiss-urgent" aria-label="Ocultar aviso">
            &times;
          </button>
        </div>
      </div>
    `;
  } else {
    banner.hidden = true;
    banner.innerHTML = "";
  }
}

/**
 * 2. Cifras documentadas en la sección Nosotros
 */
function renderStats() {
  const obrasCount = allPosts.filter(p => p.category === "obras").length;
  const faenasCount = allPosts.filter(p => p.category === "faenas").length;

  const obrasEl = document.getElementById("stat-obras");
  const faenasEl = document.getElementById("stat-faenas");

  if (obrasEl) obrasEl.textContent = obrasCount;
  if (faenasEl) faenasEl.textContent = faenasCount;
}

/**
 * 3. Galería de Historias (con imagen/video) + Boletín limpio (solo texto)
 */
function renderPublications() {
  const galleryEl = document.getElementById("stories-gallery");
  const dispatchesBlock = document.getElementById("dispatches-block");
  const dispatchesHeading = document.getElementById("dispatches-heading");
  const dispatchesList = document.getElementById("dispatches-list");
  const emptyEl = document.getElementById("empty-posts");

  if (!galleryEl || !dispatchesBlock || !dispatchesList) return;

  const query = currentSearch.trim().toLowerCase();

  const filtered = allPosts.filter(post => {
    const matchesCat = currentCategory === "todas" || post.category === currentCategory;
    const matchesQuery = !query ||
      (post.title && post.title.toLowerCase().includes(query)) ||
      (post.summary && post.summary.toLowerCase().includes(query)) ||
      (post.location && post.location.toLowerCase().includes(query));
    return matchesCat && matchesQuery;
  });

  if (filtered.length === 0) {
    galleryEl.innerHTML = "";
    galleryEl.hidden = true;
    dispatchesList.innerHTML = "";
    dispatchesBlock.hidden = true;
    if (emptyEl) emptyEl.hidden = false;
    return;
  }

  if (emptyEl) emptyEl.hidden = true;

  const hasVisualMedia = (post) =>
    (Boolean(post.imageUrl) && !post.imagePending) || Boolean(post.videoUrl);

  const visualPosts = filtered.filter(hasVisualMedia);
  const textPosts = filtered.filter(p => !hasVisualMedia(p));

  // Renderizar galería visual
  if (visualPosts.length > 0) {
    galleryEl.hidden = false;
    galleryEl.innerHTML = visualPosts.map(post => {
      const formattedDate = formatDate(post.date);
      const posterOrImage = post.videoUrl
        ? (post.videoPoster || (!post.imagePending ? post.imageUrl : ""))
        : post.imageUrl;
      const fallbackImg = post.imageFallback || posterOrImage;
      const whatsappHref = buildWhatsAppLink(post);

      let cardMediaHtml = "";
      if (posterOrImage) {
        const isWebp = posterOrImage.toLowerCase().endsWith(".webp");
        cardMediaHtml = isWebp ? `
          <picture>
            <source srcset="${escapeHtml(posterOrImage)}" type="image/webp">
            <img src="${escapeHtml(fallbackImg)}"
                 alt="${escapeHtml(post.title)}"
                 class="story-media-img"
                 loading="lazy">
          </picture>
        ` : `
          <img src="${escapeHtml(posterOrImage)}"
               alt="${escapeHtml(post.title)}"
               class="story-media-img"
               loading="lazy">
        `;
      } else if (post.videoUrl) {
        cardMediaHtml = `
          <video src="${escapeHtml(post.videoUrl)}#t=0.8"
                 preload="metadata"
                 muted
                 playsinline
                 class="story-media-img"
                 aria-hidden="true"></video>
        `;
      }

      return `
        <article class="story-card">
          <div class="story-media-wrap" data-action="open-post" data-id="${post.id}" role="button" tabindex="0" aria-label="Abrir: ${escapeHtml(post.title)}">
            ${cardMediaHtml}
            ${post.videoUrl ? `<span class="story-video-indicator">Video &bull; Ver crónica</span>` : ""}
          </div>

          <p class="story-meta">
            <span class="story-meta-cat">${escapeHtml(post.categoryLabel)}</span>
            &nbsp;&mdash;&nbsp; ${formattedDate}
          </p>

          <h3 class="story-title">
            <button type="button" class="story-title-btn" data-action="open-post" data-id="${post.id}">
              ${escapeHtml(post.title)}
            </button>
          </h3>

          <p class="story-summary">${escapeHtml(post.summary)}</p>

          <div class="story-links">
            <button type="button" class="text-action-btn" data-action="open-post" data-id="${post.id}">
              ${post.videoUrl ? "Reproducir y leer" : "Leer historia"} &rarr;
            </button>
            <a href="${whatsappHref}" target="_blank" rel="noopener noreferrer" class="text-share-link">
              WhatsApp
            </a>
          </div>
        </article>
      `;
    }).join("");
  } else {
    galleryEl.innerHTML = "";
    galleryEl.hidden = true;
  }

  // Renderizar comunicados tipográficos sin recuadros vacíos
  if (textPosts.length > 0) {
    dispatchesBlock.hidden = false;
    dispatchesBlock.classList.toggle("dispatches-block--standalone", visualPosts.length === 0);
    if (dispatchesHeading) {
      dispatchesHeading.hidden = visualPosts.length === 0;
    }

    dispatchesList.innerHTML = textPosts.map(post => {
      const formattedDate = formatDate(post.date);
      const whatsappHref = buildWhatsAppLink(post);

      return `
        <article class="dispatch-row">
          <div class="dispatch-date">
            ${formattedDate}
            <span class="dispatch-cat">${escapeHtml(post.categoryLabel)}</span>
          </div>

          <div>
            <h4 class="dispatch-title">
              <button type="button" class="story-title-btn" data-action="open-post" data-id="${post.id}">
                ${escapeHtml(post.title)}
              </button>
            </h4>
            <p class="dispatch-summary">${escapeHtml(post.summary)}</p>
          </div>

          <div class="dispatch-actions">
            <button type="button" class="text-action-btn" data-action="open-post" data-id="${post.id}">
              Leer aviso &rarr;
            </button>
            <a href="${whatsappHref}" target="_blank" rel="noopener noreferrer" class="text-share-link">
              Compartir
            </a>
          </div>
        </article>
      `;
    }).join("");
  } else {
    dispatchesList.innerHTML = "";
    dispatchesBlock.hidden = true;
  }
}

/**
 * 4. Registro abierto de obras y faenas
 */
function renderWorksTable() {
  const tbody = document.getElementById("obras-tbody");
  if (!tbody) return;

  const works = allPosts.filter(p => p.category === "obras" || p.category === "faenas");

  if (works.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">No hay obras o faenas registradas por el momento.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = works.map(post => {
    const statusClass = `works-status works-status--${escapeHtml(post.status || "notice")}`;
    return `
      <tr>
        <td class="works-date">${formatDate(post.date)}</td>
        <td class="works-name">${escapeHtml(post.title)}</td>
        <td>${escapeHtml(post.location || "San Pablo Casacuarán")}</td>
        <td><span class="${statusClass}">${escapeHtml(post.statusLabel)}</span></td>
        <td>
          <button type="button" class="text-action-btn" data-action="open-post" data-id="${post.id}">
            Consultar &rarr;
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

/**
 * 5. Control accesible del video de portada (Yuriria_header)
 */
function setupHeroVideoControl() {
  const video = document.getElementById("hero-video");
  const toggleBtn = document.getElementById("hero-video-toggle");
  if (!video || !toggleBtn) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    video.pause();
    video.removeAttribute("autoplay");
    toggleBtn.textContent = "Reproducir";
    toggleBtn.setAttribute("aria-label", "Reproducir video de portada");
  }

  toggleBtn.addEventListener("click", () => {
    if (video.paused) {
      video.play();
      toggleBtn.textContent = "Pausar";
      toggleBtn.setAttribute("aria-label", "Pausar video de portada");
    } else {
      video.pause();
      toggleBtn.textContent = "Reproducir";
      toggleBtn.setAttribute("aria-label", "Reproducir video de portada");
    }
  });
}

/**
 * 6. Cabecera minimalista y menú móvil
 */
function setupHeaderScroll() {
  const header = document.getElementById("site-header");
  if (!header) return;

  window.addEventListener("scroll", () => {
    header.classList.toggle("is-scrolled", window.scrollY > 16);
  }, { passive: true });
}

function setupMobileMenu() {
  const toggleBtn = document.getElementById("mobile-nav-toggle");
  const panel = document.getElementById("mobile-menu-panel");
  if (!toggleBtn || !panel) return;

  const closeMenu = () => {
    panel.hidden = true;
    toggleBtn.setAttribute("aria-expanded", "false");
    toggleBtn.textContent = "Menú";
    document.body.style.overflow = "";
  };

  toggleBtn.addEventListener("click", () => {
    const isOpen = !panel.hidden;
    if (isOpen) {
      closeMenu();
    } else {
      panel.hidden = false;
      toggleBtn.setAttribute("aria-expanded", "true");
      toggleBtn.textContent = "Cerrar";
      document.body.style.overflow = "hidden";
    }
  });

  panel.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      closeMenu();
    }
  });
}

/**
 * 7. Filtros y buscador
 */
function setupFiltersAndSearch() {
  const filterBtns = document.querySelectorAll(".filter-link");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      currentCategory = btn.getAttribute("data-category") || "todas";
      renderPublications();
    });
  });

  const searchInput = document.getElementById("search-posts");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearch = e.target.value || "";
      renderPublications();
    });
  }
}

/**
 * 8. Delegación global de eventos (cero onclick inline)
 */
function setupActionDelegation() {
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-action]");
    if (!trigger) return;

    const action = trigger.getAttribute("data-action");
    if (action === "open-post") {
      const id = Number(trigger.getAttribute("data-id"));
      if (id) openPostModal(id);
    } else if (action === "dismiss-urgent") {
      sessionStorage.setItem("casacuaran_urgent_dismissed", "1");
      renderUrgentBanner();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const trigger = e.target.closest(".story-media-wrap[data-action='open-post']");
      if (trigger) {
        e.preventDefault();
        const id = Number(trigger.getAttribute("data-id"));
        if (id) openPostModal(id);
      }
    }
  });
}

/**
 * 9. Modal de lectura (<dialog>) con soporte para videos horizontales y verticales 9:16
 */
function openPostModal(id) {
  const post = allPosts.find(p => p.id === id);
  if (!post) return;

  const dialog = document.getElementById("post-modal");
  const categoryEl = document.getElementById("modal-category");
  const contentArea = document.getElementById("modal-content-area");
  if (!dialog || !contentArea) return;

  if (categoryEl) {
    categoryEl.textContent = post.categoryLabel || "Comunicado";
  }

  let mediaHtml = "";
  if (post.videoUrl) {
    const posterAttr = post.videoPoster ? ` poster="${escapeHtml(post.videoPoster)}"` : "";
    mediaHtml = `
      <div class="modal-media">
        <video controls preload="metadata" playsinline${posterAttr} aria-label="Video: ${escapeHtml(post.title)}">
          <source src="${escapeHtml(post.videoUrl)}" type="video/mp4">
          ${post.videoFallbackUrl ? `<source src="${escapeHtml(post.videoFallbackUrl)}" type="video/mp4">` : ""}
        </video>
      </div>
    `;
  } else if (post.imageUrl && !post.imagePending) {
    const isWebp = post.imageUrl.toLowerCase().endsWith(".webp");
    mediaHtml = `
      <div class="modal-media">
        ${isWebp ? `
          <picture>
            <source srcset="${escapeHtml(post.imageUrl)}" type="image/webp">
            <img src="${escapeHtml(post.imageFallback || post.imageUrl)}" alt="${escapeHtml(post.title)}">
          </picture>
        ` : `
          <img src="${escapeHtml(post.imageUrl)}" alt="${escapeHtml(post.title)}">
        `}
      </div>
    `;
  }

  const whatsappHref = buildWhatsAppLink(post);

  contentArea.innerHTML = `
    <p class="eyebrow">
      ${formatDate(post.date)}
      ${post.location ? ` &nbsp;&bull;&nbsp; ${escapeHtml(post.location)}` : ""}
      ${post.statusLabel ? ` &nbsp;&bull;&nbsp; ${escapeHtml(post.statusLabel)}` : ""}
    </p>

    <h2 id="modal-title" class="modal-title">${escapeHtml(post.title)}</h2>

    ${mediaHtml}

    <div class="modal-prose">${escapeHtml(post.content || post.summary)}</div>

    <div class="modal-actions">
      <a href="${whatsappHref}" target="_blank" rel="noopener noreferrer" class="text-action-btn">
        Compartir por WhatsApp &rarr;
      </a>
      ${post.facebookUrl ? `
        <a href="${escapeHtml(post.facebookUrl)}" target="_blank" rel="noopener noreferrer" class="text-share-link">
          Ver en Facebook &nearr;
        </a>
      ` : ""}
    </div>
  `;

  dialog.showModal();
}

function setupModalEvents() {
  const dialog = document.getElementById("post-modal");
  const closeBtn = document.getElementById("modal-close-btn");
  if (!dialog) return;

  if (closeBtn) {
    closeBtn.addEventListener("click", () => dialog.close());
  }

  dialog.addEventListener("click", (e) => {
    const rect = dialog.getBoundingClientRect();
    const inside =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;
    if (!inside) {
      dialog.close();
    }
  });

  dialog.addEventListener("close", () => {
    const video = dialog.querySelector("video");
    if (video) video.pause();
  });
}

/**
 * Helpers
 */
function buildWhatsAppLink(post) {
  const url = window.location.href.split("#")[0];
  const message = `${post.title} — San Pablo Casacuarán: ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const clean = String(dateStr).split("T")[0];
    const [year, month, day] = clean.split("-");
    const months = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];
    const m = months[parseInt(month, 10) - 1];
    if (!m) return dateStr;
    return `${parseInt(day, 10)} ${m} ${year}`;
  } catch (e) {
    return dateStr;
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
