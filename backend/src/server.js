import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import './models/index.js'; 
import api from './routers/index.js'; 
import { connectMongo, mongoHealth, installMongoShutdownHooks } from './config/database.config.js';

const app = express();

app.use(express.json({ limit: '2mb' }));

const origins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: origins.length ? origins : '*',
  credentials: true,
}));


app.get('/healthz', (_req, res) => {
  res.json({
    service: 'backend',
    mongo: mongoHealth(),
    env: process.env.NODE_ENV || 'development',
  });
});

app.use('/api', api); 

(async () => {
  try {
    await connectMongo();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
    installMongoShutdownHooks(console);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();

export default app; 
