import type { FormatXMLElementFn } from "intl-messageformat";
import type { ReactNode } from "react";

export const HtmlFormatValues: Record<
	string,
	FormatXMLElementFn<React.ReactNode, React.ReactNode>
> = {
	span: (children: ReactNode) => <span>{children}</span>,
	strong: (children: ReactNode) => <strong>{children}</strong>,
	em: (children: ReactNode) => <em>{children}</em>,
};
