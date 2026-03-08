import "server-only";

import * as schema from "./schema";
import { dbAdmin, poolAdmin } from "./admin";
import { getRlsTenantTx } from "./tenant";

const dbTenant = new Proxy({} as typeof dbAdmin, {
  get(_target, prop, receiver) {
    const scopedTx = getRlsTenantTx();
    if (!scopedTx) {
      throw new Error("Tenant DB accessed without withRlsUserContext");
    }

    const value = Reflect.get(scopedTx as object, prop, receiver);
    if (typeof value === "function") {
      return value.bind(scopedTx);
    }
    return value;
  },
});

export { dbAdmin, dbTenant, poolAdmin as pool, schema };
export { timestampColumns } from "./schema";

