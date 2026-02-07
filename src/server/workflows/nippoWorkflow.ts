import { buildCollectorAgent } from '@api/llm/buildCollectorAgent';
import { buildFormatterAgent } from '@api/llm/buildFormatterAgent';
import { normalizeMastraOutput } from '@api/services/format';
import { buildCollectionPlan } from '@api/services/plan';
import type { CollectedData, Draft, ToolKey } from '@api/types';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const ToolKeySchema = z.enum(['github', 'google_calendar']);
const ModelKeySchema = z.enum(['google/gemini-2.5-flash-lite']);

const DraftSchema = z.object({
	date: z.string(),
	tools: z.array(ToolKeySchema),
	values: z.array(z.string()),
	repos: z.array(z.string()).optional()
});

const CollectionPlanSchema = z.object({
	date: z.string(),
	repos: z.array(z.string()),
	queries: z.array(z.string()),
	useRecentActivity: z.boolean()
});

const CollectedDataSchema = z.object({
	github: z
		.array(
			z.object({
				type: z.enum(['pr', 'commit', 'discussion']),
				title: z.string(),
				url: z.string(),
				repo: z.string().optional(),
				author: z.string().optional(),
				date: z.string().optional()
			})
		)
		.optional(),
	calendar: z.array(z.string()).optional()
});

const WorkflowInputSchema = z.object({
	date: z.string(),
	template: z.string(),
	values: z.array(z.string()),
	repos: z.array(z.string()).optional(),
	tools: z.array(ToolKeySchema),
	model: ModelKeySchema
});

const WorkflowOutputSchema = z.object({
	output: z.string(),
	collected: CollectedDataSchema,
	plan: CollectionPlanSchema
});

export const nippoWorkflow = createWorkflow({
	id: 'nippo-workflow',
	inputSchema: WorkflowInputSchema,
	outputSchema: WorkflowOutputSchema
});

const planStep = createStep({
	id: 'plan',
	inputSchema: WorkflowInputSchema,
	outputSchema: z.object({
		draft: DraftSchema,
		plan: CollectionPlanSchema,
		template: z.string(),
		model: ModelKeySchema
	}),
	execute: async ({ inputData }) => {
		const draft: Draft = {
			date: inputData.date,
			tools: inputData.tools as ToolKey[],
			values: inputData.values,
			repos: inputData.repos
		};

		const plan = buildCollectionPlan(draft);

		return {
			draft,
			plan,
			template: inputData.template,
			model: inputData.model
		};
	}
});

const collectStep = createStep({
	id: 'collect',
	inputSchema: z.object({
		draft: DraftSchema,
		plan: CollectionPlanSchema,
		template: z.string(),
		model: ModelKeySchema
	}),
	outputSchema: z.object({
		draft: DraftSchema,
		plan: CollectionPlanSchema,
		template: z.string(),
		model: ModelKeySchema,
		collected: CollectedDataSchema
	}),
	execute: async ({ inputData }) => {
		const { draft, plan, template, model } = inputData;

		if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
			return {
				draft,
				plan,
				template,
				model,
				collected: { github: [], calendar: [] }
			};
		}

		if (!draft.tools.includes('github')) {
			return {
				draft,
				plan,
				template,
				model,
				collected: { github: [], calendar: [] }
			};
		}

		const agent = await buildCollectorAgent({
			model,
			tools: draft.tools
		});

		const valuesJson = JSON.stringify(plan.queries, null, 2);
		const prompt = [
			'Collect GitHub signals for the daily report.',
			`Target date: ${plan.date}`,
			plan.repos.length > 0
				? `Target repos (only these): ${plan.repos.join(', ')}`
				: 'Target repos: all accessible repos',
			'Work summary items:',
			valuesJson,
			'',
			'If GitHub tools are available, search PRs, commits, and discussions related to the summary items.',
			plan.useRecentActivity
				? 'Work summary items is empty, so use recent activity for the target date instead (recent PRs, commits, and discussions).'
				: 'Work summary items is not empty, use them as search queries.',
			'Prefer using GitHub tools when available; do not ask questions.',
			'Return JSON only with keys: github (array), calendar (array).',
			'Calendar can be empty for now.'
		].join('\n');

		const output = await agent.generate(prompt);
		const collected = normalizeCollected(output);
		console.log('[collector] collected', collected);

		return {
			draft,
			plan,
			template,
			model,
			collected
		};
	}
});

const formatStep = createStep({
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

		if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
			return {
				output: fallbackFormat(template, draft),
				collected,
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
			JSON.stringify(collected, null, 2)
		].join('\n');

		const output = await agent.generate(prompt);
		return {
			output: normalizeMastraOutput(output),
			collected,
			plan
		};
	}
});

export const nippoWorkflowCommitted = nippoWorkflow
	.then(planStep)
	.then(collectStep)
	.then(formatStep)
	.commit();

function normalizeCollected(output: unknown): CollectedData {
	const text = coerceText(output);
	if (!text) return { github: [], calendar: [] };

	try {
		const parsed = JSON.parse(text) as CollectedData;
		return {
			github: Array.isArray(parsed.github) ? parsed.github : [],
			calendar: Array.isArray(parsed.calendar) ? parsed.calendar : []
		};
	} catch {
		return { github: [], calendar: [] };
	}
}

function coerceText(output: unknown): string | null {
	if (typeof output === 'string') return output;
	if (!output || typeof output !== 'object') return null;

	const record = output as Record<string, unknown>;

	if (typeof record.text === 'string') return record.text;
	if (typeof record.content === 'string') return record.content;
	if (typeof record.output === 'string') return record.output;
	if (typeof record.message === 'string') return record.message;
	if (typeof record.result === 'string') return record.result;
	if (typeof record.data === 'string') return record.data;

	return null;
}

function fallbackFormat(template: string, draft: Draft) {
	const date = draft?.date ?? new Date().toISOString().slice(0, 10);
	return template
		.replaceAll('{{date}}', date)
		.replaceAll('{{dummy.todo1}}', draft.values[0] ?? '')
		.replaceAll('{{dummy.todo2}}', draft.values[1] ?? '')
		.replaceAll('{{dummy.next1}}', draft.values[2] ?? '');
}
