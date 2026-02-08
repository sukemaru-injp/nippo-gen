import type { GithubMcpTools } from '@api/plugins/github-mcp';
import { listGithubMcpTools } from '@api/plugins/github-mcp';
import type { ToolKey } from '@api/types';
import { Agent } from '@mastra/core/agent';

const agentCache = new Map<string, Agent>();

type Args = {
	model: string;
	tools: ToolKey[];
	mcpTools?: GithubMcpTools;
};

export async function buildCollectorAgent({ model, tools, mcpTools }: Args) {
	const key = `${model}:${tools.join('-')}`;
	const cached = agentCache.get(key);
	if (cached) return cached;

	const mcp =
		mcpTools ??
		(tools.includes('github') ? await listGithubMcpTools() : undefined);

	const agent = new Agent({
		id: 'nippo-collector',
		name: 'Nippo Collector',
		instructions: [
			'You collect signals for a daily report.',
			'Use tools if needed to fetch GitHub data.',
			'Only return JSON. Do not include Markdown fences.',
			'Return an object with keys: github (array), calendar (array).',
			'github items must include: type (pr|commit|discussion), title, url.',
			'Optional fields: repo, author, date.',
			'If nothing found, return empty arrays.'
		].join('\n'),
		model,
		tools: mcp
	});

	agentCache.set(key, agent);
	return agent;
}
