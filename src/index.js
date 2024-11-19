import express from 'express';
import gymRoutes from './routes/gym.routes.js';
import cors from 'cors'; // Agregar cors si es necesario

const app = express();

app.use(cors()); // Agregar esta línea si necesitas CORS
app.use(express.json());

// Rutas
app.use('/api', gymRoutes);

// Ruta de prueba
// Para desarrollo local
app.get('/', (req, res) => {
    const name = process.env.NAME || 'World';
    res.send(`Hello ${name}`);
  });
  
  // Para desarrollo local
  if (process.env.NODE_ENV !== 'production') {
    const port = parseInt(process.env.PORT, 10) || 3000;
    app.listen(port, () => {
      console.log(`Servidor ejecutándose en http://localhost:${port}`);
    });
  }
// Exportar la app para Vercel
export default app;