# Prompts de video IA · Ricser × HanColor

Para reemplazar los fondos procedurales o las transiciones por clips renderizados en Runway Gen-3 / Kling AI.
Los prompts van en inglés porque esos modelos responden mejor así.

**Formato:** 16:9, 1920×1080 o superior, 24 fps, sin audio, sin texto ni logos generados.
**Imagen inicial (imagen a video):** usá el PNG original recortado sobre fondo `#000f16`, no la versión web.

**Paleta para todos los clips:** deep abyssal cyan-black background `#000f16`, teal `#0b5c7c`, steel blue `#2982a3`, cyan glow `#50bab7`.

**Negative prompt (Kling):** `warped machine, melted parts, extra rollers, changing proportions, invented logos, readable text, watermark, people, warm light, orange light, lens dirt, flicker, camera shake`

---

## Imagen a video (equipos reales)

### 1. Hero: el equipo emerge de la oscuridad
Imagen inicial: `DTF UV_60.png` · Duración: 10 s
> Static industrial printer standing in a pitch-black studio, keep the machine geometry and logo exactly as in the source image. The machine slowly emerges from total darkness as a thin cyan rim light traces its silhouette from left to right. Concentric rings of soft cyan light ripple outward across a reflective black floor beneath it. Fine horizontal streaks of cyan particles drift across the frame in the background. Very slow push-in. Volumetric teal haze, photorealistic product film, 35mm anamorphic, high contrast.

### 2. Órbita del equipo
Imagen inicial: `dtf uv 60cm.png` · Duración: 8 s
> Slow cinematic orbit from front view toward a three-quarter view of the same industrial UV printer, machine stays rigid and undistorted, all panels, rollers and logo unchanged. Black studio, teal volumetric light from above, cyan rim light on the edges, horizontal airflow particles wrapping around the machine. Smooth motorized camera move, no shake, shallow haze, photorealistic.

### 3. Barrido láser
Imagen inicial: `dtf uv 60cm.png` · Duración: 6 s
> Locked-off frontal shot of the industrial printer in a dark studio. A thin bright cyan laser line sweeps vertically from top to bottom across the machine, and behind the line the machine turns into a glowing cyan blueprint with visible edges and internal structure. Camera does not move. Machine geometry stays identical. Clean, technical, no sparks, no smoke.

### 4. Plotter en producción
Imagen inicial: `PLOTTER 8 CABEZALES.png` · Duración: 8 s
> Wide industrial plotter in a dark studio. The print carriage travels smoothly from left to right along its rail while cyan light glows from inside the machine. Thin horizontal lines of blue and cyan particles cross the frame at different speeds. Very slow dolly-in, machine remains undistorted, photorealistic, teal volumetric atmosphere.

---

## Texto a video (fondos y transiciones)

### 5. Portal #1: dentro de la boquilla
Duración: 5 s · Se usa entre escena 2 y 3
> Extreme macro fly-through entering a microscopic inkjet printhead nozzle. The camera accelerates through a perfectly circular metal aperture lined with a thin cyan glowing ring, passes through a dark tunnel of tiny nozzles, and bursts out into a black void filled with a grid of glowing cyan dots. Continuous forward motion, motion blur at the edges, deep black, teal and cyan light only.

### 6. Institucional: malla de puntos
Duración: 8 s, loop · Fondo de la escena 3
> Seamless loop. Abstract infinite grid of small glowing dots on a pitch-black background, gentle waves of brightness travel through the grid like a frequency signal, colours cyan and steel blue only. Camera perfectly locked. Minimal, technical, halftone pattern, no objects, no text.

### 7. Red aérea y terrestre
Duración: 8 s · Fondo de la escena 3 o 4
> Top-down abstract night map made of glowing cyan dots on a black background. A thin bright arc of light travels from the upper right corner down to a pulsing hub, then fine lines of light branch out from the hub to several distant points. Slow drift, minimal, technical, cyan and steel blue, no labels, no text.

### 8. Portal #2: la mira de registro
Duración: 5 s · Se usa entre escena 4 y 5
> Camera rushes forward into a glowing cyan optical registration mark, a thin circle with a precise crosshair, floating in a dark teal void. The circle grows to fill the entire frame and the camera passes through it into a deep, softly lit teal space with faint technical grid lines. Fast acceleration, then a gentle settle. Motion blur, no text.

### 9. Fondo del Portal del cliente
Duración: 10 s, loop · Debajo de los paneles del portal
> Seamless loop. Very slow-moving volumetric teal fog in a dark space, faint shafts of steel blue light from above, a barely visible millimetric grid in the distance. Extremely subtle movement, low contrast, deep black-cyan tones, designed as a background behind interface panels. No objects, no text.

---

## Cómo integrarlos

Exportá en MP4 (H.264) o WebM y guardalos en `assets/video/`. Agregá cada clip en `VIDEO_PLATES`, al principio de [js/cinema.js](js/cinema.js):

```js
const VIDEO_PLATES = [
  { src: 'assets/video/hero.mp4', from: 0, to: 1.6, opacity: .6 },
  { src: 'assets/video/nucleo.mp4', from: 7.1, to: 8.6, opacity: .4 },
];
```

`from` y `to` son unidades de la línea de tiempo (1 unidad = 1 pantalla de scroll). Los clips se mezclan en modo *screen*, así que el negro queda transparente.

| Unidades | Escena |
|---|---|
| 0 a 1,6 | 1. The Awakening |
| 1,6 a 4,3 | 2. Información técnica |
| 4,3 a 4,65 | Portal #1 |
| 4,65 a 7,1 | 3. Institucional |
| 7,1 a 8,6 | 4. Seguimiento |
| 8,6 a 9,4 | Portal #2 |
| 9,4 a 9,8 | Pantalla de entrada al Portal del cliente |

Los clips quedan por debajo de la escena 3, que tiene fondo opaco. Para usar un video ahí, primero hay que quitar el fondo de `#s3` en [css/site.css](css/site.css).
