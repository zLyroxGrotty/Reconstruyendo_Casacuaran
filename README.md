# Reconstruyendo Casacuarán

Portal cívico y comunitario de **San Pablo Casacuarán**, municipio de Yuriria, Guanajuato.

---

## 1. Dirección de Diseño (Variante A — City Bureau & Casa Wabi)

- **Cabecera limpia sobre blanco puro (`#FFFFFF`):** Marca tipográfica de dos niveles (`CASACUARÁN / RECONSTRUYENDO`) a la izquierda y navegación en mayúsculas espaciadas (`letter-spacing: 0.17em`) a la derecha.
- **Portada documental a pantalla completa (`100vw`):** Video panorámico de Yuriria y Casacuarán en bucle silencioso con la **placa central translúcida** de esquinas rectas estilo *City Bureau*, título en **Fraunces** y lema cívico en *Fraunces cursiva*, con control accesible de pausa/reproducción y soporte para `prefers-reduced-motion`.
- **Aire y fotografía sin marcos:** Alternancia entre blanco (`#FFFFFF`) y piedra caliza suave (`#F4F3EF`), galería de historias en proporción `3:2` con soporte tanto para videos horizontales (`16:9`) como verticales (`9:16`), y lista editorial limpia para avisos sin fotografía.

---

## 2. Compresión Automática de Videos e Imágenes (GitHub Actions + FFmpeg)

El repositorio incluye un flujo automático en `.github/workflows/optimize-media.yml` y `scripts/optimize_media.py`:

1. Cuando un administrador sube un video (`.mp4`, `.mov`, `.m4v`) o una fotografía pesada desde **Gestión (`/admin/`)** y pulsa **Publicar**:
2. **GitHub Actions** detecta el archivo nuevo en `IMG/` y ejecuta **FFmpeg** en la nube:
   - Comprime el video a **H.264 universal (`yuv420p` + `faststart`)**, reduciendo el peso entre un **75% y 85%** (respetando videos verticales `9:16` a `540×960` y horizontales a `540p`).
   - Extrae automáticamente un fotograma en `.webp` (`<nombre>-poster.webp`) como miniatura ligera.
   - Si se subió una fotografía pesada (`.jpg`/`.png`), genera su versión `.webp` ligera conservando el respaldo.
   - Vincula automáticamente las rutas optimizadas en `content/site-data.json` y **Netlify** publica la versión ligera.

---

## 3. Guía Rápida para Subir el Sitio Gratis (GitHub + Netlify)

### Paso A — Subir el proyecto a GitHub
1. Crea un repositorio nuevo en [github.com/new](https://github.com/new) (por ejemplo, `reconstruyendo-casacuaran`, **Público** para que GitHub Actions sea 100% gratuito e ilimitado).
2. Sube el contenido de esta carpeta al repositorio en la rama `main` *(la carpeta `_originales_sin_comprimir/` está en `.gitignore` para no subir originales crudos pesados)*.
3. En tu repositorio de GitHub, ve a **Settings → Actions → General → Workflow permissions** y verifica que esté marcada la opción **"Read and write permissions"**, para que el compresor automático pueda guardar los videos optimizados.

### Paso B — Conectar con Netlify y activar el acceso a `/admin/`
1. Entra a [app.netlify.com](https://app.netlify.com/) con tu cuenta de GitHub y haz clic en **"Add new site" → "Import an existing project"**.
2. Selecciona tu repositorio `reconstruyendo-casacuaran`. Deja *Build command* y *Publish directory* vacíos (es un sitio estático puro) y pulsa **Deploy**.
3. En el panel de tu sitio en Netlify, activa el inicio de sesión para `/admin/`:
   - Ve a **Site configuration → Identity** y haz clic en **Enable Identity**.
   - En *Registration preferences*, cámbialo de *Open* a **Invite only** (para que solo entren tú y las personas que invites).
   - Baja en esa misma sección a **Services → Git Gateway** y haz clic en **Enable Git Gateway**.
4. Ve a la pestaña **Integrations / Identity → Invite users**, escribe tu correo (y el de tu amigo) y abre el correo de invitación: el sitio te llevará automáticamente a `/admin/` para elegir tu contraseña y empezar a publicar.
