const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const config = require('./config/dotenv');
const app = express();

const userRoutes = require('./routes/userRoutes');
const instrumentoRoutes = require('./routes/instrumentoRoutes');
const userInstRoutes = require('./routes/userinstroutes');
const mensagemRoutes = require('./routes/mensagemRoutes');

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

app.use('/users', userRoutes);
app.use('/instrumentos', instrumentoRoutes);
app.use('/user_inst', userInstRoutes);
app.use('/mensagens', mensagemRoutes);

app.listen(config.port, () => {
  console.log(`Servidor a correr em http://localhost:${config.port}`);
});
