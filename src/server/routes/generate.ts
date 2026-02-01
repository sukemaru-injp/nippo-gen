import { formatNippoWithMastra } from '@api/services/format';
import type { Draft } from '@api/types';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

const ToolKey = z.enum(['github', 'google_calendar']);
const ModelKey = z.enum(['google/gemini-2.0-flash']);

const GenerateReq = z.object({
	date: z.string(),
	template: z.string(),
	tools: z.array(ToolKey),
	model: ModelKey
});

export type GenerateResponse = {
	output: string;
	meta: { model: string; tools: Array<z.infer<typeof ToolKey>> };
};

export const generateRoute = new Hono().post(
	'/generate',
	zValidator('json', GenerateReq),
	async (c) => {
		const { date, template, tools, model } = c.req.valid('json');
		// いまはダミーsignals（後で GitHub/Calendar をここに差し込む）
		const draft: Draft = {
			date,
			tools,
			values: [
				'Hono RPC で型安全化',
				'Mastra (Google Gemini 2.0 Flash) を差し込み',
				'GitHub / Google Calendar 収集'
			]
		};

		// LLM（Mastra）で整形。キーが無い場合はローカル整形にフォールバック。
		const output = await formatNippoWithMastra({
			model,
			template,
			draft
		});

		const res: GenerateResponse = {
			output,
			meta: { model, tools }
		};

		return c.json(res);
	}
);
