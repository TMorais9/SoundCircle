const express = require('express');
const app = express();
const userInstRoutes = require('./routes/userInstRoutes');

app.use(express.json());
app.use('/user_inst', userInstRoutes);

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor a correr em http://localhost:${PORT}`));
