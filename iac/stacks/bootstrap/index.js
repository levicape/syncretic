// Organization AWS provider
// Import Parameter for OAA role
// Provider assuming OAA Role
import { PulumiStateAws } from "@levicape/fourtwo-pulumi";
// SSM Parameters
const bucket = new PulumiStateAws("fourtwo:aws:bootstrap", {});
