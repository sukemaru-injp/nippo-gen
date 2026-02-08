import { createWorkflow } from '@mastra/core/workflows';
import { WorkflowInputSchema, WorkflowOutputSchema } from './schemas';
import { collectStep } from './steps/collectStep';
import { formatStep } from './steps/formatStep';
import { planStep } from './steps/planStep';

export const nippoWorkflow = createWorkflow({
	id: 'nippo-workflow',
	inputSchema: WorkflowInputSchema,
	outputSchema: WorkflowOutputSchema
});

export const nippoWorkflowCommitted = nippoWorkflow
	.then(planStep)
	.then(collectStep)
	.then(formatStep)
	.commit();
