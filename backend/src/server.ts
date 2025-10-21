import app from './app';
import config from './config/dotenv';

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});