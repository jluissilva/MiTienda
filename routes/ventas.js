const express = require('express');

const router = express.Router();

const ventaEditable = require('../middlewares/ventaEditable');

const {
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
} = require('../controllers/ventaController');

router.post('/', crearVenta);
router.get('/', listarVentas);

// Detalles: solo se permiten mientras la venta está en borrador
router.post('/:id_venta/detalles', ventaEditable, agregarDetalleVenta);

router.get('/:id_venta', obtenerVenta);

// Datos de la factura para el cliente (solo ventas confirmadas, sin costos)
router.get('/:id_venta/factura', obtenerFacturaVenta);

router.put('/:id_venta/detalles/:id_detalleventa', ventaEditable, modificarDetalleVenta);

router.delete('/:id_venta/detalles/:id_detalleventa', ventaEditable, eliminarDetalleVenta);

router.post('/:id_venta/confirmar', confirmarVenta);

router.post('/:id_venta/corregir', corregirVenta);

// Solo se elimina una venta en borrador.
// Una venta confirmada se corrige, se deja en cero y se confirma de nuevo.
router.delete('/:id_venta', ventaEditable, eliminarVenta);

module.exports = router;