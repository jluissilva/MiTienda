const pool = require('../config/database');
const {
    obtenerCajaAbierta,
    registrarMovimiento,
    saldoNetoPorReferencia
} = require('../helpers/caja');


/*
 * Rentabilidad como margen sobre el precio de venta:
 *   (precio_venta - costo) / precio_venta * 100
 * El costo es el precio de compra vigente del producto.
 * Devuelve null si el precio de venta es 0 o no es válido.
 */
const calcularRentabilidad = (costo, precioVenta) => {

    const c = Number(costo);
    const v = Number(precioVenta);

    if (!v || Number.isNaN(c) || Number.isNaN(v)) {
        return null;
    }

    return Math.round(((v - c) / v) * 1000) / 10;
};


/*
 * Listado de ventas, con su estado calculado igual que en compras:
 * si no tiene factura_venta todavía está en borrador.
 */
const listarVentas = async (req, res) => {

    try {

        const [ventas] = await pool.query(
            `SELECT
                v.*,
                CASE WHEN fv.id_factura IS NULL THEN 'BORRADOR' ELSE 'CONFIRMADA' END AS estado
             FROM venta v
             LEFT JOIN factura_venta fv ON fv.id_venta = v.id_venta
             ORDER BY v.id_venta DESC`
        );

        res.json(ventas);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al listar las ventas'
        });
    }
};


const crearVenta = async (req, res) => {

    try {

        const {
            id_cliente,
            id_usuario,
            descripciongeneral_venta,
            tipo_venta
        } = req.body;

        // La fecha de venta ya no la manda el frontend: se guarda siempre
        // la fecha y hora actuales (NOW()), para que registrar una venta
        // sea rápido y no haya que escribirla a mano.
        //
        // La forma de pago (efectivo, transferencia...) tampoco se pide
        // aquí: se pregunta más adelante, justo antes de confirmar la
        // venta (cuando ya se sabe qué compró el cliente). Mientras tanto
        // se deja un valor provisional que se reemplaza al confirmar.

        const [resultado] = await pool.query(
            `INSERT INTO venta
            (
                fecha_venta,
                id_cliente,
                id_usuario,
                descripciongeneral_venta,
                total_venta,
                tipo_venta,
                formapago_venta,
                saldopendiente_venta
            )
            VALUES (NOW(), ?, ?, ?, 0, ?, 'EFECTIVO', 0)`,
            [
                id_cliente,
                id_usuario,
                descripciongeneral_venta,
                tipo_venta
            ]
        );

        res.status(201).json({
            mensaje: 'Venta creada correctamente',
            id_venta: resultado.insertId
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al crear la venta'
        });
    }
};


/*
 * Agregar una línea a una venta en borrador.
 *
 * En ventas, a diferencia de compras, sí se valida el stock disponible
 * en el momento de agregar la línea: esta app es para tiendas y no debe
 * dejar vender más de lo que hay.
 */
