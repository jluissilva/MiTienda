const pool = require('../config/database');
const {
    obtenerCajaAbierta,
    registrarMovimiento,
    saldoNetoPorReferencia
} = require('../helpers/caja');


/*
 * Rentabilidad de una línea, como margen sobre el precio de venta:
 *   (precio_venta - costo_por_unidad_de_venta) / precio_venta * 100
 *
 * precioCompra llega en unidad de COMPRA (ej: por bulto) y precioVenta
 * en unidad de VENTA (ej: por kg), así que primero hay que llevar el
 * costo a la misma unidad del precio de venta dividiendo por el factor
 * de conversión (cuántas unidades de venta trae 1 unidad de compra).
 * Si se compra y se vende en la misma unidad, factorConversion es 1 y
 * no cambia nada de la cuenta de siempre.
 *
 * Se redondea a 1 decimal. Devuelve null si el precio de venta es 0 o inválido.
 */
const calcularRentabilidad = (precioCompra, precioVenta, factorConversion = 1) => {

    const compra = Number(precioCompra);
    const venta = Number(precioVenta);
    const factor = Number(factorConversion) || 1;

    if (!venta || !factor || Number.isNaN(compra) || Number.isNaN(venta)) {
        return null;
    }

    const costoPorUnidadVenta = compra / factor;

    return Math.round(((venta - costoPorUnidadVenta) / venta) * 1000) / 10;
};


const crearCompra = async (req, res) => {

    try {

        const {
            fecha_compra,
            id_proveedor,
            id_usuario,
            descripciongeneral_compra,
            forma_pagocompra
        } = req.body;

        const [resultado] = await pool.query(
            `INSERT INTO compra
            (
                fecha_compra,
                id_proveedor,
                id_usuario,
                descripciongeneral_compra,
                valortotal_compra,
                forma_pagocompra
            )
            VALUES (?, ?, ?, ?, 0, ?)`,
            [
                fecha_compra,
                id_proveedor,
                id_usuario,
                descripciongeneral_compra,
                forma_pagocompra
            ]
        );

        res.status(201).json({
            mensaje: 'Compra creada correctamente',
            id_compra: resultado.insertId
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al crear la compra'
        });
    }
};


