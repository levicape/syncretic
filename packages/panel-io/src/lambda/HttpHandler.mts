import { handle } from "hono/aws-lambda";
import { PanelHonoApp } from "../app/PanelHonoApp.mjs";

export const handler = handle(await PanelHonoApp());
