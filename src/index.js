import express from 'express';
import gymRoutes from './routes/gym.routes.js';

const app = express();

app.use(express.json());
app.use('/api',gymRoutes);

app.listen(3000, () => {
    console.log('Server on port', 3000); // Escucha en el puerto 3000
});
