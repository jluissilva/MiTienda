const pool = require('../config/database');


/*
 * Caja abierta actual, con su saldo calculado en vivo:
 *   saldo_actual = saldo_inicial + ingresos - egresos
 * (saldo_inicial es el valor con el que se abrió la caja)
 */
const obtenerCajaActual = async (req, res) => {

    try {

        const [cajas] = await pool.query(
            `SELECT *
             FROM caja
             WHERE estado_caja = 'ABIERTA'
             ORDER BY id_caja DESC
             LIMIT 1`
        );

        if (cajas.length === 0) {

            return res.status(404).json({
                error: 'No hay ninguna caja abierta'
            });
        }

        const caja = cajas[0];

        const [totales] = await pool.query(
            `SELECT
                COALESCE(SUM(CASE WHEN tipo_movimiento = 'INGRESO' THEN valor_movimiento ELSE 0 END), 0) AS total_ingresos,
                COALESCE(SUM(CASE WHEN tipo_movimiento = 'EGRESO'  THEN valor_movimiento ELSE 0 END), 0) AS total_egresos
             FROM movimiento_caja
             WHERE id_caja = ?`,
            [caja.id_caja]
        );

        const total_ingresos = Number(totales[0].total_ingresos);
        const total_egresos = Number(totales[0].total_egresos);
        const saldo_actual = Number(caja.saldo_inicial) + total_ingresos - total_egresos;

        res.json({
            ...caja,
            total_ingresos,
            total_egresos,
            saldo_actual
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al consultar la caja actual'
        });
    }
};


/*
 * Movimientos de una caja, más recientes primero.
 */
const listarMovimientos = async (req, res) => {

    try {

        const { id_caja } = req.params;

        const [movimientos] = await pool.query(
            `SELECT *
             FROM movimiento_caja
             WHERE id_caja = ?
             ORDER BY id_movimiento DESC`,
            [id_caja]
        );

        res.json(movimientos);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al consultar los movimientos de la caja'
        });
    }
};


/*
 * ABRIR CAJA
 *
 * Body: { saldo_inicial, id_usuario, observacion? }
 * Solo puede haber una caja ABIERTA a la vez: si ya hay una, se rechaza
 * con 409 en vez de abrir una segunda (eso descuadraría a cuál caja
 * se le registran los movimientos de compras/ventas).
 */
const abrirCaja = async (req, res) => {

    try {

        const { saldo_inicial, id_usuario, observacion } = req.body;

        if (
            saldo_inicial === undefined ||
            saldo_inicial === null ||
            Number(saldo_inicial) < 0
        ) {

            return res.status(400).json({
                error: 'Debe indicar un saldo inicial válido (0 o más)'
            });
        }

        const [abiertas] = await pool.query(
            `SELECT id_caja
             FROM caja
             WHERE estado_caja = 'ABIERTA'
             LIMIT 1`
        );

        if (abiertas.length > 0) {

            return res.status(409).json({
                error: `Ya hay una caja abierta (#${abiertas[0].id_caja}). Debe cerrarla antes de abrir otra.`
            });
        }

        const [resultado] = await pool.query(
            `INSERT INTO caja
            (
                fecha_apertura,
                saldo_inicial,
                estado_caja,
                observacion_caja,
                id_usuario
            )
            VALUES (NOW(), ?, 'ABIERTA', ?, ?)`,
            [
                saldo_inicial,
                observacion || null,
                id_usuario || null
            ]
        );

        res.status(201).json({
            mensaje: 'Caja abierta correctamente',
            id_caja: resultado.insertId
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al abrir la caja'
        });
    }
};


/*
 * CERRAR CAJA
 *
 * Body opcional: { observacion? }
 * Calcula el saldo_final con el mismo criterio que obtenerCajaActual
 * (saldo_inicial + ingresos - egresos) y lo deja fijo en ese momento.
 */
const cerrarCaja = async (req, res) => {

    try {

        const { id_caja } = req.params;
        const observacion = (req.body || {}).observacion;

        const [cajas] = await pool.query(
            `SELECT *
             FROM caja
             WHERE id_caja = ?`,
            [id_caja]
        );

        if (cajas.length === 0) {

            return res.status(404).json({
                error: 'La caja no existe'
            });
        }

        const caja = cajas[0];

        if (caja.estado_caja !== 'ABIERTA') {

            return res.status(409).json({
                error: 'Esta caja ya está cerrada'
            });
        }

        const [totales] = await pool.query(
            `SELECT
                COALESCE(SUM(CASE WHEN tipo_movimiento = 'INGRESO' THEN valor_movimiento ELSE 0 END), 0) AS total_ingresos,
                COALESCE(SUM(CASE WHEN tipo_movimiento = 'EGRESO'  THEN valor_movimiento ELSE 0 END), 0) AS total_egresos
             FROM movimiento_caja
             WHERE id_caja = ?`,
            [id_caja]
        );

        const saldo_final =
            Number(caja.saldo_inicial) +
            Number(totales[0].total_ingresos) -
            Number(totales[0].total_egresos);

        await pool.query(
            `UPDATE caja
             SET
                fecha_cierre = NOW(),
                saldo_final = ?,
                estado_caja = 'CERRADA',
                observacion_caja = COALESCE(?, observacion_caja)
             WHERE id_caja = ?`,
            [
                saldo_final,
                observacion || null,
                id_caja
            ]
        );

        res.json({
            mensaje: 'Caja cerrada correctamente',
            id_caja: Number(id_caja),
            saldo_final
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al cerrar la caja'
        });
    }
};


module.exports = {
    obtenerCajaActual,
    listarMovimientos,
    abrirCaja,
    cerrarCaja
};