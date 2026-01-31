import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Context, Next } from 'hono';
import mime from 'mime-types';

/**
 * dist/index.mjs から見た dist/ui を配信するための SPA static middleware.
 *
 * - ファイルが存在すればそのまま返す
 * - 存在しないパスは index.html にフォールバック（SPA）
 * - パストラバーサル対策あり
 *
 * 重要: import.meta.url を使うので、bundle 後 (dist/index.mjs) で正しい場所を参照できる
 */
export function serveUi() {
	// bundle 後は dist/index.mjs の隣に dist/ui がある想定
	const uiRoot = fileURLToPath(new URL('./ui/', import.meta.url));
	const indexHtml = join(uiRoot, 'index.html');

	// dev（tsxでsrc/serverを起動中）では uiRoot が存在しないので、何もしない
	const enabled = existsSync(indexHtml);

	return async (c: Context, next: Next) => {
		if (!enabled) {
			await next();
			return;
		}

		// API は触らない
		if (c.req.path.startsWith('/api')) {
			await next();
			return;
		}

		if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
			await next();
			return;
		}

		const path = c.req.path === '/' ? '/index.html' : c.req.path;

		// パストラバーサル対策: resolve して uiRoot 配下に収まることを保証
		const filePath = resolve(uiRoot, `.${path}`);
		if (!filePath.startsWith(uiRoot)) {
			return c.text('Bad Request', 400);
		}

		// 1) まずは静的ファイルを返す（存在すれば）
		try {
			const s = await stat(filePath);
			if (s.isDirectory()) {
				// /foo/ -> /foo/index.html
				const dirIndex = join(filePath, 'index.html');
				return await respondFile(c, dirIndex);
			}
			return await respondFile(c, filePath);
		} catch {
			// ignore -> fallback to SPA index.html
		}

		// 2) SPA fallback: index.html
		return await respondFile(c, indexHtml);
	};
}

async function respondFile(c: Context, absolutePath: string) {
	if (!existsSync(absolutePath)) {
		return c.text('Not Found', 404);
	}

	const buf = await readFile(absolutePath);

	const type =
		mime.contentType(extname(absolutePath)) || 'application/octet-stream';

	c.header('Content-Type', type);
	return c.body(buf);
}
