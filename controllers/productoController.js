const pool = require('../config/database');

const listarProductos = async (req, res) => {
    try {
        const [productos] = await pool.query(
            'SELECT * FROM producto'
        );

        res.json(productos);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Error al consultar los productos'
        });
    }
};

const obtenerProducto = async (req, res) => {
    try {
        const { id } = req.params;

        const [productos] = await pool.query(
            'SELECT * FROM producto WHERE id_producto = ?',
            [id]
        );

        if (productos.length === 0) {
            return res.status(404).json({
                mensaje: 'Producto no encontrado'
            });
        }

        res.json(productos[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al consultar el producto'
        });
    }
};

const buscarPorCodigo = async (req, res) => {
    try {
        const { codigo } = req.params;

        const [productos] = await pool.query(
            'SELECT * FROM producto WHERE codigo_barras = ?',
            [codigo]
        );

        if (productos.length === 0) {
            return res.status(404).json({
                mensaje: 'Producto no encontrado'
            });
        }

        res.json(productos[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Error al buscar el producto por código de barras'
        });
    }
};

module.exports = {
    listarProductos,
    obtenerProducto,
    buscarPorCodigo
};