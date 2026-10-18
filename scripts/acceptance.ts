// Against a disposable Supabase project ONLY. Creates confirmed users and removes them afterwards.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import sharp from "sharp";
async function main() {
  if (process.env.ALLOW_TEST_USERS !== "true")
    throw new Error("Set ALLOW_TEST_USERS=true for a disposable test project");
  const url = process.env.SUPABASE_URL!,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY!,
    anon = process.env.SUPABASE_ANON_KEY!;
  const db = createClient(url, key, { auth: { persistSession: false } }),
    base = process.env.API_URL || "http://localhost:3000";
  const users: any[] = [],
    reports: string[] = [],
    matchIds: string[] = [];
  async function call(
    path: string,
    token?: string,
    body?: any,
    method = "GET",
    status = 200,
  ) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body
        ? body instanceof FormData
          ? body
          : JSON.stringify(body)
        : undefined,
    });
    const data: any = await res.json();
    assert.equal(
      res.status,
      status,
      `${method} ${path}: ${JSON.stringify(data)}`,
    );
    return data;
  }
  async function user(label: string) {
    const email = `lostnet-test-${label}-${crypto.randomUUID()}@example.com`,
      password = crypto.randomUUID() + "Aa9!";
    const r = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Test " + label },
    });
    if (r.error) throw r.error;
    users.push(r.data.user);
    const session = await call(
      "/auth/login",
      undefined,
      { email, password },
      "POST",
      201,
    );
    return { id: r.data.user!.id, token: session.access_token };
  }
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  try {
    let ready = false;
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch(base + "/ready");
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {}
      await sleep(500);
    }
    assert.ok(ready, "API must be running and database-ready");
    const owner = await user("owner"),
      finder = await user("finder"),
      staff = await user("staff"),
      outsider = await user("outsider"),
      locked = await user("lockout");
    const locations = await call("/locations", owner.token);
    assert.ok(locations.length, "Apply the optional seed before acceptance");
    const location = locations[0];
    const membership = await db.from("staff_members").insert({
      user_id: staff.id,
      organization_id: location.organization_id,
      role: "STAFF",
    });
    if (membership.error) throw membership.error;
    await call("/reports/my", undefined, undefined, "GET", 401);
    const input = {
      category: "Bags",
      item_name: "Black Nike backpack",
      brand: "Nike",
      color: "Black",
      description: "Black backpack with a blue keychain",
      unique_features: ["blue keychain"],
      location_id: location.id,
      event_at: new Date(Date.now() - 3600000).toISOString(),
    };
    const gpsOnly = await call(
      "/reports",
      owner.token,
      {
        ...input,
        type: "LOST",
        location_id: null,
        location_label: "Park area",
        latitude: location.latitude,
        longitude: location.longitude,
      },
      "POST",
      201,
    );
    reports.push(gpsOnly.id);
    assert.equal(gpsOnly.location_id, null);
    assert.equal(gpsOnly.organization_id, null);
    await call(`/reports/${gpsOnly.id}`, staff.token, undefined, "GET", 403);
    await call(`/reports/${gpsOnly.id}/publish`, owner.token, {}, "POST", 201);
    const farSamePlace = await call(
      "/reports",
      owner.token,
      { ...input, type: "LOST", latitude: -30, longitude: -60 },
      "POST",
      201,
    );
    reports.push(farSamePlace.id);
    await call(
      `/reports/${farSamePlace.id}/publish`,
      owner.token,
      {},
      "POST",
      201,
    );
    const lost = await call(
      "/reports",
      owner.token,
      { ...input, type: "LOST" },
      "POST",
      201,
    );
    reports.push(lost.id);
    await call(`/reports/${lost.id}/publish`, owner.token, {}, "POST", 201);
    const lost2 = await call(
      "/reports",
      locked.token,
      { ...input, type: "LOST" },
      "POST",
      201,
    );
    reports.push(lost2.id);
    await call(`/reports/${lost2.id}/publish`, locked.token, {}, "POST", 201);
    const sameOwnerLost = await call(
      "/reports",
      finder.token,
      { ...input, type: "LOST" },
      "POST",
      201,
    );
    reports.push(sameOwnerLost.id);
    await call(
      `/reports/${sameOwnerLost.id}/publish`,
      finder.token,
      {},
      "POST",
      201,
    );
    const found = await call(
      "/reports",
      finder.token,
      {
        ...input,
        type: "FOUND",
        verification_question: "What is inside the front pocket?",
        verification_answer: "Red notebook and USB drive",
      },
      "POST",
      201,
    );
    reports.push(found.id);
    await call(`/reports/${found.id}/publish`, finder.token, {}, "POST", 400);
    const invalid = new FormData();
    invalid.append(
      "image",
      new Blob(["not a picture"], { type: "image/jpeg" }),
      "fake.jpg",
    );
    await call(
      `/reports/${found.id}/images`,
      finder.token,
      invalid,
      "POST",
      400,
    );
    const image = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#151515" },
    })
      .jpeg()
      .toBuffer();
    const upload = new FormData();
    upload.append(
      "image",
      new Blob([new Uint8Array(image)], { type: "image/jpeg" }),
      "bag.jpg",
    );
    await call(
      `/reports/${found.id}/images`,
      finder.token,
      upload,
      "POST",
      201,
    );
    await call(`/reports/${found.id}/publish`, finder.token, {}, "POST", 201);
    await call(`/reports/${found.id}/recheck`, outsider.token, {}, "POST", 403);
    await call(`/reports/${found.id}/recheck`, finder.token, {}, "POST", 201);
    const candidates = await db.rpc("nearby_candidates", { rid: found.id });
    if (candidates.error) throw candidates.error;
    assert.ok(
      candidates.data.some((r: any) => r.id === lost.id),
      "Different-account candidate must be eligible",
    );
    assert.ok(
      candidates.data.some((r: any) => r.id === gpsOnly.id),
      "GPS-only report must qualify by actual proximity",
    );
    assert.ok(
      !candidates.data.some((r: any) => r.id === farSamePlace.id),
      "A shared venue cannot override distant GPS",
    );
    assert.ok(
      !candidates.data.some((r: any) => r.id === sameOwnerLost.id),
      "Same-account lost/found reports must never be matched",
    );
    const unrelated = await call(
      "/reports",
      owner.token,
      {
        ...input,
        type: "LOST",
        item_name: "Tishka",
        category: "Other",
        brand: "",
        color: "Grey-white",
        description: "",
        unique_features: [],
      },
      "POST",
      201,
    );
    reports.push(unrelated.id);
    await call(
      `/reports/${unrelated.id}/publish`,
      owner.token,
      {},
      "POST",
      201,
    );
    const stale = await db
      .from("matches")
      .insert({
        lost_report_id: unrelated.id,
        found_report_id: found.id,
        visual_score: 21,
        location_score: 30,
        time_score: 20,
        feature_score: 0,
        total_score: 71,
      })
      .select()
      .single();
    if (stale.error) throw stale.error;
    await db
      .from("reports")
      .update({ status: "MATCH_FOUND" })
      .eq("id", unrelated.id);
    const persisted = await call("/reports/my", owner.token);
    assert.ok(persisted.some((r: any) => r.id === lost.id));
    assert.equal(
      persisted.find((r: any) => r.id === unrelated.id)?.type,
      "LOST",
    );
    assert.equal(
      persisted.find((r: any) => r.id === unrelated.id)?.status,
      "ACTIVE",
    );
    assert.equal(
      (
        await db
          .from("matches")
          .select("status")
          .eq("id", stale.data.id)
          .single()
      ).data?.status,
      "REJECTED",
    );

    await call(
      `/reports/${lost.id}/diagnostics`,
      outsider.token,
      undefined,
      "GET",
      403,
    );
    const diagnostics = await call(
      `/reports/${lost.id}/diagnostics`,
      owner.token,
    );
    assert.equal(typeof diagnostics.gemini_configured, "boolean");
    const candidate = diagnostics.candidates.find(
      (c: any) => c.report.id === found.id,
    );
    assert.ok(candidate);
    for (const key of [
      "user_id",
      "latitude",
      "longitude",
      "description",
      "unique_features",
      "ai_analysis",
    ])
      assert.equal(candidate.report[key], undefined);
    const manual = await call(
      `/reports/${found.id}/claim`,
      owner.token,
      { lost_report_id: unrelated.id },
      "POST",
      201,
    );
    const manualAgain = await call(
      `/reports/${found.id}/claim`,
      owner.token,
      { lost_report_id: unrelated.id },
      "POST",
      201,
    );
    assert.equal(
      manualAgain.match_id,
      manual.match_id,
      "Manual claim is idempotent",
    );
    const manualMatches = await call("/matches", owner.token);
    assert.equal(
      manualMatches.find((x: any) => x.id === manual.match_id)?.source,
      "MANUAL",
      "A manual claim survives algorithm reconciliation",
    );
    await call(
      `/matches/${manual.match_id}/challenge`,
      owner.token,
      undefined,
      "GET",
      403,
    );
    await call(
      `/reports/${found.id}/claim`,
      outsider.token,
      { lost_report_id: unrelated.id },
      "POST",
      403,
    );
    await call(
      `/reports/${found.id}/claim`,
      finder.token,
      { lost_report_id: sameOwnerLost.id },
      "POST",
      400,
    );

    const recorded = await db
      .from("matches")
      .select("*")
      .eq("lost_report_id", lost.id)
      .eq("found_report_id", found.id)
      .maybeSingle();
    if (recorded.error) throw recorded.error;
    const args = {
      lid: lost.id,
      fid: found.id,
      visual: 40,
      loc: 30,
      tm: 20,
      feature: 10,
      total: 100,
    };
    if (!recorded.data) {
      const x = await db.rpc("record_match", args);
      if (x.error) throw x.error;
    }
    const withdrawn = await db.rpc("invalidate_match", {
      mid: (
        recorded.data ||
        (
          await db
            .from("matches")
            .select("id")
            .eq("lost_report_id", lost.id)
            .eq("found_report_id", found.id)
            .single()
        ).data
      ).id,
    });
    if (withdrawn.error) throw withdrawn.error;
    const revive = await db.rpc("record_match", args);
    if (revive.error) throw revive.error;
    const revived = await db
      .from("matches")
      .select("id,status")
      .eq("lost_report_id", lost.id)
      .eq("found_report_id", found.id)
      .single();
    assert.equal(
      revived.data?.status,
      "PROPOSED",
      "Algorithm withdrawals can be reconsidered",
    );
    await db
      .from("matches")
      .update({ status: "REJECTED", rejection_reason: "USER" })
      .eq("id", revived.data!.id);
    const noRevive = await db.rpc("record_match", args);
    if (noRevive.error) throw noRevive.error;
    assert.equal(
      (
        await db
          .from("matches")
          .select("status")
          .eq("id", revived.data!.id)
          .single()
      ).data?.status,
      "REJECTED",
      "Explicit user rejection is final",
    );
    // Restore the fixture directly so the existing ownership/return checks can continue.
    await db
      .from("matches")
      .update({ status: "PROPOSED", rejection_reason: null })
      .eq("id", revived.data!.id);

    await call(`/reports/${lost.id}`, outsider.token, undefined, "GET", 403);
    const publicReports = await call("/reports/search", outsider.token);
    const visible = publicReports.find((r: any) => r.id === found.id);
    assert.ok(visible);
    for (const field of [
      "user_id",
      "latitude",
      "longitude",
      "unique_features",
      "description",
      "storage_location",
    ])
      assert.equal(visible[field], undefined, `${field} must remain private`);
    const direct = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${outsider.token}` } },
      auth: { persistSession: false },
    });
    assert.equal(
      (await direct.from("reports").select().eq("id", lost.id)).data?.length,
      0,
    );
    assert.ok(
      (await direct.from("ownership_challenges").select()).error,
      "Challenge hashes must have no client grant",
    );
    assert.ok(
      (
        await direct.rpc("return_item", {
          mid: crypto.randomUUID(),
          actor: staff.id,
        })
      ).error,
      "Mutation RPC must not be callable by authenticated clients",
    );
    let matches: any[] = [];
    for (let n = 0; n < 25; n++) {
      matches = await call("/matches", owner.token);
      if (
        matches.some(
          (m) => m.found_report_id === found.id && m.lost_report_id === lost.id,
        )
      )
        break;
      await sleep(1000);
    }
    const m = matches.find(
      (m) => m.found_report_id === found.id && m.lost_report_id === lost.id,
    );
    assert.ok(m, "Worker must create a match");
    matchIds.push(m.id);
    assert.ok(m.total_score >= 90);
    let lock: any;
    for (let n = 0; n < 25; n++) {
      const lockMatches = await call("/matches", locked.token);
      lock = lockMatches.find((m: any) => m.found_report_id === found.id);
      if (lock) break;
      await sleep(1000);
    }
    assert.ok(lock, "Worker must also match the second lost report");
    matchIds.push(lock.id);
    const notices = await call("/notifications", owner.token);
    assert.ok(notices.some((n: any) => n.data.match_id === m.id));
    await call(`/matches/${m.id}/messages`, owner.token, undefined, "GET", 403);
    await call(`/matches/${m.id}/confirm`, finder.token, {}, "POST", 400);
    await call(`/matches/${lock.id}/confirm`, locked.token, {}, "POST", 201);
    for (let i = 0; i < 5; i++)
      await call(
        `/matches/${lock.id}/verify`,
        locked.token,
        { answer: "wrong" },
        "POST",
        403,
      );
    await call(
      `/matches/${lock.id}/verify`,
      locked.token,
      { answer: "Red notebook and USB drive" },
      "POST",
      403,
    );
    await call(`/matches/${m.id}/confirm`, owner.token, {}, "POST", 201);
    const question = await call(`/matches/${m.id}/challenge`, owner.token);
    assert.ok(question.question);
    assert.equal(question.answer_hash, undefined);
    await call(
      `/matches/${m.id}/verify`,
      owner.token,
      { answer: "Wrong answer" },
      "POST",
      403,
    );
    await call(
      `/matches/${m.id}/verify`,
      owner.token,
      { answer: "  RED NOTEBOOK AND USB DRIVE " },
      "POST",
      201,
    );
    await call(
      `/matches/${m.id}/messages`,
      outsider.token,
      undefined,
      "GET",
      403,
    );
    await call(
      `/matches/${m.id}/messages`,
      owner.token,
      { message: "Hello, thank you for finding it!" },
      "POST",
      201,
    );
    const chat = await call(`/matches/${m.id}/messages`, finder.token);
    assert.ok(
      chat.some((m: any) => m.message === "Hello, thank you for finding it!"),
    );
    const chatUpload = new FormData();
    chatUpload.append(
      "image",
      new Blob([new Uint8Array(image)], { type: "image/jpeg" }),
      "detail.jpg",
    );
    await call(`/matches/${m.id}/images`, owner.token, chatUpload, "POST", 201);
    const withImage = await call(`/matches/${m.id}/messages`, finder.token);
    const shared = withImage.find((msg: any) => msg.kind === "IMAGE");
    assert.ok(shared?.image_url);
    assert.equal((await fetch(shared.image_url)).status, 200);
    await call(`/matches/${m.id}/return`, owner.token, {}, "POST", 400);
    await call(`/matches/${m.id}/return`, staff.token, {}, "POST", 201);
    const returned = await call(`/matches/${m.id}`, owner.token);
    assert.equal(returned.status, "RETURNED");
    assert.equal(returned.lost.status, "RETURNED");
    assert.equal(returned.found.status, "RETURNED");
    const reopened = await call("/reports/my", locked.token);
    assert.equal(
      reopened.find((r: any) => r.id === lost2.id)?.status,
      "ACTIVE",
      "A losing claim must not leave an unrelated lost report stuck",
    );
    await call(
      `/matches/${m.id}/messages`,
      owner.token,
      { message: "Should be read-only" },
      "POST",
      403,
    );
    const audit = await db
      .from("audit_logs")
      .select("action")
      .eq("entity_id", m.id);
    assert.ok(audit.data?.some((a) => a.action === "ITEM_RETURNED"));
    // Regression: different names + recompressed same photo, no brand/features,
    // about 490m apart. Evidence must survive upload conversion and worker reads.
    const stoneInput = {
      ...input,
      latitude: location.latitude,
      longitude: location.longitude,
      category: "Jewelry",
      item_name: "yellow diamond",
      brand: "",
      color: "yellow",
      description: "",
      unique_features: [],
      event_at: new Date(Date.now() - 3600000).toISOString(),
    };
    const stoneLost = await call(
      "/reports",
      owner.token,
      { ...stoneInput, type: "LOST" },
      "POST",
      201,
    );
    reports.push(stoneLost.id);
    const stoneFound = await call(
      "/reports",
      finder.token,
      {
        ...stoneInput,
        type: "FOUND",
        item_name: "yellow stone",
        latitude: location.latitude + 0.0044,
        event_at: new Date().toISOString(),
        verification_question: "What is engraved underneath?",
        verification_answer: "Test initials AB",
      },
      "POST",
      201,
    );
    reports.push(stoneFound.id);
    const pattern = Buffer.alloc(128 * 128 * 3);
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++) {
        const i = (y * 128 + x) * 3;
        pattern[i] = x * 2;
        pattern[i + 1] = y * 2;
        pattern[i + 2] = (x + y) % 256;
      }
    const original = await sharp(pattern, {
      raw: { width: 128, height: 128, channels: 3 },
    })
      .png()
      .toBuffer();
    const reencoded = await sharp(original).jpeg({ quality: 70 }).toBuffer();
    for (const [report, token, bytes] of [
      [stoneLost, owner.token, original],
      [stoneFound, finder.token, reencoded],
    ] as const) {
      const form = new FormData();
      form.append(
        "image",
        new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }),
        "photo.jpg",
      );
      await call(`/reports/${report.id}/images`, token, form, "POST", 201);
      await call(`/reports/${report.id}/publish`, token, {}, "POST", 201);
    }
    let stoneMatch: any;
    for (let i = 0; i < 25; i++) {
      const ms = await call("/matches", owner.token);
      stoneMatch = ms.find(
        (x: any) =>
          x.lost_report_id === stoneLost.id &&
          x.found_report_id === stoneFound.id,
      );
      if (stoneMatch) break;
      await sleep(1000);
    }
    assert.ok(
      stoneMatch,
      "Recompressed duplicate photo must create an automatic match at ~490m",
    );
    assert.equal(stoneMatch.source, "AUTOMATIC");
    assert.ok(stoneMatch.total_score >= 70);
    const stoneDetails = await call(
      `/reports/${stoneLost.id}/diagnostics`,
      owner.token,
    );
    assert.equal(stoneDetails.has_image_evidence, true);
    if (!stoneDetails.gemini_configured)
      assert.match(stoneDetails.job.last_error, /GEMINI_API_KEY/);
    console.log(
      "PASS: persistence, validated private uploads, automatic matching, notifications, RLS, authorization, ownership lockout, secure chat, audited staff return.",
    );
  } finally {
    // Scoped cleanup; never delete existing application records.
    if (reports.length) {
      const images = await db
        .from("report_images")
        .select("storage_path,thumbnail_path")
        .in("report_id", reports);
      if (images.data?.length)
        await db.storage
          .from("item-images")
          .remove(
            images.data.flatMap((x) => [x.storage_path, x.thumbnail_path]),
          );
      const ms = await db
        .from("matches")
        .select("id")
        .or(
          `lost_report_id.in.(${reports.join(",")}),found_report_id.in.(${reports.join(",")})`,
        );
      const ids = (ms.data || []).map((m) => m.id);
      if (ids.length) {
        const chatImages = await db
          .from("messages")
          .select("image_path")
          .in("match_id", ids);
        const paths = (chatImages.data || [])
          .map((m) => m.image_path)
          .filter(Boolean);
        if (paths.length) await db.storage.from("chat-images").remove(paths);
        await db.from("messages").delete().in("match_id", ids);
        await db.from("ownership_verifications").delete().in("match_id", ids);
        await db.from("matches").delete().in("id", ids);
      }
      await db.from("reports").delete().in("id", reports);
    }
    for (const u of users) {
      await db.from("audit_logs").delete().eq("actor_id", u.id);
      await db.from("notifications").delete().eq("user_id", u.id);
      await db.from("staff_members").delete().eq("user_id", u.id);
      await db.auth.admin.deleteUser(u.id);
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
