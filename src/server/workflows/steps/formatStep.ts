import { buildFormatterAgent } from '@api/llm/buildFormatterAgent';
import { summarizeCollectedData } from '@api/services/collected';
import {
	normalizeMastraOutput,
	sanitizeFormatterOutput
} from '@api/services/format';
import type { Draft } from '@api/types';
import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import {
	CollectedDataSchema,
	CollectionPlanSchema,
	DraftSchema,
	ModelKeySchema
} from '../schemas';

export const formatStep = createStep({
	id: 'format',
	inputSchema: z.object({
		draft: DraftSchema,
		plan: CollectionPlanSchema,
		template: z.string(),
		model: ModelKeySchema,
		collected: CollectedDataSchema
	}),
	outputSchema: z.object({
		output: z.string(),
		collected: CollectedDataSchema,
		plan: CollectionPlanSchema
	}),
	execute: async ({ inputData }) => {
		const { draft, plan, template, model, collected } = inputData;
		const summarizedCollected = summarizeCollectedData(collected);
		console.log('Started Format:', {
			model,
			date: draft.date,
			tools: draft.tools,
			values: draft.values,
			plan,
			templateLength: template.length,
			collected: summarizedCollected
		});

		if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
			return {
				output: fallbackFormat(template, draft),
				collected: summarizedCollected,
				plan
			};
		}

		const agent = await buildFormatterAgent({ model });
		const prompt = [
			'## template',
			template,
			'',
			'## draft(JSON)',
			JSON.stringify(draft, null, 2),
			'',
			'## collected(JSON)',
			JSON.stringify(summarizedCollected, null, 2)
		].join('\n');

		const output = await agent.generate(prompt);
		return {
			output: sanitizeFormatterOutput(normalizeMastraOutput(output)),
			collected: summarizedCollected,
			plan
		};
	}
});

function fallbackFormat(template: string, draft: Draft) {
	const date = draft?.date ?? new Date().toISOString().slice(0, 10);
	return template.replaceAll('{{date}}', date);
}
