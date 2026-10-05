/*
  APP.JS
  ======
  Punto de entrada del frontend. Se encarga de:
  1. Navegación simple entre vistas (Productos / Compras), sin ningún
     framework de rutas: solo mostrar y ocultar secciones con una clase.
  2. La lógica de cada vista: pedir datos a API (api.js), armar el HTML
     con los componentes (componentes.js), y reaccionar a los clics.

  Cómo se conecta con el resto:
  - index.html  -> carga este archivo al final, después de api.js
                   y componentes.js, para que ya existan esas funciones.
  - api.js      -> aquí se llama, nunca se usa fetch() directamente.
  - componentes.js -> aquí se llaman sus funciones para armar el HTML.
*/


/* ---------------------------------------------------------------- */
/* NAVEGACIÓN ENTRE VISTAS                                          */
/* ---------------------------------------------------------------- */

const vistas = {
    inicio: document.getElementById('vista-inicio'),
    productos: document.getElementById('vista-productos'),
    compras: document.getElementById('vista-compras'),
    ventas: document.getElementById('vista-ventas'),
    caja: document.getElementById('vista-caja')
};

function mostrarVista(nombre) {

    // Oculta todas las vistas y muestra solo la pedida
    Object.entries(vistas).forEach(([clave, elemento]) => {
        elemento.classList.toggle('oculto', clave !== nombre);
    });

    if (nombre === 'productos') cargarProductos();
    if (nombre === 'compras') cargarCompras();
    if (nombre === 'ventas') cargarVentas();
    if (nombre === 'caja') cargarCaja();
}

// Botones del menú "Módulos" (pantalla de inicio): cada uno abre su vista
document.querySelectorAll('.menu-boton').forEach((boton) => {
    boton.addEventListener('click', () => mostrarVista(boton.dataset.vista));
});

// Botones "Volver a módulos": salen de un módulo y regresan al inicio
document.querySelectorAll('.boton-volver').forEach((boton) => {
    boton.addEventListener('click', () => mostrarVista('inicio'));
});

// Aviso global: se usa cuando una acción manda al usuario de vuelta al
// menú de módulos (por ejemplo al confirmar una compra o venta), para
// que el mensaje de éxito no se pierda con el cambio de pantalla.
const toastGlobal = document.getElementById('toast-global');

function mostrarToastGlobal(mensaje, tipo = 'exito') {
    mostrarAlerta(toastGlobal, mensaje, tipo);
}


/* ---------------------------------------------------------------- */
/* VISTA: PRODUCTOS (catálogo)                                      */
/* ---------------------------------------------------------------- */

const contenedorProductos = document.getElementById('rejilla-productos');
const buscadorProductos = document.getElementById('buscador-productos');

let productosCache = [];

async function cargarProductos() {

    contenedorProductos.innerHTML = '<p class="texto-suave">Cargando productos…</p>';

    try {
        productosCache = await API.listarProductos();
        dibujarProductos(productosCache);
    } catch (error) {
        contenedorProductos.innerHTML = componenteAlerta(error.message);
    }
}

function dibujarProductos(lista) {

    if (lista.length === 0) {
        contenedorProductos.innerHTML = '<p class="estado-vacio">No hay productos para mostrar.</p>';
        return;
    }

    contenedorProductos.innerHTML = lista.map(componenteTarjetaProducto).join('');
}

// Filtro en vivo: no vuelve a pedir al servidor, filtra lo que ya se cargó
buscadorProductos.addEventListener('input', () => {

    const texto = buscadorProductos.value.trim().toLowerCase();

    const filtrados = productosCache.filter((producto) =>
        producto.nombre_producto.toLowerCase().includes(texto)
    );

    dibujarProductos(filtrados);
});


/* ---------------------------------------------------------------- */
/* VISTA: COMPRAS (listado)                                         */
/* ---------------------------------------------------------------- */

const cuerpoTablaCompras = document.getElementById('cuerpo-tabla-compras');
const alertaCompras = document.getElementById('alerta-compras');

async function cargarCompras() {

    cuerpoTablaCompras.innerHTML = `<tr><td colspan="5" class="texto-suave">Cargando compras…</td></tr>`;

    try {
        const compras = await API.listarCompras();
        dibujarCompras(compras);
    } catch (error) {
        mostrarAlerta(alertaCompras, error.message);
    }
}

