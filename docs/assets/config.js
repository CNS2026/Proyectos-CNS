// Configuración de CNS · Certificados de formación
window.CNS_CONFIG = {
  // Dirección pública del sitio (con barra final). Es la que se codifica en el QR.
  // Si más adelante usas un dominio propio (p. ej. https://certificados.grupocns.com/), cámbiala aquí
  // ANTES de emitir certificados reales: los QR ya emitidos apuntan a la dirección que había en ese momento.
  publicUrl: "https://cns2026.github.io/Proyectos-CNS/",

  // Repositorio donde se guarda el registro (el panel de administración publica aquí).
  github: { owner: "CNS2026", repo: "Proyectos-CNS", branch: "main", dir: "docs", api: "https://api.github.com" },

  contact: {
    web: "https://www.grupocns.com", webTxt: "www.grupocns.com",
    email: "info@grupocns.com", tel: "+34642113665", telTxt: "+34 642 113 665"
  },

  // Profesores (añade más líneas con el mismo formato).
  profesores: {
    ronald: { nombre: "Ronald Alegría", linkedin: "https://www.linkedin.com/in/ronald-alegria/" },
    luis:   { nombre: "Luis Cadena",    linkedin: "https://www.linkedin.com/in/luisecadenaf/" }
  },

  // Formaciones y horas por defecto (se pueden cambiar al emitir).
  formaciones: {
    marketing:  { nombre: "Marketing Digital",        horas: 40 },
    gestion:    { nombre: "Modelo de Gestión",        horas: 40 },
    callcenter: { nombre: "Call Center",              horas: 40 },
    otros:      { nombre: "Otros procesos digitales", horas: 20 }
  },

  docTypes: ["Cédula de ciudadanía (CC)", "Cédula de extranjería (CE)", "DNI", "NIE", "Pasaporte", "Otro"]
};
