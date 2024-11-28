import { ComputeDockerImage } from "../compute/ComputeDockerImage.js";

export class AwsDockerImage {
	static BASE_IMAGE = "alpine:3";
	static PLAIN_IMAGE = "busybox:stable";
	// static PROVIDED_IMAGE = (accountId?: string) => `${accountId !== undefined ? `${accountId}.dkr.` : ``}ecr.us-east-1.amazonaws.com/ecr-public/lambda/provided:2023`;
	constructor(private readonly entrypoint: string) {}

	public bootstrap(cmd?: string, args?: string): string {
		return `    
    FROM ${AwsDockerImage.BASE_IMAGE} AS bootstrap
${ComputeDockerImage.copy()}    
    # Initialize Lambda bootstrap
    RUN apk --no-cache add zip

    WORKDIR /function
    COPY --link /${cmd ?? this.entrypoint} /function/${cmd ?? this.entrypoint}
    RUN echo "#!/bin/sh" >> bootstrap && "export BUN_INSTALL_CACHE_DIR=/tmp/bun/cache" && echo "set -euo pipefail" >> bootstrap && echo "${this.entrypoint} ${cmd ? `./${cmd}` : ""} ${args ?? ""}" >> bootstrap
    RUN chmod 777 bootstrap
    RUN zip -r function.zip bootstrap ${cmd ?? this.entrypoint}`;
	}

	public layer(props: {
		from: string;
		handler?: string;
		args?: string;
	}): string {
		const { from, handler, args } = props;
		const cmdpath = (handler ?? "").split("/");
		cmdpath.pop();
		const bin = this.entrypoint.split("/").pop();
		return `    
    FROM ${AwsDockerImage.PLAIN_IMAGE} AS bootstrap
	${ComputeDockerImage.copy(from, "")}
    # Initialize Lambda bootstrap

    WORKDIR /function
	RUN mkdir -p /function/${cmdpath.join("/")}
    COPY --from=${from} /tmp/bun/cache /tmp/bun/cache
    COPY --from=${from} --link ${this.entrypoint} /function/${bin}
    RUN echo "#!/bin/sh" >> bootstrap && echo "export BUN_INSTALL_CACHE_DIR=/tmp/bun/cache" >> bootstrap && echo "set -euo pipefail" >> bootstrap && echo "./${bin} ${handler ? `./${handler}` : ""} ${args ?? ""}" >> bootstrap
    RUN chmod 777 bootstrap
	`;
	}

	public copy(): string {
		return "COPY --from=bootstrap /function /function";
	}
}
