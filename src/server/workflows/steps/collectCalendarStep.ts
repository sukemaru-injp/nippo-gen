import { summarizeCollectedData } from '@api/services/collected';
import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import {
	CollectedDataSchema,
	CollectionPlanSchema,
	DraftSchema,
	ModelKeySchema
} from '../schemas';

export const collectCalendarStep = createStep({
	id: 'collect-calendar',
	inputSchema: z.object({
		draft: DraftSchema,
		plan: CollectionPlanSchema,
		template: z.string(),
		model: ModelKeySchema,
		collected: CollectedDataSchema
	}),
	outputSchema: z.object({
		draft: DraftSchema,
		plan: CollectionPlanSchema,
		template: z.string(),
		model: ModelKeySchema,
		collected: CollectedDataSchema
	}),
	execute: async ({ inputData }) => {
		const { draft, plan, template, model, collected } = inputData;

		// Placeholder: calendar integration will append signals here.
		const summarized = summarizeCollectedData(collected);

		if (!draft.tools.includes('google_calendar')) {
			return {
				draft,
				plan,
				template,
				model,
				collected: summarized
			};
		}

		return {
			draft,
			plan,
			template,
			model,
			collected: summarized
		};
	}
});
