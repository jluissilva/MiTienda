/*
  API.JS
  ======
  Aquí viven TODAS las llamadas al backend (fetch). Ninguna otra parte
  del frontend usa fetch directamente: le pide los datos a este archivo.

  Ventaja de centralizarlo así: si mañana cambia la URL del servidor,
  o hay que agregar un encabezado a todas las peticiones, se cambia
  en un solo lugar.

  Como el frontend se sirve desde el mismo Express que la API
  (ver server.js, app.use(express.static('public'))), usamos rutas
  relativas ('/productos', '/compras'...) y no una URL completa.
  Así no hay problemas de CORS: para el navegador, todo es el mismo sitio.
*/

const API = (() => {

    /*
     * Función base: hace la petición, intenta leer el JSON de la
     * respuesta (haya salido bien o mal) y lanza un error con el
     * mensaje que mandó el backend si algo falló.
     */
    async function peticion(ruta, opciones = {}) {

        const respuesta = await fetch(ruta, {
            headers: { 'Content-Type': 'application/json' },
            ...opciones
        });

        // Algunas respuestas no traen cuerpo (poco común aquí, pero por si acaso)
        const texto = await respuesta.text();
        const datos = texto ? JSON.parse(texto) : null;

        if (!respuesta.ok) {
            const mensaje = (datos && datos.error) || `Error ${respuesta.status}`;
            throw new Error(mensaje);
        }

        return datos;
    }

    function get(ruta) {
        return peticion(ruta);
    }

    function post(ruta, cuerpo) {
        return peticion(ruta, {
            method: 'POST',
            body: JSON.stringify(cuerpo || {})
        });
    }

    function put(ruta, cuerpo) {
        return peticion(ruta, {
            method: 'PUT',
            body: JSON.stringify(cuerpo || {})
        });
    }

    function del(ruta) {
        return peticion(ruta, { method: 'DELETE' });
    }

    return {
        // Productos
        listarProductos: () => get('/productos'),
        obtenerProducto: (id) => get(`/productos/${id}`),

        // Compras
        listarCompras: () => get('/compras'),
        obtenerCompra: (id) => get(`/compras/${id}`),
        crearCompra: (datos) => post('/compras', datos),
        agregarDetalleCompra: (idCompra, datos) => post(`/compras/${idCompra}/detalles`, datos),
        modificarDetalleCompra: (idCompra, idDetalle, datos) => put(`/compras/${idCompra}/detalles/${idDetalle}`, datos),
        eliminarDetalleCompra: (idCompra, idDetalle) => del(`/compras/${idCompra}/detalles/${idDetalle}`),
        confirmarCompra: (idCompra, datos) => post(`/compras/${idCompra}/confirmar`, datos),
        corregirCompra: (idCompra) => post(`/compras/${idCompra}/corregir`),
        eliminarCompra: (idCompra) => del(`/compras/${idCompra}`),

        // Ventas
        listarVentas: () => get('/ventas'),
        obtenerVenta: (id) => get(`/ventas/${id}`),
        crearVenta: (datos) => post('/ventas', datos),
        agregarDetalleVenta: (idVenta, datos) => post(`/ventas/${idVenta}/detalles`, datos),
        modificarDetalleVenta: (idVenta, idDetalle, datos) => put(`/ventas/${idVenta}/detalles/${idDetalle}`, datos),
        eliminarDetalleVenta: (idVenta, idDetalle) => del(`/ventas/${idVenta}/detalles/${idDetalle}`),
        confirmarVenta: (idVenta, datos) => post(`/ventas/${idVenta}/confirmar`, datos),
        corregirVenta: (idVenta) => post(`/ventas/${idVenta}/corregir`),
        eliminarVenta: (idVenta) => del(`/ventas/${idVenta}`),
        obtenerFacturaVenta: (idVenta) => get(`/ventas/${idVenta}/factura`),

        // Caja
        obtenerCajaActual: () => get('/caja/actual'),
        listarMovimientosCaja: (idCaja) => get(`/caja/${idCaja}/movimientos`),
        abrirCaja: (datos) => post('/caja/abrir', datos),
        cerrarCaja: (idCaja, datos) => post(`/caja/${idCaja}/cerrar`, datos)
    };
})();