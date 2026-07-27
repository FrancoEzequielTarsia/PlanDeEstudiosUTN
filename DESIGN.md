# Design

Mundo visual de **Plan K23**. PRODUCT.md manda sobre la verdad de producto; este archivo manda
sobre las decisiones visuales durables.

> Este documento reemplaza por completo al anterior. La primera versión era una "lámina
> científica" densa, sobre fondo oscuro, con tintas saturadas y las correlativas dibujadas encima
> de las celdas. El usuario la rechazó por recargada y poco clara. No se conserva nada de ese
> mundo: no es un retoque, es un reemplazo.

## El mundo: la convención, ejecutada bien

El usuario pidió explícitamente algo **simple y moderno**, y fijó la referencia: **Ajustes de
iOS**. Eso es una decisión suya y es vinculante. No hay concepto propio acá y no se contrabandea
ninguno: se ejecuta la convención en serio, y el listón es el acabado de esa referencia.

Gramática que se toma de ahí, y se respeta entera:

- **Listas agrupadas.** El contenido vive en tarjetas de esquinas redondeadas sobre un fondo
  apenas más oscuro. Cada tarjeta es un grupo; cada grupo lleva un encabezado corto arriba y,
  cuando hace falta aclarar algo, una nota al pie debajo.
- **Filas, no tarjetas sueltas.** Dentro de un grupo, cada elemento es una fila de alto cómodo:
  etiqueta a la izquierda, valor a la derecha, separador de un pixel entre filas que **no llega
  al borde izquierdo** (arranca alineado con el texto).
- **Un solo color de acento.** El azul del sistema. Todo lo demás es neutro, salvo los colores
  de estado, que son semánticos.
- **Control segmentado** para cambiar de sección: una pista gris con la pestaña activa elevada.
- **Sin sombras decorativas.** La única elevación real es la del segmento activo y la del panel
  emergente.

## Claro y oscuro

Ambos son ciudadanos de primera. El tema se elige en Ajustes entre **Automático, Claro y
Oscuro**, se guarda, y por defecto sigue al sistema. Ningún color se escribe suelto en una regla:
todos salen de variables que cambian con el tema.

## Color: el estado es lo único que lleva color

En vez de una leyenda que hay que estudiar, cada fila **dice su estado con todas las letras** y
lo acompaña con un punto de color. Al escribirlo en cada fila, la leyenda deja de existir: no
hay nada que memorizar.

La escala va del gris al verde, siguiendo el avance de la materia:

| Estado | Color | Qué significa |
|---|---|---|
| Sin cursar | gris | Todavía no la empezaste. |
| Cursando | naranja | En curso. |
| Regularizada | verde | Materia aprobada. |
| Promocionada | violeta | Aprobada por promoción. |
| Abandonada | rojo | La dejaste. |

Y una única condición derivada: **Podés cursarla**, en el azul de acento, sobre las materias sin
cursar cuyas correlativas ya están cumplidas. Es la respuesta a la pregunta que trae al usuario
a la app, así que se gana el color de acento.

Ningún estado se distingue sólo por color: el nombre del estado está escrito siempre.

## Tipografía

Stack del sistema, sin fuentes externas (la app se abre con doble clic y sin conexión). Tamaños
de la referencia: 17px para la etiqueta de una fila, 13px para encabezados de grupo y notas al
pie, 15px para valores secundarios. Los números que se comparan llevan cifras tabulares.

## Composición

Tres secciones, cambiadas por el control segmentado:

1. **Plan** — el resumen del cálculo oficial arriba, y después las materias en una **grilla de
   cinco columnas, una por nivel**. La grilla es la vista que el usuario pidió explícitamente:
   deja ver la carrera entera de un vistazo y comparar niveles entre sí, cosa que una lista
   vertical larga no permite. Cada celda dice nombre, código y estado escrito.

   Al tocar una materia, el editor aparece **debajo de la grilla, siempre en el mismo lugar**.
   No es un modal ni un panel lateral: así se puede ir tocando materia tras materia sin abrir ni
   cerrar nada, que es como se carga un cuatrimestre. La celda abierta se marca con un anillo
   completo del color de acento, nunca con una franja lateral.
2. **Correlativas** — sección propia. Arriba el mapa completo del plan; abajo, al elegir una
   materia, el detalle enfocado de su cadena. Esta sección es **más ancha que el resto de la
   app** porque los cinco niveles tienen que entrar a la vez: un mapa que obliga a scrollear
   para ver el nivel 5 deja de ser un mapa.

   Los dos tipos de correlativa se distinguen por el trazo: **llena** para *regularizar*,
   **punteada** para *aprobar*. El punteado va bien separado (`6 5`) y la clave de arriba se
   dibuja en SVG, no con `border-dashed`, porque a 2px un borde punteado se lee igual que uno
   lleno.
3. **Ajustes** — los términos del cálculo que se cargan a mano, el tema, y los datos.

### Las herramientas son pantallas empujadas, no pestañas ni ventanas

El simulador de inscripción, el camino crítico y el ordenamiento por impacto se abren desde una
lista en **Plan** y **reemplazan la pantalla**, con un «‹ Plan» arriba a la izquierda para
volver. Mientras están abiertas, el control segmentado se oculta y el título de la barra pasa a
ser el de la herramienta.

Es exactamente la navegación por *push* de la referencia: no ensucian el nivel superior (siguen
siendo tres secciones, no seis) y no abren ventanas del navegador. Reglas que se derivan:

- Son de **sólo lectura**: calculan sobre los datos y nunca los escriben. Por eso no hay estado
  que sincronizar ni conflictos posibles.
- El estado de la herramienta (qué materias marcaste en el simulador) es efímero y vive en
  memoria: no se guarda, porque es una prueba, no un dato.
- Sólo se entra a ellas desde Plan. No hay forma de llegar por el control segmentado.

### La excepción: Progreso de la carrera

La pantalla **Progreso de la carrera** es la única con permiso para jugar, por pedido explícito
del usuario («full juguetón»): gradiente en el porcentaje grande, caminante que rebota, tira de
casilleros que se pinta en cascada, confetti. Las prohibiciones de abajo **no aplican ahí, y
sólo ahí**: nada de ese lenguaje se exporta al resto de la app. Aun en esa pantalla se respetan
los tokens del tema (claro y oscuro), `prefers-reduced-motion` apaga todo el movimiento, y la
información nunca viaja sólo en el color: los números y estados van escritos.

## Prohibiciones

- Nada de fondos con textura ni sombras de colores.
- Nada de gradientes ni vidrio esmerilado, **salvo en la grilla de niveles**, que es la
  excepción que el usuario pidió expresamente («capaz hacer algo tipo liquid glass»,
  27/07/2026) después de rechazar tres intentos de resolver el contraste por color y por
  tono. Ahí las materias son paneles translúcidos sobre un campo de luz desenfocado: lo
  terminado es vidrio espeso y opaco que se hunde, lo pendiente es vidrio limpio con canto
  especular. El campo de luz existe porque el desenfoque necesita algo detrás para
  refractar. No se exporta a ninguna otra sección.
- Nada de leyendas: si un color necesita explicación, la etiqueta va escrita en la fila.
- Nada de líneas de correlativas dibujadas sobre la lista de materias. El grafo vive en su
  sección y en ningún otro lado.
- Ninguna fuente ni imagen traída por red.
- Nada de monoespaciada como disfraz de "técnico"; sólo para códigos de materia y fórmulas.

## Tokens

Los valores exactos viven en `styles.css` bajo `:root` y `[data-tema]`, que son la fuente de
verdad.