function dibujarCompras(lista) {

    if (lista.length === 0) {
        cuerpoTablaCompras.innerHTML = `<tr><td colspan="5" class="estado-vacio">Todavía no hay compras registradas.</td></tr>`;
        return;
    }

    cuerpoTablaCompras.innerHTML = lista.map(componenteFilaCompra).join('');
}

// Delegación de eventos: un solo listener en la tabla, en vez de uno
// por fila (más eficiente, y funciona también con filas agregadas después)
cuerpoTablaCompras.addEventListener('click', (evento) => {

    const fila = evento.target.closest('tr[data-id-compra]');
    if (!fila) return;

    abrirDetalleCompra(fila.dataset.idCompra);
});

document.getElementById('boton-nueva-compra').addEventListener('click', abrirFormularioNuevaCompra);


/* ---------------------------------------------------------------- */
/* VISTA: COMPRAS (formulario para crear una nueva)                 */
/* ---------------------------------------------------------------- */

const panelFormularioCompra = document.getElementById('panel-formulario-compra');
const panelListadoCompras = document.getElementById('panel-listado-compras');
const panelDetalleCompra = document.getElementById('panel-detalle-compra');
const formularioNuevaCompra = document.getElementById('formulario-nueva-compra');

function abrirFormularioNuevaCompra() {
    panelListadoCompras.classList.add('oculto');
    panelFormularioCompra.classList.remove('oculto');
}

document.getElementById('boton-cancelar-nueva-compra').addEventListener('click', () => {
    panelFormularioCompra.classList.add('oculto');
    panelListadoCompras.classList.remove('oculto');
});

formularioNuevaCompra.addEventListener('submit', async (evento) => {

    evento.preventDefault();

    const datos = Object.fromEntries(new FormData(formularioNuevaCompra));

    try {
        const resultado = await API.crearCompra(datos);
        formularioNuevaCompra.reset();
        panelFormularioCompra.classList.add('oculto');
        panelListadoCompras.classList.remove('oculto');
        await cargarCompras();
        abrirDetalleCompra(resultado.id_compra);
    } catch (error) {
        mostrarAlerta(alertaCompras, error.message);
    }
});


/* ---------------------------------------------------------------- */
/* VISTA: COMPRAS (detalle de una compra puntual)                   */
/* ---------------------------------------------------------------- */

const cuerpoDetalleCompra = document.getElementById('cuerpo-detalle-compra');
const alertaDetalleCompra = document.getElementById('alerta-detalle-compra');

let idCompraActual = null;

async function abrirDetalleCompra(idCompra) {

    idCompraActual = idCompra;

    panelListadoCompras.classList.add('oculto');
    panelFormularioCompra.classList.add('oculto');
    panelDetalleCompra.classList.remove('oculto');

    await refrescarDetalleCompra();
}

document.getElementById('boton-volver-listado').addEventListener('click', () => {
    panelDetalleCompra.classList.add('oculto');
    panelListadoCompras.classList.remove('oculto');
    cargarCompras();
});

async function refrescarDetalleCompra() {

    cuerpoDetalleCompra.innerHTML = '<p class="texto-suave">Cargando…</p>';

    try {
        const datos = await API.obtenerCompra(idCompraActual);
        dibujarDetalleCompra(datos);
    } catch (error) {
        cuerpoDetalleCompra.innerHTML = componenteAlerta(error.message);
    }
}

