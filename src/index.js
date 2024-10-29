import express from 'express';
import gymRoutes from './routes/gym.routes.js';
import cors from 'cors'; // Agregar cors si es necesario

const app = express();

app.use(cors()); // Agregar esta línea si necesitas CORS
app.use(express.json());

// Rutas
app.use('/api', gymRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
    const name = process.env.NAME || 'World'; // Cambia esto según necesites
    res.send(`Hello ${name}`);
});

// Exportar la app para Vercel
export default app;