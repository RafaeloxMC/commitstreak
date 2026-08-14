import { NextResponse } from "next/server";

type ContributionDay = {
	date: string;
	contributionCount: number;
};

type ContributionWeek = {
	contributionDays?: ContributionDay[];
};

function toUtcDateString(date: Date): string {
	return date.toISOString().slice(0, 10);
}

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

export async function POST(req: Request) {
	try {
		const { login } = await req.json();

		if (!login) {
			return NextResponse.json(
				{ error: "Missing login" },
				{ status: 400 },
			);
		}

		const token = process.env.GITHUB_TOKEN;
		if (!token) {
			return NextResponse.json(
				{ error: "Missing GITHUB_TOKEN env var" },
				{ status: 500 },
			);
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
		const date = new Date();
		const from = new Date(date);
		from.setFullYear(date.getFullYear() - 1);

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
					to: date.toISOString(),
				},
			}),
		});

		const data = await res.json();

		if (!res.ok) {
			return NextResponse.json(
				{ error: "GitHub API error", details: data },
				{ status: res.status },
			);
		}

		const user = data?.data?.user;
		if (!user) {
			console.log("User not found, response:", data);
			return NextResponse.json(
				{ error: "User not found" },
				{ status: 404 },
			);
		}

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

		const now = new Date();
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
		const details = error instanceof Error ? error.message : String(error);

		return NextResponse.json(
			{ error: "Server error", details },
			{ status: 500 },
		);
	}
}
