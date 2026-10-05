/*
 * Helper compartido de caja, usado por compraController y ventaController.
 *
 * Reemplaza a los triggers trg_caja_compra y trg_caja_venta, que registraban
 * un movimiento por cada UPDATE de la compra/venta (duplicando al editar).
 * Aquí el backend decide el único momento en que se registra: al confirmar,
 * y su contrario al corregir.
 */

const obtenerCajaAbierta = async (connection) => {

    const [cajas] = await connection.query(
        `SELECT id_caja
         FROM caja
         WHERE estado_caja = 'ABIERTA'
         ORDER BY id_caja DESC
         LIMIT 1`
    );

    return cajas.length > 0 ? cajas[0].id_caja : null;
};


const registrarMovimiento = async (connection, {
    id_caja,
    tipo_movimiento,
    origen_movimiento,
    descripcion_movimiento,
    valor_movimiento,
    referencia_id,
    id_usuario
}) => {

    await connection.query(
        `INSERT INTO movimiento_caja
        (
            fecha_movimiento,
            id_caja,
            tipo_movimiento,
            origen_movimiento,
            descripcion_movimiento,
            valor_movimiento,
            referencia_id,
            id_usuario
        )
        VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?)`,
        [
            id_caja,
            tipo_movimiento,
            origen_movimiento,
            descripcion_movimiento,
            valor_movimiento,
            referencia_id,
            id_usuario || null
        ]
    );
};


/*
 * Cuánto dinero neto ha dejado en caja un origen puntual (una compra o una
 * venta en concreto), sumando ingresos y restando egresos. Sirve para saber
 * si al corregir hay algo que revertir, incluso si ya se confirmó y corrigió
 * varias veces.
 */
const saldoNetoPorReferencia = async (connection, origen_movimiento, referencia_id) => {

    const [filas] = await connection.query(
        `SELECT
            COALESCE(SUM(
                CASE WHEN tipo_movimiento = 'INGRESO'
                     THEN valor_movimiento
                     ELSE -valor_movimiento
                END
            ), 0) AS saldo_neto
         FROM movimiento_caja
         WHERE origen_movimiento = ?
         AND referencia_id = ?`,
        [origen_movimiento, referencia_id]
    );

    return Number(filas[0].saldo_neto);
};


module.exports = {
    obtenerCajaAbierta,
    registrarMovimiento,
    saldoNetoPorReferencia
};