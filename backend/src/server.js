const express = require('express');
const app = express();

const userRoutes = require('./routes/userRoutes');
const instrumentoRoutes = require('./routes/instrumentoRoutes');
const userInstRoutes = require('./routes/userInstRoutes');
const mensagemRoutes = require('./routes/mensagemRoutes');

app.use(express.json());

app.use('/users', userRoutes);
app.use('/instrumentos', instrumentoRoutes);
app.use('/user_inst', userInstRoutes);
app.use('/mensagens', mensagemRoutes);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor a correr em http://localhost:${PORT}`);
});
