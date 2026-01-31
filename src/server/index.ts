import { serve } from '@hono/node-server';
import { app } from './app';

const port = Number(process.env.NIPPO_SERVER_PORT ?? 8787);

serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, () =>
	console.log(`Started server: http://127.0.0.1:${port}`)
);
