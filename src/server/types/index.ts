export type ToolKey = 'github' | 'google_calendar';

export type CollectedGithubItem = {
	type: 'pr' | 'commit' | 'discussion';
	title: string;
	url: string;
	repo?: string;
	author?: string;
	date?: string;
};

export type CollectedData = {
	github?: CollectedGithubItem[];
	calendar?: string[];
};

export type CollectionPlan = {
	date: string;
	repos: string[];
	queries: string[];
	useRecentActivity: boolean;
};

export type Draft = {
	date: string;
	tools: ToolKey[];
	values: string[];
	repos?: string[];
};
