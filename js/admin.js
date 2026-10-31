// ==========================================================================
// RECONSTRUYENDO CASACUARÁN - Panel de Edición Local
// San Pablo Casacuarán, Yuriria, Guanajuato
// ==========================================================================

let editingPostId = null;

document.addEventListener("DOMContentLoaded", async () => {
  await DataStore.initFromRemoteOrLocal({ preferLocalDrafts: true });
  initAdminDashboard();
});

function initAdminDashboard() {
  populateUrgentNoticeForm();
  renderAdminTable();
  setupAdminForms();
  setupAdminDelegation();
  setupExportImport();
}

/**
 * 1. Formulario de Aviso Urgente
 */
function populateUrgentNoticeForm() {
  const config = DataStore.getConfig();
  const activeCheckbox = document.getElementById("urgent-active");
  const textInput = document.getElementById("urgent-text");

  if (config.urgentNotice) {
    if (activeCheckbox) activeCheckbox.checked = Boolean(config.urgentNotice.active);
    if (textInput) textInput.value = config.urgentNotice.text || "";
  }
}

function setupAdminForms() {
  // Formulario Aviso Urgente
  const urgentForm = document.getElementById("urgent-notice-form");
  if (urgentForm) {
    urgentForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const config = DataStore.getConfig();
      config.urgentNotice = {
        active: document.getElementById("urgent-active").checked,
        badge: "Aviso Urgente",
        text: document.getElementById("urgent-text").value.trim(),
        linkText: "Ver detalles",
        postId: null
      };
      DataStore.saveConfig(config);
      alert("Aviso superior actualizado correctamente en el almacenamiento local.");
    });
  }

  // Formulario de Publicación
  const postForm = document.getElementById("post-form");
  const cancelBtn = document.getElementById("btn-cancel-edit");

  if (postForm) {
    // Establecer fecha de hoy por defecto
    const dateInput = document.getElementById("post-date");
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split("T")[0];
    }

    postForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const title = document.getElementById("post-title").value.trim();
      const category = document.getElementById("post-category").value;
      const categoryLabel = getCategoryLabel(category);
      const date = document.getElementById("post-date").value || new Date().toISOString().split("T")[0];
      const location = document.getElementById("post-location").value.trim();
      const status = document.getElementById("post-status").value;
      const statusLabel = getStatusLabel(status);
      const summary = document.getElementById("post-summary").value.trim();
      const content = document.getElementById("post-content").value.trim();
      const imageUrl = document.getElementById("post-image-url").value.trim();
      const videoUrl = document.getElementById("post-video-url").value.trim();
      const facebookUrl = document.getElementById("post-facebook-url").value.trim();

      const postData = {
        title,
        category,
        categoryLabel,
        date,
        location,
        status,
        statusLabel,
        summary,
        content: content || summary,
        imageUrl,
        imagePending: !imageUrl,
        videoUrl,
        facebookUrl
      };

      if (editingPostId) {
        postData.id = editingPostId;
        DataStore.updatePost(postData);
        alert("Publicación actualizada correctamente.");
      } else {
        DataStore.addPost(postData);
        alert("Nueva publicación agregada al registro local.");
      }

      resetPostForm();
      renderAdminTable();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", resetPostForm);
  }
}

/**
 * 2. Renderizar Tabla de Publicaciones
 */
