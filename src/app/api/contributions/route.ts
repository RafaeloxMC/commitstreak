import { NextResponse } from "next/server";

type ContributionDay = {
	date: string;
	contributionCount: number;
};

type ContributionWeek = {
	contributionDays?: ContributionDay[];
};

export async function POST(req: Request) {
	try {
		const { login, from, to } = await req.json();

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

		const res = await fetch("https://api.github.com/graphql", {
			method: "POST",
			headers: {
				Authorization: `bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query,
				variables: { login, from, to },
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
			return NextResponse.json(
				{ error: "User not found" },
				{ status: 404 },
			);
		}

		const weeks =
			user.contributionsCollection?.contributionCalendar?.weeks ?? [];
		const days = weeks.flatMap(
			(w: ContributionWeek) => w.contributionDays ?? [],
		);

		return NextResponse.json({
			login,
			totalContributions:
				user.contributionsCollection?.contributionCalendar
					?.totalContributions ?? 0,
			days: days.map((d: ContributionDay) => ({
				date: d.date, // YYYY-MM-DD
				count: d.contributionCount,
			})),
		});
	} catch (error: unknown) {
		const details = error instanceof Error ? error.message : String(error);

		return NextResponse.json(
			{ error: "Server error", details },
			{ status: 500 },
		);
	}
}
