const express = require('express');

const router = express.Router();

const {
    listarProductos,
    obtenerProducto,
    buscarPorCodigo
} = require('../controllers/productoController');

router.get('/', listarProductos);

router.get('/barcode/:codigo', buscarPorCodigo);

router.get('/:id', obtenerProducto);

module.exports = router;