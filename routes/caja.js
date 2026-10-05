const express = require('express');

const router = express.Router();

const {
    obtenerCajaActual,
    listarMovimientos,
    abrirCaja,
    cerrarCaja
} = require('../controllers/cajaController');

// Caja abierta actual, con su saldo calculado en vivo
router.get('/actual', obtenerCajaActual);

// Movimientos de una caja puntual
router.get('/:id_caja/movimientos', listarMovimientos);

// Abrir una caja nueva (solo si no hay otra ya abierta)
router.post('/abrir', abrirCaja);

// Cerrar una caja abierta, fijando su saldo final
router.post('/:id_caja/cerrar', cerrarCaja);

module.exports = router;