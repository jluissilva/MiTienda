/*
  COMPONENTES.JS
  ==============
  Un "componente" aquí es simplemente una función de JavaScript que
  recibe datos y devuelve un pedazo de HTML (como texto, con template
  literals). No se usa ningún framework: es la idea básica detrás de
  React, Vue, etc., pero escrita a mano para entender qué hace.

  Cada función de este archivo se puede llamar muchas veces con datos
  distintos, y siempre devuelve el mismo tipo de pedazo de interfaz.
  Eso es lo que hace que sea un componente reutilizable y no una
  plantilla pegada una sola vez.
*/


/* Convierte un número a formato de pesos colombianos: 28000 -> "$28.000" */
function formatoMoneda(valor) {

    const numero = Number(valor) || 0;

    return numero.toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    });
}


/* Componente: badge de estado (BORRADOR / CONFIRMADA) */
function componenteBadgeEstado(estado) {

    const esConfirmada = estado === 'CONFIRMADA';

    const clase = esConfirmada ? 'badge--confirmada' : 'badge--borrador';
    const texto = esConfirmada ? 'Confirmada' : 'Borrador';

    return `<span class="badge ${clase}">${texto}</span>`;
}


/* Componente: tarjeta de producto, para el catálogo */
function componenteTarjetaProducto(producto) {

    return `
        <article class="producto">
            <div class="producto__nombre">${producto.nombre_producto}</div>
            <div class="producto__detalle">
                Stock: ${producto.stock_producto} ${producto.und_medida || ''}
            </div>
            <div class="producto__precio">${formatoMoneda(producto.preciounitario_venta)}</div>
        </article>
    `;
}


/* Componente: fila de la tabla de compras (listado) */
function componenteFilaCompra(compra) {

    const fecha = compra.fecha_compra
        ? new Date(compra.fecha_compra).toLocaleDateString('es-CO')
        : '—';

    return `
        <tr class="fila-clicable" data-id-compra="${compra.id_compra}">
            <td>#${compra.id_compra}</td>
            <td>${fecha}</td>
            <td>${compra.descripciongeneral_compra || '—'}</td>
            <td>${componenteBadgeEstado(compra.estado)}</td>
            <td class="texto-derecha">${formatoMoneda(compra.valortotal_compra)}</td>
        </tr>
    `;
}


/*
 * Componente: fila editable del detalle de una compra.
 * Si la compra está en borrador, la cantidad y los precios son inputs
 * editables. Si está confirmada, se muestran como texto plano.
 */
function componenteFilaDetalleCompra(linea, editable) {

    if (!editable) {

        return `
            <tr data-id-detalle="${linea.id_detallecompra}">
                <td>${linea.nombre_producto}</td>
                <td>${linea.und_medida || ''}</td>
                <td class="texto-derecha">${linea.cantidad_producto}</td>
                <td class="texto-derecha">${formatoMoneda(linea.preciounitario_compra)}</td>
                <td class="texto-derecha">${formatoMoneda(linea.preciounitario_venta)}</td>
                <td class="texto-derecha">${formatoMoneda(linea.preciototal_compra)}</td>
                <td></td>
            </tr>
        `;
    }

    return `
        <tr data-id-detalle="${linea.id_detallecompra}">
            <td>${linea.nombre_producto}</td>
            <td>${linea.und_medida || ''}</td>
            <td>
                <input
                    type="number" min="0" step="1"
                    class="entrada-linea campo-cantidad"
                    value="${linea.cantidad_producto}"
                >
            </td>
            <td>
                <input
                    type="number" min="0" step="1"
                    class="entrada-linea campo-precio-compra"
                    value="${linea.preciounitario_compra}"
                >
            </td>
            <td>
                <input
                    type="number" min="0" step="1"
                    class="entrada-linea campo-precio-venta"
                    value="${linea.preciounitario_venta}"
                >
            </td>
            <td class="texto-derecha">${formatoMoneda(linea.preciototal_compra)}</td>
            <td>
                <button class="boton boton--peligro boton--pequeno boton-eliminar-linea" type="button">
                    Quitar
                </button>
            </td>
        </tr>
    `;
}


