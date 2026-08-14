import { NextResponse } from "next/server";

import {
	getCachedContributionData,
	toUtcDateString,
	type CachedContributionUser,
	type ContributionDay,
	type ContributionWeek,
} from "@/lib/contribution-cache";

function toLocalDateString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function subtractUtcDays(dateString: string, days: number): string {
	const date = new Date(`${dateString}T00:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() - days);
	return toUtcDateString(date);
}

async function fetchGithubContributionData(login: string, now: Date) {
	const token = process.env.GITHUB_TOKEN;
	if (!token) {
		throw new Error("Missing GITHUB_TOKEN env var");
	}

	const query = `
      query($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }
    `;
	const from = new Date(now);
	from.setUTCFullYear(now.getUTCFullYear() - 1);

	const res = await fetch("https://api.github.com/graphql", {
		method: "POST",
		headers: {
			Authorization: `bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			query,
			variables: {
				login,
				from: from.toISOString(),
				to: now.toISOString(),
			},
		}),
	});

	const data = await res.json();

	if (!res.ok) {
		const error = new Error("GitHub API error") as Error & {
			status?: number;
			details?: unknown;
		};
		error.status = res.status;
		error.details = data;
		throw error;
	}

	const user = data?.data?.user as CachedContributionUser | undefined;
	if (!user) {
		throw new Error("User not found");
	}

	return user;
}

export async function POST(req: Request) {
	try {
		const { login } = await req.json();

		if (!login) {
			return NextResponse.json(
				{ error: "Missing login" },
				{ status: 400 },
			);
		}

		const now = new Date();
		const user = await getCachedContributionData(
			login,
			async (currentLogin, currentNow) => {
				return fetchGithubContributionData(currentLogin, currentNow);
			},
			now,
		);

		const weeks: ContributionWeek[] =
			user.contributionsCollection?.contributionCalendar?.weeks ?? [];
		const days: ContributionDay[] = weeks.flatMap(
			(w: ContributionWeek) => w.contributionDays ?? [],
		);

		const contributedDates = new Set(
			days
				.filter((d: ContributionDay) => d.contributionCount > 0)
				.map((d: ContributionDay) => d.date),
		);

		const utcToday = toUtcDateString(now);
		const localToday = toLocalDateString(now);

		const calendarDays = [
			...new Set<string>(days.map((d: ContributionDay) => d.date)),
		].sort();

		const latestNonFutureDay =
			calendarDays.filter((d) => d <= utcToday).at(-1) ?? utcToday;

		const today: string = calendarDays.includes(localToday)
			? localToday
			: calendarDays.includes(utcToday)
				? utcToday
				: latestNonFutureDay;

		let streak = 0;
		while (contributedDates.has(subtractUtcDays(today, streak))) {
			streak += 1;
		}

		return NextResponse.json(streak);
	} catch (error: unknown) {
		if (
			error instanceof Error &&
			"status" in error &&
			typeof error.status === "number"
		) {
			const githubError = error as Error & {
				status: number;
				details?: unknown;
			};
			return NextResponse.json(
				{ error: "GitHub API error", details: githubError.details },
				{ status: githubError.status },
			);
		}

		if (error instanceof Error && error.message === "User not found") {
			return NextResponse.json(
				{ error: "User not found" },
				{ status: 404 },
			);
		}

		const details = error instanceof Error ? error.message : String(error);
		return NextResponse.json(
			{ error: "Server error", details },
			{ status: 500 },
		);
	}
}
