import { serve } from '@hono/node-server';
import { app } from './app';
import open from 'open';

const port = Number(process.env.NIPPO_SERVER_PORT ?? 9000);

serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, () => {
	console.log(`Started server: http://127.0.0.1:${port}`);

	// 自動でブラウザを開く
	(async () => {
		const url = `http://127.0.0.1:${port}`;
		console.log(`nippo-gen running at ${url}`);
		await open(url);
	})();
});
