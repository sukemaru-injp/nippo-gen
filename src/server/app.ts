import { Hono } from 'hono';
import { generateRoute } from './routes/generate';
import { serveUi } from './static/ui';

export const app = new Hono();

app.get('/', (c) => c.text('Nippo-gen Server is running'));
// RPC で公開したいものだけ route として束ねる
export const route = app.route('/api', generateRoute);

app.use('/*', serveUi());

// これを UI 側で import して hc<AppType>() する
export type AppType = typeof route;
