const express = require('express');

const router = express.Router();

const compraEditable = require('../middlewares/compraEditable');

const {
    crearCompra,
    listarCompras,
    agregarDetalleCompra,
    obtenerCompra,
    modificarDetalleCompra,
    eliminarDetalleCompra,
    confirmarCompra,
    corregirCompra,
    eliminarCompra
} = require('../controllers/compraController');

router.post('/', crearCompra);
router.get('/', listarCompras);

// Detalles: solo se permiten mientras la compra está en borrador
router.post('/:id_compra/detalles', compraEditable, agregarDetalleCompra);

router.get('/:id_compra', obtenerCompra);

router.put('/:id_compra/detalles/:id_detallecompra', compraEditable, modificarDetalleCompra);

router.delete('/:id_compra/detalles/:id_detallecompra', compraEditable, eliminarDetalleCompra);

router.post('/:id_compra/confirmar', confirmarCompra);

router.post('/:id_compra/corregir', corregirCompra);

// Solo se elimina una compra en borrador.
// Una compra confirmada se corrige, se deja en cero y se confirma con el motivo.
router.delete('/:id_compra', compraEditable, eliminarCompra);

module.exports = router;