function dibujarDetalleCompra(datos) {

    const { compra, estado, productos } = datos;
    const enBorrador = estado === 'BORRADOR';

    const filasProductos = productos
        .map((linea) => componenteFilaDetalleCompra(linea, enBorrador))
        .join('');

    cuerpoDetalleCompra.innerHTML = `
        <div class="encabezado-seccion">
            <div>
                <h2>Compra #${compra.id_compra} ${componenteBadgeEstado(estado)}</h2>
                <p class="texto-suave">${compra.descripciongeneral_compra || 'Sin descripción'}</p>
            </div>
            <div class="texto-derecha">
                <div class="texto-suave">Total</div>
                <div style="font-family: var(--fuente-titulo); font-size: 1.4rem;">
                    ${formatoMoneda(compra.valortotal_compra)}
                </div>
            </div>
        </div>

        ${enBorrador ? formularioAgregarLinea() : ''}

        <div class="tabla-envoltorio">
            <table>
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Unidad</th>
                        <th>Cantidad</th>
                        <th>P. compra</th>
                        <th>P. venta</th>
                        <th>Total</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody id="cuerpo-lineas-compra">
                    ${filasProductos || `<tr><td colspan="7" class="estado-vacio">Todavía no hay productos en esta compra.</td></tr>`}
                </tbody>
            </table>
        </div>

        <div class="barra-acciones">
            ${enBorrador ? `
                <button class="boton" id="boton-confirmar-compra" type="button">Confirmar compra</button>
                <button class="boton boton--peligro boton--secundario" id="boton-eliminar-compra" type="button">Eliminar compra</button>
            ` : `
                <button class="boton boton--secundario" id="boton-corregir-compra" type="button">Corregir compra</button>
            `}
        </div>
    `;

    engancharEventosDetalle(enBorrador);
}

function formularioAgregarLinea() {

    const opcionesProductos = productosCache
        .map((p) => `<option value="${p.id_producto}">${p.nombre_producto}</option>`)
        .join('');

    return `
        <form id="formulario-agregar-linea" class="tarjeta" style="margin-bottom: var(--espacio-m);">
            <h3>Agregar producto</h3>
            <div class="fila-campos">
                <div class="campo">
                    <label for="campo-producto">Producto</label>
                    <select id="campo-producto" name="id_producto" required>
                        <option value="">Seleccione…</option>
                        ${opcionesProductos}
                    </select>
                </div>
                <div class="campo">
                    <label for="campo-unidad">Unidad</label>
                    <input id="campo-unidad" name="und_medida" placeholder="Kg, Unidad…" required>
                </div>
                <div class="campo">
                    <label for="campo-cantidad">Cantidad</label>
                    <input id="campo-cantidad" name="cantidad_producto" type="number" min="1" step="1" required>
                </div>
                <div class="campo">
                    <label for="campo-pcompra">Precio de compra</label>
                    <input id="campo-pcompra" name="preciounitario_compra" type="number" min="0" step="1" required>
                </div>
                <div class="campo">
                    <label for="campo-pventa">Precio de venta</label>
                    <input id="campo-pventa" name="preciounitario_venta" type="number" min="0" step="1" required>
                </div>
            </div>
            <button class="boton boton--pequeno" type="submit">Agregar</button>
        </form>
    `;
}

function engancharEventosDetalle(enBorrador) {

    if (enBorrador) {

        const formularioLinea = document.getElementById('formulario-agregar-linea');

        formularioLinea.addEventListener('submit', async (evento) => {

            evento.preventDefault();

            const datos = Object.fromEntries(new FormData(formularioLinea));

            try {
                await API.agregarDetalleCompra(idCompraActual, datos);
                await refrescarDetalleCompra();
            } catch (error) {
                mostrarAlerta(alertaDetalleCompra, error.message);
            }
        });

        // Edición en línea: al salir de un campo (blur), se guarda esa fila.
        // Delegación de eventos: un solo listener para todas las filas.
        const cuerpoLineas = document.getElementById('cuerpo-lineas-compra');

        cuerpoLineas.addEventListener('focusout', async (evento) => {

            if (!evento.target.classList.contains('entrada-linea')) return;

            const fila = evento.target.closest('tr');
            await guardarLinea(fila);
        });

        cuerpoLineas.addEventListener('click', async (evento) => {

            if (!evento.target.classList.contains('boton-eliminar-linea')) return;

            const fila = evento.target.closest('tr');
            const idDetalle = fila.dataset.idDetalle;

            const confirmado = await pedirConfirmacion(
                '¿Quitar este producto de la compra?'
            );

            if (!confirmado) return;

            try {
                await API.eliminarDetalleCompra(idCompraActual, idDetalle);
                await refrescarDetalleCompra();
            } catch (error) {
                mostrarAlerta(alertaDetalleCompra, error.message);
            }
        });

        document.getElementById('boton-confirmar-compra').addEventListener('click', confirmarCompraActual);
        document.getElementById('boton-eliminar-compra').addEventListener('click', eliminarCompraActual);

    } else {

        document.getElementById('boton-corregir-compra').addEventListener('click', corregirCompraActual);
    }
}

