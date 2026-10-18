import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  LayoutDashboard,
  ClipboardList,
  ScanLine,
  Bell,
  MapPin,
  ArrowUpRight,
  ArrowLeft,
  Search,
  Plus,
  Package,
  ShieldCheck,
  Check,
  LogOut,
  Leaf,
  MessageCircle,
  X,
  Menu,
  Loader2,
  SlidersHorizontal,
  ChevronRight,
  Upload,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { api, configured, supabase } from "./lib";
import { categories, Report, Match } from "@lostnet/shared";
import "./style.css";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchInterval: 15000 } },
});
type View =
  "Overview" | "My reports" | "Matches" | "Notifications" | "Staff desk";
function App() {
  const [session, setSession] = useState<any>(null),
    [loaded, setLoaded] = useState(!configured),
    [view, setView] = useState<View>("Overview"),
    [form, setForm] = useState<"LOST" | "FOUND" | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [error, setError] = useState(""),
    [mobileNav, setMobileNav] = useState(false),
    [recovery, setRecovery] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (_event === "PASSWORD_RECOVERY") setRecovery(true);
      queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api("/me"),
    enabled: !!session,
  });
  const reports = useQuery<Report[]>({
    queryKey: ["reports"],
    queryFn: () => api("/reports/my"),
    enabled: !!session,
  });
  const matches = useQuery<Match[]>({
    queryKey: ["matches"],
    queryFn: () => api("/matches"),
    enabled: !!session,
  });
  const notices = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: () => api("/notifications"),
    enabled: !!session,
  });
  const staff = !!(
    me.data?.memberships?.length || me.data?.role === "PLATFORM_ADMIN"
  );
  const links: View[] = [
    "Overview",
    "My reports",
    "Matches",
    "Notifications",
    ...(staff ? ["Staff desk" as View] : []),
  ];
  const icons: any = {
    Overview: LayoutDashboard,
    "My reports": ClipboardList,
    Matches: ScanLine,
    Notifications: Bell,
    "Staff desk": ShieldCheck,
  };
  const refresh = () => queryClient.invalidateQueries();
  useEffect(() => {
    if (!session || !supabase) return;
    const c = supabase
      .channel("inbox")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${session.user.id}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase?.removeChannel(c);
    };
  }, [session?.user.id]);
  if (!loaded)
    return (
      <div className="center">
        <Loader2 className="spin" /> Loading your workspace…
      </div>
    );
  return (
    <div className="shell">
      <aside className={mobileNav ? "sidebar open" : "sidebar"}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("Overview");
          }}
        >
          <span className="brand-icon">
            <ScanLine size={23} />
          </span>
          LostNet<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <span className="workspace-symbol">L</span>
          <div>
            Community workspace<small>Find. Connect. Return.</small>
          </div>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {links.map((v) => {
            const Icon = icons[v];
            return (
              <button
                key={v}
                className={view === v ? "nav active" : "nav"}
                onClick={() => {
                  setView(v);
                  setSelected(null);
                  setMobileNav(false);
                }}
              >
                <Icon size={19} />
                {v}
                {v === "Notifications" &&
                  !!notices.data?.filter((n) => !n.read).length && (
                    <span className="count">
                      {notices.data.filter((n) => !n.read).length}
                    </span>
                  )}
              </button>
            );
          })}
        </nav>
        <div className="side-note">
          <div className="note-symbol">
            <Leaf size={20} />
          </div>
          <b>A little help. A big difference.</b>
          <p>
            Every returned item has a story. Be part of someone’s happy ending.
          </p>
          <span>
            Good things find their way back <ArrowUpRight size={14} />
          </span>
        </div>
        <div className="side-bottom">
          <span className="avatar">
            {(me.data?.full_name || "G").slice(0, 1).toUpperCase()}
          </span>
          <div>
            <b>{me.data?.full_name || "Guest workspace"}</b>
            <small>
              {staff
                ? "Organization staff"
                : session
                  ? "Community member"
                  : "Connect to get started"}
            </small>
          </div>
          {session && (
            <button
              aria-label="Sign out"
              className="icon-button"
              onClick={async () => {
                try {
                  await api("/auth/logout", { method: "POST" });
                  await supabase?.auth.signOut();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <LogOut size={17} />
            </button>
          )}
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-button menu-toggle"
              onClick={() => setMobileNav(!mobileNav)}
              aria-label="Open menu"
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={14} /> <b>{view}</b>
            </span>
          </div>
          <div className="top-actions">
            <span className="community-pill">
              <span /> A community that cares
            </span>
            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() => setView("Notifications")}
            >
              <Bell size={19} />
            </button>
            <span className="avatar small">
              {(me.data?.full_name || "G").slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        <main>
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          )}
          {!configured ? (
            <Setup />
          ) : !session ? (
            <Auth />
          ) : recovery ? (
            <ResetPassword done={() => setRecovery(false)} />
          ) : selected ? (
            <MatchDetail id={selected} back={() => setSelected(null)} />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">A PLACE FOR SECOND CHANCES</div>
                  <h1>
                    {view === "Overview"
                      ? `Let’s bring things home${me.data?.full_name ? ", " + me.data.full_name.split(" ")[0] : ""}.`
                      : view}
                  </h1>
                  <p>
                    {view === "Overview"
                      ? "Lost something? Found something? You’re in the right place."
                      : view === "Matches"
                        ? "A familiar detail could be the start of a happy reunion."
                        : view === "My reports"
                          ? "Follow your items, from the first report to their way home."
                          : view === "Staff desk"
                            ? "Keep every handover organized, verified, and accounted for."
                            : "Your latest updates, all in one place."}
                  </p>
                </div>
                {view !== "Overview" && (
                  <button
                    className="button primary"
                    onClick={() => setForm("LOST")}
                  >
                    <Plus size={17} /> New report
                  </button>
                )}
              </div>
              {(reports.error || matches.error || me.error) && (
                <div className="alert error">
                  {(reports.error || matches.error || me.error)?.message}
                </div>
              )}
              {view === "Overview" && (
                <>
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="hero-label">
                        <span /> LOST THINGS. NEW CONNECTIONS.
                      </span>
                      <h2>
                        Sometimes, all it takes
                        <br />
                        is someone like you.
                      </h2>
                      <p>
                        Connect with your community and help the things
                        <br className="desktop" /> that matter find their way
                        back.
                      </p>
                      <div className="hero-buttons">
                        <button
                          className="button white"
                          onClick={() => setForm("LOST")}
                        >
                          <Search size={18} /> I lost something{" "}
                          <ArrowUpRight size={17} />
                        </button>
                        <button
                          className="button ghost"
                          onClick={() => setForm("FOUND")}
                        >
                          <Plus size={18} /> I found something
                        </button>
                      </div>
                      <div className="hero-foot">
                        <ShieldCheck size={15} /> Private details. Verified
                        owners. Safer returns.
                      </div>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="orbit one" />
                      <div className="orbit two" />
                      <div className="art-dot a" />
                      <div className="art-dot b" />
                      <div className="floating-pin">
                        <MapPin size={25} />
                      </div>
                      <div className="item-illustration">
                        <div className="bag-handle" />
                        <div className="bag-body">
                          <div className="bag-line" />
                          <div className="bag-pocket">
                            <Leaf size={34} />
                          </div>
                          <div className="bag-tag" />
                        </div>
                      </div>
                      <div className="found-tag">
                        <span>
                          <Check size={16} />
                        </span>{" "}
                        Found its way home
                      </div>
                      <div className="spark s1">✧</div>
                      <div className="spark s2">✧</div>
                    </div>
                  </section>
                  <section className="stats">
                    <Stat
                      icon={<ClipboardList />}
                      label="Your active reports"
                      value={
                        reports.isLoading
                          ? "—"
                          : String(
                              reports.data?.filter(
                                (r) =>
                                  !["CLOSED", "RETURNED", "DRAFT"].includes(
                                    r.status,
                                  ),
                              ).length || 0,
                            )
                      }
                      hint="We’re keeping an eye out"
                    />
                    <Stat
                      icon={<ScanLine />}
                      label="Possible matches"
                      value={
                        matches.isLoading
                          ? "—"
                          : String(
                              matches.data?.filter(
                                (m) => m.status === "PROPOSED",
                              ).length || 0,
                            )
                      }
                      hint="A step closer to a reunion"
                    />
                    <Stat
                      icon={<Package />}
                      label="Safely returned"
                      value={
                        reports.isLoading
                          ? "—"
                          : String(
                              reports.data?.filter(
                                (r) => r.status === "RETURNED",
                              ).length || 0,
                            )
                      }
                      hint="Back where they belong"
                    />
                  </section>
                  <section className="section">
                    <div className="section-title">
                      <div>
                        <h2>
                          Possible matches{" "}
                          <span className="label green">FOR YOU</span>
                        </h2>
                        <p>A few things that might look familiar.</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => setView("Matches")}
                      >
                        View all matches <ArrowUpRight size={16} />
                      </button>
                    </div>
                    {matches.isLoading ? (
                      <Loading />
                    ) : matches.data?.filter((m) => m.status === "PROPOSED")
                        .length ? (
                      <div className="card-grid">
                        {matches.data
                          .filter((m) => m.status === "PROPOSED")
                          .slice(0, 3)
                          .map((m) => (
                            <MatchCard
                              key={m.id}
                              match={m}
                              open={() => setSelected(m.id)}
                            />
                          ))}
                      </div>
                    ) : (
                      <Empty
                        icon={<ScanLine />}
                        title="Your next match starts with a report"
                        text="Tell us what you’ve lost. We’ll compare it with found items nearby."
                        action={() => setForm("LOST")}
                        actionText="Create a lost report"
                      />
                    )}
                  </section>
                  <SearchReports onFound={() => setForm("FOUND")} />
                </>
              )}
              {view === "My reports" && (
                <section className="section">
                  {reports.isLoading ? (
                    <Loading />
                  ) : reports.data?.length ? (
                    <div className="card-grid">
                      {reports.data.map((r) => (
                        <ReportCard
                          key={r.id}
                          report={r}
                          onPublish={async () => {
                            try {
                              await api(`/reports/${r.id}/publish`, {
                                method: "POST",
                              });
                              refresh();
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <Empty
                      icon={<ClipboardList />}
                      title="A fresh start"
                      text="Create your first report and let your community help."
                      action={() => setForm("LOST")}
                      actionText="Create report"
                    />
                  )}
                </section>
              )}
              {view === "Matches" &&
                (matches.isLoading ? (
                  <Loading />
                ) : matches.data?.length ? (
                  <div className="card-grid">
                    {matches.data.map((m) => (
                      <MatchCard
                        key={m.id}
                        match={m}
                        open={() => setSelected(m.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon={<ScanLine />}
                    title="Looking for the right connection"
                    text="Matches appear here when we find a similar item near your report."
                  />
                ))}
              {view === "Notifications" &&
                (notices.isLoading ? (
                  <Loading />
                ) : notices.data?.length ? (
                  <div className="notification-list">
                    {notices.data.map((n) => (
                      <button
                        className={"notification " + (!n.read ? "unread" : "")}
                        key={n.id}
                        onClick={async () => {
                          await api(`/notifications/${n.id}/read`, {
                            method: "PATCH",
                          });
                          refresh();
                          if (n.data.match_id) setSelected(n.data.match_id);
                        }}
                      >
                        <span className="stat-icon">
                          <Bell size={20} />
                        </span>
                        <div>
                          <b>{n.title}</b>
                          <p>{n.message}</p>
                          <small>
                            {new Date(n.created_at).toLocaleString()}
                          </small>
                        </div>
                        {!n.read && <span className="unread-dot" />}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon={<Bell />}
                    title="You’re all caught up"
                    text="New matches and updates will appear here."
                  />
                ))}
              {view === "Staff desk" && <StaffDesk open={setSelected} />}
            </>
          )}
          <footer>
            <span>
              <span className="footer-mark">✳</span> Small acts. Meaningful
              reunions.
            </span>
            <span>Made for a more connected community.</span>
          </footer>
        </main>
      </div>
      {form && (
        <ReportForm
          type={form}
          close={() => setForm(null)}
          done={() => {
            setForm(null);
            setView("My reports");
            refresh();
          }}
        />
      )}
    </div>
  );
}
function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>
        <span className="tiny-dot" />
        {hint}
      </small>
    </article>
  );
}
function Loading() {
  return (
    <div className="empty">
      <Loader2 className="spin" /> Loading…
    </div>
  );
}
function Empty({
  icon,
  title,
  text,
  action,
  actionText,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: () => void;
  actionText?: string;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="button subtle" onClick={action}>
          {actionText}
          <ArrowUpRight size={16} />
        </button>
      )}
    </div>
  );
}
function Setup() {
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">WELCOME TO LOSTNET</div>
        <h1>Good things find their way back.</h1>
        <p>Your community’s lost & found, in one thoughtful place.</p>
      </div>
      <section className="setup-card">
        <span className="setup-icon">
          <Leaf size={38} />
        </span>
        <span className="label green">WORKSPACE SETUP</span>
        <h2>
          A home for everything
          <br />
          that’s missing.
        </h2>
        <p>
          Connect your Supabase project to open this workspace.
          <br />
          Your reports, matches, and conversations will live there securely.
        </p>
        <div className="setup-steps">
          <div>
            <span>1</span>
            <p>
              <b>Create your Supabase project</b>
              <small>
                Apply database/migrations/001_initial.sql and the optional seed.
              </small>
            </p>
          </div>
          <div>
            <span>2</span>
            <p>
              <b>Configure your environment</b>
              <small>
                Set the public Supabase URL, anon key, and API URL in
                admin/.env.
              </small>
            </p>
          </div>
          <div>
            <span>3</span>
            <p>
              <b>Start your community workspace</b>
              <small>
                Start the API and restart the web app. Full instructions are in
                README.md.
              </small>
            </p>
          </div>
        </div>
        <div className="setup-privacy">
          <ShieldCheck size={17} /> Service-role and Gemini keys belong only on
          the server.
        </div>
      </section>
    </>
  );
}
function Auth() {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  return (
    <section className="auth-card">
      <span className="setup-icon">
        <ScanLine size={32} />
      </span>
      <div className="eyebrow">YOUR COMMUNITY IS HERE</div>
      <h1>
        {mode === "login"
          ? "Welcome back."
          : mode === "register"
            ? "Let’s make connections."
            : "Find your way back in."}
      </h1>
      <p>
        {mode === "login"
          ? "Sign in to find what matters."
          : mode === "register"
            ? "A little help starts with an account."
            : "We’ll email you a secure password reset link."}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setNotice("");
          const values = Object.fromEntries(new FormData(e.currentTarget));
          try {
            if (mode === "register" && values.password !== values.confirm)
              throw new Error("Passwords do not match");
            const r = await api(
              `/auth/${mode === "reset" ? "reset-password" : mode}`,
              { method: "POST", body: JSON.stringify(values) },
            );
            if (mode === "reset") setNotice(r.message);
            else if (mode === "register" && !r.session)
              setNotice(
                "Check your email to verify your account, then sign in.",
              );
            else {
              const s = mode === "register" ? r.session : r;
              const { error } = await supabase!.auth.setSession(s);
              if (error) throw error;
            }
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {mode === "register" && (
          <label>
            Full name
            <input
              name="full_name"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
            />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        {mode !== "reset" && (
          <label>
            Password
            <input
              name="password"
              type="password"
              minLength={mode === "register" ? 8 : 1}
              maxLength={128}
              required
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
            />
          </label>
        )}
        {mode === "register" && (
          <label>
            Confirm password
            <input
              name="confirm"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>
        )}
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="alert success" role="status">
            {notice}
          </div>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? <Loader2 className="spin" size={18} /> : null}
          {mode === "login"
            ? "Sign in"
            : mode === "register"
              ? "Create account"
              : "Send reset link"}
          <ArrowUpRight size={17} />
        </button>
      </form>
      <div className="auth-links">
        <button
          className="text-button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
            setNotice("");
          }}
        >
          {mode === "login" ? "Create an account" : "Back to sign in"}
        </button>
        {mode === "login" && (
          <button
            className="text-button muted"
            onClick={() => setMode("reset")}
          >
            Forgot password?
          </button>
        )}
      </div>
    </section>
  );
}
function ResetPassword({ done }: { done: () => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="auth-card">
      <h1>Choose a new password.</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setError("");
          if (f.get("password") !== f.get("confirm")) {
            setError("Passwords do not match");
            return;
          }
          setBusy(true);
          try {
            const { error } = await supabase!.auth.updateUser({
              password: String(f.get("password")),
            });
            if (error) throw error;
            done();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          New password
          <input
            type="password"
            name="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            name="confirm"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
          />
        </label>
        {error && <div className="alert error">{error}</div>}
        <button className="button primary full" disabled={busy}>
          Update password
        </button>
      </form>
    </section>
  );
}
function ReportCard({
  report: r,
  onPublish,
}: {
  report: Report;
  onPublish?: () => void;
}) {
  return (
    <article className="item-card">
      <div className="item-image">
        {r.image_url ? (
          <img src={r.image_url} alt={r.item_name} />
        ) : (
          <Package size={48} />
        )}
        <span className={"image-label " + (r.type === "LOST" ? "lost" : "")}>
          {r.type === "LOST" ? "Lost item" : "Found item"}
        </span>
      </div>
      <div className="item-info">
        <div className="item-meta">
          {r.category}
          <span className="status">{r.status.replaceAll("_", " ")}</span>
        </div>
        <h3>{r.item_name}</h3>
        <p>
          <MapPin size={14} />
          {r.location_name}
        </p>
        <small>
          {new Date(r.event_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}{" "}
          · {r.color}
        </small>
        {onPublish && <OwnReportTools report={r} />}
        {r.status === "DRAFT" && onPublish && (
          <button className="button subtle full" onClick={onPublish}>
            Publish draft <ArrowUpRight size={15} />
          </button>
        )}
      </div>
    </article>
  );
}

function OwnReportTools({ report: r }: { report: Report }) {
  const [editing, setEditing] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  return (
    <>
      <ErrorTextInline error={error} />
      {r.ai_description && <p className="ai-copy">{r.ai_description}</p>}
      {r.status === "DRAFT" && (
        <label className="upload compact">
          <Upload size={16} /> Add draft photos
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 5) {
                setError("Choose up to 5 photos");
                return;
              }
              setBusy(true);
              setError("");
              try {
                for (const file of files) {
                  const fd = new FormData();
                  fd.append("image", file);
                  await api(`/reports/${r.id}/images`, {
                    method: "POST",
                    body: fd,
                  });
                }
                qc.invalidateQueries();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      )}
      {!["RETURNED", "CLOSED"].includes(r.status) && (
        <button className="text-button" onClick={() => setEditing(true)}>
          {r.status === "DRAFT" ? "Edit draft" : "Edit AI description"}{" "}
          <ArrowUpRight size={14} />
        </button>
      )}
      {editing && (
        <div className="modal-backdrop">
          <section
            className="modal small-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Edit report"
          >
            <h2>
              {r.status === "DRAFT" ? "Edit report" : "Review AI description"}
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = Object.fromEntries(new FormData(e.currentTarget));
                setBusy(true);
                setError("");
                try {
                  await api(
                    `/reports/${r.id}${r.status === "DRAFT" ? "" : "/ai-description"}`,
                    {
                      method: "PATCH",
                      body: JSON.stringify(
                        r.status === "DRAFT" ? { ...r, ...f } : f,
                      ),
                    },
                  );
                  setEditing(false);
                  qc.invalidateQueries();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {r.status === "DRAFT" ? (
                <>
                  <label>
                    Item name
                    <input
                      name="item_name"
                      defaultValue={r.item_name}
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Color
                    <input
                      name="color"
                      defaultValue={r.color}
                      required
                      maxLength={60}
                    />
                  </label>
                  <label>
                    Brand
                    <input
                      name="brand"
                      defaultValue={r.brand}
                      maxLength={100}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      name="description"
                      defaultValue={r.description}
                      maxLength={2000}
                    />
                  </label>
                </>
              ) : (
                <label>
                  Description
                  <textarea
                    name="ai_description"
                    defaultValue={r.ai_description || r.description}
                    required
                    maxLength={2000}
                  />
                </label>
              )}
              <ErrorTextInline error={error} />
              <div className="hero-buttons">
                <button
                  type="button"
                  className="button subtle"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
                <button className="button primary" disabled={busy}>
                  Save changes
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
function ErrorTextInline({ error }: { error: string }) {
  return error ? (
    <div className="alert error" role="alert">
      {error}
    </div>
  ) : null;
}
function MatchCard({ match: m, open }: { match: Match; open: () => void }) {
  const r = m.found!;
  return (
    <button className="item-card match-card" onClick={open}>
      <div className="item-image">
        {r.image_url ? (
          <img src={r.image_url} alt={r.item_name} />
        ) : (
          <Package size={48} />
        )}
        <span className="match-score">
          <ScanLine size={14} />
          {Math.round(m.total_score)}% match
        </span>
      </div>
      <div className="item-info">
        <div className="item-meta">
          {r.category}
          <span>{m.status}</span>
        </div>
        <h3>{r.item_name}</h3>
        <p>
          <MapPin size={14} />
          {r.location_name}
        </p>
        <div className="card-bottom">
          <span>
            {m.total_score >= 90
              ? "A strong connection"
              : "Worth a closer look"}
          </span>
          <span className="round-arrow">
            <ArrowUpRight size={17} />
          </span>
        </div>
      </div>
    </button>
  );
}
function SearchReports({ onFound }: { onFound: () => void }) {
  const [term, setTerm] = useState(""),
    [category, setCategory] = useState("");
  const reports = useQuery<Report[]>({
    queryKey: ["search", term, category],
    queryFn: () =>
      api(
        "/reports/search?" +
          new URLSearchParams({ q: term, ...(category ? { category } : {}) }),
      ),
  });
  return (
    <section className="section">
      <div className="section-title">
        <div>
          <h2>Around the community</h2>
          <p>Recently found. Waiting to be recognized.</p>
        </div>
        <button className="text-button" onClick={onFound}>
          Found something? <Plus size={16} />
        </button>
      </div>
      <div className="search-row">
        <label className="search-input">
          <Search size={18} />
          <input
            placeholder="Search found items…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </label>
        <label className="filter-select">
          <SlidersHorizontal size={16} />
          <select
            aria-label="Filter category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      {reports.isLoading ? (
        <Loading />
      ) : reports.error ? (
        <div className="alert error">{reports.error.message}</div>
      ) : reports.data?.length ? (
        <div className="card-grid">
          {reports.data.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </div>
      ) : (
        <Empty
          icon={<Search />}
          title="Nothing here just yet"
          text={
            term || category
              ? "Try another search or category."
              : "Found items will appear here as your community shares them."
          }
        />
      )}
    </section>
  );
}
function ReportForm({
  type,
  close,
  done,
}: {
  type: "LOST" | "FOUND";
  close: () => void;
  done: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [files, setFiles] = useState<File[]>([]),
    [draft, setDraft] = useState<string | null>(null),
    [uploaded, setUploaded] = useState(0);
  const locations = useQuery<any[]>({
    queryKey: ["locations"],
    queryFn: () => api("/locations"),
  });
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              {type === "LOST"
                ? "LET’S FIND IT TOGETHER"
                : "THANK YOU FOR LOOKING OUT"}
            </span>
            <h2 id="form-title">
              {type === "LOST" ? "Report a lost item" : "Report a found item"}
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close"
            onClick={close}
            disabled={busy}
          >
            <X />
          </button>
        </div>
        <p className="muted">
          {type === "LOST"
            ? "The little details can make a big difference."
            : "Share what you found. We’ll help connect it with its owner."}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = Object.fromEntries(new FormData(e.currentTarget));
            try {
              if (type === "FOUND" && !files.length && !draft)
                throw new Error("Add at least one photo");
              let id = draft;
              if (!id) {
                const r = await api("/reports", {
                  method: "POST",
                  body: JSON.stringify({
                    ...f,
                    type,
                    event_at: new Date(f.event_at as string).toISOString(),
                    unique_features: String(f.unique_features || "")
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  }),
                });
                id = r.id;
                setDraft(id);
              }
              for (let i = uploaded; i < files.length; i++) {
                const fd = new FormData();
                fd.append("image", files[i]);
                await api(`/reports/${id}/images`, {
                  method: "POST",
                  body: fd,
                });
                setUploaded(i + 1);
              }
              await api(`/reports/${id}/publish`, { method: "POST" });
              done();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy || !!draft}>
            <div className="form-grid">
              <label>
                Item name *
                <input
                  name="item_name"
                  placeholder="e.g. Black Nike backpack"
                  required
                  minLength={2}
                  maxLength={120}
                />
              </label>
              <label>
                Category *
                <select name="category" required>
                  <option value="">Choose a category</option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Color *
                <input
                  name="color"
                  placeholder="e.g. Black"
                  required
                  maxLength={60}
                />
              </label>
              <label>
                Brand
                <input name="brand" placeholder="e.g. Nike" maxLength={100} />
              </label>
              <label>
                Location *
                <select name="location_id" required>
                  <option value="">Choose a location</option>
                  {locations.data?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date and time *
                <input
                  type="datetime-local"
                  name="event_at"
                  required
                  max={new Date(
                    Date.now() - new Date().getTimezoneOffset() * 60000,
                  )
                    .toISOString()
                    .slice(0, 16)}
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                name="description"
                placeholder="What should we look for?"
                maxLength={2000}
                rows={3}
              />
            </label>
            <label>
              Unique features{" "}
              <span className="muted">(private, comma separated)</span>
              <input
                name="unique_features"
                placeholder="Blue keychain, small scratch near zipper"
              />
            </label>
            {type === "FOUND" && (
              <div className="verification-box">
                <ShieldCheck size={21} />
                <div>
                  <h3>Keep one detail just for the owner</h3>
                  <p>
                    A private question helps us verify who this belongs to.
                    Don’t put the answer in your photos or public item name.
                  </p>
                  <label>
                    Verification question *
                    <input
                      name="verification_question"
                      placeholder="What is inside the front pocket?"
                      required
                      minLength={8}
                      maxLength={200}
                    />
                  </label>
                  <label>
                    Expected answer *
                    <input
                      name="verification_answer"
                      type="password"
                      required
                      minLength={3}
                      maxLength={200}
                      autoComplete="off"
                    />
                  </label>
                </div>
              </div>
            )}
            <label className="upload">
              <Upload size={25} />
              <b>
                {files.length
                  ? `${files.length} photo(s) selected`
                  : "Add a photo" + (type === "FOUND" ? " *" : "")}
              </b>
              <span>JPG, PNG or WebP · up to 10 MB each · 5 photos</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => {
                  const fs = Array.from(e.target.files || []);
                  if (fs.length > 5 || fs.some((f) => f.size > 10485760)) {
                    setError("Select up to 5 photos, 10 MB each");
                    return;
                  }
                  setError("");
                  setFiles(fs);
                }}
              />
            </label>
          </fieldset>
          {locations.error && (
            <div className="alert error">{locations.error.message}</div>
          )}
          {locations.data?.length === 0 && (
            <div className="alert error">
              No locations yet. An administrator must add a location.
            </div>
          )}
          {error && (
            <div className="alert error" role="alert">
              {error}
              {draft && " Your draft is saved. Retry to continue the upload."}
            </div>
          )}
          <div className="modal-footer">
            <span>
              <ShieldCheck size={14} /> Your private details stay private.
            </span>
            <button
              className="button primary"
              disabled={busy || !locations.data?.length}
            >
              {busy ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <Plus size={18} />
              )}{" "}
              {draft ? "Continue publishing" : "Submit report"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function MatchDetail({ id, back }: { id: string; back: () => void }) {
  const qc = useQueryClient();
  const m = useQuery<Match>({
    queryKey: ["match", id],
    queryFn: () => api(`/matches/${id}`),
  });
  const challenge = useQuery<{ question: string }>({
    queryKey: ["challenge", id],
    queryFn: () => api(`/matches/${id}/challenge`),
    enabled: m.data?.status === "VERIFYING",
    retry: false,
  });
  const messages = useQuery<any[]>({
    queryKey: ["messages", id],
    queryFn: () => api(`/matches/${id}/messages`),
    enabled: ["VERIFIED", "RETURNED"].includes(m.data?.status || ""),
    refetchInterval: 4000,
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const run = async (path: string, body?: any) => {
    setBusy(true);
    setError("");
    try {
      await api(`/matches/${id}/${path}`, {
        method: "POST",
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      await qc.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (m.isLoading) return <Loading />;
  if (!m.data) return <div className="alert error">{m.error?.message}</div>;
  const v = m.data;
  return (
    <>
      <button className="text-button" onClick={back}>
        <ArrowLeft size={17} /> Back to workspace
      </button>
      <div className="page-heading">
        <h1>A possible way home.</h1>
        <p>Compare the details, then verify what only you would know.</p>
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <div className="detail-grid">
        <ReportCard report={v.found!} />
        <section className="detail-panel">
          <span className="label green">{v.status}</span>
          <h2>{Math.round(v.total_score)}% match</h2>
          <p className="muted">A suggestion, not proof of ownership.</p>
          {[
            ["Visual / text", v.visual_score, 40],
            ["Location", v.location_score, 30],
            ["Time", v.time_score, 20],
            ["Unique features", v.feature_score, 10],
          ].map(([name, n, max]) => (
            <div className="score-row" key={name}>
              <div>
                <span>{name}</span>
                <b>
                  {n} / {max}
                </b>
              </div>
              <progress value={Number(n)} max={Number(max)} />
            </div>
          ))}
          {v.status === "PROPOSED" && v.viewer_is_owner && (
            <div className="hero-buttons">
              <button
                className="button primary"
                disabled={busy}
                onClick={() => run("confirm")}
              >
                This could be mine <Check size={17} />
              </button>
              <button
                className="button subtle"
                disabled={busy}
                onClick={() => run("reject")}
              >
                Not a match
              </button>
            </div>
          )}
          {v.status === "VERIFYING" &&
            (challenge.data ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run("verify", {
                    answer: new FormData(e.currentTarget).get("answer"),
                  });
                }}
              >
                <label>
                  {challenge.data.question}
                  <input
                    name="answer"
                    required
                    maxLength={200}
                    autoComplete="off"
                  />
                </label>
                <small>
                  Up to 5 attempts. Answers are matched without case
                  sensitivity.
                </small>
                <button className="button primary full" disabled={busy}>
                  Verify ownership <ShieldCheck size={17} />
                </button>
              </form>
            ) : (
              <p>Waiting for the owner to complete verification.</p>
            ))}
        </section>
      </div>
      {["VERIFIED", "RETURNED"].includes(v.status) && (
        <section className="chat-panel">
          <h2>
            <MessageCircle size={21} /> Secure conversation
          </h2>
          <p className="muted">
            Arrange a safe handover with the finder or staff.
          </p>
          {messages.error && (
            <div className="alert error">{messages.error.message}</div>
          )}
          <div className="chat-messages">
            {messages.data?.map((msg) => (
              <div className="message" key={msg.id}>
                <small>
                  {msg.sender_role || "Participant"} ·{" "}
                  {new Date(msg.created_at).toLocaleTimeString()}
                </small>
                {msg.image_url ? (
                  <img
                    className="chat-image"
                    src={msg.image_url}
                    alt="Shared item detail"
                  />
                ) : (
                  <p>{msg.message}</p>
                )}
              </div>
            ))}
            {!messages.data?.length && (
              <p className="muted">Start the conversation with a hello.</p>
            )}
          </div>
          {v.status === "VERIFIED" && (
            <form
              className="chat-compose"
              onSubmit={(e) => {
                e.preventDefault();
                const f = e.currentTarget;
                run("messages", {
                  message: new FormData(f).get("message"),
                }).then(() => f.reset());
              }}
            >
              <label className="chat-attach" aria-label="Attach image">
                ＋
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setBusy(true);
                    setError("");
                    try {
                      const fd = new FormData();
                      fd.append("image", file);
                      await api(`/matches/${id}/images`, {
                        method: "POST",
                        body: fd,
                      });
                      qc.invalidateQueries();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </label>
              <input
                name="message"
                placeholder="Write a message…"
                required
                maxLength={4000}
              />
              <button className="button primary" disabled={busy}>
                Send <ArrowUpRight size={16} />
              </button>
            </form>
          )}
        </section>
      )}
    </>
  );
}
function StaffDesk({ open }: { open: (id: string) => void }) {
  const qc = useQueryClient();
  const reports = useQuery<Report[]>({
    queryKey: ["staff-reports"],
    queryFn: () => api("/staff/reports"),
  });
  const matches = useQuery<Match[]>({
    queryKey: ["staff-matches"],
    queryFn: () => api("/staff/matches"),
  });
  const [error, setError] = useState(""),
    [storage, setStorage] = useState<Report | null>(null),
    [busy, setBusy] = useState(false);
  return (
    <>
      {error && <div className="alert error">{error}</div>}
      <div className="stats">
        <Stat
          icon={<Package />}
          label="Items in storage"
          value={String(
            reports.data?.filter((r) => r.status === "STORED").length || 0,
          )}
          hint="At your organization"
        />
        <Stat
          icon={<ShieldCheck />}
          label="Verified handovers"
          value={String(
            matches.data?.filter((m) => m.status === "VERIFIED").length || 0,
          )}
          hint="Ready to be returned"
        />
        <Stat
          icon={<CheckCircle2 />}
          label="Returned items"
          value={String(
            reports.data?.filter((r) => r.status === "RETURNED").length || 0,
          )}
          hint="Reunited with their owners"
        />
      </div>
      <section className="section">
        <h2>Ready for handover</h2>
        {matches.error && (
          <div className="alert error">{matches.error.message}</div>
        )}
        {matches.data
          ?.filter((m) => m.status === "VERIFIED")
          .map((m) => (
            <div className="handover" key={m.id}>
              <div>
                <b>{m.found?.item_name}</b>
                <p>Ownership verified · {m.found?.location_name}</p>
              </div>
              <button className="button subtle" onClick={() => open(m.id)}>
                Open conversation
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Confirm the physical item has been handed to the verified owner?",
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await api(`/matches/${m.id}/return`, { method: "POST" });
                    qc.invalidateQueries();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Check size={16} /> Confirm return
              </button>
            </div>
          ))}
        {!matches.data?.some((m) => m.status === "VERIFIED") && (
          <Empty
            icon={<ShieldCheck />}
            title="No handovers waiting"
            text="Verified claims will appear here when they’re ready for return."
          />
        )}
      </section>
      <section className="section">
        <h2>Organization reports</h2>
        {reports.error && (
          <div className="alert error">{reports.error.message}</div>
        )}
        {reports.isLoading ? (
          <Loading />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Storage</th>
                </tr>
              </thead>
              <tbody>
                {reports.data?.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.item_name}</b>
                      <small>
                        {r.category} · {r.color}
                      </small>
                    </td>
                    <td>{r.type}</td>
                    <td>{r.location_name}</td>
                    <td>
                      <span className="status">{r.status}</span>
                    </td>
                    <td>
                      {r.type === "FOUND" &&
                      ["FOUND", "STORED"].includes(r.status) ? (
                        <button
                          className="text-button"
                          onClick={() => setStorage(r)}
                        >
                          {r.storage_location || "Assign storage"}{" "}
                          <ArrowUpRight size={15} />
                        </button>
                      ) : (
                        r.storage_location || "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {storage && (
        <div className="modal-backdrop">
          <section className="modal small-modal">
            <h2>Store {storage.item_name}</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await api(`/staff/reports/${storage.id}/store`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      storage_location: new FormData(e.currentTarget).get(
                        "storage_location",
                      ),
                    }),
                  });
                  setStorage(null);
                  qc.invalidateQueries();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Storage point
                <input
                  name="storage_location"
                  required
                  maxLength={200}
                  defaultValue={storage.storage_location}
                />
              </label>
              <div className="hero-buttons">
                <button
                  type="button"
                  className="button subtle"
                  onClick={() => setStorage(null)}
                >
                  Cancel
                </button>
                <button className="button primary" disabled={busy}>
                  Save storage
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