const agregarDetalleCompra = async (req, res) => {

    try {

        const { id_compra } = req.params;

        const {
            id_producto,
            und_medida,
            cantidad_producto,
            preciounitario_compra,
            preciounitario_venta,
            unidad_venta,
            factor_conversion
        } = req.body;

        // Si no se indica una unidad de venta distinta, se vende en la
        // misma unidad en que se compró (factor de conversión 1:1),
        // igual que antes de agregar esta opción.
        const unidadVentaFinal = unidad_venta || und_medida;
        const factorFinal = factor_conversion || 1;

        const [resultado] = await pool.query(
            `INSERT INTO detalle_compra
            (
                fecha_compra,
                id_compra,
                id_producto,
                und_medida,
                cantidad_producto,
                preciounitario_compra,
                preciounitario_venta,
                preciototal_compra,
                unidad_venta,
                factor_conversion
            )
            VALUES (NOW(), ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
            [
                id_compra,
                id_producto,
                und_medida,
                cantidad_producto,
                preciounitario_compra,
                preciounitario_venta,
                unidadVentaFinal,
                factorFinal
            ]
        );

        res.status(201).json({
            mensaje: 'Producto agregado correctamente a la compra',
            id_detallecompra: resultado.insertId,
            rentabilidad_porcentaje: calcularRentabilidad(
                preciounitario_compra,
                preciounitario_venta,
                factorFinal
            )
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al agregar el producto a la compra'
        });
    }
};


/*
 * Listado de compras, más recientes primero, con su estado
 * (BORRADOR o CONFIRMADA) calculado igual que en obtenerCompra.
 */
const listarCompras = async (req, res) => {

    try {

        const [compras] = await pool.query(
            `SELECT
                c.*,
                CASE WHEN fc.id_factura IS NULL THEN 'BORRADOR' ELSE 'CONFIRMADA' END AS estado
             FROM compra c
             LEFT JOIN factura_compra fc
                 ON fc.id_compra = c.id_compra
             ORDER BY c.id_compra DESC`
        );

        res.json(compras);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al listar las compras'
        });
    }
};


const obtenerCompra = async (req, res) => {

    try {

        const { id_compra } = req.params;

        const [compra] = await pool.query(
            `SELECT *
             FROM compra
             WHERE id_compra = ?`,
            [id_compra]
        );

        if (compra.length === 0) {

            return res.status(404).json({
                error: 'Compra no encontrada'
            });
        }

        const [detalles] = await pool.query(
            `SELECT
                dc.id_detallecompra,
                dc.id_producto,
                p.nombre_producto,
                dc.und_medida,
                dc.cantidad_producto,
                dc.preciounitario_compra,
                dc.preciounitario_venta,
                dc.preciototal_compra,
                dc.unidad_venta,
                dc.factor_conversion
             FROM detalle_compra dc
             INNER JOIN producto p
                 ON dc.id_producto = p.id_producto
             WHERE dc.id_compra = ?`,
            [id_compra]
        );

        // Estado y observación de la confirmación

        const [facturas] = await pool.query(
            `SELECT
                fecha_factura,
                observacion_factura
             FROM factura_compra
             WHERE id_compra = ?
             LIMIT 1`,
            [id_compra]
        );

        // Agregar la rentabilidad de cada línea, sin modificar la base

        const productos = detalles.map(detalle => ({
            ...detalle,
            rentabilidad_porcentaje: calcularRentabilidad(
                detalle.preciounitario_compra,
                detalle.preciounitario_venta,
                detalle.factor_conversion
            )
        }));

        res.json({
            compra: compra[0],
            estado: facturas.length > 0 ? 'CONFIRMADA' : 'BORRADOR',
            confirmacion: facturas.length > 0 ? facturas[0] : null,
            productos: productos
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al obtener la compra'
        });
    }
};


const modificarDetalleCompra = async (req, res) => {

    try {

        const {
            id_compra,
            id_detallecompra
        } = req.params;

        const {
            id_producto,
            und_medida,
            cantidad_producto,
            preciounitario_compra,
            preciounitario_venta,
            unidad_venta,
            factor_conversion
        } = req.body;

        console.log('BODY RECIBIDO:', req.body);


        // 1. Verificar que el detalle exista
        const [detalle] = await pool.query(
            `SELECT *
             FROM detalle_compra
             WHERE id_detallecompra = ?
             AND id_compra = ?`,
            [
                id_detallecompra,
                id_compra
            ]
        );


        if (detalle.length === 0) {

            return res.status(404).json({
                error: 'Detalle de compra no encontrado'
            });
        }


        // 2. Conservar los datos actuales
        // cuando no se envíen en el body

        const actual = detalle[0];


        const nuevoIdProducto =
            id_producto !== undefined
                ? id_producto
                : actual.id_producto;


        const nuevaUndMedida =
            und_medida !== undefined
                ? und_medida
                : actual.und_medida;


        const nuevaCantidad =
            cantidad_producto !== undefined
                ? cantidad_producto
                : actual.cantidad_producto;


        const nuevoPrecioCompra =
            preciounitario_compra !== undefined
                ? preciounitario_compra
                : actual.preciounitario_compra;


        const nuevoPrecioVenta =
            preciounitario_venta !== undefined
                ? preciounitario_venta
                : actual.preciounitario_venta;

        const nuevaUnidadVenta =
            unidad_venta !== undefined
                ? unidad_venta
                : actual.unidad_venta;

        const nuevoFactorConversion =
            factor_conversion !== undefined
                ? factor_conversion
                : actual.factor_conversion;


        // 3. Validar campos obligatorios

        if (
            nuevoIdProducto === null ||
            nuevoIdProducto === undefined ||
            nuevaUndMedida === null ||
            nuevaUndMedida === undefined ||
            nuevaUndMedida === '' ||
            nuevaCantidad === null ||
            nuevaCantidad === undefined ||
            nuevoPrecioCompra === null ||
            nuevoPrecioCompra === undefined ||
            nuevoPrecioVenta === null ||
            nuevoPrecioVenta === undefined
        ) {

            return res.status(400).json({
                error: 'El detalle de compra debe tener producto, unidad de medida, cantidad, precio de compra y precio de venta'
            });
        }


        // 4. Verificar que el producto exista

        const [producto] = await pool.query(
            `SELECT id_producto
             FROM producto
             WHERE id_producto = ?`,
            [nuevoIdProducto]
        );


        if (producto.length === 0) {

            return res.status(404).json({
                error: 'El producto indicado no existe'
            });
        }


        // 5. Actualizar el detalle
        // (la cantidad 0 está permitida)

        const [resultado] = await pool.query(
            `UPDATE detalle_compra
             SET
                id_producto = ?,
                und_medida = ?,
                cantidad_producto = ?,
                preciounitario_compra = ?,
                preciounitario_venta = ?,
                unidad_venta = ?,
                factor_conversion = ?
             WHERE id_detallecompra = ?
             AND id_compra = ?`,
            [
                nuevoIdProducto,
                nuevaUndMedida,
                nuevaCantidad,
                nuevoPrecioCompra,
                nuevoPrecioVenta,
                nuevaUnidadVenta || nuevaUndMedida,
                nuevoFactorConversion || 1,
                id_detallecompra,
                id_compra
            ]
        );


        if (resultado.affectedRows === 0) {

            return res.status(404).json({
                error: 'Detalle de compra no encontrado'
            });
        }


        res.json({
            mensaje: 'Producto de la compra actualizado correctamente',
            rentabilidad_porcentaje: calcularRentabilidad(
                nuevoPrecioCompra,
                nuevoPrecioVenta,
                nuevoFactorConversion
            )
        });


    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al modificar el producto de la compra'
        });
    }
};


const eliminarDetalleCompra = async (req, res) => {

    try {

        const {
            id_compra,
            id_detallecompra
        } = req.params;


        const [resultado] = await pool.query(
            `DELETE FROM detalle_compra
             WHERE id_detallecompra = ?
             AND id_compra = ?`,
            [
                id_detallecompra,
                id_compra
            ]
        );


        if (resultado.affectedRows === 0) {

            return res.status(404).json({
                error: 'Detalle de compra no encontrado'
            });
        }


        res.json({
            mensaje: 'Producto eliminado de la compra correctamente'
        });


    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al eliminar el producto de la compra'
        });
    }
};


/*
 * CONFIRMAR COMPRA
 *
 * Body opcional: { "observacion": "texto" }
 * La observación se guarda en el registro de confirmación (factura_compra).
 * Si todas las cantidades están en cero (compra "eliminada"),
 * la observación con el motivo es obligatoria.
 */
const confirmarCompra = async (req, res) => {

    const connection = await pool.getConnection();

    try {

        const { id_compra } = req.params;

        const observacion = String(
            (req.body || {}).observacion || ''
        ).trim().slice(0, 300);

        await connection.beginTransaction();


        // 1. Verificar que la compra exista

        const [compras] = await connection.query(
            `SELECT *
             FROM compra
             WHERE id_compra = ?
             FOR UPDATE`,
            [id_compra]
        );


        if (compras.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                error: 'La compra no existe'
            });
        }


        // 2. Verificar que tenga productos

        const [detalles] = await connection.query(
            `SELECT *
             FROM detalle_compra
             WHERE id_compra = ?`,
            [id_compra]
        );


        if (detalles.length === 0) {

            await connection.rollback();

            return res.status(400).json({
                error: 'No se puede confirmar una compra sin productos'
            });
        }


        // 3. Verificar que todos los detalles sean válidos

        for (const detalle of detalles) {

            if (
                detalle.id_producto === null ||
                detalle.id_producto === undefined ||
                detalle.und_medida === null ||
                detalle.und_medida === '' ||
                detalle.cantidad_producto === null ||
                detalle.preciounitario_compra === null ||
                detalle.preciounitario_venta === null
            ) {

                await connection.rollback();

                return res.status(400).json({
                    error: `El detalle ${detalle.id_detallecompra} está incompleto y no puede confirmarse`
                });
            }


            if (Number(detalle.cantidad_producto) < 0) {

                await connection.rollback();

                return res.status(400).json({
                    error: `El detalle ${detalle.id_detallecompra} tiene una cantidad negativa`
                });
            }


            const [producto] = await connection.query(
                `SELECT id_producto
                 FROM producto
                 WHERE id_producto = ?`,
                [detalle.id_producto]
            );


            if (producto.length === 0) {

                await connection.rollback();

                return res.status(400).json({
                    error: `El producto ${detalle.id_producto} no existe`
                });
            }
        }


        // 4. Verificar que no haya sido confirmada

        const [facturas] = await connection.query(
            `SELECT id_factura
             FROM factura_compra
             WHERE id_compra = ?
             LIMIT 1`,
            [id_compra]
        );


        if (facturas.length > 0) {

            await connection.rollback();

            return res.status(400).json({
                error: 'La compra ya fue confirmada'
            });
        }


        // 5. Actualizar stock, precio de compra y precio de venta
        // (las líneas en cero no mueven stock ni cambian ningún precio)
        //
        // Si se compró en una unidad distinta a la que se vende (ej: 1
        // bulto de 50kg que se vende por kg), factor_conversion dice
        // cuántas unidades de venta trae 1 unidad de compra:
        //   - el stock sube en unidades de VENTA (1 bulto -> +50 kg)
        //   - el costo que queda guardado en producto también pasa a ser
        //     por unidad de venta (100.000 / 50 = 2.000 el kg), para que
        //     la rentabilidad en Ventas compare peras con peras
        //   - la unidad del producto pasa a ser la unidad de venta
        // Si se compra y se vende en la misma unidad, factor_conversion
        // es 1 y todo queda exactamente igual que antes.

        for (const detalle of detalles) {

            if (Number(detalle.cantidad_producto) === 0) {
                continue;
            }

            const factor = Number(detalle.factor_conversion) || 1;
            const cantidadEnUnidadVenta = Number(detalle.cantidad_producto) * factor;
            const costoPorUnidadVenta = Number(detalle.preciounitario_compra) / factor;
            const unidadVentaFinal = detalle.unidad_venta || detalle.und_medida;

            await connection.query(
                `UPDATE producto
                 SET
                    stock_producto = stock_producto + ?,
                    preciounitario_compra = ?,
                    preciounitario_venta = ?,
                    und_medida = ?
                 WHERE id_producto = ?`,
                [
                    cantidadEnUnidadVenta,
                    costoPorUnidadVenta,
                    detalle.preciounitario_venta,
                    unidadVentaFinal,
                    detalle.id_producto
                ]
            );
        }


        // 6. Si la compra es en EFECTIVO y tiene un total mayor a cero,
        // registrar el egreso en la caja abierta

        const totalCompra = Number(compras[0].valortotal_compra);

        if (compras[0].forma_pagocompra === 'EFECTIVO' && totalCompra > 0) {

            const id_caja = await obtenerCajaAbierta(connection);

            if (id_caja === null) {

                await connection.rollback();

                return res.status(409).json({
                    error: 'No hay una caja abierta. Debe abrir la caja antes de confirmar una compra en efectivo.'
                });
            }

            await registrarMovimiento(connection, {
                id_caja,
                tipo_movimiento: 'EGRESO',
                origen_movimiento: 'COMPRA',
                descripcion_movimiento: `Compra #${id_compra} confirmada`,
                valor_movimiento: totalCompra,
                referencia_id: id_compra,
                id_usuario: compras[0].id_usuario
            });
        }


        // 7. Registrar la confirmación (con la observación, si hay)

        await connection.query(
            `INSERT INTO factura_compra
            (
                id_compra,
                fecha_factura,
                imagen_factura,
                tipo_documento,
                observacion_factura
            )
            VALUES (?, NOW(), NULL, 'FACTURA', ?)`,
            [
                id_compra,
                observacion === '' ? null : observacion
            ]
        );


        // 7. Confirmar toda la operación

        await connection.commit();


        res.status(200).json({
            mensaje: 'Compra confirmada correctamente',
            id_compra: id_compra
        });


    } catch (error) {

        await connection.rollback();

        console.error(error);

        res.status(500).json({
            error: 'Error al confirmar la compra'
        });


    } finally {

        connection.release();
    }
};


