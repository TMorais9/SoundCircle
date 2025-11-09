const express = require('express');
const app = express();

const userInstRoutes = require('./routes/userInstRoutes');
const mensagemRoutes = require('./routes/mensagemRoutes');
const instrumentoRoutes = require('./routes/instrumentoRoutes');
const userRoutes = require('./routes/userRoutes'); // ✅

app.use(express.json());

app.use('/user_inst', userInstRoutes);
app.use('/mensagens', mensagemRoutes);
app.use('/instrumentos', instrumentoRoutes);
app.use('/users', userRoutes); // ✅

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor a correr em http://localhost:${PORT}`));
;