export type RoundRobinProps<Choices extends string> = {
	list: ReadonlyArray<Choices>;
	period?: number;
};

const CONTAINER_ARM_ENVIRONMENTS = [
	"BUILD_GENERAL1_SMALL",
	"BUILD_GENERAL1_MEDIUM",
	"BUILD_GENERAL1_LARGE",
];

const LAMBDA_ARM_ENVIRONMENTS = [
	"BUILD_LAMBDA_1GB",
	"BUILD_LAMBDA_2GB",
	"BUILD_LAMBDA_4GB",
	"BUILD_LAMBDA_8GB",
	"BUILD_LAMBDA_10GB",
] as const;

export const RoundRobin = <Choices extends string>(
	props: RoundRobinProps<Choices>,
) => {
	let generator = (function* () {
		const list = props?.list ?? [];
		const period = props?.period ?? 1;
		const max = list.length;
		let current = 0;
		let index = Math.floor(Math.random() * max);

		while (true) {
			yield list[index];
			current++;
			if (current >= period) {
				current = 0;
				index = (index + 1) % max;
			}
		}
	})();
	return generator;
};

export const AwsCodeBuildContainerRoundRobin = RoundRobin({
	list: CONTAINER_ARM_ENVIRONMENTS,
	period: 1,
});
export const AwsCodeBuildLambdaRoundRobin = RoundRobin({
	list: LAMBDA_ARM_ENVIRONMENTS,
	period: 1,
});
