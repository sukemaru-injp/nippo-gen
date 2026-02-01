// import { Agent } from '@mastra/core/agent';
import type { Draft } from '../types';

type Args = {
	model: 'google/gemini-2.5-flash-lite';
	template: string;
	draft: Draft;
};

export async function formatNippoWithMastra({ template, draft }: Args) {
	// キーが無ければローカル置換（開発しやすさ優先）
	if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
		return fallbackFormat(template, draft);
	}

	// const agent = new Agent({
	// 	id: 'nippo-format',
	// 	name: 'Nippo Formatter',
	// 	instructions: [
	// 		'あなたは日報フォーマッタです。',
	// 		'与えられた JSON(draft) の情報だけを根拠に、template にできるだけ忠実に日報を生成してください。',
	// 		'秘密情報（APIキー等）を出力しないでください。',
	// 		'出力はMarkdownテキストのみ。'
	// 	],
	// 	model: `google/${model}` // => "google/gemini-2.5-flash-lite"
	// });

	// const prompt = [
	// 	'## template',
	// 	template,
	// 	'',
	// 	'## draft(JSON)',
	// 	JSON.stringify(draft, null, 2)
	// ].join('\n');

	// const output = await agent.generate(prompt);
	// return typeof output === 'string' ? output : String(output);
	return 'Not implemented yet.';
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
