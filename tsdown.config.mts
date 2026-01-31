import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: {
		server: 'src/server/index.ts'
	},
	outDir: 'dist',
	format: 'esm',
	platform: 'node',
	target: 'es2024',
	// tsc で型チェックする前提なので tsdown は速さ重視
	clean: true,
	sourcemap: true,
	minify: false,
	// tsconfig の paths を解決して bundle に含める
	tsconfig: 'tsconfig.json',
	// CLIとして使う場合（npx想定）
	banner: {
		js: '#!/usr/bin/env node'
	}
});
