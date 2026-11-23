# CNS · Certificados de formación (GitHub Pages)

## Cómo funciona
- **Verificar (público, sin cuenta):** `https://cns2026.github.io/Proyectos-CNS/` — se pega el código o se escanea el QR.
  Muestra formación, intensidad, profesor con LinkedIn y fechas. Teléfono, email y documento completo nunca son públicos.
- **Emitir (solo administración):** `https://cns2026.github.io/Proyectos-CNS/admin/` — pide un **token de GitHub** con
  permiso de escritura sobre este repositorio y una **clave de cifrado**. La página pública no enlaza al panel.
- **Privacidad:** el repositorio es público, pero `data/registry.json` solo contiene datos cifrados con el propio código
  de cada certificado (sin el código no se puede leer ni el nombre), y `data/ledger.enc.json` (contacto, documento) está
  cifrado con la clave de administración.
- **Publicación:** al emitir o revocar, el panel hace un commit en `main`; GitHub Pages tarda 1–2 minutos en publicarlo.

## Puesta en marcha (una sola vez)
1. Settings → Pages → *Build and deployment*: Source **Deploy from a branch**, Branch **main**, carpeta **/docs** → Save.
2. Crea un token: GitHub → Settings → Developer settings → Fine-grained tokens → *Generate new token*.
   Repository access: solo `Proyectos-CNS`. Permisos: **Contents → Read and write**. Caducidad a tu elección.
3. Abre `/admin/`, pega el token, elige una clave de cifrado (mín. 12 caracteres; guárdala: sin ella no se pueden leer
   contacto ni documento) y repítela. El primer acceso crea el registro.

## Cambios
- Profesores, formaciones, horas por defecto y contacto: `docs/assets/config.js`.
- Dominio propio (p. ej. `certificados.grupocns.com`): configúralo en Settings → Pages y cambia `publicUrl` en
  `config.js` **antes** de emitir certificados reales (los QR ya emitidos apuntan a la dirección vigente al emitirlos).

## Revocar / reactivar
Desde el panel (botón en cada fila). La verificación mostrará "Certificado revocado".
