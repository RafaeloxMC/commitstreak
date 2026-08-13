import GitHubContributionsHeatmap from "../ContributionsHeatmap";

function Hero() {
	return (
		<div>
			Navigate to /streaks/@{"<your-github-username>"}.svg to embed your
			streak!
			<GitHubContributionsHeatmap />
		</div>
	);
}

export default Hero;
