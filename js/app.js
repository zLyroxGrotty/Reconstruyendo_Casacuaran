// ==========================================================================
// RECONSTRUYENDO CASACUARÁN — Lógica del Portal Público
// Diseño Editorial, Galería Visual y Bitácora Histórica Compacta (2024–2026)
// ==========================================================================

let currentCategory = "todas";
let currentSearch = "";
let allPosts = [];
let siteConfig = {};

// Estado interactivo de la Bitácora Histórica Compacta
const LEDGER_INITIAL_LIMIT = 10;
const LEDGER_STEP = 15;
let ledgerYear = "todos";
let ledgerCategory = "todas";
let ledgerIntervention = "todos";
let ledgerSearch = "";
let ledgerLimit = LEDGER_INITIAL_LIMIT;

// Redirección automática de tokens de invitación/recuperación de Netlify Identity hacia admin.html
(function checkNetlifyIdentityRedirect() {
  const hash = window.location.hash || "";
  if (
    hash.includes("invite_token=") ||
    hash.includes("confirmation_token=") ||
    hash.includes("recovery_token=") ||
    hash.includes("email_change_token=")
  ) {
    window.location.replace("admin.html" + hash);
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
  updateLedgerYearCounts();
  renderWorksTable();

  setupHeaderScroll();
  setupMobileMenu();
  setupHeroVideoControl();
  setupFiltersAndSearch();
  setupLedgerFilters();
  setupActionDelegation();
  setupModalEvents();
}

/**
 * Convierte fecha YYYY-MM-DD (o ISO) a timestamp UTC para ordenamiento cronológico estricto
 */
function parseDateTimestamp(dateValue) {
  if (!dateValue) return 0;
  const clean = String(dateValue).trim().split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    const d = Number(parts[2]);
    const ts = Date.UTC(y, m, d);
    if (!Number.isNaN(ts)) return ts;
  }
  const fallback = Date.parse(String(dateValue));
  return Number.isNaN(fallback) ? 0 : fallback;
}

/**
 * Normaliza entradas (ID único, 8 categorías oficiales, rutas multimedia limpias,
 * fechas aproximadas mes/año y orden cronológico descendente)
 */
function normalizePublications(posts) {
  if (!Array.isArray(posts)) return [];

  const statusLabels = {
    completed: "Concluida",
    in_progress: "En ejecución",
    upcoming: "En preparación",
    notice: "Aviso Oficial"
  };

  const usedIds = new Set();
  const cleanPath = (val) => DataStore.cleanMediaPath(val);

  const normalized = posts.map((raw, idx) => {
    const post = { ...raw, _origIndex: idx };
    let candidateId = Number(post.id);
    if (!candidateId || usedIds.has(candidateId)) {
      candidateId = idx + 1;
      while (usedIds.has(candidateId)) candidateId++;
    }
    usedIds.add(candidateId);
    post.id = candidateId;

    post.category = typeof resolveCategorySlug === "function"
      ? resolveCategorySlug(post.category)
      : (post.category || "infraestructura");

    post.categoryLabel = typeof resolveCategoryLabel === "function"
      ? resolveCategoryLabel(post.category)
      : (post.categoryLabel || "Comunidad");

    post.dateApproximate = Boolean(post.dateApproximate);
    post.interventionType = String(post.interventionType || "").trim() || "Actividad comunitaria";

    post.imageUrl = cleanPath(post.imageUrl);
    post.imageFallback = cleanPath(post.imageFallback);
    post.videoUrl = cleanPath(post.videoUrl);
    if (/\.(mp4|mov|m4v|webm)$/i.test(post.imageUrl) && !post.videoUrl) {
      post.videoUrl = post.imageUrl;
      post.imageUrl = "";
    }
    post.videoFallbackUrl = cleanPath(post.videoFallbackUrl);
    post.videoPoster = cleanPath(post.videoPoster);
    post._inferredPoster = post.videoPoster || DataStore.inferVideoPoster(post.videoUrl);

    if (post.imageUrl) {
      post.imagePending = false;
    }

    if (!post.statusLabel) {
      post.statusLabel = statusLabels[post.status] || "Registrada";
    }
    return post;
  });

  // Ordenamiento cronológico descendente (más reciente primero)
  normalized.sort((a, b) => {
    const diff = parseDateTimestamp(b.date) - parseDateTimestamp(a.date);
    if (diff !== 0) return diff;
    return a._origIndex - b._origIndex;
  });

  return normalized;
}

function hasVisualMedia(post) {
  return (Boolean(post.imageUrl) && !post.imagePending) || Boolean(post.videoUrl);
}

function isActiveNoticeOrCall(post) {
  return post.status === "notice" || post.status === "in_progress" || post.status === "upcoming";
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
 * 2. Cifras reales documentadas en la sección Nosotros
 */
function renderStats() {
  const totalCount = allPosts.length;
  const obrasFaenasCount = allPosts.filter(
    p => p.category === "infraestructura" || p.category === "mantenimiento"
  ).length;

  const totalEl = document.getElementById("stat-total");
  const obrasEl = document.getElementById("stat-obras");

  if (totalEl) totalEl.textContent = totalCount;
  if (obrasEl) obrasEl.textContent = obrasFaenasCount;
}

/**
 * 3. Galería de Historias (con foto o video real) + Sección de Avisos y Convocatorias
 *    (las actividades concluidas históricas sin foto viven en la Bitácora Histórica 2024–2026)
 */
function renderPublications() {
  const galleryEl = document.getElementById("stories-gallery");
  const dispatchesBlock = document.getElementById("dispatches-block");
  const dispatchesHeading = document.getElementById("dispatches-heading");
  const dispatchesList = document.getElementById("dispatches-list");
  const emptyEl = document.getElementById("empty-posts");

  if (!galleryEl || !dispatchesBlock || !dispatchesList) return;

  const query = currentSearch.trim().toLowerCase();

  const matchesQueryOnly = (post) => {
    if (!query) return true;
    return (
      (post.title && post.title.toLowerCase().includes(query)) ||
      (post.summary && post.summary.toLowerCase().includes(query)) ||
      (post.location && post.location.toLowerCase().includes(query))
    );
  };

  const matchesFilter = (post) => {
    if (!matchesQueryOnly(post)) return false;
    if (currentCategory === "todas") return true;
    if (currentCategory === "avisos") return isActiveNoticeOrCall(post);
    return post.category === currentCategory;
  };

  // Si el usuario pulsa el filtro "Avisos", enfocamos directamente la lista de Avisos y Convocatorias
  const visualPosts = currentCategory === "avisos"
    ? []
    : allPosts.filter(p => hasVisualMedia(p) && matchesFilter(p));

  const activeTextNotices = allPosts.filter(
    p => !hasVisualMedia(p) && isActiveNoticeOrCall(p) && matchesFilter(p)
  );

  if (visualPosts.length === 0 && activeTextNotices.length === 0) {
    galleryEl.innerHTML = "";
    galleryEl.hidden = true;
    dispatchesList.innerHTML = "";
    dispatchesBlock.hidden = true;

    if (emptyEl) {
      const ledgerMatchesCount = currentCategory === "avisos"
        ? 0
        : allPosts.filter(p => (currentCategory === "todas" || p.category === currentCategory) && matchesQueryOnly(p)).length;
      emptyEl.hidden = false;

      if (ledgerMatchesCount > 0) {
        const catLabel = currentCategory === "todas"
          ? "esa búsqueda"
          : resolveCategoryLabel(currentCategory);
        emptyEl.innerHTML = `
          <div class="empty-bridge-box">
            <p class="empty-bridge-text">
              Aún no se han subido fotografías ni avisos vigentes en <strong>${escapeHtml(catLabel)}</strong>, pero existen <strong>${ledgerMatchesCount} actividades registradas</strong> en el archivo histórico.
            </p>
            <button type="button"
                    class="text-action-btn"
                    data-action="jump-to-ledger"
                    data-category="${escapeHtml(currentCategory)}"
                    data-query="${escapeHtml(currentSearch)}">
              Ver las ${ledgerMatchesCount} actividades en la Bitácora Histórica &darr;
            </button>
          </div>
        `;
      } else {
        emptyEl.textContent = "No se encontraron historias ni avisos vigentes con ese criterio de búsqueda.";
      }
    }
    return;
  }

  if (emptyEl) {
    emptyEl.hidden = true;
    emptyEl.innerHTML = "";
  }

  // Renderizar galería visual (solo tarjetas con foto o video real)
  if (visualPosts.length > 0) {
    galleryEl.hidden = false;
    galleryEl.innerHTML = visualPosts.map(post => {
      const formattedDate = formatDate(post.date, post.dateApproximate);
      const explicitPosterOrImage = post.videoUrl
        ? (post.videoPoster || (!post.imagePending ? post.imageUrl : ""))
        : post.imageUrl;
      const fallbackImg = post.imageFallback || explicitPosterOrImage;
      const whatsappHref = buildWhatsAppLink(post);

      let cardMediaHtml = "";
      if (explicitPosterOrImage) {
        const encodedMain = encodeMediaUrl(explicitPosterOrImage);
        const encodedFallback = encodeMediaUrl(fallbackImg);
        const isWebp = explicitPosterOrImage.toLowerCase().endsWith(".webp");
        cardMediaHtml = isWebp ? `
          <picture>
            <source srcset="${escapeHtml(encodedMain)}" type="image/webp">
            <img src="${escapeHtml(encodedFallback)}"
                 alt="${escapeHtml(post.title)}"
                 class="story-media-img"
                 loading="lazy">
          </picture>
        ` : `
          <img src="${escapeHtml(encodedMain)}"
               alt="${escapeHtml(post.title)}"
               class="story-media-img"
               loading="lazy">
        `;
      } else if (post.videoUrl) {
        const encodedVid = encodeMediaUrl(post.videoUrl);
        const posterAttr = post._inferredPoster
          ? ` poster="${escapeHtml(encodeMediaUrl(post._inferredPoster))}"`
          : "";
        cardMediaHtml = `
          <video src="${escapeHtml(encodedVid)}#t=0.8"${posterAttr}
                 preload="metadata"
                 muted
                 playsinline
                 class="story-media-img story-video-thumb"
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

    hydrateVideoThumbnails(galleryEl);
  } else {
    galleryEl.innerHTML = "";
    galleryEl.hidden = true;
  }

  // Renderizar sección Avisos y Convocatorias (siempre con su encabezado visible)
  if (activeTextNotices.length > 0) {
    dispatchesBlock.hidden = false;
    dispatchesBlock.classList.toggle("dispatches-block--standalone", visualPosts.length === 0);
    if (dispatchesHeading) {
      dispatchesHeading.hidden = false;
    }

    dispatchesList.innerHTML = activeTextNotices.map(post => {
      const formattedDate = formatDate(post.date, post.dateApproximate);
      const whatsappHref = buildWhatsAppLink(post);

      return `
        <article class="dispatch-row">
          <div class="dispatch-date">
            ${formattedDate}
            <span class="dispatch-cat">${escapeHtml(post.statusLabel || post.categoryLabel)}</span>
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

function hydrateVideoThumbnails(container) {
  container.querySelectorAll("video.story-video-thumb").forEach(vid => {
    vid.addEventListener("loadedmetadata", () => {
      if (vid.duration && vid.currentTime === 0) {
        vid.currentTime = Math.min(1.0, vid.duration * 0.25);
      }
    }, { once: true });
  });
}

/**
 * 4. Bitácora Histórica Compacta 2024–2026 (10 renglones iniciales + filtros + buscador)
 */
function updateLedgerYearCounts() {
  const yearBtns = document.querySelectorAll(".ledger-year-btn");
  const counts = { todos: allPosts.length, "2026": 0, "2025": 0, "2024": 0 };

  allPosts.forEach(p => {
    const yr = String(p.date || "").slice(0, 4);
    if (counts[yr] !== undefined) counts[yr] += 1;
  });

  yearBtns.forEach(btn => {
    const yr = btn.getAttribute("data-year") || "todos";
    const labelBase = yr === "todos" ? "Todos" : yr;
    const count = counts[yr] !== undefined ? counts[yr] : 0;
    btn.textContent = `${labelBase} (${count})`;
  });
}

function getFilteredLedgerPosts() {
  const q = ledgerSearch.trim().toLowerCase();

  return allPosts.filter(post => {
    const postYear = String(post.date || "").slice(0, 4);
    if (ledgerYear !== "todos" && postYear !== ledgerYear) return false;
    if (ledgerCategory !== "todas" && post.category !== ledgerCategory) return false;
    if (ledgerIntervention !== "todos" && post.interventionType !== ledgerIntervention) return false;

    if (q) {
      const haystack = `${post.title || ""} ${post.categoryLabel || ""} ${post.location || ""} ${post.interventionType || ""} ${post.date || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function renderWorksTable() {
  const tbody = document.getElementById("obras-tbody");
  const countLabel = document.getElementById("ledger-count-label");
  const paginationEl = document.getElementById("ledger-pagination");
  if (!tbody) return;

  const matching = getFilteredLedgerPosts();
  const visible = matching.slice(0, ledgerLimit);

  if (countLabel) {
    countLabel.textContent = matching.length === 0
      ? "0 registros encontrados"
      : `Mostrando ${visible.length} de ${matching.length} registros`;
  }

  if (matching.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">No se encontraron actividades con esos filtros.</td>
      </tr>
    `;
    if (paginationEl) {
      paginationEl.innerHTML = `
        <button type="button" class="text-action-btn" data-action="ledger-reset-filters">
          Limpiar filtros de la bitácora
        </button>
      `;
    }
    return;
  }

  tbody.innerHTML = visible.map(post => {
    const dateText = formatCompactDate(post.date, post.dateApproximate);
    const dateClass = post.dateApproximate ? "works-date works-date--approx" : "works-date";
    const mediaBadge = post.videoUrl
      ? `<span class="works-media-flag">Video</span>`
      : (hasVisualMedia(post) ? `<span class="works-media-flag">Foto</span>` : "");

    return `
      <tr>
        <td class="${dateClass}" title="${post.dateApproximate ? "Mes registrado por secuencia histórica" : "Fecha registrada"}">${escapeHtml(dateText)}</td>
        <td class="works-name">
          <button type="button" class="story-title-btn" data-action="open-post" data-id="${post.id}">
            ${escapeHtml(post.title)}
          </button>${mediaBadge}
        </td>
        <td class="works-cat-cell">${escapeHtml(post.categoryLabel)}</td>
        <td class="works-type-cell">${escapeHtml(post.interventionType)}</td>
        <td>
          <button type="button" class="text-action-btn" data-action="open-post" data-id="${post.id}">
            Ver &rarr;
          </button>
        </td>
      </tr>
    `;
  }).join("");

  if (paginationEl) {
    const remaining = matching.length - visible.length;
    const nextStep = Math.min(LEDGER_STEP, remaining);

    let buttonsHtml = '<div class="ledger-footer-actions">';
    if (remaining > 0) {
      buttonsHtml += `
        <button type="button" class="text-action-btn" data-action="ledger-more">
          Mostrar ${nextStep} más &darr;
        </button>
      `;
      if (remaining > LEDGER_STEP) {
        buttonsHtml += `
          <button type="button" class="text-share-link text-action-btn" data-action="ledger-all">
            Ver todos (${matching.length})
          </button>
        `;
      }
    }
    if (visible.length > LEDGER_INITIAL_LIMIT) {
      buttonsHtml += `
        <button type="button" class="text-action-btn" data-action="ledger-collapse">
          Contraer a ${LEDGER_INITIAL_LIMIT} recientes &uarr;
        </button>
      `;
    }
    buttonsHtml += "</div>";
    paginationEl.innerHTML = buttonsHtml;
  }
}

function setupLedgerFilters() {
  const yearBtns = document.querySelectorAll(".ledger-year-btn");
  yearBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      yearBtns.forEach(b => b.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      ledgerYear = btn.getAttribute("data-year") || "todos";
      ledgerLimit = LEDGER_INITIAL_LIMIT;
      renderWorksTable();
    });
  });

  const catSelect = document.getElementById("ledger-category");
  if (catSelect) {
    catSelect.addEventListener("change", (e) => {
      ledgerCategory = e.target.value || "todas";
      ledgerLimit = LEDGER_INITIAL_LIMIT;
      renderWorksTable();
    });
  }

  const typeSelect = document.getElementById("ledger-intervention");
  if (typeSelect) {
    typeSelect.addEventListener("change", (e) => {
      ledgerIntervention = e.target.value || "todos";
      ledgerLimit = LEDGER_INITIAL_LIMIT;
      renderWorksTable();
    });
  }

  const searchInput = document.getElementById("ledger-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      ledgerSearch = e.target.value || "";
      ledgerLimit = LEDGER_INITIAL_LIMIT;
      renderWorksTable();
    });
  }
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
 * 7. Filtros y buscador de Historias Destacadas
 */
function setupFiltersAndSearch() {
  const filterBtns = document.querySelectorAll("#comunicados .filter-link");
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

  // Asegurar que los enlaces hacia #dispatches-block muestren siempre Avisos y Convocatorias
  document.querySelectorAll('a[href="#dispatches-block"]').forEach(link => {
    link.addEventListener("click", () => {
      const dispatchesBlock = document.getElementById("dispatches-block");
      if (dispatchesBlock && dispatchesBlock.hidden) {
        currentCategory = "todas";
        currentSearch = "";
        if (searchInput) searchInput.value = "";
        filterBtns.forEach(b => {
          b.setAttribute("aria-pressed", b.getAttribute("data-category") === "todas" ? "true" : "false");
        });
        renderPublications();
      }
    });
  });
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
    } else if (action === "ledger-more") {
      ledgerLimit += LEDGER_STEP;
      renderWorksTable();
    } else if (action === "ledger-all") {
      ledgerLimit = allPosts.length + 50;
      renderWorksTable();
    } else if (action === "ledger-collapse") {
      ledgerLimit = LEDGER_INITIAL_LIMIT;
      renderWorksTable();
      const section = document.getElementById("obras");
      if (section) section.scrollIntoView({ behavior: "smooth" });
    } else if (action === "ledger-reset-filters") {
      resetLedgerFilters();
    } else if (action === "jump-to-ledger") {
      const targetCat = trigger.getAttribute("data-category") || "todas";
      const targetQuery = trigger.getAttribute("data-query") || "";
      applyLedgerJump(targetCat, targetQuery);
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

function resetLedgerFilters() {
  ledgerYear = "todos";
  ledgerCategory = "todas";
  ledgerIntervention = "todos";
  ledgerSearch = "";
  ledgerLimit = LEDGER_INITIAL_LIMIT;

  document.querySelectorAll(".ledger-year-btn").forEach(btn => {
    btn.setAttribute("aria-pressed", btn.getAttribute("data-year") === "todos" ? "true" : "false");
  });

  const catSelect = document.getElementById("ledger-category");
  const typeSelect = document.getElementById("ledger-intervention");
  const searchInput = document.getElementById("ledger-search");

  if (catSelect) catSelect.value = "todas";
  if (typeSelect) typeSelect.value = "todos";
  if (searchInput) searchInput.value = "";

  renderWorksTable();
}

function applyLedgerJump(cat, query) {
  resetLedgerFilters();
  ledgerCategory = cat;
  ledgerSearch = query;

  const catSelect = document.getElementById("ledger-category");
  const searchInput = document.getElementById("ledger-search");
  if (catSelect) catSelect.value = cat;
  if (searchInput) searchInput.value = query;

  renderWorksTable();
  const section = document.getElementById("obras");
  if (section) section.scrollIntoView({ behavior: "smooth" });
}

/**
 * 9. Modal de lectura (<dialog>) con soporte para videos horizontales/verticales y fechas mensuales
 */
function openPostModal(id) {
  const post = allPosts.find(p => p.id === id);
  if (!post) return;

  const dialog = document.getElementById("post-modal");
  const categoryEl = document.getElementById("modal-category");
  const contentArea = document.getElementById("modal-content-area");
  if (!dialog || !contentArea) return;

  if (categoryEl) {
    categoryEl.textContent = post.categoryLabel || "Actividad Comunitaria";
  }

  let mediaHtml = "";
  if (post.videoUrl) {
    const posterPath = post.videoPoster || post._inferredPoster || "";
    const posterAttr = posterPath ? ` poster="${escapeHtml(encodeMediaUrl(posterPath))}"` : "";
    const mainVideoSrc = encodeMediaUrl(post.videoUrl);
    const mainTypeAttr = inferVideoMimeAttr(post.videoUrl);
    const fallbackTypeAttr = post.videoFallbackUrl ? inferVideoMimeAttr(post.videoFallbackUrl) : "";

    mediaHtml = `
      <div class="modal-media">
        <video controls preload="metadata" playsinline${posterAttr} aria-label="Video: ${escapeHtml(post.title)}">
          <source src="${escapeHtml(mainVideoSrc)}"${mainTypeAttr}>
          ${post.videoFallbackUrl ? `<source src="${escapeHtml(encodeMediaUrl(post.videoFallbackUrl))}"${fallbackTypeAttr}>` : ""}
        </video>
      </div>
    `;
  } else if (post.imageUrl && !post.imagePending) {
    const encodedImg = encodeMediaUrl(post.imageUrl);
    const encodedFallback = encodeMediaUrl(post.imageFallback || post.imageUrl);
    const isWebp = post.imageUrl.toLowerCase().endsWith(".webp");
    mediaHtml = `
      <div class="modal-media">
        ${isWebp ? `
          <picture>
            <source srcset="${escapeHtml(encodedImg)}" type="image/webp">
            <img src="${escapeHtml(encodedFallback)}" alt="${escapeHtml(post.title)}">
          </picture>
        ` : `
          <img src="${escapeHtml(encodedImg)}" alt="${escapeHtml(post.title)}">
        `}
      </div>
    `;
  }

  const whatsappHref = buildWhatsAppLink(post);
  const dateDisplay = formatDate(post.date, post.dateApproximate) +
    (post.dateApproximate ? " (registro mensual)" : "");

  contentArea.innerHTML = `
    <p class="eyebrow">
      ${escapeHtml(dateDisplay)}
      ${post.location ? ` &nbsp;&bull;&nbsp; ${escapeHtml(post.location)}` : ""}
      ${post.interventionType ? ` &nbsp;&bull;&nbsp; ${escapeHtml(post.interventionType)}` : ""}
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
 * Helpers de formato y URLs
 */
function encodeMediaUrl(url) {
  if (!url) return "";
  try {
    return encodeURI(decodeURI(url));
  } catch (e) {
    return encodeURI(url);
  }
}

function inferVideoMimeAttr(url) {
  const lower = String(url || "").toLowerCase();
  if (lower.endsWith(".webm")) return ' type="video/webm"';
  if (lower.endsWith(".mp4") || lower.endsWith(".m4v")) return ' type="video/mp4"';
  return "";
}

function buildWhatsAppLink(post) {
  const url = window.location.href.split("#")[0];
  const message = `${post.title} — San Pablo Casacuarán: ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function formatDate(dateStr, approximate = false) {
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
    if (approximate) {
      return `${m.charAt(0).toUpperCase() + m.slice(1)} ${year}`;
    }
    return `${parseInt(day, 10)} ${m} ${year}`;
  } catch (e) {
    return dateStr;
  }
}

function formatCompactDate(dateStr, approximate = false) {
  if (!dateStr) return "";
  try {
    const clean = String(dateStr).split("T")[0];
    const [year, month, day] = clean.split("-");
    const fullMonths = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    const shortMonths = [
      "ene", "feb", "mar", "abr", "may", "jun",
      "jul", "ago", "sep", "oct", "nov", "dic"
    ];
    const idx = parseInt(month, 10) - 1;
    if (idx < 0 || idx > 11) return dateStr;
    if (approximate) {
      return `${fullMonths[idx]} ${year}`;
    }
    return `${parseInt(day, 10)} ${shortMonths[idx]} ${year}`;
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
