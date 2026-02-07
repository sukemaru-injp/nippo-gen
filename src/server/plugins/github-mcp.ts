import { MCPClient } from '@mastra/mcp';

type GithubMcpClient = MCPClient;

let client: GithubMcpClient | null = null;

export function getGithubMcpClient(): GithubMcpClient | null {
	if (client) return client;

	const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
	if (!token) {
		console.warn('[github-mcp] GITHUB_PERSONAL_ACCESS_TOKEN is not set');
		return null;
	}

	client = new MCPClient({
		id: 'github-mcp',
		servers: {
			github: {
				url: new URL('https://api.githubcopilot.com/mcp/'),
				connectTimeout: 15000,
				timeout: 60000, // 60 seconds
				requestInit: {
					headers: {
						Authorization: `Bearer ${token}`
					}
				}
			}
		}
	});

	return client;
}
