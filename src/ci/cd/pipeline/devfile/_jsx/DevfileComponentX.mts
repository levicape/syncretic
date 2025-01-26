import { DevfileComponentBuilder } from "../DevfileComponent.mjs";

export type DevfileComponentProps<
	Component extends string,
	SupportedImages = "public.ecr.aws/aws-mde/universal-image:4.0",
> = {
	name: Component;
	container?: {
		image: SupportedImages;
		mountSources?: boolean;
		command?: string[];
		args?: string[];
		env?: { [key: string]: string };
		volumeMounts?: { [key: string]: string };
	};
};

export const DevfileComponentX = <Component extends string>(
	props: DevfileComponentProps<Component>,
): DevfileComponentBuilder<Component> => {
	return new DevfileComponentBuilder(props.name).setContainer(props.container);
};

export const DevfileSourceComponentX = <Component extends string>(props: {
	name: Component;
	image?: string;
	volumeMounts?: { [key: string]: string };
}): DevfileComponentBuilder<Component> => {
	return new DevfileComponentBuilder(props.name).setContainer({
		image: "public.ecr.aws/aws-mde/universal-image:4.0",
		mountSources: true,
		command: ["sleep", "infinity"],
		...(props.volumeMounts && Object.keys(props.volumeMounts).length > 0
			? props.volumeMounts
			: {}),
	});
};
