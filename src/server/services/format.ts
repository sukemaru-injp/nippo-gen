import { buildFormatterAgent } from '@api/llm/buildFormatterAgent';
import { collectSignals } from '@api/services/collect';
import type { CollectedData, Draft } from '../types';

type Args = {
	model: 'google/gemini-2.5-flash-lite';
	template: string;
	draft: Draft;
	collected?: CollectedData;
};

export async function formatNippoWithMastra({
	model,
	template,
	draft,
	collected: providedCollected
}: Args) {
	// キーが無ければローカル置換（開発しやすさ優先）
	if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
		return fallbackFormat(template, draft);
	}

	const agent = await buildFormatterAgent({
		model
	});

	const collected =
		providedCollected ?? (await collectSignals({ model, draft }));

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

	const output = await agent.generate(prompt, {
		onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
			console.log({ text, toolCalls, toolResults, finishReason, usage });
		}
	});
	return sanitizeFormatterOutput(normalizeMastraOutput(output));
}

function fallbackFormat(template: string, draft: Draft) {
	const date = draft?.date ?? new Date().toISOString().slice(0, 10);
	// 最低限：既存の {{date}} / {{dummy.*}} を動かす
	return template
		.replaceAll('{{date}}', date)
		.replaceAll('{{dummy.todo1}}', draft.values[0] ?? '')
		.replaceAll('{{dummy.todo2}}', draft.values[1] ?? '')
		.replaceAll('{{dummy.next1}}', draft.values[2] ?? '');
}

export function normalizeMastraOutput(output: unknown): string {
	if (typeof output === 'string') return output;
	if (!output || typeof output !== 'object') return String(output);

	const record = output as Record<string, unknown>;

	if (typeof record.text === 'string') return record.text;
	if (typeof record.content === 'string') return record.content;
	if (typeof record.output === 'string') return record.output;
	if (typeof record.message === 'string') return record.message;
	if (typeof record.result === 'string') return record.result;
	if (typeof record.data === 'string') return record.data;

	const choices = record.choices;
	if (Array.isArray(choices) && choices.length > 0) {
		const first = choices[0] as Record<string, unknown>;
		const message = first?.message as Record<string, unknown> | undefined;
		if (message && typeof message.content === 'string') return message.content;
		const delta = first?.delta as Record<string, unknown> | undefined;
		if (delta && typeof delta.content === 'string') return delta.content;
	}

	return JSON.stringify(output, null, 2);
}

export function sanitizeFormatterOutput(text: string): string {
	const withoutDraft = removeDebugSection(text, 'draft\\(JSON\\)');
	const withoutCollected = removeDebugSection(
		withoutDraft,
		'collected\\(JSON\\)'
	);
	return withoutCollected.trim();
}

function removeDebugSection(text: string, sectionNamePattern: string): string {
	const heading = `##\\s*${sectionNamePattern}\\s*`;
	const fencedBlock = '```[\\s\\S]*?```\\s*';
	const nextHeadingOrEnd = '(?=\\n##\\s+|$)';
	const pattern = new RegExp(
		`${heading}(?:\\n${fencedBlock})?${nextHeadingOrEnd}`,
		'gi'
	);
	return text.replace(pattern, '').trim();
}
