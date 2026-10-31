// Base de datos inicial y sincronización de Reconstruyendo Casacuarán
// San Pablo Casacuarán, Yuriria, Guanajuato

const DEFAULT_SITE_CONFIG = {
  communityName: "San Pablo Casacuarán",
  municipality: "Yuriria, Guanajuato",
  slogan: "Gaceta comunitaria, registro de obras y avisos de San Pablo Casacuarán",
  urgentNotice: {
    active: true,
    badge: "Aviso Urgente",
    text: "Atención ciudadana: Próxima jornada de salud visual este viernes en Casa de Cultura a partir de las 9:00 AM.",
    linkText: "Ver detalles",
    postId: 3
  },
  delegationSchedule: "Lunes a Viernes de 9:00 AM a 3:00 PM",
  emergencyPhone: "445 123 4567",
  waterServicePhone: "445 765 4321",
  facebookPageUrl: "https://www.facebook.com/people/Reconstruyendo-Casacuar%C3%A1n/61569069380607/"
};

const INITIAL_PUBLICATIONS = [
  {
    id: 1,
    title: "Conclusión de trabajos de rehabilitación en la red de drenaje",
    category: "obras",
    categoryLabel: "Obras Públicas",
    date: "2026-10-04",
    status: "completed",
    statusLabel: "Concluida",
    summary: "Se finalizaron con éxito las maniobras de sustitución de tubería y desazolve para evitar encharcamientos e inundaciones.",
    content: "Gracias a la gestión de la Delegación y al apoyo de los vecinos de San Pablo Casacuarán, concluyeron los trabajos de excavación y reposición de la tubería sanitaria de la calle principal. Esta obra beneficia de manera directa a decenas de familias, previniendo focos de infección y optimizando el flujo de aguas residuales rumbo al colector.\n\nAgradecemos la paciencia de los automovilistas y vecinos durante el tiempo que duró la maquinaria pesada en operación.",
    imageUrl: "",
    imagePending: true,
    location: "Calle Principal y Acceso Poniente",
    facebookUrl: "https://www.facebook.com/people/Reconstruyendo-Casacuar%C3%A1n/61569069380607/",
    featured: true
  },
  {
    id: 2,
    title: "Gran Faena Vecinal: Limpieza y mantenimiento del Jardín Principal y Unidad Deportiva",
    category: "faenas",
    categoryLabel: "Faenas Comunitarias",
    date: "2026-09-28",
    status: "completed",
    statusLabel: "Labor Vecinal",
    summary: "Decenas de ciudadanos se sumaron con palas, escobas y desbrozadoras para embellecer nuestras áreas recreativas.",
    content: "Bajo la convicción de que 'una comunidad unida vale más', hombres, mujeres y jóvenes de Casacuarán se dieron cita este fin de semana para podar áreas verdes, pintar guarniciones y dar mantenimiento integral a la cancha de usos múltiples y jardineras del centro.\n\nEl comité organizador proporcionó bolsas de basura y pintura, mientras que familias voluntarias aportaron hidratación. Este tipo de acciones refrendan el compromiso de mantener nuestro pueblo limpio, digno y seguro para nuestras niñas y niños.",
    imageUrl: "IMG/Faena.webp",
    imageFallback: "IMG/Faena.jpg",
    imagePending: false,
    location: "Jardín Principal de San Pablo Casacuarán",
    facebookUrl: "https://www.facebook.com/people/Reconstruyendo-Casacuar%C3%A1n/61569069380607/",
    featured: true
  },
  {
    id: 3,
    title: "Jornada de Salud Visual a bajo costo en la Casa de Cultura",
    category: "salud",
    categoryLabel: "Salud y Bienestar",
    date: "2026-10-09",
    status: "in_progress",
    statusLabel: "Convocatoria Abierta",
    summary: "Examen de la vista profesional sin costo y lentes graduados a precio subsidiado para niños y adultos mayores.",
    content: "La Delegación de San Pablo Casacuarán invita a todas las familias de la comunidad a aprovechar la Jornada de Salud Visual en colaboración con optometristas certificados.\n\n• Horario: Viernes y sábado de 9:00 AM a 4:00 PM\n• Lugar: Instalaciones de la Casa de Cultura de Casacuarán\n• Servicios: Detección oportuna de miopía, astigmatismo, vista cansada y canalización médica.\n• Cuota de recuperación para armazones y micas: Precios comunitarios accesibles.",
    imageUrl: "",
    imagePending: true,
    location: "Casa de Cultura de Casacuarán",
    facebookUrl: "https://www.facebook.com/people/Reconstruyendo-Casacuar%C3%A1n/61569069380607/",
    featured: true
  },
  {
    id: 4,
    title: "Mantenimiento y colocación de luminarias LED en accesos comunitarios",
    category: "obras",
    categoryLabel: "Obras Públicas",
    date: "2026-09-18",
    status: "completed",
    statusLabel: "Concluida",
    summary: "Se rehabilitaron más de 25 puntos de alumbrado para brindar mayor seguridad a peatones y estudiantes.",
    content: "Continuando con los recorridos nocturnos de detección de fallas, la brigada técnica sustituyó lámparas de vapor de sodio averiadas por modernas luminarias de tecnología LED en los callejones aledaños a la parroquia y en el camino hacia la secundaria.\n\nUn Casacuarán mejor iluminado es un espacio más seguro para todos al regresar de las jornadas de trabajo y estudio.",
    imageUrl: "IMG/Alumbrado.webp",
    imageFallback: "IMG/Alumbrado.jpg",
    imagePending: false,
    location: "Accesos y camino a la secundaria",
    facebookUrl: "https://www.facebook.com/people/Reconstruyendo-Casacuar%C3%A1n/61569069380607/",
    featured: false
  },
  {
    id: 5,
    title: "Preparativos para las tradicionales Fiestas Patronales de San Pablo Apóstol",
    category: "cultura",
    categoryLabel: "Tradición y Cultura",
    date: "2026-09-12",
    status: "upcoming",
    statusLabel: "En Preparación",
    summary: "Comité ciudadano inicia reuniones de coordinación para los festejos de enero, danzas, certamen y procesión.",
    content: "Como cada año, nuestra comunidad se prepara para honrar a nuestro santo patrono, San Pablo Apóstol. Las celebraciones de enero representan el reencuentro de nuestras familias y la bienvenida a todos nuestros paisanos que nos visitan desde Estados Unidos.\n\nEn las próximas semanas se publicará la convocatoria formal para el certamen de la Reina de las Fiestas y el rol de peregrinaciones por barrio.",
    imageUrl: "IMG/Casacuaran.webp",
    imageFallback: "IMG/Casacuaran.jpg",
    imagePending: false,
    videoUrl: "IMG/Fiesta-web.mp4",
    videoFallbackUrl: "IMG/Fiesta-480p.mp4",
    videoPoster: "IMG/Fiesta-poster.webp",
    location: "Parroquia de San Pablo y Atrio",
    facebookUrl: "https://www.facebook.com/people/Reconstruyendo-Casacuar%C3%A1n/61569069380607/",
    featured: false
  },
  {
    id: 6,
    title: "Horarios de servicio de recolección de basura y aviso de saneamiento",
    category: "avisos",
    categoryLabel: "Avisos Delegacionales",
    date: "2026-09-02",
    status: "notice",
    statusLabel: "Aviso Oficial",
    summary: "Recordatorio a la ciudadanía sobre las rutas y días de recolección para mantener las calles limpias.",
    content: "Se solicita atentamente a los vecinos no sacar los desechos a las esquinas fuera de los horarios establecidos para evitar que los animales rompan las bolsas.\n\n• Días de paso del camión: Martes, Jueves y Sábados a partir de las 8:00 AM.\nCuidar la imagen de nuestro pueblo es tarea de todas y todos.",
    imageUrl: "",
    imagePending: true,
    location: "Toda la comunidad",
    facebookUrl: "https://www.facebook.com/people/Reconstruyendo-Casacuar%C3%A1n/61569069380607/",
    featured: false
  }
];

