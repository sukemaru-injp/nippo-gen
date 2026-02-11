import { z } from 'zod';

export const ToolKeySchema = z.enum(['github', 'google_calendar']);
export const ModelKeySchema = z.enum(['google/gemini-2.0-flash-lite']);

export const DraftSchema = z.object({
	date: z.string(),
	tools: z.array(ToolKeySchema),
	values: z.array(z.string()),
	repos: z.array(z.string()).optional()
});

export const CollectionPlanSchema = z.object({
	date: z.string(),
	repos: z.array(z.string()),
	queries: z.array(z.string()),
	useRecentActivity: z.boolean()
});

export const CollectedDataSchema = z.object({
	github: z
		.array(
			z.object({
				type: z.enum(['pr', 'commit', 'discussion']),
				title: z.string(),
				url: z.string(),
				repo: z.string().optional(),
				author: z.string().optional(),
				date: z.string().optional()
			})
		)
		.optional(),
	calendar: z.array(z.string()).optional()
});

export const WorkflowInputSchema = z.object({
	date: z.string(),
	template: z.string(),
	values: z.array(z.string()),
	repos: z.array(z.string()).optional(),
	tools: z.array(ToolKeySchema),
	model: ModelKeySchema
});

export const WorkflowOutputSchema = z.object({
	output: z.string(),
	collected: CollectedDataSchema,
	plan: CollectionPlanSchema
});