async function guardarLinea(fila) {

    const idDetalle = fila.dataset.idDetalle;

    const datos = {
        cantidad_producto: fila.querySelector('.campo-cantidad').value,
        preciounitario_compra: fila.querySelector('.campo-precio-compra').value,
        preciounitario_venta: fila.querySelector('.campo-precio-venta').value
    };

    try {
        await API.modificarDetalleCompra(idCompraActual, idDetalle, datos);
        await refrescarDetalleCompra();
    } catch (error) {
        mostrarAlerta(alertaDetalleCompra, error.message);
    }
}

async function confirmarCompraActual() {

    const confirmado = await pedirConfirmacion(
        '¿Confirmar esta compra?',
        'El stock de los productos se actualizará y la compra quedará protegida contra ediciones directas.'
    );

    if (!confirmado) return;

    try {
        await API.confirmarCompra(idCompraActual);
        mostrarToastGlobal('Compra confirmada correctamente.');
        mostrarVista('inicio');
    } catch (error) {
        mostrarAlerta(alertaDetalleCompra, error.message);
    }
}

async function corregirCompraActual() {

    const confirmado = await pedirConfirmacion(
        '¿Devolver esta compra a borrador?',
        'El stock se revertirá y podrá editar los productos de nuevo.'
    );

    if (!confirmado) return;

    try {
        await API.corregirCompra(idCompraActual);
        mostrarAlerta(alertaDetalleCompra, 'Compra devuelta a borrador.', 'exito');
        await refrescarDetalleCompra();
    } catch (error) {
        mostrarAlerta(alertaDetalleCompra, error.message);
    }
}

async function eliminarCompraActual() {

    const confirmado = await pedirConfirmacion(
        '¿Eliminar esta compra?',
        'Esta acción no se puede deshacer. Solo es posible mientras la compra está en borrador.'
    );

    if (!confirmado) return;

    try {
        await API.eliminarCompra(idCompraActual);
        panelDetalleCompra.classList.add('oculto');
        panelListadoCompras.classList.remove('oculto');
        await cargarCompras();
    } catch (error) {
        mostrarAlerta(alertaDetalleCompra, error.message);
    }
}


/* ---------------------------------------------------------------- */
/* VISTA: VENTAS (listado)                                          */
/* ---------------------------------------------------------------- */

const cuerpoTablaVentas = document.getElementById('cuerpo-tabla-ventas');
const alertaVentas = document.getElementById('alerta-ventas');

async function cargarVentas() {

    cuerpoTablaVentas.innerHTML = `<tr><td colspan="6" class="texto-suave">Cargando ventas…</td></tr>`;

    try {
        const ventas = await API.listarVentas();
        dibujarVentas(ventas);
    } catch (error) {
        mostrarAlerta(alertaVentas, error.message);
    }
}

function dibujarVentas(lista) {

    if (lista.length === 0) {
        cuerpoTablaVentas.innerHTML = `<tr><td colspan="6" class="estado-vacio">Todavía no hay ventas registradas.</td></tr>`;
        return;
    }

    cuerpoTablaVentas.innerHTML = lista.map(componenteFilaVenta).join('');
}

// Delegación de eventos: un solo listener en la tabla
cuerpoTablaVentas.addEventListener('click', (evento) => {

    const fila = evento.target.closest('tr[data-id-venta]');
    if (!fila) return;

    abrirDetalleVenta(fila.dataset.idVenta);
});

document.getElementById('boton-nueva-venta').addEventListener('click', abrirFormularioNuevaVenta);


/* ---------------------------------------------------------------- */
/* VISTA: VENTAS (formulario para crear una nueva)                  */
/* ---------------------------------------------------------------- */

const panelFormularioVenta = document.getElementById('panel-formulario-venta');
const panelListadoVentas = document.getElementById('panel-listado-ventas');
const panelDetalleVenta = document.getElementById('panel-detalle-venta');
const formularioNuevaVenta = document.getElementById('formulario-nueva-venta');

