import { Agent } from '@mastra/core/agent';

const agentCache = new Map<string, Agent>();

type Args = {
	model: string;
};

export async function buildFormatterAgent({ model }: Args) {
	const key = model;
	const cached = agentCache.get(key);
	if (cached) return cached;

	const agent = new Agent({
		id: 'nippo-formatter-for-gemini',
		name: 'Nippo Formatter',
		instructions: [
			'You are a nippo(日報) formatter.',
			'You MUST use only the provided draft data and collected signals.',
			'Follow the template as closely as possible.',
			'Output must be Markdown text only.',
			'Do not include secrets or API keys.'
		].join('\n'),
		model
	});

	agentCache.set(key, agent);
	return agent;
}
