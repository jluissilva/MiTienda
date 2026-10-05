const pool = require('../config/database');

/*
 * Guardián de edición de ventas.
 *
 * Se coloca antes de los handlers que modifican los detalles de una venta.
 * Una venta está CONFIRMADA cuando tiene un registro en factura_venta
 * (el mismo criterio que usan confirmarVenta y corregirVenta).
 *
 *  - No existe la venta        -> 404
 *  - Venta confirmada          -> 409 (debe usar "Corregir venta")
 *  - Venta en borrador         -> continúa al handler
 */
const ventaEditable = async (req, res, next) => {

    try {

        const { id_venta } = req.params;

        const [ventas] = await pool.query(
            `SELECT id_venta
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
            `SELECT id_factura
             FROM factura_venta
             WHERE id_venta = ?
             LIMIT 1`,
            [id_venta]
        );

        if (facturas.length > 0) {

            return res.status(409).json({
                error: 'Venta confirmada. Debe utilizar "Corregir venta".'
            });
        }

        next();

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al verificar el estado de la venta'
        });
    }
};

module.exports = ventaEditable;