function abrirFormularioNuevaVenta() {
    panelListadoVentas.classList.add('oculto');
    panelFormularioVenta.classList.remove('oculto');
}

document.getElementById('boton-cancelar-nueva-venta').addEventListener('click', () => {
    panelFormularioVenta.classList.add('oculto');
    panelListadoVentas.classList.remove('oculto');
});

formularioNuevaVenta.addEventListener('submit', async (evento) => {

    evento.preventDefault();

    const datos = Object.fromEntries(new FormData(formularioNuevaVenta));

    // El cliente es opcional (venta de mostrador): si el campo quedó
    // vacío, se manda null en vez de un texto vacío.
    datos.id_cliente = datos.id_cliente ? datos.id_cliente : null;

    // Ya no se pide fecha ni forma de pago aquí: la fecha la pone el
    // backend (hora actual) y la forma de pago se pregunta más adelante,
    // justo antes de confirmar la venta.

    try {
        const resultado = await API.crearVenta(datos);
        formularioNuevaVenta.reset();
        panelFormularioVenta.classList.add('oculto');
        panelListadoVentas.classList.remove('oculto');
        await cargarVentas();
        abrirDetalleVenta(resultado.id_venta);
    } catch (error) {
        mostrarAlerta(alertaVentas, error.message);
    }
});


/* ---------------------------------------------------------------- */
/* VISTA: VENTAS (detalle de una venta puntual)                     */
/* ---------------------------------------------------------------- */

const cuerpoDetalleVenta = document.getElementById('cuerpo-detalle-venta');
const alertaDetalleVenta = document.getElementById('alerta-detalle-venta');

let idVentaActual = null;

async function abrirDetalleVenta(idVenta) {

    idVentaActual = idVenta;

    panelListadoVentas.classList.add('oculto');
    panelFormularioVenta.classList.add('oculto');
    panelDetalleVenta.classList.remove('oculto');

    await refrescarDetalleVenta();
}

document.getElementById('boton-volver-listado-ventas').addEventListener('click', () => {
    panelDetalleVenta.classList.add('oculto');
    panelListadoVentas.classList.remove('oculto');
    cargarVentas();
});

async function refrescarDetalleVenta() {

    cuerpoDetalleVenta.innerHTML = '<p class="texto-suave">Cargando…</p>';

    try {
        const datos = await API.obtenerVenta(idVentaActual);
        dibujarDetalleVenta(datos);
    } catch (error) {
        cuerpoDetalleVenta.innerHTML = componenteAlerta(error.message);
    }
}

function dibujarDetalleVenta(datos) {

    const { venta, estado, productos } = datos;
    const enBorrador = estado === 'BORRADOR';

    const filasProductos = productos
        .map((linea) => componenteFilaDetalleVenta(linea, enBorrador))
        .join('');

    cuerpoDetalleVenta.innerHTML = `
        <div class="encabezado-seccion">
            <div>
                <h2>Venta #${venta.id_venta} ${componenteBadgeEstado(estado)} ${componenteBadgeTipoVenta(venta.tipo_venta)}</h2>
                <p class="texto-suave">${venta.descripciongeneral_venta || 'Sin descripción'}</p>
                ${venta.tipo_venta === 'FIADO' ? `<p class="texto-suave">Saldo pendiente: ${formatoMoneda(venta.saldopendiente_venta)}</p>` : ''}
            </div>
            <div class="texto-derecha">
                <div class="texto-suave">Total</div>
                <div style="font-family: var(--fuente-titulo); font-size: 1.4rem;">
                    ${formatoMoneda(venta.total_venta)}
                </div>
            </div>
        </div>

        ${enBorrador ? formularioAgregarLineaVenta() : ''}

        <div class="tabla-envoltorio">
            <table>
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Unidad</th>
                        <th>Cantidad</th>
                        <th>P. venta</th>
                        <th>Total</th>
                        <th>Rentab.</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody id="cuerpo-lineas-venta">
                    ${filasProductos || `<tr><td colspan="7" class="estado-vacio">Todavía no hay productos en esta venta.</td></tr>`}
                </tbody>
            </table>
        </div>

        <div class="barra-acciones">
            ${enBorrador ? `
                <button class="boton" id="boton-confirmar-venta" type="button">Confirmar venta</button>
                <button class="boton boton--peligro boton--secundario" id="boton-eliminar-venta" type="button">Eliminar venta</button>
            ` : `
                <button class="boton boton--secundario" id="boton-corregir-venta" type="button">Corregir venta</button>
            `}
        </div>
    `;

    engancharEventosDetalleVenta(enBorrador);
}