const agregarDetalleVenta = async (req, res) => {

    try {

        const { id_venta } = req.params;

        const {
            id_producto,
            und_medida,
            cantidad_producto,
            preciounitario_venta
        } = req.body;

        if (
            id_producto === undefined ||
            id_producto === null ||
            cantidad_producto === undefined ||
            cantidad_producto === null ||
            Number(cantidad_producto) <= 0
        ) {

            return res.status(400).json({
                error: 'Debe indicar producto y una cantidad mayor que cero'
            });
        }

        const [productos] = await pool.query(
            `SELECT
                nombre_producto,
                stock_producto,
                preciounitario_venta,
                preciounitario_compra
             FROM producto
             WHERE id_producto = ?`,
            [id_producto]
        );

        if (productos.length === 0) {

            return res.status(404).json({
                error: 'El producto indicado no existe'
            });
        }

        const producto = productos[0];

        if (Number(producto.stock_producto) < Number(cantidad_producto)) {

            return res.status(409).json({
                error: `Solo hay ${producto.stock_producto} unidades de `
                     + `${producto.nombre_producto} en stock, no se pueden `
                     + `vender ${cantidad_producto}`
            });
        }


        // El precio de venta es opcional: si no se envía, se usa el precio
        // vigente del producto (el que dejó la última compra confirmada).
        // Si se envía, es el precio de ESTA venta y no cambia el del producto.

        const precioEnviado =
            preciounitario_venta !== undefined &&
            preciounitario_venta !== null &&
            preciounitario_venta !== '';

        const precioAplicado = precioEnviado
            ? preciounitario_venta
            : producto.preciounitario_venta;

        if (
            precioAplicado === null ||
            precioAplicado === undefined ||
            Number(precioAplicado) < 0
        ) {

            return res.status(400).json({
                error: 'El producto no tiene precio de venta. Indique el precio.'
            });
        }

        const [resultado] = await pool.query(
            `INSERT INTO detalle_venta
            (
                fecha_venta,
                id_venta,
                id_producto,
                und_medida,
                cantidad_producto,
                preciounitario_venta,
                preciototal_venta
            )
            VALUES (NOW(), ?, ?, ?, ?, ?, 0)`,
            [
                id_venta,
                id_producto,
                und_medida,
                cantidad_producto,
                precioAplicado
            ]
        );

        res.status(201).json({
            mensaje: 'Producto agregado correctamente a la venta',
            id_detalleventa: resultado.insertId,
            precio_aplicado: Number(precioAplicado),
            precio_sugerido: Number(producto.preciounitario_venta),
            rentabilidad_porcentaje: calcularRentabilidad(
                producto.preciounitario_compra,
                precioAplicado
            )
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al agregar el producto a la venta'
        });
    }
};


const obtenerVenta = async (req, res) => {

    try {

        const { id_venta } = req.params;

        const [venta] = await pool.query(
            `SELECT *
             FROM venta
             WHERE id_venta = ?`,
            [id_venta]
        );

        if (venta.length === 0) {

            return res.status(404).json({
                error: 'Venta no encontrada'
            });
        }

        const [detalles] = await pool.query(
            `SELECT
                dv.id_detalleventa,
                dv.id_producto,
                p.nombre_producto,
                dv.und_medida,
                dv.cantidad_producto,
                dv.preciounitario_venta,
                dv.preciototal_venta,
                dv.costo_unitario,
                p.preciounitario_venta AS precio_sugerido,
                p.preciounitario_compra AS costo_actual
             FROM detalle_venta dv
             INNER JOIN producto p
                 ON dv.id_producto = p.id_producto
             WHERE dv.id_venta = ?`,
            [id_venta]
        );

        const [facturas] = await pool.query(
            `SELECT
                fecha_factura,
                observacion_factura
             FROM factura_venta
             WHERE id_venta = ?
             LIMIT 1`,
            [id_venta]
        );

        res.json({
            venta: venta[0],
            estado: facturas.length > 0 ? 'CONFIRMADA' : 'BORRADOR',
            confirmacion: facturas.length > 0 ? facturas[0] : null,
            // Venta confirmada: rentabilidad con el costo guardado en la línea.
            // Borrador: rentabilidad con el costo vigente del producto.
            productos: detalles.map(detalle => ({
                ...detalle,
                rentabilidad_porcentaje: calcularRentabilidad(
                    detalle.costo_unitario !== null
                        ? detalle.costo_unitario
                        : detalle.costo_actual,
                    detalle.preciounitario_venta
                )
            }))
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al obtener la venta'
        });
    }
};


