import { buildCollectorAgent } from '@api/llm/buildCollectorAgent';
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

	const prompt = [
		'Collect GitHub signals for the daily report.',
		`Target date: ${draft.date}`,
		'Work summary items:',
		JSON.stringify(draft.values, null, 2),
		'',
		'If GitHub tools are available, search PRs, commits, and discussions related to the summary items.',
		'Return JSON only with keys: github (array), calendar (array).',
		'Calendar can be empty for now.'
	].join('\n');

	const output = await agent.generate(prompt);
	return normalizeCollectedData(output);
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
