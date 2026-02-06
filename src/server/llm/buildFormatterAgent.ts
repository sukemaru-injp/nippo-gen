import { getGithubMcpClient } from '@api/plugins/github-mcp';
import type { ToolKey } from '@api/types';
import { Agent } from '@mastra/core/agent';

const agentCache = new Map<string, Agent>();

type Args = {
	model: string;
	tools: ToolKey[];
};

export async function buildFormatterAgent({ model, tools }: Args) {
	const key = `${model}:${tools.slice().sort().join(',')}`;
	const cached = agentCache.get(key);
	if (cached) return cached;

	const mcp = tools.includes('github')
		? await getGithubMcpClient()?.listTools()
		: undefined;

	const agent = new Agent({
		id: 'nippo-formatter-for-gemini',
		name: 'Nippo Formatter',
		instructions: [
			'You are a nippo(日報) formatter.',
			'Use tools to fetch information if needed.',
			'You MUST use only the provided draft data and tool outputs.',
			'Follow the template as closely as possible.',
			'Output must be Markdown text only.',
			'Do not include secrets or API keys.'
		].join('\n'),
		model,
		tools: mcp
	});

	agentCache.set(key, agent);
	return agent;
}
