import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import './models/index.js'; 
import api from './routers/index.js'; 
import { connectMongo, mongoHealth, installMongoShutdownHooks } from './config/database.config.js';

const app = express();

//  UTF-8 encoding cho JSON responses
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.charset = 'utf-8';
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

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
