import type { Abi, Arch, Os } from "../agent/Agent.mjs";
import type { PipelineOptions } from "../pipeline/Pipeline.mjs";
import { Target, type TargetPrototype } from "./Target.mjs";

export class TargetBuilder<Step> {
	private os?: Os;
	private arch?: Arch;
	private abi?: Abi;
	private baseline?: boolean;

	setArch(arch: Arch): this {
		this.arch = arch;
		return this;
	}

	setAbi(abi?: Abi): this {
		this.abi = abi;
		return this;
	}

	setBaseline(baseline?: boolean): this {
		this.baseline = baseline;
		return this;
	}

	setOs(os: Os): this {
		this.os = os;
		return this;
	}

	build(): Target & TargetPrototype<Step> {
		if (!this.os) {
			throw new Error("os is required");
		}

		if (!this.arch) {
			throw new Error("arch is required");
		}

		const target: Target = {
			os: this.os,
			arch: this.arch,
		};

		if (this.abi) {
			target.abi = this.abi;
		}

		if (this.baseline) {
			target.baseline = this.baseline;
		}

		return {
			...target,
			getTargetKey: () => Target.getTargetKey(target),
			getTargetLabel: () => Target.getTargetLabel(target),
			getBuildToolchain: () => Target.getBuildToolchain(target),
			getParallelism: () => Target.getParallelism(target),
		};
	}
}
