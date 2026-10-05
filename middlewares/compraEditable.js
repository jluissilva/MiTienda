const pool = require('../config/database');

/*
 * Guardián de edición de compras.
 *
 * Se coloca antes de los handlers que modifican los detalles de una compra.
 * Una compra está CONFIRMADA cuando tiene un registro en factura_compra
 * (el mismo criterio que usan confirmarCompra y corregirCompra).
 *
 *  - No existe la compra        -> 404
 *  - Compra confirmada          -> 409 (debe usar "Corregir compra")
 *  - Compra en borrador         -> continúa al handler
 */
const compraEditable = async (req, res, next) => {

    try {

        const { id_compra } = req.params;

        const [compras] = await pool.query(
            `SELECT id_compra
             FROM compra
             WHERE id_compra = ?`,
            [id_compra]
        );

        if (compras.length === 0) {

            return res.status(404).json({
                error: 'Compra no encontrada'
            });
        }

        const [facturas] = await pool.query(
            `SELECT id_factura
             FROM factura_compra
             WHERE id_compra = ?
             LIMIT 1`,
            [id_compra]
        );

        if (facturas.length > 0) {

            return res.status(409).json({
                error: 'Compra confirmada. Debe utilizar "Corregir compra".'
            });
        }

        next();

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: 'Error al verificar el estado de la compra'
        });
    }
};

module.exports = compraEditable;