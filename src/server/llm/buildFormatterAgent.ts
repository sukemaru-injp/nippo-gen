import { Agent } from '@mastra/core/agent';

let agent: Agent | null = null;

export function buildFormatterAgent() {
	if (agent) return agent;

	agent = new Agent({
		id: 'nippo-formatter-for-gemini',
		name: 'Nippo Formatter',
		instructions: [
			'You are a nippo(日報) formatter.',
			'You MUST use only the provided draft data.',
			'Follow the template as closely as possible.',
			'Output must be Markdown text only.',
			'Do not include secrets or API keys.'
		].join('\n'),
		model: 'google/gemini-2.0-flash'
	});

	return agent;
}
