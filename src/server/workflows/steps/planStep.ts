import { buildCollectionPlan } from '@api/services/plan';
import type { Draft, ToolKey } from '@api/types';
import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import {
	CollectionPlanSchema,
	DraftSchema,
	ModelKeySchema,
	WorkflowInputSchema
} from '../schemas';

export const planStep = createStep({
	id: 'plan',
	inputSchema: WorkflowInputSchema,
	outputSchema: z.object({
		draft: DraftSchema,
		plan: CollectionPlanSchema,
		template: z.string(),
		model: ModelKeySchema
	}),
	execute: async ({ inputData }) => {
		const draft: Draft = {
			date: inputData.date,
			tools: inputData.tools as ToolKey[],
			values: inputData.values,
			repos: inputData.repos
		};

		const plan = buildCollectionPlan(draft);

		return {
			draft,
			plan,
			template: inputData.template,
			model: inputData.model
		};
	}
});