const modificarDetalleVenta = async (req, res) => {

    try {

        const {
            id_venta,
            id_detalleventa
        } = req.params;

        const {
            id_producto,
            und_medida,
            cantidad_producto,
            preciounitario_venta
        } = req.body;


        // 1. Verificar que el detalle exista

        const [detalle] = await pool.query(
            `SELECT *
             FROM detalle_venta
             WHERE id_detalleventa = ?
             AND id_venta = ?`,
            [
                id_detalleventa,
                id_venta
            ]
        );

        if (detalle.length === 0) {

            return res.status(404).json({
                error: 'Detalle de venta no encontrado'
            });
        }


        // 2. Conservar los datos actuales
        // cuando no se envíen en el body

        const actual = detalle[0];

        const nuevoIdProducto =
            id_producto !== undefined ? id_producto : actual.id_producto;

        const nuevaUndMedida =
            und_medida !== undefined ? und_medida : actual.und_medida;

        const nuevaCantidad =
            cantidad_producto !== undefined ? cantidad_producto : actual.cantidad_producto;

        const cambioDeProducto =
            id_producto !== undefined &&
            Number(id_producto) !== Number(actual.id_producto);

        const precioEnviado =
            preciounitario_venta !== undefined &&
            preciounitario_venta !== null &&
            preciounitario_venta !== '';


        // 3. Validar campos obligatorios
        // (la cantidad 0 está permitida, igual que en compras)

        if (
            nuevoIdProducto === null ||
            nuevoIdProducto === undefined ||
            nuevaUndMedida === null ||
            nuevaUndMedida === undefined ||
            nuevaUndMedida === '' ||
            nuevaCantidad === null ||
            nuevaCantidad === undefined ||
            Number(nuevaCantidad) < 0
        ) {

            return res.status(400).json({
                error: 'El detalle de venta debe tener producto, unidad de medida y cantidad (0 o más)'
            });
        }


        // 4. Verificar que el producto exista y que el stock alcance

        const [productos] = await pool.query(
            `SELECT
                nombre_producto,
                stock_producto,
                preciounitario_venta,
                preciounitario_compra
             FROM producto
             WHERE id_producto = ?`,
            [nuevoIdProducto]
        );

        if (productos.length === 0) {

            return res.status(404).json({
                error: 'El producto indicado no existe'
            });
        }

        const producto = productos[0];

        if (Number(producto.stock_producto) < Number(nuevaCantidad)) {

            return res.status(409).json({
                error: `Solo hay ${producto.stock_producto} unidades de `
                     + `${producto.nombre_producto} en stock, no se pueden `
                     + `vender ${nuevaCantidad}`
            });
        }


        // Precio de esta línea:
        //  - si se envía, ese es el precio (solo de esta venta)
        //  - si se cambia el producto sin enviar precio, el del nuevo producto
        //  - si no, se conserva el que ya tenía la línea

        const nuevoPrecioVenta = precioEnviado
            ? preciounitario_venta
            : (cambioDeProducto
                ? producto.preciounitario_venta
                : actual.preciounitario_venta);

        if (
            nuevoPrecioVenta === null ||
            nuevoPrecioVenta === undefined ||
            Number(nuevoPrecioVenta) < 0
        ) {

            return res.status(400).json({
                error: 'El producto no tiene precio de venta. Indique el precio.'
            });
        }


        // 5. Actualizar el detalle

        const [resultado] = await pool.query(
            `UPDATE detalle_venta
             SET
                id_producto = ?,
                und_medida = ?,
                cantidad_producto = ?,
                preciounitario_venta = ?
             WHERE id_detalleventa = ?
             AND id_venta = ?`,
            [
                nuevoIdProducto,
                nuevaUndMedida,
                nuevaCantidad,
                nuevoPrecioVenta,
                id_detalleventa,
                id_venta
            ]
        );

        if (resultado.affectedRows === 0) {

            return res.status(404).json({
                error: 'Detalle de venta no encontrado'
            });
        }

        res.json({
            mensaje: 'Producto de la venta actualizado correctamente',
            precio_aplicado: Number(nuevoPrecioVenta),
            precio_sugerido: Number(producto.preciounitario_venta),
            rentabilidad_porcentaje: calcularRentabilidad(
                producto.preciounitario_compra,
                nuevoPrecioVenta
            )
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al modificar el producto de la venta'
        });
    }
};


const eliminarDetalleVenta = async (req, res) => {

    try {

        const {
            id_venta,
            id_detalleventa
        } = req.params;

        const [resultado] = await pool.query(
            `DELETE FROM detalle_venta
             WHERE id_detalleventa = ?
             AND id_venta = ?`,
            [
                id_detalleventa,
                id_venta
            ]
        );

        if (resultado.affectedRows === 0) {

            return res.status(404).json({
                error: 'Detalle de venta no encontrado'
            });
        }

        res.json({
            mensaje: 'Producto eliminado de la venta correctamente'
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al eliminar el producto de la venta'
        });
    }
};


