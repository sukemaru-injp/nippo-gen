import type { CollectionPlan, Draft } from '@api/types';

export function buildCollectionPlan(draft: Draft): CollectionPlan {
	const values = draft.values ?? [];
	const repos = draft.repos ?? [];

	const queries = values.filter(Boolean);
	const useRecentActivity = queries.length === 0;

	return {
		date: draft.date,
		repos,
		queries,
		useRecentActivity
	};
}
