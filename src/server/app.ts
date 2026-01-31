import { Hono } from 'hono';
import { generateRoute } from './routes/generate';

export const app = new Hono();

// RPC で公開したいものだけ route として束ねる
export const route = app.route('/api', generateRoute);

// これを UI 側で import して hc<AppType>() する
export type AppType = typeof route;
