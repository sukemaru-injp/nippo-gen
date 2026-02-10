import type { CollectedData, CollectedGithubItem } from '@api/types';

const DEFAULT_MAX_GITHUB_ITEMS = 60;
const DEFAULT_MAX_GITHUB_ITEMS_PER_TYPE = 20;
const DEFAULT_MAX_CALENDAR_ITEMS = 20;
const MAX_TITLE_LENGTH = 160;
const MAX_TEXT_LENGTH = 200;

type Options = {
	maxGithubItems?: number;
	maxGithubItemsPerType?: number;
	maxCalendarItems?: number;
};

export function summarizeCollectedData(
	collected: CollectedData,
	options: Options = {}
): CollectedData {
	const maxGithubItems = options.maxGithubItems ?? DEFAULT_MAX_GITHUB_ITEMS;
	const maxGithubItemsPerType =
		options.maxGithubItemsPerType ?? DEFAULT_MAX_GITHUB_ITEMS_PER_TYPE;
	const maxCalendarItems =
		options.maxCalendarItems ?? DEFAULT_MAX_CALENDAR_ITEMS;

	const github = summarizeGithub(
		Array.isArray(collected.github) ? collected.github : [],
		maxGithubItems,
		maxGithubItemsPerType
	);
	const calendar = summarizeCalendar(
		Array.isArray(collected.calendar) ? collected.calendar : [],
		maxCalendarItems
	);

	return { github, calendar };
}

function summarizeGithub(
	items: CollectedGithubItem[],
	maxGithubItems: number,
	maxGithubItemsPerType: number
) {
	const unique = new Set<string>();
	const typeCounts: Record<CollectedGithubItem['type'], number> = {
		pr: 0,
		commit: 0,
		discussion: 0
	};
	const out: CollectedGithubItem[] = [];

	for (const item of items) {
		if (!item) continue;
		if (out.length >= maxGithubItems) break;
		if (typeCounts[item.type] >= maxGithubItemsPerType) continue;

		const normalized = normalizeGithubItem(item);
		if (!normalized) continue;

		const dedupeKey = normalized.url
			? `url:${normalized.url}`
			: `${normalized.type}:${normalized.repo ?? ''}:${normalized.title}`;
		if (unique.has(dedupeKey)) continue;

		unique.add(dedupeKey);
		typeCounts[normalized.type] += 1;
		out.push(normalized);
	}

	return out;
}

function summarizeCalendar(items: string[], maxCalendarItems: number) {
	const out: string[] = [];
	const unique = new Set<string>();

	for (const item of items) {
		const normalized = truncateText(item, MAX_TEXT_LENGTH);
		if (!normalized || unique.has(normalized)) continue;
		unique.add(normalized);
		out.push(normalized);
		if (out.length >= maxCalendarItems) break;
	}

	return out;
}

function normalizeGithubItem(
	item: CollectedGithubItem
): CollectedGithubItem | null {
	const title = truncateText(item.title, MAX_TITLE_LENGTH);
	const url = truncateText(item.url, MAX_TEXT_LENGTH);
	if (!title || !url) return null;

	const repo = truncateText(item.repo, MAX_TEXT_LENGTH);
	const author = truncateText(item.author, MAX_TEXT_LENGTH);
	const date = truncateText(item.date, MAX_TEXT_LENGTH);

	return {
		type: item.type,
		title,
		url,
		...(repo ? { repo } : {}),
		...(author ? { author } : {}),
		...(date ? { date } : {})
	};
}

function truncateText(value: string | undefined, maxLen: number) {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	return trimmed.length > maxLen
		? `${trimmed.slice(0, maxLen - 3)}...`
		: trimmed;
}
