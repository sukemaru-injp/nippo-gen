import { formatNippoWithMastra } from '@api/services/format';
import type { Draft } from '@api/types';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

const ToolKey = z.enum(['github', 'google_calendar']);
const ModelKey = z.enum(['google/gemini-2.5-flash-lite']);

const GenerateReq = z.object({
	date: z.string(),
	template: z.string(),
	values: z.array(z.string()),
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
		const { date, template, values, tools, model } = c.req.valid('json');
		const draft: Draft = {
			date,
			tools,
			values
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
