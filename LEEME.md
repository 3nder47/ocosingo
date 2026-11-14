# Kiosko

La página de la raíz se genera con `kiosko-api/herramientas/armar-nueva.py --definitiva` desde `kiosko-api/herramientas/base/` (la app vieja congelada) y `herramientas/pagina/`. No editar a mano: se regenera. Usa el Worker (`https://kiosko-api.kiosko-api.workers.dev/`) y la sesión por PIN. `nueva/` solo redirige a la raíz; los prototipos redirigen al catálogo (originales en `base/prototipos/`). Los `.gs` son Apps Script (ayudante de fotos).