/*
 * CONFIRMAR VENTA
 *
 * Body opcional: { "observacion": "texto" }
 * Revalida el stock de cada línea (por si otra venta lo consumió mientras
 * esta seguía en borrador), descuenta el stock, calcula el saldo pendiente
 * si la venta es FIADA, y registra la confirmación en factura_venta.
 */
const confirmarVenta = async (req, res) => {

    const connection = await pool.getConnection();

    try {

        const { id_venta } = req.params;

        const observacion = String(
            (req.body || {}).observacion || ''
        ).trim().slice(0, 300);

        // Forma de pago real, elegida justo antes de confirmar (no la que
        // se dejó provisional al crear la venta). Si no llega ninguna, se
        // conserva la que ya tenía la venta.
        const formasValidas = ['EFECTIVO', 'TRANSFERENCIA', 'NEQUI', 'DAVIPLATA', 'TARJETA', 'OTRO'];
        const formaPagoEnviada = (req.body || {}).formapago_venta;
        const formaPagoValida = formasValidas.includes(formaPagoEnviada)
            ? formaPagoEnviada
            : null;

        await connection.beginTransaction();


        // 1. Verificar que la venta exista

        const [ventas] = await connection.query(
            `SELECT *
             FROM venta
             WHERE id_venta = ?
             FOR UPDATE`,
            [id_venta]
        );

        if (ventas.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                error: 'La venta no existe'
            });
        }

        const venta = ventas[0];

        // Si llegó una forma de pago válida, se fija ahora como la
        // definitiva de esta venta (se usa más abajo para decidir si
        // mueve caja).
        if (formaPagoValida !== null) {

            await connection.query(
                `UPDATE venta
                 SET formapago_venta = ?
                 WHERE id_venta = ?`,
                [formaPagoValida, id_venta]
            );

            venta.formapago_venta = formaPagoValida;
        }


        // 2. Verificar que tenga productos

        const [detalles] = await connection.query(
            `SELECT *
             FROM detalle_venta
             WHERE id_venta = ?`,
            [id_venta]
        );

        if (detalles.length === 0) {

            await connection.rollback();

            return res.status(400).json({
                error: 'No se puede confirmar una venta sin productos'
            });
        }


        // 3. Verificar que no haya sido confirmada

        const [facturasExistentes] = await connection.query(
            `SELECT id_factura
             FROM factura_venta
             WHERE id_venta = ?
             LIMIT 1`,
            [id_venta]
        );

        if (facturasExistentes.length > 0) {

            await connection.rollback();

            return res.status(400).json({
                error: 'La venta ya fue confirmada'
            });
        }


        // 4. Validar cada detalle y sumar cantidades por producto

        const cantidadPorProducto = {};

        for (const detalle of detalles) {

            if (
                detalle.id_producto === null ||
                detalle.id_producto === undefined ||
                detalle.und_medida === null ||
                detalle.und_medida === '' ||
                detalle.cantidad_producto === null ||
                detalle.preciounitario_venta === null ||
                Number(detalle.cantidad_producto) < 0
            ) {

                await connection.rollback();

                return res.status(400).json({
                    error: `El detalle ${detalle.id_detalleventa} está incompleto y no puede confirmarse`
                });
            }

            if (Number(detalle.cantidad_producto) === 0) {
                continue;
            }

            cantidadPorProducto[detalle.id_producto] =
                (cantidadPorProducto[detalle.id_producto] || 0)
                + Number(detalle.cantidad_producto);
        }

        const productosAfectados = Object.keys(cantidadPorProducto);


        // 5. Revalidar que el stock alcance para cada producto
        // (pudo cambiar mientras la venta estaba en borrador)

        for (const id_producto of productosAfectados) {

            const cantidad = cantidadPorProducto[id_producto];

            const [productos] = await connection.query(
                `SELECT nombre_producto, stock_producto
                 FROM producto
                 WHERE id_producto = ?
                 FOR UPDATE`,
                [id_producto]
            );

            if (productos.length === 0) {

                await connection.rollback();

                return res.status(400).json({
                    error: `El producto ${id_producto} no existe`
                });
            }

            if (Number(productos[0].stock_producto) < cantidad) {

                await connection.rollback();

                return res.status(409).json({
                    error: `Solo hay ${productos[0].stock_producto} unidades de `
                         + `${productos[0].nombre_producto} en stock, no se pueden `
                         + `vender ${cantidad}`
                });
            }
        }


        // 6. Descontar el stock
        // (las líneas en cero no mueven stock)

        for (const id_producto of productosAfectados) {

            await connection.query(
                `UPDATE producto
                 SET stock_producto = stock_producto - ?
                 WHERE id_producto = ?`,
                [
                    cantidadPorProducto[id_producto],
                    id_producto
                ]
            );
        }


        // 7. Guardar el costo unitario de cada línea (historial)
        // Es el precio de compra vigente del producto en el momento de la venta.
        // Incluye las líneas en cero, para que todas queden con su costo.

        await connection.query(
            `UPDATE detalle_venta dv
             INNER JOIN producto p
                 ON dv.id_producto = p.id_producto
             SET dv.costo_unitario = p.preciounitario_compra
             WHERE dv.id_venta = ?`,
            [id_venta]
        );


        // 8. Calcular el saldo pendiente
        // (el trigger que hacía esto solo se dispara con UPDATE, no con
        // el flujo de confirmación por API, así que se replica aquí)

        const totalActual = Number(venta.total_venta);

        const saldoPendiente =
            venta.tipo_venta === 'FIADO' ? totalActual : 0;

        await connection.query(
            `UPDATE venta
             SET saldopendiente_venta = ?
             WHERE id_venta = ?`,
            [
                saldoPendiente,
                id_venta
            ]
        );


        // 9. Si la venta es de CONTADO en EFECTIVO y tiene un total mayor
        // a cero, registrar el ingreso en la caja abierta
        // (una venta FIADA no mueve caja: el dinero entra con los abonos)

        if (
            venta.tipo_venta === 'CONTADO' &&
            venta.formapago_venta === 'EFECTIVO' &&
            totalActual > 0
        ) {

            const id_caja = await obtenerCajaAbierta(connection);

            if (id_caja === null) {

                await connection.rollback();

                return res.status(409).json({
                    error: 'No hay una caja abierta. Debe abrir la caja antes de confirmar una venta de contado en efectivo.'
                });
            }

            await registrarMovimiento(connection, {
                id_caja,
                tipo_movimiento: 'INGRESO',
                origen_movimiento: 'VENTA',
                descripcion_movimiento: `Venta #${id_venta} confirmada`,
                valor_movimiento: totalActual,
                referencia_id: id_venta,
                id_usuario: venta.id_usuario
            });
        }


        // 10. Registrar la confirmación (con la observación, si hay)

        await connection.query(
            `INSERT INTO factura_venta
            (
                id_venta,
                fecha_factura,
                tipo_documento,
                observacion_factura
            )
            VALUES (?, NOW(), 'FACTURA', ?)`,
            [
                id_venta,
                observacion === '' ? null : observacion
            ]
        );


        // 10. Confirmar toda la operación

        await connection.commit();

        res.status(200).json({
            mensaje: 'Venta confirmada correctamente',
            id_venta: id_venta
        });

    } catch (error) {

        await connection.rollback();

        console.error(error);

        res.status(500).json({
            error: 'Error al confirmar la venta'
        });

    } finally {

        connection.release();
    }
};


