import {
  Controller,
  Inject,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Headers,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { z } from "zod";
import { reportSchema, registerSchema } from "@lostnet/shared";
import { score, matchReasons } from "./matching";
import { Service, fail, result } from "./service";
const uuid = (id: string) => z.uuid().parse(id);
const login = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});
@Controller()
export class Api {
  constructor(@Inject(Service) private readonly s: Service) {}
  @Get("health") health() {
    return { status: "ok", service: "Lost&Found API" };
  }
  @Get("ready") async ready() {
    const r = await this.s.db.from("matches").select("id,source").limit(1);
    if (r.error)
      fail(
        "Database not ready. Apply database migrations 001 through 004",
        503,
      );
    return {
      database: "ok",
      ai: this.s.config.GEMINI_API_KEY ? "configured" : "unconfigured",
    };
  }
  @Post("auth/register") async register(@Body() body: unknown) {
    const v = registerSchema.parse(body);
    const r = await this.s.auth.auth.signUp({
      email: v.email,
      password: v.password,
      options: { data: { full_name: v.full_name } },
    });
    if (r.error)
      fail("Registration failed. Check your details or try signing in");
    return {
      session: r.data.session,
      email_verification_required: !r.data.session,
    };
  }
  @Post("auth/login") async login(@Body() body: unknown) {
    const v = login.parse(body);
    const r = await this.s.auth.auth.signInWithPassword(v);
    if (r.error)
      fail("Invalid email or password, or email is not verified", 401);
    return r.data.session;
  }
  @Post("auth/logout") async logout(@Headers("authorization") h: string) {
    await this.s.actor(h);
    const r = await this.s.db.auth.admin.signOut(h.slice(7), "global");
    if (r.error) fail("Could not sign out");
    return { ok: true };
  }
  @Post("auth/reset-password") async reset(@Body() body: unknown) {
    const v = z.object({ email: z.email() }).parse(body);
    await this.s.auth.auth.resetPasswordForEmail(v.email);
    return { message: "If the account exists, a reset email has been sent" };
  }
  @Get("me") async me(@Headers("authorization") h: string) {
    const actor = await this.s.actor(h);
    return {
      ...result(
        await this.s.db.from("profiles").select("*").eq("id", actor).single(),
      ),
      memberships: result(
        await this.s.db.from("staff_members").select("*").eq("user_id", actor),
      ),
    };
  }
  @Get("locations") async locations(@Headers("authorization") h: string) {
    await this.s.actor(h);
    return result(
      await this.s.db
        .from("locations")
        .select("*")
        .eq("active", true)
        .order("name"),
    );
  }
  @Post("reports") async create(
    @Headers("authorization") h: string,
    @Body() body: unknown,
  ) {
    const actor = await this.s.actor(h);
    const v = reportSchema.parse(body);
    const challenge = z.object({
      verification_question: z.string().trim().min(8).max(200),
      verification_answer: z.string().trim().min(3).max(200),
    });
    const proof = v.type === "FOUND" ? challenge.parse(body) : null;
    const location = v.location_id
      ? result(
          await this.s.db
            .from("locations")
            .select("*")
            .eq("id", v.location_id)
            .eq("active", true)
            .maybeSingle(),
        )
      : null;
    if (v.location_id && !location) fail("Select an active location");
    const r = result(
      await this.s.db
        .from("reports")
        .insert({
          ...v,
          user_id: actor,
          organization_id: location?.organization_id ?? null,
          latitude: v.latitude ?? location?.latitude,
          longitude: v.longitude ?? location?.longitude,
        })
        .select()
        .single(),
    );
    if (proof) {
      try {
        result(
          await this.s.db.rpc("set_challenge", {
            rid: r.id,
            q: proof.verification_question,
            a: proof.verification_answer,
          }),
        );
      } catch (e) {
        await this.s.db.from("reports").delete().eq("id", r.id);
        throw e;
      }
    }
    return r;
  }
  @Post("reports/:id/publish") async publish(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    const actor = await this.s.actor(h);
    uuid(id);
    await this.s.report(id, actor, true);
    result(await this.s.db.rpc("publish_report", { rid: id, actor }));
    return { ok: true };
  }
  @Get("reports/my") async my(@Headers("authorization") h: string) {
    const actor = await this.s.actor(h);
    await this.s.reconcileMatches(actor);
    return Promise.all(
      result(
        await this.s.db
          .from("reports")
          .select("*")
          .eq("user_id", actor)
          .order("created_at", { ascending: false })
          .limit(100),
      ).map((r) => this.s.safeReport(r, true)),
    );
  }
  @Get("reports/search") async search(
    @Headers("authorization") h: string,
    @Query() query: any,
  ) {
    await this.s.actor(h);
    const v = z
      .object({
        category: z.string().max(80).optional(),
        color: z.string().max(60).optional(),
        brand: z.string().max(100).optional(),
        q: z.string().max(120).optional(),
        date: z.iso.date().optional(),
        status: z.enum(["FOUND", "STORED", "MATCH_FOUND"]).optional(),
      })
      .parse(query);
    let q = this.s.db
      .from("reports")
      .select("*")
      .eq("type", "FOUND")
      .in("status", ["FOUND", "STORED", "MATCH_FOUND"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (v.category) q = q.eq("category", v.category);
    if (v.color) q = q.ilike("color", v.color);
    if (v.brand) q = q.ilike("brand", v.brand);
    if (v.q) q = q.ilike("item_name", `%${v.q.replace(/[%_]/g, "")}%`);
    if (v.status) q = q.eq("status", v.status);
    if (v.date)
      q = q
        .gte("event_at", v.date + "T00:00:00Z")
        .lte("event_at", v.date + "T23:59:59Z");
    return Promise.all(result(await q).map((r) => this.s.safeReport(r)));
  }
  @Get("reports/:id") async detail(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    return this.s.safeReport(
      await this.s.report(uuid(id), await this.s.actor(h)),
      true,
    );
  }
  @Patch("reports/:id") async edit(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const actor = await this.s.actor(h);
    const r = await this.s.report(uuid(id), actor, true);
    if (r.status !== "DRAFT") fail("Only drafts can be edited");
    const v = reportSchema.parse(body);
    if (v.type !== r.type || v.location_id !== r.location_id)
      fail("Type and location cannot change");
    return result(
      await this.s.db.from("reports").update(v).eq("id", id).select().single(),
    );
  }
  @Delete("reports/:id") async close(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    const actor = await this.s.actor(h);
    const r = await this.s.report(uuid(id), actor, true);
    if (["VERIFYING", "CLAIMED", "RETURNED"].includes(r.status))
      fail("This report is in an active return process");
    result(await this.s.db.rpc("close_report", { rid: id, actor }));
    return { ok: true };
  }
  @Post("reports/:id/claim") async claim(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const actor = await this.s.actor(h);
    const { lost_report_id } = z
      .object({ lost_report_id: z.uuid() })
      .parse(body);
    const lost = await this.s.report(lost_report_id, actor, true);
    if (lost.user_id !== actor) fail("Select your own lost report", 403);
    const match_id = result(
      await this.s.db.rpc("request_claim", {
        lid: lost_report_id,
        fid: uuid(id),
        actor,
      }),
    );
    return { match_id };
  }
  @Get("reports/:id/diagnostics") async diagnostics(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    const actor = await this.s.actor(h);
    const r = await this.s.report(uuid(id), actor, true);
    const job = result(
      await this.s.db
        .from("jobs")
        .select("state,last_error,attempts")
        .eq("report_id", id)
        .maybeSingle(),
    );
    const opposite = result(
      await this.s.db
        .from("reports")
        .select("*")
        .neq("user_id", actor)
        .eq("type", r.type === "LOST" ? "FOUND" : "LOST")
        .in("status", ["ACTIVE", "FOUND", "STORED", "MATCH_FOUND"])
        .order("created_at", { ascending: false })
        .limit(100),
    );
    const pairs = result(
      await this.s.db
        .from("matches")
        .select("lost_report_id,found_report_id,status")
        .or(`lost_report_id.eq.${id},found_report_id.eq.${id}`),
    );
    // Do not expose private LOST reports or counterpart coordinates/AI/description.
    const candidates =
      r.type === "LOST"
        ? await Promise.all(
            opposite.map(async (c) => {
              const pair = pairs.find((p) => p.found_report_id === c.id);
              const reasons = matchReasons(r, c);
              if (pair?.status === "REJECTED")
                reasons.unshift(
                  "This pair was rejected. Explicit rejections are not reopened automatically.",
                );
              return {
                report: await this.s.safeReport(c),
                reasons,
                score: score(r, c)?.total_score ?? null,
                match_status: pair?.status ?? null,
              };
            }),
          )
        : [];
    return {
      ai_state: r.ai_state,
      gemini_configured: Boolean(this.s.config.GEMINI_API_KEY),
      has_image_evidence: Boolean(r.ai_analysis?.image_sha256),
      job,
      candidates,
    };
  }
  @Post("reports/:id/recheck") async recheck(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    const actor = await this.s.actor(h);
    const r = await this.s.report(uuid(id), actor, true);
    if (!["ACTIVE", "FOUND", "STORED", "MATCH_FOUND"].includes(r.status))
      fail("This report is not available for matching");
    const job = result(
      await this.s.db
        .from("jobs")
        .select("state")
        .eq("report_id", id)
        .maybeSingle(),
    );
    if (job?.state === "RUNNING" || job?.state === "PENDING")
      return { queued: true };
    result(
      await this.s.db
        .from("jobs")
        .upsert(
          { report_id: id, state: "PENDING", attempts: 0, last_error: null },
          { onConflict: "report_id" },
        ),
    );
    return { queued: true };
  }
  @Post("reports/:id/images")
  @UseInterceptors(
    FileInterceptor("image", { limits: { fileSize: 10485760, files: 1 } }),
  )
  async upload(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.s.upload(uuid(id), await this.s.actor(h), file);
  }
  @Get("matches") async matches(@Headers("authorization") h: string) {
    const actor = await this.s.actor(h);
    await this.s.reconcileMatches(actor);
    const reports = result(
      await this.s.db.from("reports").select("id").eq("user_id", actor),
    );
    if (!reports.length) return [];
    const ids = reports.map((r) => r.id).join(",");
    const ms = result(
      await this.s.db
        .from("matches")
        .select("*")
        .neq("status", "REJECTED")
        .or(`lost_report_id.in.(${ids}),found_report_id.in.(${ids})`)
        .order("total_score", { ascending: false })
        .limit(100),
    );
    return Promise.all(
      ms.map(async (m) =>
        this.safeMatch(await this.s.match(m.id, actor), actor),
      ),
    );
  }
  async safeMatch(m: any, actor?: string) {
    return {
      ...m,
      viewer_is_owner: m.lost.user_id === actor,
      lost: await this.s.safeReport(m.lost),
      found: await this.s.safeReport(m.found),
    };
  }
  @Get("matches/:id") async match(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    const actor = await this.s.actor(h);
    return this.safeMatch(await this.s.match(uuid(id), actor), actor);
  }
  @Post("matches/:id/confirm") async confirm(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    const actor = await this.s.actor(h);
    await this.s.reconcileMatches(actor);
    await this.s.match(uuid(id), actor);
    result(await this.s.db.rpc("confirm_match", { mid: id, actor }));
    return { ok: true };
  }
  @Post("matches/:id/reject") async reject(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    const actor = await this.s.actor(h);
    const m = await this.s.match(uuid(id), actor);
    if (m.status !== "PROPOSED") fail("Only proposed matches can be rejected");
    result(
      await this.s.db
        .from("matches")
        .update({ status: "REJECTED", rejection_reason: "USER" })
        .eq("id", id)
        .eq("status", "PROPOSED"),
    );
    await this.s.audit(actor, "MATCH_REJECTED", id);
    return { ok: true };
  }
  @Get("matches/:id/challenge") async challenge(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    const actor = await this.s.actor(h);
    const m = await this.s.match(uuid(id), actor);
    if (m.lost.user_id !== actor || m.status !== "VERIFYING")
      fail("Confirm your match first", 403);
    return result(
      await this.s.db
        .from("ownership_challenges")
        .select("question")
        .eq("report_id", m.found_report_id)
        .single(),
    );
  }
  @Post("matches/:id/verify") async verify(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const actor = await this.s.actor(h);
    await this.s.match(uuid(id), actor);
    const { answer } = z
      .object({ answer: z.string().trim().min(1).max(200) })
      .parse(body);
    const ok = result(
      await this.s.db.rpc("verify_ownership", { mid: id, actor, answer }),
    );
    if (!ok) fail("Answer not accepted or attempt limit reached", 403);
    return { verified: true };
  }
  @Get("matches/:id/messages") async messages(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    const m = await this.s.match(uuid(id), await this.s.actor(h));
    if (!["VERIFIED", "RETURNED"].includes(m.status))
      fail("Verify ownership to open chat", 403);
    const rows = result(
      await this.s.db
        .from("messages")
        .select("*")
        .eq("match_id", id)
        .order("created_at")
        .limit(200),
    );
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        sender_role:
          row.sender_id === m.lost.user_id
            ? "Owner"
            : row.sender_id === m.found.user_id
              ? "Finder"
              : "Staff",
        image_url: row.image_path
          ? result(
              await this.s.db.storage
                .from("chat-images")
                .createSignedUrl(row.image_path, 300),
            ).signedUrl
          : undefined,
      })),
    );
  }
  @Post("matches/:id/messages") async message(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const actor = await this.s.actor(h);
    const m = await this.s.match(uuid(id), actor);
    if (m.status !== "VERIFIED")
      fail("Chat is available for verified matches", 403);
    const v = z
      .object({ message: z.string().trim().min(1).max(4000) })
      .parse(body);
    return result(
      await this.s.db.rpc("send_message", { mid: id, actor, body: v.message }),
    );
  }
  @Post("matches/:id/return") async returned(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    const actor = await this.s.actor(h);
    await this.s.match(uuid(id), actor);
    result(await this.s.db.rpc("return_item", { mid: id, actor }));
    return { ok: true };
  }
  @Get("notifications") async notifications(
    @Headers("authorization") h: string,
  ) {
    return result(
      await this.s.db
        .from("notifications")
        .select("*")
        .eq("user_id", await this.s.actor(h))
        .order("created_at", { ascending: false })
        .limit(100),
    );
  }
  @Patch("notifications/:id/read") async read(
    @Headers("authorization") h: string,
    @Param("id") id: string,
  ) {
    result(
      await this.s.db
        .from("notifications")
        .update({ read: true })
        .eq("id", uuid(id))
        .eq("user_id", await this.s.actor(h)),
    );
    return { ok: true };
  }
  @Post("push-tokens") async token(
    @Headers("authorization") h: string,
    @Body() body: unknown,
  ) {
    const actor = await this.s.actor(h);
    const v = z
      .object({
        token: z
          .string()
          .regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/),
      })
      .parse(body);
    result(
      await this.s.db.from("push_tokens").upsert({ user_id: actor, ...v }),
    );
    return { ok: true };
  }
  @Get("staff/reports") async staff(@Headers("authorization") h: string) {
    const actor = await this.s.actor(h);
    if (!(await this.s.staff(actor))) fail("Staff access required", 403);
    const p = result(
      await this.s.db.from("profiles").select("role").eq("id", actor).single(),
    );
    let q = this.s.db
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (p.role !== "PLATFORM_ADMIN") {
      const ms = result(
        await this.s.db
          .from("staff_members")
          .select("organization_id")
          .eq("user_id", actor),
      );
      q = q.in(
        "organization_id",
        ms.map((m) => m.organization_id),
      );
    }
    await this.s.audit(actor, "STAFF_LIST_PRIVATE_REPORTS", actor);
    return Promise.all(result(await q).map((r) => this.s.safeReport(r, true)));
  }
  @Get("staff/matches") async staffMatches(
    @Headers("authorization") h: string,
  ) {
    const actor = await this.s.actor(h);
    const reports: any[] = await this.staff(h);
    if (!reports.length) return [];
    const ids = reports.filter((r) => r.type === "FOUND").map((r) => r.id);
    if (!ids.length) return [];
    const ms = result(
      await this.s.db
        .from("matches")
        .select("*")
        .in("found_report_id", ids)
        .order("created_at", { ascending: false })
        .limit(100),
    );
    return Promise.all(
      ms.map(async (m) =>
        this.safeMatch(await this.s.match(m.id, actor), actor),
      ),
    );
  }
  @Patch("staff/reports/:id/store") async store(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const actor = await this.s.actor(h);
    const r = await this.s.report(uuid(id), actor);
    if (!(await this.s.staff(actor, r.organization_id)))
      fail("Staff access required", 403);
    if (r.type !== "FOUND" || !["FOUND", "STORED"].includes(r.status))
      fail("Only found items can be stored");
    const v = z
      .object({ storage_location: z.string().trim().min(1).max(200) })
      .parse(body);
    result(
      await this.s.db
        .from("reports")
        .update({ ...v, status: "STORED" })
        .eq("id", id)
        .in("status", ["FOUND", "STORED"]),
    );
    await this.s.audit(actor, "ITEM_STORED", id);
    return { ok: true };
  }
  @Post("matches/:id/images")
  @UseInterceptors(
    FileInterceptor("image", { limits: { fileSize: 10485760, files: 1 } }),
  )
  async chatImage(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.s.uploadChat(uuid(id), await this.s.actor(h), file);
  }
  @Patch("reports/:id/ai-description")
  async aiDescription(
    @Headers("authorization") h: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const actor = await this.s.actor(h);
    const r = await this.s.report(uuid(id), actor, true);
    if (["RETURNED", "CLOSED"].includes(r.status)) fail("Report is closed");
    const v = z
      .object({ ai_description: z.string().trim().min(1).max(2000) })
      .parse(body);
    result(await this.s.db.from("reports").update(v).eq("id", id));
    return { ok: true };
  }
}