const corregirCompra = async (req, res) => {

    const connection = await pool.getConnection();

    try {

        const { id_compra } = req.params;

        await connection.beginTransaction();


        // 1. Verificar que la compra exista

        const [compras] = await connection.query(
            `SELECT *
             FROM compra
             WHERE id_compra = ?
             FOR UPDATE`,
            [id_compra]
        );


        if (compras.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                error: 'La compra no existe'
            });
        }


        // 2. Obtener los detalles de la compra

        const [detalles] = await connection.query(
            `SELECT
                id_producto,
                cantidad_producto,
                factor_conversion
             FROM detalle_compra
             WHERE id_compra = ?`,
            [id_compra]
        );


        if (detalles.length === 0) {

            await connection.rollback();

            return res.status(400).json({
                error: 'La compra no tiene productos'
            });
        }


        // 3. Verificar que la compra esté confirmada

        const [facturas] = await connection.query(
            `SELECT id_factura
             FROM factura_compra
             WHERE id_compra = ?
             LIMIT 1`,
            [id_compra]
        );


        if (facturas.length === 0) {

            await connection.rollback();

            return res.status(400).json({
                error: 'La compra ya está en borrador'
            });
        }


        // 4. Sumar las cantidades a revertir por producto
        // (una compra puede tener varias líneas del mismo producto)
        //
        // El stock se subió en unidades de VENTA al confirmar (cantidad
        // de compra × factor de conversión), así que se revierte de la
        // misma forma.

        const cantidadPorProducto = {};

        for (const detalle of detalles) {

            const factor = Number(detalle.factor_conversion) || 1;

            cantidadPorProducto[detalle.id_producto] =
                (cantidadPorProducto[detalle.id_producto] || 0)
                + (Number(detalle.cantidad_producto) * factor);
        }

        const productosAfectados = Object.keys(cantidadPorProducto);


        // 5. Verificar que el stock alcance para revertir
        // (si parte de esa mercancía ya se vendió, no se puede corregir)

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
                continue;
            }

            if (Number(productos[0].stock_producto) < cantidad) {

                await connection.rollback();

                return res.status(409).json({
                    error: `No se puede corregir: de ${productos[0].nombre_producto} `
                         + `quedan ${productos[0].stock_producto} unidades en stock y esta `
                         + `compra aportó ${cantidad}. Parte de esa mercancía ya se vendió.`
                });
            }
        }


        // 6. Revertir las cantidades del stock

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


        // 7. Si esta compra dejó un egreso en caja, revertirlo con un ingreso
        // (se usa el saldo neto por si ya se corrigió y confirmó antes)

        const saldoCaja = await saldoNetoPorReferencia(connection, 'COMPRA', id_compra);

        if (saldoCaja < 0) {

            const id_caja = await obtenerCajaAbierta(connection);

            if (id_caja === null) {

                await connection.rollback();

                return res.status(409).json({
                    error: 'No hay una caja abierta. Debe abrir la caja antes de corregir esta compra.'
                });
            }

            await registrarMovimiento(connection, {
                id_caja,
                tipo_movimiento: 'INGRESO',
                origen_movimiento: 'COMPRA',
                descripcion_movimiento: `Reversión por corrección de la compra #${id_compra}`,
                valor_movimiento: Math.abs(saldoCaja),
                referencia_id: id_compra,
                id_usuario: compras[0].id_usuario
            });
        }


        // 8. Eliminar la factura de confirmación

        await connection.query(
            `DELETE FROM factura_compra
             WHERE id_compra = ?`,
            [id_compra]
        );


        // 9. Recuperar el precio de compra y el precio de venta anteriores
        // (ignorando las líneas en cero, es decir compras anuladas)

        for (const id_producto of productosAfectados) {

            const [ultimaCompra] = await connection.query(
                `SELECT
                    dc.preciounitario_compra,
                    dc.preciounitario_venta,
                    dc.und_medida,
                    dc.unidad_venta,
                    dc.factor_conversion
                 FROM detalle_compra dc
                 INNER JOIN factura_compra fc
                     ON dc.id_compra = fc.id_compra
                 WHERE dc.id_producto = ?
                 AND dc.cantidad_producto > 0
                 ORDER BY
                    fc.fecha_factura DESC,
                    dc.id_detallecompra DESC
                 LIMIT 1`,
                [id_producto]
            );


            if (ultimaCompra.length > 0) {

                const anterior = ultimaCompra[0];
                const factorAnterior = Number(anterior.factor_conversion) || 1;
                const costoAnteriorPorUnidadVenta = Number(anterior.preciounitario_compra) / factorAnterior;
                const unidadAnterior = anterior.unidad_venta || anterior.und_medida;

                await connection.query(
                    `UPDATE producto
                     SET
                        preciounitario_compra = ?,
                        preciounitario_venta = ?,
                        und_medida = ?
                     WHERE id_producto = ?`,
                    [
                        costoAnteriorPorUnidadVenta,
                        anterior.preciounitario_venta,
                        unidadAnterior,
                        id_producto
                    ]
                );
            }
        }


        // 8. Confirmar toda la operación

        await connection.commit();


        res.status(200).json({
            mensaje: 'Compra devuelta a borrador correctamente',
            id_compra: id_compra
        });


    } catch (error) {

        await connection.rollback();

        console.error(error);

        res.status(500).json({
            error: 'Error al devolver la compra a borrador'
        });


    } finally {

        connection.release();
    }
};