/*
 * CORREGIR VENTA
 *
 * Devuelve una venta confirmada a borrador: repone el stock vendido,
 * pone el saldo pendiente en 0 y elimina el registro de confirmación.
 * No hay riesgo de dejar stock negativo (siempre se está sumando).
 */
const corregirVenta = async (req, res) => {

    const connection = await pool.getConnection();

    try {

        const { id_venta } = req.params;

        await connection.beginTransaction();


        // 1. Verificar que la venta exista

        const [ventas] = await connection.query(
            `SELECT *
             FROM venta
             WHERE id_venta = ?
             FOR UPDATE`,
            [id_venta]
        );

        if (ventas.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                error: 'La venta no existe'
            });
        }


        // 2. Obtener los detalles de la venta

        const [detalles] = await connection.query(
            `SELECT
                id_producto,
                cantidad_producto
             FROM detalle_venta
             WHERE id_venta = ?`,
            [id_venta]
        );

        if (detalles.length === 0) {

            await connection.rollback();

            return res.status(400).json({
                error: 'La venta no tiene productos'
            });
        }


        // 3. Verificar que la venta esté confirmada

        const [facturas] = await connection.query(
            `SELECT id_factura
             FROM factura_venta
             WHERE id_venta = ?
             LIMIT 1`,
            [id_venta]
        );

        if (facturas.length === 0) {

            await connection.rollback();

            return res.status(400).json({
                error: 'La venta ya está en borrador'
            });
        }


        // 4. Sumar las cantidades a devolver por producto

        const cantidadPorProducto = {};

        for (const detalle of detalles) {

            cantidadPorProducto[detalle.id_producto] =
                (cantidadPorProducto[detalle.id_producto] || 0)
                + Number(detalle.cantidad_producto);
        }


        // 5. Devolver el stock
        // (siempre se suma: no hay riesgo de quedar negativo)

        for (const [id_producto, cantidad] of Object.entries(cantidadPorProducto)) {

            await connection.query(
                `UPDATE producto
                 SET stock_producto = stock_producto + ?
                 WHERE id_producto = ?`,
                [
                    cantidad,
                    id_producto
                ]
            );
        }


        // 6. Poner el saldo pendiente en 0
        // (una venta en borrador todavía no genera ninguna deuda)

        await connection.query(
            `UPDATE venta
             SET saldopendiente_venta = 0
             WHERE id_venta = ?`,
            [id_venta]
        );


        // 7. Quitar el costo guardado
        // (en borrador el costo no es definitivo; se vuelve a guardar al confirmar)

        await connection.query(
            `UPDATE detalle_venta
             SET costo_unitario = NULL
             WHERE id_venta = ?`,
            [id_venta]
        );


        // 8. Si esta venta dejó un ingreso en caja, revertirlo con un egreso
        // (se usa el saldo neto por si ya se corrigió y confirmó antes)

        const saldoCaja = await saldoNetoPorReferencia(connection, 'VENTA', id_venta);

        if (saldoCaja > 0) {

            const id_caja = await obtenerCajaAbierta(connection);

            if (id_caja === null) {

                await connection.rollback();

                return res.status(409).json({
                    error: 'No hay una caja abierta. Debe abrir la caja antes de corregir esta venta.'
                });
            }

            await registrarMovimiento(connection, {
                id_caja,
                tipo_movimiento: 'EGRESO',
                origen_movimiento: 'VENTA',
                descripcion_movimiento: `Reversión por corrección de la venta #${id_venta}`,
                valor_movimiento: Math.abs(saldoCaja),
                referencia_id: id_venta,
                id_usuario: ventas[0].id_usuario
            });
        }


        // 9. Eliminar la factura de confirmación

        await connection.query(
            `DELETE FROM factura_venta
             WHERE id_venta = ?`,
            [id_venta]
        );


        // 9. Confirmar toda la operación

        await connection.commit();

        res.status(200).json({
            mensaje: 'Venta devuelta a borrador correctamente',
            id_venta: id_venta
        });

    } catch (error) {

        await connection.rollback();

        console.error(error);

        res.status(500).json({
            error: 'Error al devolver la venta a borrador'
        });

    } finally {

        connection.release();
    }
};


