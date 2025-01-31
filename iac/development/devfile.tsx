#!/usr/bin/env -S node --import tsx
/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import {
	DevfileCommandX,
	DevfileEventX,
	DevfileMetadataX,
	DevfileSourceComponentX,
	DevfileX,
} from "@levicape/fourtwo/x/devfile";

const NODE_VERSION = "22";
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
const PNPM_VERSION = "9";
const CCR_URL =
	"https://github.com/aws/codecatalyst-runner-cli/releases/latest/download/ccr_Linux_x86_64.tar.gz";

const sudodo = (script: string) =>
	["sudo ", ""].map((su) => `${su}${script}`).join("; ");

let data = (
	<DevfileX
		metadata={<DevfileMetadataX name={"fourtwo"} />}
		components={[<DevfileSourceComponentX name={"source"} />]}
		events={
			<DevfileEventX
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
		{[
			<DevfileCommandX
				id={"make"}
				exec={{
					component: "source",
					commandLine: `sudo yum install -y ${MAKE_DEPENDENCIES} || true`,
				}}
			/>,
			<DevfileCommandX
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
			/>,
			<DevfileCommandX
				id={"corepack"}
				exec={{
					component: "source",
					commandLine: sudodo("corepack enable pnpm || true"),
				}}
			/>,
			<DevfileCommandX
				id={"pnpm"}
				exec={{
					component: "source",
					commandLine: sudodo(`corepack install -g ${PNPM_VERSION} || true`),
				}}
			/>,
			<DevfileCommandX
				id={"node"}
				exec={{
					component: "source",
					commandLine: sudodo(`pnpx n ${NODE_VERSION} -y;`),
				}}
			/>,
			<DevfileCommandX
				id={"codecatalyst-workflow-cli"}
				exec={{
					component: "source",
					commandLine: [
						[`sudo curl -sL ${CCR_URL} -o -`, "sudo tar -zx ccr"].join(" | "),
						"sudo mv ccr /usr/local/bin/ccr",
					].join(" && "),
				}}
			/>,
			<DevfileCommandX
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
			/>,
			<DevfileCommandX
				id={"finch"}
				exec={{
					component: "source",
					commandLine: [
						"sudo dnf install runfinch-finch",
						"sudo dnf install amazon-ecr-credential-helper",
					].join("; "),
				}}
			/>,
		]}
	</DevfileX>
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
