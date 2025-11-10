const express = require('express');
const cors = require('cors');
const config = require('./config/dotenv');
const app = express();

const userRoutes = require('./routes/userRoutes');
const instrumentoRoutes = require('./routes/instrumentoRoutes');
const userInstRoutes = require('./routes/userInstRoutes');
const mensagemRoutes = require('./routes/mensagemRoutes');

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

app.use('/users', userRoutes);
app.use('/instrumentos', instrumentoRoutes);
app.use('/user_inst', userInstRoutes);
app.use('/mensagens', mensagemRoutes);

app.listen(config.port, () => {
  console.log(`Servidor a correr em http://localhost:${config.port}`);
});
