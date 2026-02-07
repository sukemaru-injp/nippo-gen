import { nippoWorkflowCommitted } from '@api/workflows/nippoWorkflow';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

const ToolKey = z.enum(['github', 'google_calendar']);
const ModelKey = z.enum(['google/gemini-2.5-flash-lite']);

const GenerateReq = z.object({
	date: z.string(),
	template: z.string(),
	values: z.array(z.string()),
	repos: z.array(z.string()).optional(),
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
		const { date, template, values, repos, tools, model } = c.req.valid('json');
		console.log('Started Generate:', {
			date,
			values
		});

		const run = await nippoWorkflowCommitted.createRun();
		const result = await run.start({
			inputData: { date, template, values, repos, tools, model }
		});

		if (result.status !== 'success') {
			return c.json({ output: 'workflow failed', meta: { model, tools } }, 500);
		}

		const output = result.result.output;

		const res: GenerateResponse = {
			output,
			meta: { model, tools }
		};

		return c.json(res);
	}
);
