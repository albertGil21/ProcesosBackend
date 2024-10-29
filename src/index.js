import express from 'express';
import gymRoutes from './routes/gym.routes.js';

const app = express();

app.use(express.json());
app.use('/api', gymRoutes);

const PORT = process.env.PORT || 3000; // Usa el puerto asignado por Vercel o 3000 como fallback

app.listen(PORT, () => {
    console.log('Server on port', PORT); // Escucha en el puerto asignado
});

export default app;