# Layout responsive y edición de vistas existentes

Complementa a [frontend.md](frontend.md), que cubre **crear** una app. Este cubre lo otro: **tocar
una vista que ya existe** sin romperla en pantallas angostas. Todo lo de acá salió de bugs reales
que pasaron build, lint y typecheck sin una queja.

> Esto es para layouts responsive dentro del mismo host. Si la app tiene un host móvil **aparte**,
> eso es [frontend-mobile-variant.md](frontend-mobile-variant.md).

## Breakpoints

Los de Tailwind por defecto: el preset no define `screens`. El corte compacto de la plataforma es
**`lg` (1024px)** — es el que usan `adc-sidebar` (pasa a drawer) y `adc-page-shell` (offset del
aside). Su gemelo en JS es `useIsCompact()` / `COMPACT_QUERY` de `@ui-library/utils/use-media-query`:
usarlo en vez de hardcodear un ancho, así el layout JS y las clases `lg:` no se desincronizan.

`sm`/`md` sirven para lo que es puro ancho de una fila (un pie, una toolbar), no para el chasis.

## La escala de spacing **no** son 4px

`--spacing` de la plataforma es **3.25px**, no los 4px de Tailwind por defecto (el root font-size no
es 16). O sea `w-11` = 35.75px, no 44. Cuando un número tiene que coincidir con un valor concreto
—un mínimo táctil, el ancho de un icono, un carril reservado— va **en px explícitos**
(`w-[44px]`, `sm:px-[60px]`) y con un comentario que diga de dónde sale. En la escala se ve
prolijo y da otro número.

## Clases inválidas no fallan: desaparecen

Tailwind v4 acepta *bare values*, pero son **números contra `--spacing`**. Con unidad hacen falta
corchetes:

| Escrito | Qué pasa |
| --- | --- |
| `max-w-70vw` | **no genera ninguna regla**. Silencio total |
| `max-w-70` | compila, pero significa `calc(var(--spacing) * 70)` — no es "70vw" |
| `max-w-[70vw]` | ✅ |

Sacarle la unidad para que "compile" es peor que el bug original. `bun run check:ui` caza la primera
forma; la segunda no la puede distinguir de un uso legítimo de la escala.

## Decoración fuera de flujo

Un `absolute` sobre contenido que envuelve necesita una de dos cosas, y hay que elegir cuál:

- **reservarle el carril** al hermano que fluye (`sm:px-[60px]`), o
- **volver al flujo** en pantallas angostas (`mt-3 inline-block sm:absolute sm:right-4 …`).

Al calcular el carril, contá el ancho **efectivo**: `accessibility.css` infla `a`/`button`/`input`
a 44px por debajo de 768px, así que un icono de 36px ocupa 44 en esa banda.

## Píldoras y botones: nunca un `<span>` con borde

Un `<span>` es `display:inline`. Al envolver, el navegador **fragmenta la caja**: media píldora al
final de un renglón y media al principio del siguiente. Usar `adc-button` (su `inline-flex` no se
puede fragmentar). Si de verdad tiene que ser propio: `inline-flex whitespace-nowrap shrink-0`.

> Ojo: un hijo directo de un contenedor flex se *blockifica*, así que ahí el bug no aparece. Sale
> cuando el span está dentro de un `<label>`, un `<p>` o cualquier contexto inline.

## Filas flex con texto largo

- `flex-wrap` para que el segundo elemento baje en vez de comprimirse.
- `min-w-0` en el que tiene que encogerse: sin él, un flex item no baja del ancho intrínseco de su
  contenido y deja de achicarse.
- Un `slot="footer"` de `adc-modal` es un **flex item** del footer del modal (`flex justify-end`):
  sin `w-full` no recibe espacio libre, y `justify-between` adentro no reparte nada.

## Contenido que no entra: darle su propio scroll

Una tabla, una barra de tabs o un bloque de código anchos **no** se arreglan achicándolos: se
envuelven en un contenedor con `overflow-x-auto` y `max-w-full`. Así scrollea esa caja y no la
página entera — que es lo que rompe la lectura en móvil.

```tsx
<div className="max-w-full overflow-x-auto">
	<table className="w-full …">…</table>
</div>
```

`ui-check` sabe la diferencia: si el desborde queda contenido por un ancestro scrolleable que sí
entra en pantalla, no lo reporta. Lo que reporta es lo que empuja el ancho del **documento**.

## Touch targets

`src/global/accessibility.css` fuerza `min-height/min-width: 44px` a `button`, `a`, `input`,
`select`, `textarea` y `[role=button|link]` **por debajo de 768px**, en silencio. Diseñá contando con
eso en vez de pelearlo: un control de 20px no queda de 20px, queda de 44 y te desarma la fila.

Excepciones ya resueltas ahí: `checkbox`/`radio` se quedan en 24px (mínimo de WCAG 2.5.8), y los
enlaces dentro de una oración no cuentan (excepción "inline" de WCAG 2.5.5).

## Antes de dar por cerrado un cambio de UI

```bash
bun run check:ui                                    # clases muertas, colores crudos, enlaces rotos
node .claude/skills/run-adc-platform/driver.mjs ui-check <url> <nombre> --mobile
```

`ui-check` reporta overflow horizontal, cajas inline partidas, solapamientos y touch targets chicos,
y sale ≠ 0 si encuentra algo (detalle en la SKILL de `run-adc-platform`). Para una vista con sesión:
`--login admin`. Igual conviene mirar la captura: la sonda ve geometría, no si algo se ve feo.

## Checklist

- [ ] Valores con unidad entre corchetes (`max-w-[70vw]`), nunca `max-w-70vw` ni `max-w-70`.
- [ ] Los números que deben coincidir con algo concreto, en px explícitos y comentados.
- [ ] Todo `absolute` sobre contenido: carril reservado o vuelta al flujo en angosto.
- [ ] Ningún `<span>` con borde/fondo haciendo de botón.
- [ ] Filas flex con `flex-wrap` y `min-w-0` donde corresponde; `w-full` en los `slot="footer"`.
- [ ] Tablas/tabs/código anchos dentro de un `overflow-x-auto`, no desbordando la página.
- [ ] Colores por token semántico (`text-tsuccess`, `bg-warn`), no `text-green-500`.
- [ ] Enlaces a otra app por `resolvePlatformPath("<id>", path)`, nunca con el host escrito a mano.
- [ ] `bun run check:ui` en verde y `ui-check --mobile` sin hallazgos.
