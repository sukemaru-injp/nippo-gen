import { buildCollectorAgent } from '@api/llm/buildCollectorAgent';
import { buildCollectionPlan } from '@api/services/plan';
import type { CollectedData, Draft } from '@api/types';

export async function collectSignals({
	model,
	draft
}: {
	model: string;
	draft: Draft;
}) {
	const agent = await buildCollectorAgent({
		model,
		tools: draft.tools
	});

	const plan = buildCollectionPlan(draft);
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
	console.log('[collector] raw output', output);
	const collected = normalizeCollectedData(output);
	console.log('[collector] collected', collected);
	return collected;
}

function normalizeCollectedData(output: unknown): CollectedData {
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
