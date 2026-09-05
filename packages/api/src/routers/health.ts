import { inventreeConfigured, inventreeHealthCheck } from "@receivingX/inventree";
import { graphConfigured } from "@receivingX/mailer";
import { ocrHealthCheck } from "@receivingX/ocr";

import { roleProcedure, router } from "../index";

export const healthRouter = router({
  check: roleProcedure("admin").query(async () => {
    const [ocr, inventree] = await Promise.all([ocrHealthCheck(), inventreeConfigured() ? inventreeHealthCheck() : Promise.resolve(false)]);
    return {
      ocr: { ok: ocr },
      inventree: { ok: inventree, configured: inventreeConfigured() },
      mail: { configured: graphConfigured() },
    };
  }),
});
