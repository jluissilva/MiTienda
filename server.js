const productosRoutes = require('./routes/productos');
const comprasRoutes = require('./routes/compras');
const ventasRoutes = require('./routes/ventas');
const cajaRoutes = require('./routes/caja');
const express = require('express');
const pool = require('./config/database');

const app = express();

app.use(express.json());

// Archivos del frontend (HTML, CSS, JS). Al ser estáticos, Express los
// sirve directamente desde la carpeta "public" sin pasar por ningún
// controlador: por ejemplo, public/index.html queda disponible en "/".
app.use(express.static('public'));

// Antes esta ruta ("/") devolvía el estado de la API en JSON. Como ahora
// "/" lo usa el frontend (index.html, arriba), ese estado queda en
// /api/estado para no perderlo.
app.get('/api/estado', (req, res) => {
    res.json({
        sistema: 'MiTienda API',
        version: '1.0'
    });
});

// Probar conexión con MySQL
app.get('/test-db', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT NOW() AS fecha');
        res.json(rows);
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

const PORT = 3000;
app.use('/productos', productosRoutes);
app.use('/compras', comprasRoutes);
app.use('/ventas', ventasRoutes);
app.use('/caja', cajaRoutes);

app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});