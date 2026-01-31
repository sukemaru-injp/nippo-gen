import { resolve } from 'node:path';
import stylex from '@stylexjs/unplugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	root: resolve(__dirname),
	plugins: [
		stylex.vite({
			useCSSLayers: true
		}),
		react()
	],
	server: {
		port: 9000
	},
	build: {
		outDir: resolve(__dirname, '../../dist/ui'),
		emptyOutDir: true
	}
});
