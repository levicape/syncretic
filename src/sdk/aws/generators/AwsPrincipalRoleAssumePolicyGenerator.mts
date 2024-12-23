// import type { AwsSystemsManager } from "../clients/AwsSystemsManager.mjs";

// AwsRoleGenerator
// Generator({clients: AwsClients, principal: string, region: string}) -> Promise<Function*>
//   -> generator.next(parameter, roleName) -> { $kind: "read"}
//   generator.next(rolePolicy) -> { $kind: "policy" }
//   generator.next() -> { $kind: "update" }
//   generator.return() -> { $kind: "done" }