function formularioAgregarLineaVenta() {

    const opcionesProductos = productosCache
        .map((p) => `<option value="${p.id_producto}">${p.nombre_producto}</option>`)
        .join('');

    return `
        <form id="formulario-agregar-linea-venta" class="tarjeta" style="margin-bottom: var(--espacio-m);">
            <h3>Agregar producto</h3>
            <div class="fila-campos">
                <div class="campo">
                    <label for="campo-producto-venta">Producto</label>
                    <select id="campo-producto-venta" name="id_producto" required>
                        <option value="">Seleccione…</option>
                        ${opcionesProductos}
                    </select>
                </div>
                <div class="campo">
                    <label for="campo-unidad-venta">Unidad</label>
                    <input id="campo-unidad-venta" name="und_medida" placeholder="Kg, Unidad…" required>
                </div>
                <div class="campo">
                    <label for="campo-cantidad-venta">Cantidad</label>
                    <input id="campo-cantidad-venta" name="cantidad_producto" type="number" min="1" step="1" required>
                </div>
                <div class="campo">
                    <label for="campo-pventa-venta">Precio de venta</label>
                    <input id="campo-pventa-venta" name="preciounitario_venta" type="number" min="0" step="1" placeholder="Dejar vacío = precio del producto">
                </div>
            </div>
            <button class="boton boton--pequeno" type="submit">Agregar</button>
        </form>
    `;
}

function engancharEventosDetalleVenta(enBorrador) {

    if (enBorrador) {

        const formularioLinea = document.getElementById('formulario-agregar-linea-venta');

        // Al elegir el producto, traer su unidad y precio de venta
        // guardados (de la última compra confirmada) y dejarlos ya
        // puestos en el formulario. El usuario los puede cambiar si
        // quiere (por ejemplo para hacer un descuento puntual).
        const campoProductoVenta = document.getElementById('campo-producto-venta');

        campoProductoVenta.addEventListener('change', () => {

            const producto = productosCache.find(
                (p) => String(p.id_producto) === campoProductoVenta.value
            );

            if (!producto) return;

            const campoUnidad = document.getElementById('campo-unidad-venta');
            const campoPrecio = document.getElementById('campo-pventa-venta');

            campoUnidad.value = producto.und_medida || '';
            campoPrecio.value = producto.preciounitario_venta ?? '';
        });

        formularioLinea.addEventListener('submit', async (evento) => {

            evento.preventDefault();

            const datos = Object.fromEntries(new FormData(formularioLinea));

            // El precio es opcional: si quedó vacío, no se envía y el
            // backend usa el precio vigente del producto.
            if (!datos.preciounitario_venta) delete datos.preciounitario_venta;

            try {
                await API.agregarDetalleVenta(idVentaActual, datos);
                await refrescarDetalleVenta();
            } catch (error) {
                mostrarAlerta(alertaDetalleVenta, error.message);
            }
        });

        // Edición en línea: al salir de un campo (blur), se guarda esa fila.
        const cuerpoLineas = document.getElementById('cuerpo-lineas-venta');

        cuerpoLineas.addEventListener('focusout', async (evento) => {

            if (!evento.target.classList.contains('entrada-linea')) return;

            const fila = evento.target.closest('tr');
            await guardarLineaVenta(fila);
        });

        // Rentabilidad en vivo: mientras el usuario escribe un precio
        // nuevo (por ejemplo para hacer un descuento), se recalcula al
        // instante con el costo de la línea (data-costo), sin esperar a
        // guardar y sin tocar nada en la compra que originó ese costo.
        cuerpoLineas.addEventListener('input', (evento) => {

            if (!evento.target.classList.contains('campo-precio-venta')) return;

            const fila = evento.target.closest('tr');
            const costo = Number(fila.dataset.costo) || 0;
            const precio = Number(evento.target.value);

            const celdaRentabilidad = fila.querySelector('.valor-rentabilidad');
            if (!celdaRentabilidad) return;

            celdaRentabilidad.textContent = precio > 0
                ? `${Math.round(((precio - costo) / precio) * 1000) / 10}%`
                : '—';
        });

        cuerpoLineas.addEventListener('click', async (evento) => {

            if (!evento.target.classList.contains('boton-eliminar-linea')) return;

            const fila = evento.target.closest('tr');
            const idDetalle = fila.dataset.idDetalle;

            const confirmado = await pedirConfirmacion(
                '¿Quitar este producto de la venta?'
            );

            if (!confirmado) return;

            try {
                await API.eliminarDetalleVenta(idVentaActual, idDetalle);
                await refrescarDetalleVenta();
            } catch (error) {
                mostrarAlerta(alertaDetalleVenta, error.message);
            }
        });

        document.getElementById('boton-confirmar-venta').addEventListener('click', confirmarVentaActual);
        document.getElementById('boton-eliminar-venta').addEventListener('click', eliminarVentaActual);

    } else {

        document.getElementById('boton-corregir-venta').addEventListener('click', corregirVentaActual);
    }
}

