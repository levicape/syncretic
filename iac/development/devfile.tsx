#!/usr/bin/env -S node --import tsx
/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import {
	Devfile,
	DevfileCommand,
	DevfileEvent,
	DevfileMetadata,
	DevfileSourceComponent,
} from "../../module/jsx/devfile/Devfile.mts";

const APPLICATION_NAME = "fourtwo";
const NODE_VERSION = "22.12.0";
const PNPM_VERSION = "pnpm@9.15.4";
const MAKE_DEPENDENCIES = [
	"g++",
	"make",
	"cmake",
	"zip",
	"unzip",
	"libcurl-devel",
	"automake",
	"autoconf",
	"libtool",
	"zlib",
	"zlib-devel",
	"zlib-static",
	"protobuf",
	"protobuf-devel",
	"protobuf-compiler",
	"sqlite",
	"sqlite-devel",
	"sqlite-libs",
	"sqlite-tools",
].join(" ");
const CCR_URL =
	"https://github.com/aws/codecatalyst-runner-cli/releases/latest/download/ccr_Linux_x86_64.tar.gz";

const sudodo = (script: string) =>
	["sudo ", ""].map((su) => `${su}${script}`).join("; ");

let data = (
	<Devfile
		metadata={<DevfileMetadata name={APPLICATION_NAME} />}
		components={[<DevfileSourceComponent name={"source"} />]}
		events={
			<DevfileEvent
				postStart={[
					"make",
					"pyenv",
					"corepack",
					"pnpm",
					"node",
					"codecatalyst-workflow-cli",
					"docker",
					"finch",
				]}
			/>
		}
	>
		<DevfileCommand
			id={"make"}
			exec={{
				component: "source",
				commandLine: `sudo yum install -y ${MAKE_DEPENDENCIES} || true`,
			}}
		/>
		,
		<DevfileCommand
			id={"pyenv"}
			exec={{
				component: "source",
				commandLine: [
					'export PYENV_URL="https://pyenv.run"',
					'echo "Downloading pyenv. URL: $PYENV_URL"',
					"$(curl -fsSL $PYENV_URL | bash) || true",
					'export PYENV_ROOT="$HOME/.pyenv"',
					'[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"',
					'eval "$(pyenv init - bash)"',
					'echo "pyenv configured. Root: $PYENV_ROOT"',
				].join(" && "),
			}}
		/>
		,
		<DevfileCommand
			id={"corepack"}
			exec={{
				component: "source",
				commandLine: sudodo("corepack enable pnpm || true"),
			}}
		/>
		,
		<DevfileCommand
			id={"pnpm"}
			exec={{
				component: "source",
				commandLine: sudodo(`corepack install -g ${PNPM_VERSION} || true`),
			}}
		/>
		,
		<DevfileCommand
			id={"node"}
			exec={{
				component: "source",
				commandLine: sudodo(`pnpx n ${NODE_VERSION} -y`),
			}}
		/>
		,
		<DevfileCommand
			id={"codecatalyst-workflow-cli"}
			exec={{
				component: "source",
				commandLine: [
					[`sudo curl -sL ${CCR_URL} -o -`, "sudo tar -zx ccr"].join(" | "),
					"sudo mv ccr /usr/local/bin/ccr",
				].join(" && "),
			}}
		/>
		,
		<DevfileCommand
			id={"docker"}
			exec={{
				component: "source",
				commandLine: [
					[
						"sudo sh -c",
						`'echo {\"dns\": [\"8.8.8.8\"]}`,
						"> /etc/docker/daemon.json'",
					].join(" "),
					[
						"sudo sh -c 'dockerd --storage-opt dm.basesize=60G",
						"> /var/log/docker-daemon.log 2>&1 &'",
					].join(" "),
				].join(" && "),
			}}
		/>
		,
		<DevfileCommand
			id={"finch"}
			exec={{
				component: "source",
				commandLine: [
					"sudo dnf install runfinch-finch",
					"sudo dnf install amazon-ecr-credential-helper",
				].join("; "),
			}}
		/>
		,
	</Devfile>
);

import { stringify } from "yaml";

console.log(
	stringify(data.build(), {
		collectionStyle: "block",
		aliasDuplicateObjects: false,
		doubleQuotedAsJSON: true,
		minContentWidth: 0,
		lineWidth: 0,
	}),
);
