import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import { handleError } from './common/http.js';
import { router } from './routes.js';

const app = express();

app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(router);
app.use(handleError);

app.listen(config.port, () => {
  console.log(`El Padel backend listening on http://localhost:${config.port}`);
});
