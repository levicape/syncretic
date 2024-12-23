import VError from "verror";

export const WaitForReadySequence = async (
	label: string,
	props: { timeout?: number; isReady: () => Promise<boolean> },
) => {
	const start = Date.now();
	console.dir({
		waitForReady: {
			message: `Waiting for ${label}`,
			timeout: `${props.timeout ?? 60000}ms`,
		},
	});

	while (Date.now() - start < (props.timeout ?? 60000)) {
		if (await props.isReady()) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 4000));
	}
	throw new VError(
		{
			name: "waitForReady",
			message: `Timeout waiting for ${label}`,
		},
		`Timeout waiting for ${label}`,
	);
};
