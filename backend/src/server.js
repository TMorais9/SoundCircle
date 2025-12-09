require('dotenv').config();   

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const config = require('./config/dotenv');  

const app = express();

const userRoutes = require('./routes/userRoutes');
const instrumentoRoutes = require('./routes/instrumentoRoutes');
const userinstRoutes = require('./routes/userinstroutes');
const mensagemRoutes = require('./routes/mensagemRoutes');
const caracteristicaRoutes = require('./routes/caracteristicaRoutes');
const usercarRoutes = require('./routes/usercarRoutes');
const userphotoRoutes = require('./routes/userphotoRoutes');
const aiRoutes = require('./routes/aiRoutes');

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
const msgUploadsDir = path.join(__dirname, 'uploads_mensagens');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(msgUploadsDir)) {
  fs.mkdirSync(msgUploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));
app.use('/uploads_mensagens', express.static(msgUploadsDir));

app.use('/users', userRoutes);
app.use('/instrumentos', instrumentoRoutes);
app.use('/user_inst', userinstRoutes);
app.use('/mensagens', mensagemRoutes);
app.use('/caracteristicas', caracteristicaRoutes);
app.use('/usercar', usercarRoutes);
app.use('/users', userphotoRoutes);
app.use('/ai', aiRoutes);

app.listen(config.port, () => {
  console.log(`Servidor a correr em http://localhost:${config.port}`);
});
