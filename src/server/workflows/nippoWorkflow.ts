import { buildCollectorAgent } from '@api/llm/buildCollectorAgent';
import { buildFormatterAgent } from '@api/llm/buildFormatterAgent';
import type { GithubMcpTools } from '@api/plugins/github-mcp';
import { listGithubMcpTools } from '@api/plugins/github-mcp';
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

		const githubTools = draft.tools.includes('github')
			? filterGithubTools(await listGithubMcpTools())
			: {};
		const agent = await buildCollectorAgent({
			model,
			tools: draft.tools,
			mcpTools: githubTools
		});

		const valuesJson = JSON.stringify(plan.queries, null, 2);
		const availableTools = Object.keys(githubTools).join(', ');

		const prompt = [
			'Collect GitHub signals for the daily report.',
			`Target date: ${plan.date}`,
			plan.repos.length > 0
				? `Target repos (only these): ${plan.repos.join(', ')}`
				: 'Target repos: all accessible repos',
			'Work summary items:',
			valuesJson,
			'',
			plan.repos.length > 0
				? 'Restrict all searches to the target repos.'
				: 'First list accessible repositories, then search within those repositories.',
			availableTools
				? `Available tools: ${availableTools}`
				: 'No tools available.',
			'If GitHub tools are available, search PRs, commits, and discussions related to the summary items.',
			plan.useRecentActivity
				? 'Work summary items is empty, so use recent activity for the target date instead (recent PRs, commits, and discussions).'
				: 'Work summary items is not empty, use them as search queries.',
			plan.useRecentActivity && availableTools
				? 'You MUST call at least one GitHub tool to retrieve recent activity.'
				: 'If tools are available, call them to gather matching PRs, commits, and discussions.',
			'Use ONLY the listed tools (exact names). Do not invent tool names.',
			'Prefer using GitHub tools when available; do not ask questions.',
			'Return JSON only with keys: github (array), calendar (array).',
			'Calendar can be empty for now.'
		].join('\n');

		let lastToolResults: unknown[] = [];
		const output = await agent.generate(prompt, {
			onStepFinish: ({ toolCalls, toolResults }) => {
				console.log('[collector] toolCalls', toolCalls ?? []);
				console.log('[collector] toolResults', toolResults ?? []);
				if (toolResults && toolResults.length > 0) {
					lastToolResults = toolResults;
				}
			}
		});
		const collected = normalizeCollected(output, lastToolResults);
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

function normalizeCollected(
	output: unknown,
	toolResults: unknown[] = []
): CollectedData {
	const fromTools = tryFromToolResults(toolResults);
	if (fromTools) return fromTools;

	const text = coerceText(output);
	if (!text) return { github: [], calendar: [] };

	const parsed = tryParseCollected(text);
	return parsed ?? { github: [], calendar: [] };
}

function tryFromToolResults(toolResults: unknown[]): CollectedData | null {
	for (const result of toolResults) {
		const candidate = unwrapToolResult(result);
		if (!candidate) continue;
		const normalized = normalizeCollectedObject(candidate);
		if (
			(normalized.github?.length ?? 0) > 0 ||
			(normalized.calendar?.length ?? 0) > 0
		) {
			return normalized;
		}
	}
	return null;
}

function unwrapToolResult(value: unknown): unknown | null {
	if (typeof value === 'string') {
		return safeJsonParse(value);
	}
	if (!value || typeof value !== 'object') return null;
	const record = value as Record<string, unknown>;
	return (
		record.result ?? record.output ?? record.data ?? record.content ?? record
	);
}

function tryParseCollected(text: string): CollectedData | null {
	const direct = safeJsonParse(text);
	if (direct) return normalizeCollectedObject(direct);

	const fenced = extractJsonFromFences(text);
	if (fenced) {
		const parsed = safeJsonParse(fenced);
		if (parsed) return normalizeCollectedObject(parsed);
	}

	const inline = extractInlineJson(text);
	if (inline) {
		const parsed = safeJsonParse(inline);
		if (parsed) return normalizeCollectedObject(parsed);
	}

	return null;
}

function normalizeCollectedObject(value: unknown): CollectedData {
	if (!value || typeof value !== 'object') {
		return { github: [], calendar: [] };
	}
	const record = value as Record<string, unknown>;
	const github = Array.isArray(record.github) ? record.github : [];
	const calendar = Array.isArray(record.calendar) ? record.calendar : [];
	return { github, calendar };
}

function safeJsonParse(text: string): unknown | null {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

function extractJsonFromFences(text: string): string | null {
	const match = text.match(/```(?:json)?\n([\s\S]*?)\n```/i);
	return match ? match[1].trim() : null;
}

function extractInlineJson(text: string): string | null {
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start === -1 || end === -1 || end <= start) return null;
	return text.slice(start, end + 1);
}

function filterGithubTools(tools: GithubMcpTools): GithubMcpTools {
	const deniedPrefixes = [
		'github_add_',
		'github_assign_',
		'github_create_',
		'github_delete_',
		'github_enable_',
		'github_disable_',
		'github_fork_',
		'github_merge_',
		'github_remove_',
		'github_set_',
		'github_update_'
	];

	const allowedPrefixes = ['github_get_', 'github_list_', 'github_search_'];

	const entries = Object.entries(tools).filter(([name]) => {
		if (deniedPrefixes.some((prefix) => name.startsWith(prefix))) return false;
		return allowedPrefixes.some((prefix) => name.startsWith(prefix));
	});

	const filtered: GithubMcpTools = {};
	for (const [name, tool] of entries) {
		filtered[name] = tool;
	}
	return filtered;
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
	return template.replaceAll('{{date}}', date);
}
