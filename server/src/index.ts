import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import authRouter from './routes/auth';
import budgetsRouter from './routes/budgets';
import itemsRouter from './routes/items';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required in production');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));

app.use('/api/auth', authRouter);
app.use('/api/budgets', budgetsRouter);
app.use('/api', itemsRouter);

// Serve client in production
const clientDist = path.join(__dirname, '../public');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