/*
 * FACTURA DE VENTA
 *
 * Devuelve los datos del documento para el cliente. Solo existe para
 * ventas confirmadas. NO incluye costo ni rentabilidad (son internos).
 * Las líneas en cero (anuladas) no aparecen en la factura.
 */
const obtenerFacturaVenta = async (req, res) => {

    try {

        const { id_venta } = req.params;

        const [ventas] = await pool.query(
            `SELECT *
             FROM venta
             WHERE id_venta = ?`,
            [id_venta]
        );

        if (ventas.length === 0) {

            return res.status(404).json({
                error: 'Venta no encontrada'
            });
        }

        const [facturas] = await pool.query(
            `SELECT
                id_factura,
                fecha_factura,
                tipo_documento,
                observacion_factura
             FROM factura_venta
             WHERE id_venta = ?
             LIMIT 1`,
            [id_venta]
        );

        if (facturas.length === 0) {

            return res.status(409).json({
                error: 'La venta está en borrador y todavía no tiene factura. Debe confirmarla.'
            });
        }

        const venta = ventas[0];

        let cliente = null;

        if (venta.id_cliente !== null && venta.id_cliente !== undefined) {

            const [clientes] = await pool.query(
                `SELECT *
                 FROM cliente
                 WHERE id_cliente = ?`,
                [venta.id_cliente]
            );

            cliente = clientes.length > 0 ? clientes[0] : null;
        }

        const [lineas] = await pool.query(
            `SELECT
                p.nombre_producto,
                dv.und_medida,
                dv.cantidad_producto,
                dv.preciounitario_venta AS precio_unitario,
                dv.preciototal_venta AS precio_total
             FROM detalle_venta dv
             INNER JOIN producto p
                 ON dv.id_producto = p.id_producto
             WHERE dv.id_venta = ?
             AND dv.cantidad_producto > 0`,
            [id_venta]
        );

        res.json({
            factura: {
                numero: facturas[0].id_factura,
                fecha: facturas[0].fecha_factura,
                tipo_documento: facturas[0].tipo_documento,
                observacion: facturas[0].observacion_factura
            },
            venta: {
                id_venta: venta.id_venta,
                fecha_venta: venta.fecha_venta,
                descripcion: venta.descripciongeneral_venta,
                tipo_venta: venta.tipo_venta,
                forma_pago: venta.formapago_venta,
                total: venta.total_venta,
                saldo_pendiente: venta.saldopendiente_venta
            },
            cliente: cliente,
            productos: lineas
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al obtener la factura de la venta'
        });
    }
};


