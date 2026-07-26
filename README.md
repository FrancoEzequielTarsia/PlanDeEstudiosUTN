# Plan K23

Seguimiento del plan de estudios **K23** de Ingeniería en Sistemas de Información, UTN FRBA:
estado y nota de cada materia, peso académico bajo las dos fórmulas vigentes, promedio original y
ponderado, y el mapa de correlativas evaluado contra tu avance real.

## Cómo se usa

Abrí **`index.html`** con doble clic. No hace falta instalar nada, ni servidor, ni conexión.

La app tiene tres secciones:

- **Plan** — el resumen del cálculo oficial y la carrera entera en cinco columnas, una por nivel.
  Tocá una materia y el editor aparece debajo de la grilla: estado, nota y año. Nada más.
- **Correlativas** — el mapa completo del plan. Tocá una materia y se enciende su cadena; abajo
  aparece qué necesitás antes y qué destraba después.
- **Ajustes** — el tema (automático, claro u oscuro), los cuatro datos que las fórmulas necesitan
  y no se deducen de un estado, y el respaldo de tus datos.

### Dónde se guardan tus datos

Por defecto, en el **`localStorage` de este navegador**. Eso persiste indefinidamente: cerrás,
apagás la máquina y al día siguiente sigue todo. Se pierde sólo si borrás los datos de navegación,
si usás otro navegador o perfil, o si abrís el archivo en una ventana privada.

En **Ajustes → Copia en disco** podés además elegir un archivo tuyo (por ejemplo
`D:\ProyectosPersonales\PlanK23\plan-k23.json`). A partir de ahí la app lo reescribe sola en cada
cambio, así que tenés una copia real fuera del navegador. Es una copia **adicional**: si algo
falla al escribirla, tus datos en el navegador no se tocan.

Al reabrir la página el navegador puede volver a pedir permiso sobre ese archivo; alcanza con un
click en «Reactivar» y no hay que volver a elegirlo. También queda siempre **Exportar**, que baja
el JSON a mano.

### Los cinco estados

Sin cursar · Cursando · **Regularizada** · **Promocionada** · Abandonada.

*Regularizada* significa materia aprobada. Como consecuencia, las 11 correlativas del plan que
piden *aprobar* la previa se cumplen igual que las que piden *regularizarla*.

### Herramientas

Desde la sección **Plan** se entra a tres pantallas de decisión. No abren ventanas nuevas ni
ocupan una pestaña propia: la pantalla cambia y volvés con «‹ Plan». Son de **sólo lectura**:
te muestran cómo quedarías, sin tocar lo que cargaste.

- **Simulador de inscripción.** Marcás las materias que pensás anotarte y te muestra cómo
  quedaría tu peso académico bajo las dos fórmulas, qué destraba, y si la combinación es viable
  (avisa si elegiste una materia que todavía no podés cursar, o dos donde una es correlativa de
  la otra).
- **Camino crítico.** La cadena más larga de materias sin aprobar que te queda. Como cada una
  necesita la anterior aprobada, su largo es el **piso de cuatrimestres** que te faltan, por más
  materias que apruebes en paralelo. Marca cuál es la que no podés seguir pateando.
- **Ordenar por impacto.** De las que podés cursar, cuántas materias destrabás al aprobar cada
  una: «ahora» (las que quedan habilitadas de inmediato) y «en total» (todo lo que depende de
  ella más adelante).

### Los colores

Gris sin cursar, naranja cursando, verde regularizada, violeta promocionada, rojo abandonada, y
azul para «Podés cursarla». No hay leyenda que estudiar: cada materia dice su estado escrito.

## Archivos

| Archivo | Qué contiene |
|---|---|
| `index.html` | Estructura de la página. |
| `styles.css` | Todo el sistema visual. Los tokens de `:root` son la fuente de verdad. |
| `plan.js` | Las 37 materias, sus niveles y las 59 correlativas. Datos, sin lógica. |
| `calculo.js` | **La aritmética oficial.** No toca el DOM. |
| `disco.js` | Copia automática en un archivo del disco. Aislado del resto. |
| `app.js` | Render e interacción. No calcula nada. |
| `test-calculo.js` | Pruebas de `calculo.js`. |
| `PRODUCT.md` | Verdad de producto: definiciones, fuentes y decisiones abiertas. |
| `DESIGN.md` | Decisiones visuales durables. |

## Pruebas

```
node test-calculo.js
```

62 comprobaciones. Incluyen los dos ejemplos reales de SIGA (peso académico **133** y **151** en
uno, **169** en el otro): si alguno se rompe, el número que muestra la app dejó de coincidir con
el que te muestra la facultad.

## De dónde salen los datos

- **Correlativas**: extraídas de la geometría vectorial del PDF *Mapa Correlativas K23* (Franja
  Morada) — 59 aristas, 48 de tipo *Regularizar* y 11 de tipo *Aprobar*. Ese mapa declara
  explícitamente que **sólo incluye correlativas directas**, y con eso alcanza: si tenés
  regularizada la materia previa, sus propias correlativas ya se cumplieron.
- **Niveles y códigos**: SIGA. Donde el PDF y SIGA discrepan (*Análisis Numérico* y *Ciencia de
  Datos*), manda SIGA.
- **Peso académico y ponderación**: Ordenanza 1549 y resolución 2902/25. Las definiciones exactas
  de cada término están en `PRODUCT.md`.

Un detalle que sorprende: la ponderación de la Ordenanza 1549 **sólo se aplica a notas de ciclos
lectivos anteriores a 2017**. Desde 2017 la nota ponderada es igual a la original, así que los
dos promedios coinciden siempre para quien empezó después.
