# Roadmap Universitario

Tracker de progreso académico para las carreras **TPI** (Tecnicatura en Programación Informática) y **LI** (Licenciatura en Informática) de la UNAJ, con planificador de horarios semanal.

Sin frameworks. Sin bundler. Sin dependencias de runtime. Cinco archivos, abre con doble click.

---

## Estructura

```
tpi.html          # Roadmap TPI
li.html           # Roadmap LI
calendario.html   # Planificador de horarios semanal
roadmap.js        # Motor compartido (cargado por tpi.html y li.html)
shared.css        # Design system compartido
```

---

## Funcionalidades

### Roadmaps (TPI y LI)

- **Cuatro estados por materia:** `bloqueada` → `habilitada` → `en-curso` → `aprobada`
- **Motor de correlativas:** evalúa requisitos de dos tipos — correlativas directas (IDs de materias) y umbrales de créditos por grupo
- **Progreso compartido:** aprobar una materia en TPI la marca también en LI si comparten ID, y viceversa
- **Simulación de cuatrimestre:** marcá materias como "en curso" para ver cuántos créditos sumarías y qué nuevas materias se desbloquearían si las aprobás todas
- **Toast de desbloqueo:** al aprobar una materia, notifica en tiempo real qué otras materias quedaron habilitadas
- **Filtros:** por grupo (CI, CO, CA...) y por estado
- **Barra de progreso** con porcentaje de materias aprobadas
- **Hints en tarjetas bloqueadas:** muestra exactamente qué correlativas o créditos faltan
- **Dark mode** con persistencia en `localStorage` y fallback a `prefers-color-scheme`

### Calendario Semanal

- Grilla CSS Grid con resolución de 30 minutos (08:00 a 22:00, lunes a sábado)
- **Detección de solapamientos** entre comisiones — marca los conflictos visualmente
- **Exportar imagen** (PNG a escala 2×) vía `html2canvas`, cargado on-demand
- **Compartir por URL:** serializa el horario armado en un query param (`?horario=`) usando `btoa`, se restaura automáticamente al abrir el link
- Chips de materias agregadas con botón de quitar individual

---

## Uso

Abrí cualquiera de los tres archivos HTML directamente en el navegador. No requiere servidor.

El progreso se guarda automáticamente en `localStorage` bajo la key `roadmap_aprobadas`. Si tenías progreso guardado de una versión anterior con keys separadas por carrera, podés migrarlo desde la consola del navegador:

```js
const tpi = JSON.parse(localStorage.getItem('roadmap_tpi_aprobadas') || '[]');
const li  = JSON.parse(localStorage.getItem('roadmap_li_aprobadas')  || '[]');
localStorage.setItem('roadmap_aprobadas', JSON.stringify([...new Set([...tpi, ...li])]));
```

---

## Stack técnico

| | |
|---|---|
| **Lenguajes** | HTML5, CSS3, JavaScript ES2020+ |
| **Layout** | CSS Grid (`auto-fill`, `minmax`, posicionamiento absoluto en grilla para el calendario) |
| **Theming** | CSS custom properties + `[data-theme="dark"]` |
| **Persistencia** | `localStorage` |
| **Exportación** | `html2canvas` (on-demand) |
| **Compartir** | `navigator.clipboard` + `btoa`/`atob` + query params |
| **Modales** | Custom, basados en Promises (reemplaza `window.confirm`) |
| **Tipografía** | IBM Plex Sans + IBM Plex Mono (Google Fonts) |

---

## Arquitectura

`roadmap.js` es un motor genérico que consume tres variables declaradas por cada HTML host:

```js
const materiasData      = [...]; // nodos del grafo
const storageKey        = '...'; // namespace en localStorage
const gruposDisponibles = [...]; // grupos válidos para acumular créditos
```

Esto permite que el mismo motor procese los planes de estudio de TPI y LI (con topologías distintas) sin duplicar lógica.

Cada materia define sus condiciones de habilitación en un objeto `requisitos`:

```js
{
  id: "1037",
  nombre: "Programación con Objetos II",
  grupo: "CO",
  creditos: 12,
  requisitos: {
    materiasAprobadas: ["1034"],          // correlativas directas
    creditosNecesarios: { "CI": 30 }      // umbrales por grupo
  }
}
```

La función `verificarEstadoMateria` evalúa ambas condiciones y retorna el estado correspondiente. Los desbloqueos se calculan comparando snapshots de estado antes y después de una aprobación.# RoadMap-UNQ