/* Componente: badge del tipo de venta (CONTADO / FIADO) */
function componenteBadgeTipoVenta(tipoVenta) {

    const esFiado = tipoVenta === 'FIADO';

    const clase = esFiado ? 'badge--borrador' : 'badge--confirmada';
    const texto = esFiado ? 'Fiado' : 'Contado';

    return `<span class="badge ${clase}">${texto}</span>`;
}


/* Componente: fila de la tabla de ventas (listado) */
function componenteFilaVenta(venta) {

    const fecha = venta.fecha_venta
        ? new Date(venta.fecha_venta).toLocaleDateString('es-CO')
        : '—';

    const cliente = venta.id_cliente ? `Cliente #${venta.id_cliente}` : 'Mostrador';

    return `
        <tr class="fila-clicable" data-id-venta="${venta.id_venta}">
            <td>#${venta.id_venta}</td>
            <td>${fecha}</td>
            <td>${cliente}</td>
            <td>${componenteBadgeTipoVenta(venta.tipo_venta)}</td>
            <td>${componenteBadgeEstado(venta.estado)}</td>
            <td class="texto-derecha">${formatoMoneda(venta.total_venta)}</td>
        </tr>
    `;
}


/*
 * Componente: fila editable del detalle de una venta.
 * Si la venta está en borrador, la cantidad y el precio de venta son
 * inputs editables. Si está confirmada, se muestran como texto plano
 * junto con la rentabilidad (dato interno, no aparece en la factura).
 */
function componenteFilaDetalleVenta(linea, editable) {

    const rentabilidad = (linea.rentabilidad_porcentaje === null || linea.rentabilidad_porcentaje === undefined)
        ? '—'
        : `${linea.rentabilidad_porcentaje}%`;

    if (!editable) {

        return `
            <tr data-id-detalle="${linea.id_detalleventa}">
                <td>${linea.nombre_producto}</td>
                <td>${linea.und_medida || ''}</td>
                <td class="texto-derecha">${linea.cantidad_producto}</td>
                <td class="texto-derecha">${formatoMoneda(linea.preciounitario_venta)}</td>
                <td class="texto-derecha">${formatoMoneda(linea.preciototal_venta)}</td>
                <td class="texto-derecha">${rentabilidad}</td>
                <td></td>
            </tr>
        `;
    }

    // Costo de referencia para recalcular la rentabilidad en vivo mientras
    // el usuario escribe un precio nuevo, sin tocar nada en detalle_compra:
    // si la venta ya tiene costo guardado (confirmada) se usa ese; si está
    // en borrador, el costo vigente del producto.
    const costoReferencia = linea.costo_unitario !== null && linea.costo_unitario !== undefined
        ? linea.costo_unitario
        : linea.costo_actual;

    return `
        <tr data-id-detalle="${linea.id_detalleventa}" data-costo="${Number(costoReferencia) || 0}">
            <td>${linea.nombre_producto}</td>
            <td>${linea.und_medida || ''}</td>
            <td>
                <input
                    type="number" min="0" step="1"
                    class="entrada-linea campo-cantidad"
                    value="${linea.cantidad_producto}"
                >
            </td>
            <td>
                <input
                    type="number" min="0" step="1"
                    class="entrada-linea campo-precio-venta"
                    value="${linea.preciounitario_venta}"
                >
            </td>
            <td class="texto-derecha">${formatoMoneda(linea.preciototal_venta)}</td>
            <td class="texto-derecha valor-rentabilidad">${rentabilidad}</td>
            <td>
                <button class="boton boton--peligro boton--pequeno boton-eliminar-linea" type="button">
                    Quitar
                </button>
            </td>
        </tr>
    `;
}


/* Componente: badge del tipo de movimiento de caja (INGRESO / EGRESO) */
function componenteBadgeMovimiento(tipoMovimiento) {

    const esIngreso = tipoMovimiento === 'INGRESO';

    const clase = esIngreso ? 'badge--confirmada' : 'badge--borrador';
    const texto = esIngreso ? 'Ingreso' : 'Egreso';

    return `<span class="badge ${clase}">${texto}</span>`;
}


