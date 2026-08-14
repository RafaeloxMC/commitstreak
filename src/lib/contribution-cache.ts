export type ContributionDay = {
	date: string;
	contributionCount: number;
};

export type ContributionWeek = {
	contributionDays?: ContributionDay[];
};

export type CachedContributionUser = {
	contributionsCollection?: {
		contributionCalendar?: {
			weeks?: ContributionWeek[];
		};
	};
};

export const dailyContributionCache = new Map<
	string,
	{ expiresAt: number; value: CachedContributionUser }
>();

export function toUtcDateString(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function getNextUtcDayMillis(date: Date): number {
	const nextUtcDay = new Date(
		Date.UTC(
			date.getUTCFullYear(),
			date.getUTCMonth(),
			date.getUTCDate() + 1,
		),
	);

	return nextUtcDay.getTime();
}

export function getCacheKeyForLogin(login: string, date: Date): string {
	return `${login}:${toUtcDateString(date)}`;
}

export async function getCachedContributionData(
	login: string,
	fetcher: (login: string, now: Date) => Promise<CachedContributionUser>,
	now = new Date(),
) {
	const cacheKey = getCacheKeyForLogin(login, now);
	const cachedEntry = dailyContributionCache.get(cacheKey);

	if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
		return cachedEntry.value;
	}

	if (cachedEntry) {
		dailyContributionCache.delete(cacheKey);
	}

	const fresh = await fetcher(login, now);
	dailyContributionCache.set(cacheKey, {
		expiresAt: getNextUtcDayMillis(now),
		value: fresh,
	});

	return fresh;
}