class DataStore {
  static STORAGE_KEY_POSTS = "casacuaran_publicaciones_v3";
  static STORAGE_KEY_CONFIG = "casacuaran_config_v3";

  static async initFromRemoteOrLocal({ preferLocalDrafts = false } = {}) {
    let remoteData = null;
    try {
      const response = await fetch("./content/site-data.json", { cache: "no-cache" });
      if (response.ok) {
        remoteData = await response.json();
      }
    } catch (e) {
      console.info("Modo local sin servidor HTTP: usando respaldo local.");
    }

    if (remoteData && remoteData.publications && Array.isArray(remoteData.publications)) {
      const localPosts = this.getPosts();
      const remoteIds = new Set(remoteData.publications.map(p => Number(p.id)));

      // Conservar cualquier publicación agregada localmente cuyo ID no esté en el archivo remoto
      const localOnlyPosts = localPosts.filter(p => p && p.id && !remoteIds.has(Number(p.id)));

      // Las publicaciones locales van primero para verse de inmediato en la gaceta
      const mergedPosts = [...localOnlyPosts, ...remoteData.publications];
      this.savePosts(mergedPosts);

      const mergedConfig = remoteData.config || this.getConfig();
      if (!localStorage.getItem(this.STORAGE_KEY_CONFIG)) {
        this.saveConfig(mergedConfig);
      }

      return { config: this.getConfig(), publications: mergedPosts };
    }

    return { config: this.getConfig(), publications: this.getPosts() };
  }

  static getPosts() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_POSTS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Error leyendo publicaciones de localStorage:", e);
    }
    this.savePosts(INITIAL_PUBLICATIONS);
    return INITIAL_PUBLICATIONS;
  }

  static savePosts(posts) {
    try {
      localStorage.setItem(this.STORAGE_KEY_POSTS, JSON.stringify(posts));
      return true;
    } catch (e) {
      console.error("Error guardando publicaciones:", e);
      return false;
    }
  }

  static getConfig() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_CONFIG);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Error leyendo configuración:", e);
    }
    this.saveConfig(DEFAULT_SITE_CONFIG);
    return DEFAULT_SITE_CONFIG;
  }

  static saveConfig(config) {
    try {
      localStorage.setItem(this.STORAGE_KEY_CONFIG, JSON.stringify(config));
      return true;
    } catch (e) {
      console.error("Error guardando configuración:", e);
      return false;
    }
  }

  static addPost(newPost) {
    const posts = this.getPosts();
    newPost.id = Date.now();
    posts.unshift(newPost);
    this.savePosts(posts);
    return newPost;
  }

  static updatePost(updatedPost) {
    let posts = this.getPosts();
    posts = posts.map(p => p.id === updatedPost.id ? updatedPost : p);
    this.savePosts(posts);
    return true;
  }

  static deletePost(id) {
    let posts = this.getPosts();
    posts = posts.filter(p => p.id !== id);
    this.savePosts(posts);
    return true;
  }

  static resetToDefaults() {
    this.savePosts(INITIAL_PUBLICATIONS);
    this.saveConfig(DEFAULT_SITE_CONFIG);
    return true;
  }

  static exportSiteDataJson() {
    const data = {
      config: this.getConfig(),
      publications: this.getPosts()
    };
    return JSON.stringify(data, null, 2);
  }
}
