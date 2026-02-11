import { buildCollectorAgent } from '@api/llm/buildCollectorAgent';
import type { GithubMcpTools } from '@api/plugins/github-mcp';
import { listGithubMcpTools } from '@api/plugins/github-mcp';
import { summarizeCollectedData } from '@api/services/collected';
import type { CollectedData, CollectedGithubItem, ToolKey } from '@api/types';
import type { AgentExecutionOptionsBase } from '@mastra/core/agent';
import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import {
	CollectedDataSchema,
	CollectionPlanSchema,
	DraftSchema,
	ModelKeySchema
} from '../schemas';

type OnStepFinishPayload = Parameters<
	NonNullable<AgentExecutionOptionsBase<unknown>['onStepFinish']>
>[0];
type StepToolResult = NonNullable<OnStepFinishPayload['toolResults']>[number];

export const collectGithubStep = createStep({
	id: 'collect-github',
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
			tools: draft.tools as ToolKey[],
			mcpTools: githubTools
		});

		const valuesJson = JSON.stringify(plan.queries, null, 2);
		const availableToolsList = Object.keys(githubTools);
		const availableTools = availableToolsList.join(',');
		console.log('[collector] available tools', availableToolsList);
		const toolChoice = availableToolsList.length > 0 ? 'required' : 'auto';

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
			'Keep tool usage efficient. Do not repeat the same query unless previous results are empty.',
			'Limit gathered GitHub items to the most relevant and recent ones.',
			'Use ONLY the listed tools (exact names). Do not invent tool names.',
			'Prefer using GitHub tools when available; do not ask questions.',
			'Return JSON only with keys: github (array), calendar (array).',
			'Calendar can be empty for now.'
		].join('\n');

		const stepToolResults: StepToolResult[] = [];
		const output = await agent.generate(prompt, {
			maxSteps: 8,
			toolCallConcurrency: 2,
			toolChoice,
			onStepFinish: ({ toolCalls, toolResults }) => {
				const toolCallCount = Array.isArray(toolCalls) ? toolCalls.length : 0;
				const toolResultCount = Array.isArray(toolResults)
					? toolResults.length
					: 0;
				if (Array.isArray(toolResults)) {
					stepToolResults.push(...toolResults);
				}
				console.log('[collector] step summary', {
					toolCallCount,
					toolResultCount,
					toolNames: summarizeToolNames(toolResults)
				});
			}
		});

		const collected = summarizeCollectedData(
			normalizeCollected(output, stepToolResults)
		);
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

function normalizeCollected(
	output: unknown,
	fallbackToolResults: unknown[] = []
) {
	const extracted = extractToolResultsFromOutput(output);
	const fromTools = tryFromToolResults([...fallbackToolResults, ...extracted]);
	if (fromTools) return fromTools;

	const text = coerceText(output);
	if (!text) return { github: [], calendar: [] };

	const parsed = tryParseCollected(text);
	return parsed ?? { github: [], calendar: [] };
}

function extractToolResultsFromOutput(output: unknown): unknown[] {
	if (!output || typeof output !== 'object') return [];
	const record = output as Record<string, unknown>;
	const toolResults = record.toolResults;
	return Array.isArray(toolResults) ? toolResults : [];
}

function tryFromToolResults(toolResults: unknown[]): CollectedData | null {
	const github = toolResults.reduce<CollectedGithubItem[]>((acc, entry) => {
		const payload = extractToolResultPayload(entry);
		if (!payload) return acc;

		const toolName = payload.toolName ?? '';
		const data = payload.result ?? payload.output ?? payload.data ?? payload;

		if (toolName === 'github_search_pull_requests') {
			return acc.concat(mapSearchItemsToGithub(data, 'pr'));
		}

		if (toolName === 'github_search_issues') {
			return acc.concat(mapSearchIssuesToGithub(data));
		}

		if (toolName === 'github_list_commits') {
			return acc.concat(mapCommitsToGithub(data));
		}

		return acc;
	}, []);

	if (github.length > 0) {
		return { github, calendar: [] };
	}

	return null;
}

