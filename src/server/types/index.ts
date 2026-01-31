export type ToolKey = 'github' | 'google_calendar';

export type Draft = {
	date: string;
	tools: ToolKey[];
	values: string[];
};