function renderAdminTable() {
  const tbody = document.getElementById("admin-tbody");
  const countLabel = document.getElementById("posts-count-label");
  if (!tbody) return;

  const posts = DataStore.getPosts();
  if (countLabel) {
    countLabel.textContent = `${posts.length} publicaciones registradas`;
  }

  if (posts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2rem; color: var(--tinta-muda);">
          No hay publicaciones en el registro.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = posts.map(post => {
    return `
      <tr>
        <td style="white-space: nowrap; font-variant-numeric: tabular-nums;">${escapeHtml(post.date || "")}</td>
        <td style="font-weight: 700; color: var(--tinta);">${escapeHtml(post.title)}</td>
        <td>${escapeHtml(post.categoryLabel || post.category)}</td>
        <td>${escapeHtml(post.statusLabel || post.status)}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button type="button" class="btn-secondary-action" data-admin-action="edit" data-id="${post.id}" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; margin-right: 0.35rem;">
            Editar
          </button>
          <button type="button" class="btn-secondary-action" data-admin-action="delete" data-id="${post.id}" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; color: var(--guardapolvo);">
            Eliminar
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

/**
 * 3. Delegación de eventos para Editar y Eliminar
 */
function setupAdminDelegation() {
  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-admin-action]");
    if (!target) return;

    const action = target.getAttribute("data-admin-action");
    const id = Number(target.getAttribute("data-id"));

    if (action === "edit" && id) {
      editPost(id);
    } else if (action === "delete" && id) {
      deletePostConfirm(id);
    }
  });
}

function editPost(id) {
  const posts = DataStore.getPosts();
  const post = posts.find(p => p.id === id);
  if (!post) return;

  editingPostId = post.id;

  document.getElementById("post-title").value = post.title || "";
  document.getElementById("post-category").value = post.category || "obras";
  document.getElementById("post-date").value = post.date || "";
  document.getElementById("post-location").value = post.location || "";
  document.getElementById("post-status").value = post.status || "completed";
  document.getElementById("post-summary").value = post.summary || "";
  document.getElementById("post-content").value = post.content || "";
  document.getElementById("post-image-url").value = post.imageUrl || "";
  document.getElementById("post-video-url").value = post.videoUrl || "";
  document.getElementById("post-facebook-url").value = post.facebookUrl || "";

  const formTitle = document.getElementById("form-mode-title");
  const cancelBtn = document.getElementById("btn-cancel-edit");
  const submitBtn = document.getElementById("btn-submit-post");

  if (formTitle) formTitle.textContent = "Editando Publicación";
  if (cancelBtn) cancelBtn.style.display = "inline-block";
  if (submitBtn) submitBtn.textContent = "Guardar Cambios";

  document.getElementById("form-container").scrollIntoView({ behavior: "smooth" });
}

function deletePostConfirm(id) {
  const posts = DataStore.getPosts();
  const post = posts.find(p => p.id === id);
  const title = post ? post.title : "esta publicación";

  if (confirm(`¿Deseas eliminar la publicación: "${title}"?\nEsta acción no se puede deshacer.`)) {
    DataStore.deletePost(id);
    if (editingPostId === id) resetPostForm();
    renderAdminTable();
  }
}

function resetPostForm() {
  editingPostId = null;
  const form = document.getElementById("post-form");
  const formTitle = document.getElementById("form-mode-title");
  const cancelBtn = document.getElementById("btn-cancel-edit");
  const submitBtn = document.getElementById("btn-submit-post");

  if (form) form.reset();
  if (formTitle) formTitle.textContent = "Nueva Publicación";
  if (cancelBtn) cancelBtn.style.display = "none";
  if (submitBtn) submitBtn.textContent = "Guardar Publicación";

  const dateInput = document.getElementById("post-date");
  if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
}

/**
 * 4. Descarga y Respaldo de site-data.json
 */
function setupExportImport() {
  const downloadFn = () => {
    const jsonStr = DataStore.exportSiteDataJson();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "site-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const quickBtn = document.getElementById("btn-quick-download");
  const exportBtn = document.getElementById("btn-export-json");
  if (quickBtn) quickBtn.addEventListener("click", downloadFn);
  if (exportBtn) exportBtn.addEventListener("click", downloadFn);

  const importFile = document.getElementById("import-json-file");
  if (importFile) {
    importFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (parsed && Array.isArray(parsed.publications)) {
            DataStore.savePosts(parsed.publications);
            if (parsed.config) DataStore.saveConfig(parsed.config);
            renderAdminTable();
            populateUrgentNoticeForm();
            alert("Archivo site-data.json cargado correctamente.");
          } else {
            alert("El archivo no tiene el formato esperado (debe contener 'publications').");
          }
        } catch (err) {
          alert("Error leyendo el archivo JSON: " + err.message);
        }
      };
      reader.readAsText(file);
    });
  }

  const resetBtn = document.getElementById("btn-reset-demo");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("¿Deseas restablecer las publicaciones originales de Casacuarán?")) {
        DataStore.resetToDefaults();
        renderAdminTable();
        populateUrgentNoticeForm();
        alert("Valores restablecidos.");
      }
    });
  }
}

/**
 * Helpers
 */
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
    default: return "Activo";
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
