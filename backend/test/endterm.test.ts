import { test } from "node:test";
import assert from "node:assert/strict";
import { Api } from "../src/controller";
import { Service } from "../src/service";
import { reportSchema } from "@lostnet/shared";

const input = {
  type: "LOST",
  category: "Bags",
  item_name: "Backpack",
  color: "Black",
  latitude: 27.7,
  longitude: 85.3,
  event_at: "2026-01-01T10:00:00Z",
};
test("whitespace required fields and invalid dates are rejected; correction succeeds", () => {
  for (const field of ["item_name", "color"]) {
    const parsed = reportSchema.safeParse({ ...input, [field]: "   " });
    assert.equal(parsed.success, false);
    if (!parsed.success)
      assert.ok(
        parsed.error.issues.some(
          (i) => i.path[0] === field && i.message.includes("required"),
        ),
      );
  }
  assert.equal(
    reportSchema.safeParse({ ...input, event_at: "2099-01-01T10:00:00Z" })
      .success,
    false,
  );
  assert.equal(reportSchema.safeParse(input).success, true);
});
test("analytics derives scope from authenticated actor, rejects unauthenticated access before querying", async () => {
  const calls: unknown[] = [];
  const service = {
    actor: Service.prototype.actor,
    auth: {
      auth: {
        getUser: async () => ({ data: { user: { id: "owner" } }, error: null }),
      },
    },
    db: {
      rpc: async (name: string, args: unknown) => {
        calls.push([name, args]);
        return { data: { total_reports: 2 }, error: null };
      },
    },
  } as unknown as Service;
  const api = new Api(service);
  await assert.rejects(
    () => api.analytics(undefined as any),
    (e: any) => e.getStatus() === 401,
  );
  assert.equal(calls.length, 0);
  assert.deepEqual(await api.analytics("Bearer valid"), { total_reports: 2 });
  assert.deepEqual(calls, [["personal_analytics", { actor: "owner" }]]);
});