async function guardarLineaVenta(fila) {

    const idDetalle = fila.dataset.idDetalle;

    const datos = {
        cantidad_producto: fila.querySelector('.campo-cantidad').value,
        preciounitario_venta: fila.querySelector('.campo-precio-venta').value
    };

    try {
        await API.modificarDetalleVenta(idVentaActual, idDetalle, datos);
        await refrescarDetalleVenta();
    } catch (error) {
        mostrarAlerta(alertaDetalleVenta, error.message);
    }
}

async function confirmarVentaActual() {

    // La forma de pago se pregunta aquí, al final, cuando ya se sabe
    // qué está comprando el cliente (no al crear la venta).
    const formaPago = await pedirFormaPago();

    if (!formaPago) return;

    try {
        await API.confirmarVenta(idVentaActual, { formapago_venta: formaPago });
        mostrarToastGlobal('Venta confirmada correctamente.');
        mostrarVista('inicio');
    } catch (error) {
        mostrarAlerta(alertaDetalleVenta, error.message);
    }
}

async function corregirVentaActual() {

    const confirmado = await pedirConfirmacion(
        '¿Devolver esta venta a borrador?',
        'El stock vendido se repondrá y podrá editar los productos de nuevo.'
    );

    if (!confirmado) return;

    try {
        await API.corregirVenta(idVentaActual);
        mostrarAlerta(alertaDetalleVenta, 'Venta devuelta a borrador.', 'exito');
        await refrescarDetalleVenta();
    } catch (error) {
        mostrarAlerta(alertaDetalleVenta, error.message);
    }
}

async function eliminarVentaActual() {

    const confirmado = await pedirConfirmacion(
        '¿Eliminar esta venta?',
        'Esta acción no se puede deshacer. Solo es posible mientras la venta está en borrador.'
    );

    if (!confirmado) return;

    try {
        await API.eliminarVenta(idVentaActual);
        panelDetalleVenta.classList.add('oculto');
        panelListadoVentas.classList.remove('oculto');
        await cargarVentas();
    } catch (error) {
        mostrarAlerta(alertaDetalleVenta, error.message);
    }
}


/* ---------------------------------------------------------------- */
/* VISTA: CAJA                                                       */
/* ---------------------------------------------------------------- */

const cuerpoCaja = document.getElementById('cuerpo-caja');

let cajaActual = null;

async function cargarCaja() {

    cuerpoCaja.innerHTML = '<p class="texto-suave">Cargando…</p>';

    try {
        cajaActual = await API.obtenerCajaActual();
        const movimientos = await API.listarMovimientosCaja(cajaActual.id_caja);
        dibujarCaja(movimientos);
    } catch (error) {
        // Si no hay ninguna caja abierta, el backend responde 404: en vez
        // de mostrarlo como error, se ofrece el formulario para abrir una.
        cajaActual = null;
        dibujarFormularioAbrirCaja(error.message);
    }
}