/*
 * ELIMINAR VENTA
 *
 * Solo ventas en borrador. Una venta confirmada no se elimina:
 * se corrige, se ponen sus cantidades en cero y se confirma de nuevo
 * (la observación del motivo es opcional).
 */
const eliminarVenta = async (req, res) => {

    const connection = await pool.getConnection();

    try {

        const { id_venta } = req.params;

        await connection.beginTransaction();

        const [ventas] = await connection.query(
            `SELECT *
             FROM venta
             WHERE id_venta = ?
             FOR UPDATE`,
            [id_venta]
        );

        if (ventas.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                error: 'La venta no existe'
            });
        }

        const [facturas] = await connection.query(
            `SELECT id_factura
             FROM factura_venta
             WHERE id_venta = ?
             LIMIT 1`,
            [id_venta]
        );

        if (facturas.length > 0) {

            await connection.rollback();

            return res.status(409).json({
                error: 'Venta confirmada. Debe utilizar "Corregir venta".'
            });
        }

        await connection.query(
            `DELETE FROM detalle_venta
             WHERE id_venta = ?`,
            [id_venta]
        );

        await connection.query(
            `DELETE FROM venta
             WHERE id_venta = ?`,
            [id_venta]
        );

        await connection.commit();

        res.status(200).json({
            mensaje: 'Venta eliminada correctamente',
            id_venta: id_venta
        });

    } catch (error) {

        await connection.rollback();

        console.error(error);

        res.status(500).json({
            error: 'Error al eliminar la venta'
        });

    } finally {

        connection.release();
    }
};


module.exports = {

    listarVentas,
    crearVenta,
    agregarDetalleVenta,
    obtenerVenta,
    modificarDetalleVenta,
    eliminarDetalleVenta,
    confirmarVenta,
    corregirVenta,
    obtenerFacturaVenta,
    eliminarVenta

};