"use client";

import React, { useMemo, useState } from "react";

type Day = { date: string; count: number };

function addDays(d: Date, days: number) {
	const copy = new Date(d);
	copy.setUTCDate(copy.getUTCDate() + days);
	return copy;
}

function classForCount(count: number, max: number) {
	if (count === 0) return "bg-gray-100";
	const t = max ? count / max : 0;
	if (t <= 0.2) return "bg-green-200";
	if (t <= 0.4) return "bg-green-300";
	if (t <= 0.6) return "bg-green-400";
	if (t <= 0.8) return "bg-green-500";
	return "bg-green-700";
}

export default function GitHubContributionsHeatmap() {
	const [username, setUsername] = useState("");
	const [days, setDays] = useState<Day[]>([]);
	const [total, setTotal] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const maxCount = useMemo(() => {
		return Math.max(0, ...days.map((d) => d.count));
	}, [days]);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setTotal(null);
		setDays([]);

		const login = username.trim();
		if (!login) {
			setError("Enter a GitHub username.");
			return;
		}

		const now = new Date();
		const fromDate = addDays(now, -365); // Changing to new Date(0) results in POST /api/contributions 404; same with -365 * 5
		const toDate = now;

		const from = new Date(fromDate.toISOString());
		const to = new Date(toDate.toISOString());

		setLoading(true);
		try {
			const res = await fetch("/api/contributions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					login,
					from: from.toISOString(),
					to: to.toISOString(),
				}),
			});

			const data = await res.json();

			if (!res.ok) {
				setError(data?.error ?? "Failed to fetch contributions.");
				return;
			}

			setTotal(data.totalContributions ?? 0);
			setDays(data.days ?? []);
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="max-w-xl">
			<form onSubmit={onSubmit} className="flex gap-2 items-center mb-4">
				<input
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					placeholder="GitHub username"
					className="border rounded px-3 py-2 flex-1"
				/>
				<button
					type="submit"
					disabled={loading}
					className="px-3 py-2 rounded disabled:opacity-60"
				>
					{loading ? "Loading..." : "Fetch"}
				</button>
			</form>

			{error ? <div className="text-red-600 mb-3">{error}</div> : null}
			{total != null ? (
				<div className="text-sm mb-3">
					Total contributions (range): <b>{total}</b>
				</div>
			) : null}

			<div
				className="grid gap-1"
				style={{
					gridTemplateColumns: "repeat(auto-fill, minmax(12px, 1fr))",
				}}
			>
				{days.map((d) => (
					<div
						key={d.date}
						className={`w-3 h-3 rounded ${classForCount(d.count, maxCount)}`}
					/>
				))}
			</div>

			{days.length === 0 && total == null && !loading ? (
				<div className="text-sm mt-3">
					Enter a username to load their daily contribution counts.
				</div>
			) : null}
		</div>
	);
}