function dibujarFormularioAbrirCaja(mensaje) {

    cuerpoCaja.innerHTML = `
        <p class="estado-vacio">${mensaje}</p>

        <form id="formulario-abrir-caja" class="tarjeta">
            <h3>Abrir caja</h3>
            <div class="campo">
                <label for="caja-saldo-inicial">Saldo inicial</label>
                <input id="caja-saldo-inicial" name="saldo_inicial" type="number" min="0" step="1" required>
            </div>
            <div class="campo">
                <label for="caja-usuario">Usuario (ID)</label>
                <input id="caja-usuario" name="id_usuario" type="number" min="1" required>
            </div>
            <div class="campo">
                <label for="caja-observacion">Observación</label>
                <input id="caja-observacion" name="observacion" placeholder="Opcional">
            </div>
            <button class="boton" type="submit">Abrir caja</button>
        </form>
    `;

    document.getElementById('formulario-abrir-caja').addEventListener('submit', async (evento) => {

        evento.preventDefault();

        const formulario = evento.target;
        const datos = Object.fromEntries(new FormData(formulario));

        try {
            await API.abrirCaja(datos);
            await cargarCaja();
        } catch (error) {
            mostrarAlerta(cuerpoCaja, error.message);
        }
    });
}

function dibujarCaja(movimientos) {

    const caja = cajaActual;

    const filasMovimientos = movimientos
        .map(componenteFilaMovimiento)
        .join('');

    cuerpoCaja.innerHTML = `
        <div id="alerta-caja"></div>

        <div class="encabezado-seccion">
            <div>
                <p class="texto-suave">Caja #${caja.id_caja} — ${caja.estado_caja}</p>
                <p class="texto-suave">Saldo inicial: ${formatoMoneda(caja.saldo_inicial)}</p>
            </div>
            <div class="texto-derecha">
                <div class="texto-suave">Saldo actual</div>
                <div style="font-size: 1.4rem; font-weight: bold; color: var(--color-primario-oscuro);">
                    ${formatoMoneda(caja.saldo_actual)}
                </div>
            </div>
        </div>

        <div class="fila-campos" style="grid-template-columns: 1fr 1fr;">
            <div class="tarjeta">
                <p class="texto-suave">Ingresos</p>
                <p style="font-weight: bold; color: var(--color-exito);">${formatoMoneda(caja.total_ingresos)}</p>
            </div>
            <div class="tarjeta">
                <p class="texto-suave">Egresos</p>
                <p style="font-weight: bold; color: var(--color-alerta);">${formatoMoneda(caja.total_egresos)}</p>
            </div>
        </div>

        <div class="tabla-envoltorio" style="margin-top: var(--espacio-m);">
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Origen</th>
                        <th>Descripción</th>
                        <th class="texto-derecha">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    ${filasMovimientos || `<tr><td colspan="5" class="estado-vacio">Todavía no hay movimientos en esta caja.</td></tr>`}
                </tbody>
            </table>
        </div>

        <button class="boton boton--peligro" id="boton-cerrar-caja" type="button" style="margin-top: var(--espacio-m);">
            Cerrar caja
        </button>
    `;

    document.getElementById('boton-cerrar-caja').addEventListener('click', cerrarCajaActual);
}

async function cerrarCajaActual() {

    const confirmado = await pedirConfirmacion(
        '¿Cerrar esta caja?',
        'Se fija el saldo final con los movimientos de hoy. Después de cerrarla no se le pueden registrar más movimientos.'
    );

    if (!confirmado) return;

    try {
        await API.cerrarCaja(cajaActual.id_caja);
        await cargarCaja();
    } catch (error) {
        mostrarAlerta(document.getElementById('alerta-caja') || cuerpoCaja, error.message);
    }
}


/* ---------------------------------------------------------------- */
/* ARRANQUE                                                          */
/* ---------------------------------------------------------------- */

// Al cargar la página: traer el catálogo de productos (lo necesita el
// formulario de agregar línea) y mostrar el menú de módulos.
(async function iniciar() {
    await cargarProductos();
    mostrarVista('inicio');
})();