/* Componente: fila de la tabla de movimientos de caja */
function componenteFilaMovimiento(movimiento) {

    const fecha = movimiento.fecha_movimiento
        ? new Date(movimiento.fecha_movimiento).toLocaleString('es-CO')
        : '—';

    const signo = movimiento.tipo_movimiento === 'INGRESO' ? '+' : '−';

    return `
        <tr>
            <td>${fecha}</td>
            <td>${componenteBadgeMovimiento(movimiento.tipo_movimiento)}</td>
            <td>${movimiento.origen_movimiento}</td>
            <td>${movimiento.descripcion_movimiento || ''}</td>
            <td class="texto-derecha">${signo} ${formatoMoneda(movimiento.valor_movimiento)}</td>
        </tr>
    `;
}


/* Componente: mensaje de alerta (éxito o error), para informar al usuario */
function componenteAlerta(mensaje, tipo = 'error') {

    const clase = tipo === 'exito' ? 'alerta--exito' : 'alerta--error';

    return `<div class="alerta ${clase}">${mensaje}</div>`;
}


/* Muestra una alerta dentro de un contenedor y la quita sola a los pocos segundos */
function mostrarAlerta(contenedor, mensaje, tipo = 'error') {

    contenedor.innerHTML = componenteAlerta(mensaje, tipo);

    window.setTimeout(() => {
        contenedor.innerHTML = '';
    }, 4000);
}


/*
 * Componente: modal para preguntar la forma de pago antes de confirmar
 * una venta (ver pedirConfirmacion más abajo: mismo patrón, pero con un
 * select en vez de solo sí/no). Devuelve el valor elegido, o null si se
 * cancela.
 */
function pedirFormaPago() {

    return new Promise((resolver) => {

        const fondo = document.createElement('div');
        fondo.className = 'modal-fondo';

        fondo.innerHTML = `
            <div class="modal">
                <h3>¿Cómo va a pagar el cliente?</h3>
                <div class="campo">
                    <label for="modal-forma-pago">Forma de pago</label>
                    <select id="modal-forma-pago">
                        <option value="EFECTIVO">Efectivo</option>
                        <option value="TRANSFERENCIA">Transferencia</option>
                        <option value="NEQUI">Nequi</option>
                        <option value="DAVIPLATA">Daviplata</option>
                        <option value="TARJETA">Tarjeta</option>
                        <option value="OTRO">Otro</option>
                    </select>
                </div>
                <div class="modal__acciones">
                    <button class="boton boton--secundario" data-accion="cancelar" type="button">Cancelar</button>
                    <button class="boton" data-accion="continuar" type="button">Confirmar venta</button>
                </div>
            </div>
        `;

        document.body.appendChild(fondo);

        fondo.addEventListener('click', (evento) => {

            const accion = evento.target.dataset.accion;
            if (accion !== 'continuar' && accion !== 'cancelar') return;

            const formaPago = document.getElementById('modal-forma-pago').value;

            document.body.removeChild(fondo);
            resolver(accion === 'continuar' ? formaPago : null);
        });
    });
}


/*
 * Componente: modal de confirmación. Devuelve una promesa que se
 * resuelve con true si el usuario confirma, o false si cancela.
 * Así se puede usar como: if (await pedirConfirmacion('¿Seguro?')) { ... }
 */
function pedirConfirmacion(pregunta, detalle = '') {

    return new Promise((resolver) => {

        const fondo = document.createElement('div');
        fondo.className = 'modal-fondo';

        fondo.innerHTML = `
            <div class="modal">
                <h3>${pregunta}</h3>
                ${detalle ? `<p class="texto-suave">${detalle}</p>` : ''}
                <div class="modal__acciones">
                    <button class="boton boton--secundario" data-accion="cancelar" type="button">Cancelar</button>
                    <button class="boton" data-accion="continuar" type="button">Continuar</button>
                </div>
            </div>
        `;

        document.body.appendChild(fondo);

        fondo.addEventListener('click', (evento) => {

            const accion = evento.target.dataset.accion;

            if (accion === 'continuar' || accion === 'cancelar') {
                document.body.removeChild(fondo);
                resolver(accion === 'continuar');
            }
        });
    });
}