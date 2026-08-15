import flame from "@/assets/flame.png";
import grayFlame from "@/assets/flame-gray.png";
import type { NextRequest } from "next/server";

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ username: string }> },
) {
	let { username } = await params;

	username = username.replace(/\.(?:svg|jpe?g|png|gif)$/i, "");

	const safe = username.replace(/[^a-zA-Z0-9_-]/g, "");

	const res = await fetch(new URL("/api/contributions", req.nextUrl.origin), {
		method: "POST",
		body: JSON.stringify({
			login: username,
		}),
	});

	const result: unknown = await res.json();
	const streak =
		typeof result === "object" &&
		result !== null &&
		"streak" in result &&
		typeof result.streak === "number"
			? result.streak
			: typeof result === "number"
				? result
				: 0;

	let title = "On Fire!";
	let description = `@${safe} coded for </tspan><tspan x="295" y="194.136">${streak} days in a row!</tspan>`;

	if (streak == 0) {
		title = "On Break!";
		description = `@${safe} hasn't </tspan><tspan x="295" y="194.136">coded in a while!</tspan>`;
	}

	const svg = `<svg width="800" height="400" viewBox="0 0 800 400" fill="none" xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink">
    <rect width="800" height="400" rx="15" fill="#343434" />
    <text fill="white" style="white-space: pre" xml:space="preserve" font-family="sans"
        font-size="76" font-weight="900" letter-spacing="0em"><tspan x="295" y="105.636">${title}</tspan></text>
    <text fill="white" fill-opacity="0.75" style="white-space: pre" xml:space="preserve" font-family="sans"
		font-size="32" font-style="italic" letter-spacing="0em"><tspan x="295" y="155.136">${description}</text>
    <text fill="white" fill-opacity="0.5" style="white-space: pre" xml:space="preserve"
        font-family="sans" font-size="24" font-style="italic" letter-spacing="0em"><tspan x="500" y="340">codingstreak.xvcf.dev</tspan></text>
    <rect y="67" width="267" height="266" fill="url(#pattern0_1_2)" />
    <defs>
        <pattern id="pattern0_1_2" patternContentUnits="objectBoundingBox" width="1" height="1">
            <use xlink:href="#image0_1_2" transform="matrix(0.00194581 0 0 0.00195312 0.00187266 0)" />
        </pattern>
        <image id="image0_1_2" width="512" height="512" preserveAspectRatio="none" xlink:href="
		${streak == 0 ? `${grayFlame.src}` : `${flame.src}`}"/></defs>
</svg>`;

	return new Response(svg, {
		headers: {
			"Content-Type": "image/svg+xml; charset=utf-8",
		},
	});
}