function summarizeToolNames(toolResults: unknown): string[] {
	if (!Array.isArray(toolResults)) return [];
	const names = toolResults
		.map((entry) => extractToolResultPayload(entry)?.toolName)
		.filter((name): name is string => typeof name === 'string');
	return Array.from(new Set(names));
}

function extractToolResultPayload(entry: unknown): {
	toolName?: string;
	result?: unknown;
	output?: unknown;
	data?: unknown;
} | null {
	if (!entry || typeof entry !== 'object') return null;
	const record = entry as Record<string, unknown>;
	if (record.payload && typeof record.payload === 'object') {
		return record.payload as {
			toolName?: string;
			result?: unknown;
			output?: unknown;
			data?: unknown;
		};
	}
	return record as {
		toolName?: string;
		result?: unknown;
		output?: unknown;
		data?: unknown;
	};
}

function mapSearchItemsToGithub(
	data: unknown,
	type: CollectedGithubItem['type']
) {
	const items = extractItems(data);
	return items
		.map((item) => ({
			type,
			title: getString(item, ['title']) ?? '',
			url: getString(item, ['html_url', 'url']) ?? '',
			repo:
				getString(item, ['repository', 'full_name']) ??
				getString(item, ['repository_url']) ??
				undefined,
			author: getString(item, ['user', 'login']) ?? undefined,
			date: getString(item, ['created_at']) ?? undefined
		}))
		.filter((item) => item.title && item.url);
}

function mapSearchIssuesToGithub(data: unknown) {
	const items = extractItems(data);
	return items
		.map((item) => {
			const isPull = Boolean(getValue(item, ['pull_request', 'url']));
			const type: CollectedGithubItem['type'] = isPull ? 'pr' : 'discussion';
			return {
				type,
				title: getString(item, ['title']) ?? '',
				url: getString(item, ['html_url', 'url']) ?? '',
				repo:
					getString(item, ['repository', 'full_name']) ??
					getString(item, ['repository_url']) ??
					undefined,
				author: getString(item, ['user', 'login']) ?? undefined,
				date: getString(item, ['created_at']) ?? undefined
			};
		})
		.filter((item) => item.title && item.url);
}

function mapCommitsToGithub(data: unknown) {
	const items = extractItems(data);
	return items
		.map((item) => ({
			type: 'commit' as CollectedGithubItem['type'],
			title:
				getString(item, ['commit', 'message']) ??
				getString(item, ['message']) ??
				'',
			url: getString(item, ['html_url', 'url']) ?? '',
			repo:
				getString(item, ['repository', 'full_name']) ??
				getString(item, ['repository_url']) ??
				undefined,
			author:
				getString(item, ['author', 'login']) ??
				getString(item, ['committer', 'login']) ??
				undefined,
			date:
				getString(item, ['commit', 'author', 'date']) ??
				getString(item, ['commit', 'committer', 'date']) ??
				undefined
		}))
		.filter((item) => item.title && item.url);
}

function extractItems(data: unknown): Array<Record<string, unknown>> {
	if (Array.isArray(data)) {
		return data.filter((item) => item && typeof item === 'object') as Array<
			Record<string, unknown>
		>;
	}
	if (!data || typeof data !== 'object') return [];
	const record = data as Record<string, unknown>;
	const candidates = [record.items, record.data, record.results, record.result];
	for (const candidate of candidates) {
		if (Array.isArray(candidate)) {
			return candidate.filter(
				(item) => item && typeof item === 'object'
			) as Array<Record<string, unknown>>;
		}
	}
	return [];
}

function getString(value: unknown, path: string[]): string | null {
	const result = getValue(value, path);
	return typeof result === 'string' ? result : null;
}

function getValue(value: unknown, path: string[]): unknown {
	return path.reduce<unknown>((current, key) => {
		if (!current || typeof current !== 'object') return undefined;
		const record = current as Record<string, unknown>;
		return record[key];
	}, value);
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

	return entries.reduce<GithubMcpTools>(
		(acc, [name, tool]) => ({
			...acc,
			[name]: tool
		}),
		{}
	);
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