/*
 * ELIMINAR COMPRA
 *
 * Solo compras en borrador. Una compra confirmada no se elimina:
 * se corrige, se ponen sus cantidades en cero y se confirma con el motivo.
 */
const eliminarCompra = async (req, res) => {

    const connection = await pool.getConnection();

    try {

        const { id_compra } = req.params;

        await connection.beginTransaction();


        // 1. Verificar que la compra exista

        const [compras] = await connection.query(
            `SELECT *
             FROM compra
             WHERE id_compra = ?
             FOR UPDATE`,
            [id_compra]
        );


        if (compras.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                error: 'La compra no existe'
            });
        }


        // 2. Solo se eliminan compras en borrador

        const [facturas] = await connection.query(
            `SELECT id_factura
             FROM factura_compra
             WHERE id_compra = ?
             LIMIT 1`,
            [id_compra]
        );


        if (facturas.length > 0) {

            await connection.rollback();

            return res.status(409).json({
                error: 'Compra confirmada. Debe utilizar "Corregir compra".'
            });
        }


        // 3. Eliminar detalles y compra

        await connection.query(
            `DELETE FROM detalle_compra
             WHERE id_compra = ?`,
            [id_compra]
        );


        await connection.query(
            `DELETE FROM compra
             WHERE id_compra = ?`,
            [id_compra]
        );


        // 4. Confirmar toda la operación

        await connection.commit();


        res.status(200).json({
            mensaje: 'Compra eliminada correctamente',
            id_compra: id_compra
        });


    } catch (error) {

        await connection.rollback();

        console.error(error);

        res.status(500).json({
            error: 'Error al eliminar la compra'
        });


    } finally {

        connection.release();
    }
};


module.exports = {

    crearCompra,
    listarCompras,
    agregarDetalleCompra,
    obtenerCompra,
    modificarDetalleCompra,
    eliminarDetalleCompra,
    confirmarCompra,
    corregirCompra,
    eliminarCompra

};