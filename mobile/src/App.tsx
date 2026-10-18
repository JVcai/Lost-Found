import React, { useEffect, useState } from "react";
import {
  Alert,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
  Modal,
  ActivityIndicator,
  Platform,
  AppState,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import * as Picker from "expo-image-picker";
import * as Manipulator from "expo-image-manipulator";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { categories, Report, Match } from "@lostnet/shared";
import { api, supabase, configured, useSession } from "./lib";
import { groupMatches, counterpart } from "./reportPresentation";
const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchInterval: 15000 } },
});
const Tab = createBottomTabNavigator();
const icons: Record<string, string> = {
  Home: "⌂",
  Reports: "▤",
  Matches: "◎",
  Notifications: "♧",
  Profile: "○",
};
const refresh = () => qc.invalidateQueries();
function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[s.button, secondary && s.secondary, disabled && { opacity: 0.5 }]}
    >
      <Text style={[s.buttonText, secondary && { color: "#247342" }]}>
        {title}
      </Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  set,
  secure = false,
  multiline = false,
  placeholder = "",
  keyboardType = "default",
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  secure?: boolean;
  multiline?: boolean;
  placeholder?: string;
  keyboardType?: any;
}) {
  return (
    <View style={{ marginBottom: 15 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[s.input, multiline && { height: 85, textAlignVertical: "top" }]}
        value={value}
        onChangeText={set}
        secureTextEntry={secure}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor="#98a59c"
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        keyboardType={keyboardType}
        maxLength={multiline ? 2000 : 200}
      />
    </View>
  );
}
function ErrorText({ error }: { error?: string }) {
  return error ? (
    <Text accessibilityRole="alert" style={s.error}>
      {error}
    </Text>
  ) : null;
}
function Page({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={s.page}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptySymbol}>◎</Text>
      <Text style={s.h3}>{title}</Text>
      <Text style={s.muted}>{text}</Text>
    </View>
  );
}
function Auth() {
  const [mode, setMode] = useState<"login" | "register" | "reset-password">(
      "login",
    ),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Page>
      <Text style={s.wordmark}>✳ Lost&Found</Text>
      <View style={{ height: 35 }} />
      <Text style={s.eyebrow}>GOOD THINGS FIND THEIR WAY BACK</Text>
      <Text style={s.h1}>
        {mode === "login"
          ? "Welcome back."
          : mode === "register"
            ? "Join your community."
            : "Reset your password."}
      </Text>
      <Text style={[s.muted, { marginBottom: 25 }]}>
        A little help. A meaningful reunion.
      </Text>
      {mode === "register" && (
        <Field label="Full name" value={name} set={setName} />
      )}
      <Field
        label="Email"
        value={email}
        set={setEmail}
        keyboardType="email-address"
      />
      {mode !== "reset-password" && (
        <Field label="Password" value={password} set={setPassword} secure />
      )}
      {mode === "register" && (
        <Field
          label="Confirm password"
          value={confirm}
          set={setConfirm}
          secure
        />
      )}
      <ErrorText error={error} />
      {!!notice && <Text style={s.notice}>{notice}</Text>}
      <Button
        title={
          busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in →"
              : mode === "register"
                ? "Create account →"
                : "Send reset link"
        }
        disabled={busy}
        onPress={async () => {
          setError("");
          setNotice("");
          setBusy(true);
          try {
            if (mode === "register" && password !== confirm)
              throw new Error("Passwords do not match");
            const r = await api(`/auth/${mode}`, {
              method: "POST",
              body: JSON.stringify({
                email: email.trim(),
                password,
                full_name: name,
              }),
            });
            if (mode === "reset-password") setNotice(r.message);
            else if (mode === "register" && !r.session)
              setNotice(
                "Check your email to verify your account, then sign in.",
              );
            else {
              const { error } = await supabase!.auth.setSession(
                mode === "register" ? r.session : r,
              );
              if (error) throw error;
            }
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button
        secondary
        title={mode === "login" ? "Create an account" : "Back to sign in"}
        onPress={() => {
          setMode(mode === "login" ? "register" : "login");
          setError("");
          setNotice("");
        }}
      />
      {mode === "login" && (
        <Button
          secondary
          title="Forgot password?"
          onPress={() => setMode("reset-password")}
        />
      )}
    </Page>
  );
}
function Item({ r, open }: { r: Report; open?: () => void }) {
  return (
    <Pressable disabled={!open} onPress={open} style={s.card}>
      {r.image_url ? (
        <Image source={{ uri: r.image_url }} style={s.itemImage} />
      ) : (
        <View
          style={[
            s.itemImage,
            { alignItems: "center", justifyContent: "center" },
          ]}
        >
          <Text style={{ fontSize: 40, color: "#9caf96" }}>▧</Text>
        </View>
      )}
      <View style={{ padding: 17 }}>
        <View style={s.row}>
          <Text style={s.eyebrow}>
            {r.type === "LOST" ? "Lost report" : "Found report"} · {r.category}
          </Text>
          <Text style={s.badge}>
            {(
              {
                MATCH_FOUND: "Possible match — unverified",
                ACTIVE: "Searching",
                FOUND: "Awaiting owner",
                VERIFYING: "Verifying owner",
                CLAIMED: "Owner verified",
                RETURNED: "Returned",
                STORED: "In storage",
                DRAFT: "Draft",
                CLOSED: "Closed",
              } as Record<string, string>
            )[r.status] || r.status}
          </Text>
        </View>
        <Text style={s.h3}>{r.item_name}</Text>
        <Text style={s.muted}>⌖ {r.location_name}</Text>
        <Text style={s.small}>
          {new Date(r.event_at).toLocaleDateString()} · {r.color}
        </Text>
      </View>
    </Pressable>
  );
}
function Home() {
  const [type, setType] = useState<"LOST" | "FOUND" | null>(null),
    [search, setSearch] = useState(""),
    [selectedFound, setSelectedFound] = useState<Report | null>(null);
  const reports = useQuery<Report[]>({
    queryKey: ["public", search],
    queryFn: () => api("/reports/search?" + new URLSearchParams({ q: search })),
  });
  return (
    <Page>
      <Text style={s.eyebrow}>A PLACE FOR SECOND CHANCES</Text>
      <Text style={s.h1}>Let’s bring things home.</Text>
      <View style={s.hero}>
        <Text style={s.heroLabel}>LOST THINGS. NEW CONNECTIONS.</Text>
        <Text style={s.heroTitle}>
          Sometimes, all it takes{"\n"}is someone like you.
        </Text>
        <Text style={s.heroText}>
          Connect with your community and help the things that matter find their
          way back.
        </Text>
        <Button
          title="⌕  I lost something  ↗"
          onPress={() => setType("LOST")}
        />
        <Button
          secondary
          title="＋  I found something"
          onPress={() => setType("FOUND")}
        />
        <Text style={s.heroFoot}>
          ✓ Private details. Verified owners. Safer returns.
        </Text>
      </View>
      <Text style={s.h2}>Around the community</Text>
      <Text style={s.muted}>Recently found. Waiting to be recognized.</Text>
      <TextInput
        accessibilityLabel="Search found items"
        style={[s.input, { marginVertical: 17 }]}
        placeholder="Search found items…"
        value={search}
        onChangeText={setSearch}
      />
      <ErrorText error={reports.error?.message} />
      {reports.isLoading ? (
        <ActivityIndicator color="#16a34a" />
      ) : reports.data?.length ? (
        reports.data.map((r) => (
          <Item key={r.id} r={r} open={() => setSelectedFound(r)} />
        ))
      ) : (
        <Empty
          title="Nothing here just yet"
          text="Found items will appear as your community shares them."
        />
      )}
      {selectedFound && (
        <FoundItem
          report={selectedFound}
          close={() => setSelectedFound(null)}
        />
      )}
      {type && <ReportForm type={type} close={() => setType(null)} />}
    </Page>
  );
}
function FoundItem({ report, close }: { report: Report; close: () => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [matchId, setMatchId] = useState<string | null>(null);
  const own = useQuery<Report[]>({
    queryKey: ["reports"],
    queryFn: () => api("/reports/my"),
  });
  const choices =
    own.data?.filter(
      (r) => r.type === "LOST" && ["ACTIVE", "MATCH_FOUND"].includes(r.status),
    ) || [];
  const isOwn = own.data?.some((r) => r.id === report.id);
  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1 }}>
        <Page>
          <Button secondary title="← Back" onPress={close} />
          <Item r={report} />
          <Text style={s.h2}>This might be mine</Text>
          <Text style={s.muted}>
            Choose your lost report. You will still need to answer the finder's
            private ownership question before a return can be arranged.
          </Text>
          <ErrorText error={error || own.error?.message} />
          {own.isLoading && <ActivityIndicator />}
          {isOwn ? (
            <Text style={s.notice}>This is your own found report.</Text>
          ) : (
            choices.map((r) => (
              <Button
                key={r.id}
                title={`This may be my ${r.item_name}`}
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const out = await api(`/reports/${report.id}/claim`, {
                      method: "POST",
                      body: JSON.stringify({ lost_report_id: r.id }),
                    });
                    refresh();
                    setMatchId(out.match_id);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            ))
          )}
          {!own.isLoading && !isOwn && !choices.length && (
            <Text style={s.notice}>
              Create and publish a lost report in Reports first, then return
              here to select it.
            </Text>
          )}
          {matchId && (
            <MatchScreen
              id={matchId}
              close={() => {
                setMatchId(null);
                close();
              }}
            />
          )}
        </Page>
      </SafeAreaView>
    </Modal>
  );
}
function MatchingDiagnostics({ id }: { id: string }) {
  const [checking, setChecking] = useState(false),
    [checkResult, setCheckResult] = useState("");
  const d = useQuery<any>({
    queryKey: ["diagnostics", id],
    queryFn: () => api(`/reports/${id}/diagnostics`),
    refetchInterval: 5000,
  });
  return (
    <View style={s.verification}>
      <Text style={s.h3}>Analysis and matching</Text>
      <ErrorText error={d.error?.message} />
      {d.isLoading && <ActivityIndicator />}
      {d.data && (
        <>
          <Text style={s.muted}>
            Gemini:{" "}
            {d.data.gemini_configured
              ? d.data.ai_state === "DONE"
                ? "analysis completed"
                : d.data.ai_state || "waiting"
              : "not configured on the API server"}
          </Text>
          <Text style={s.muted}>
            Search job: {d.data.job?.state || "not queued"}
          </Text>
          <Text style={s.muted}>
            Matching compares name, color and description. Only similarity above
            75% creates an automatic suggestion.
          </Text>
          {(d.data.ai_error || d.data.job?.last_error) && (
            <Text style={s.notice}>
              {d.data.ai_error || d.data.job.last_error}
            </Text>
          )}
          <Button
            secondary
            title={checking ? "Checking Gemini…" : "Check Gemini API"}
            disabled={checking}
            onPress={async () => {
              setChecking(true);
              setCheckResult("");
              try {
                const out = await api("/ai/check", { method: "POST" });
                setCheckResult(`${out.message} Model: ${out.model}`);
              } catch (e) {
                setCheckResult((e as Error).message);
              } finally {
                setChecking(false);
              }
            }}
          />
          {checkResult ? <Text style={s.notice}>{checkResult}</Text> : null}
          {d.data.candidates.map((c: any) => (
            <View key={c.report.id} style={{ marginTop: 12 }}>
              <Text style={s.h3}>{c.report.item_name}</Text>
              <Text style={s.muted}>
                {c.reasons.length
                  ? c.reasons.join("\n")
                  : c.match_status
                    ? `Match: ${c.match_status}`
                    : "Eligible. Run Recheck matches and wait for the search job to finish."}
              </Text>
            </View>
          ))}
          {!d.data.candidates.length && (
            <Text style={s.muted}>
              No available found reports from other accounts in the latest 100
              reports, or this is a found report.
            </Text>
          )}
        </>
      )}
    </View>
  );
}
function Reports() {
  const [type, setType] = useState<"LOST" | "FOUND" | null>(null),
    [error, setError] = useState("");
  const data = useQuery<Report[]>({
    queryKey: ["reports"],
    queryFn: () => api("/reports/my"),
  });
  return (
    <Page>
      <Text style={s.h1}>My reports</Text>
      <Text style={s.muted}>Every detail is a step closer to home.</Text>
      <View style={s.row}>
        <Button title="＋ Lost item" onPress={() => setType("LOST")} />
        <Button
          secondary
          title="＋ Found item"
          onPress={() => setType("FOUND")}
        />
      </View>
      <ErrorText error={data.error?.message || error} />
      {data.isLoading ? (
        <ActivityIndicator />
      ) : data.data?.length ? (
        data.data.map((r) => (
          <View key={r.id}>
            <Item r={r} />
            <MobileReportTools report={r} />
            {r.status === "DRAFT" && (
              <Button
                secondary
                title="Publish draft"
                onPress={async () => {
                  try {
                    await api(`/reports/${r.id}/publish`, { method: "POST" });
                    refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
            )}
          </View>
        ))
      ) : (
        <Empty
          title="Your story starts here"
          text="Create your first report and let your community help."
        />
      )}
      {type && <ReportForm type={type} close={() => setType(null)} />}
    </Page>
  );
}

function MobileReportTools({ report: r }: { report: Report }) {
  const [edit, setEdit] = useState(false),
    [diagnose, setDiagnose] = useState(false),
    [name, setName] = useState(r.item_name),
    [color, setColor] = useState(r.color),
    [description, setDescription] = useState(r.ai_description || r.description),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <ErrorText error={error} />
      {r.status !== "DRAFT" && (
        <Button
          secondary
          title={
            diagnose ? "Hide matching details" : "Why no match? / Gemini status"
          }
          onPress={() => setDiagnose(!diagnose)}
        />
      )}
      {diagnose && <MatchingDiagnostics id={r.id} />}
      {r.ai_description && <Text style={s.notice}>{r.ai_description}</Text>}
      {r.status === "DRAFT" && (
        <Button
          secondary
          title="Add a draft photo"
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            setError("");
            try {
              const permission =
                await Picker.requestMediaLibraryPermissionsAsync();
              if (!permission.granted)
                throw new Error("Photo permission denied");
              const picked = await Picker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                quality: 0.8,
              });
              if (picked.canceled) return;
              if ((picked.assets[0].fileSize || 0) > 10485760)
                throw new Error("Choose a photo up to 10 MB");
              const out = await Manipulator.manipulateAsync(
                picked.assets[0].uri,
                [{ resize: { width: 1600 } }],
                { compress: 0.8, format: Manipulator.SaveFormat.JPEG },
              );
              const fd = new FormData();
              fd.append("image", {
                uri: out.uri,
                name: "item.jpg",
                type: "image/jpeg",
              } as any);
              await api(`/reports/${r.id}/images`, {
                method: "POST",
                body: fd,
              });
              refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {!["CLOSED", "RETURNED"].includes(r.status) && (
        <Button
          secondary
          title={r.status === "DRAFT" ? "Edit draft" : "Review AI description"}
          onPress={() => setEdit(true)}
        />
      )}
      {["ACTIVE", "FOUND", "STORED", "MATCH_FOUND"].includes(r.status) && (
        <Button
          secondary
          title="Recheck matches"
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            setError("");
            try {
              await api(`/reports/${r.id}/recheck`, { method: "POST" });
              Alert.alert(
                "Search queued",
                "Check Matches shortly. Automatic suggestions require more than 75% similarity in name, color and description.",
              );
              refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {edit && (
        <Modal
          visible
          animationType="slide"
          onRequestClose={() => setEdit(false)}
        >
          <SafeAreaView style={{ flex: 1 }}>
            <Page>
              <Text style={s.h1}>Review your details</Text>
              {r.status === "DRAFT" && (
                <>
                  <Field label="Item name" value={name} set={setName} />
                  <Field label="Color" value={color} set={setColor} />
                </>
              )}
              <Field
                label="Description"
                value={description}
                set={setDescription}
                multiline
              />
              <ErrorText error={error} />
              <Button
                title="Save changes"
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await api(
                      `/reports/${r.id}${r.status === "DRAFT" ? "" : "/ai-description"}`,
                      {
                        method: "PATCH",
                        body: JSON.stringify(
                          r.status === "DRAFT"
                            ? { ...r, item_name: name, color, description }
                            : { ai_description: description },
                        ),
                      },
                    );
                    setEdit(false);
                    refresh();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              <Button secondary title="Cancel" onPress={() => setEdit(false)} />
            </Page>
          </SafeAreaView>
        </Modal>
      )}
    </>
  );
}
function Matches() {
  const [id, setId] = useState<string | null>(null);
  const data = useQuery<Match[]>({
    queryKey: ["matches"],
    queryFn: () => api("/matches"),
  });
  return (
    <Page>
      <Text style={s.h1}>Possible matches</Text>
      <Text style={s.muted}>A familiar detail could be a new beginning.</Text>
      <ErrorText error={data.error?.message} />
      {data.isLoading ? (
        <ActivityIndicator />
      ) : data.data?.length ? (
        Object.entries(groupMatches(data.data)).map(([own, items]) => (
          <View key={own}>
            <Text style={s.h2}>
              Your {items[0].viewer_is_owner ? "lost" : "found"} report:{" "}
              {
                (items[0].viewer_is_owner ? items[0].lost : items[0].found)
                  ?.item_name
              }
            </Text>
            <Text style={s.muted}>
              {items.length} possible counterpart{items.length === 1 ? "" : "s"}{" "}
              · these are suggestions, not confirmed returns
            </Text>
            {items.map((m) => (
              <View key={m.id}>
                <Text
                  style={[s.badge, { alignSelf: "flex-start", marginTop: 20 }]}
                >
                  {m.source === "MANUAL"
                    ? "User requested claim"
                    : `${Number(m.total_score.toFixed(2))}% similarity`}{" "}
                  ·{" "}
                  {m.status === "PROPOSED" ? "Unverified suggestion" : m.status}
                </Text>
                <Text style={s.small}>Compared with your report above</Text>
                <Item r={counterpart(m)!} open={() => setId(m.id)} />
              </View>
            ))}
          </View>
        ))
      ) : (
        <Empty
          title="Looking for the right connection"
          text="We’ll compare new items with your active reports."
        />
      )}
      {id && <MatchScreen id={id} close={() => setId(null)} />}
    </Page>
  );
}
function Inbox() {
  const [id, setId] = useState<string | null>(null),
    [error, setError] = useState("");
  const q = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: () => api("/notifications"),
  });
  return (
    <Page>
      <Text style={s.h1}>Notifications</Text>
      <ErrorText error={q.error?.message || error} />
      {q.data?.length ? (
        q.data.map((n) => (
          <Pressable
            key={n.id}
            style={[
              s.card,
              { padding: 18, backgroundColor: n.read ? "white" : "#eef8e9" },
            ]}
            onPress={async () => {
              try {
                await api(`/notifications/${n.id}/read`, { method: "PATCH" });
                refresh();
                if (n.data.match_id) setId(n.data.match_id);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Text style={s.h3}>{n.title}</Text>
            <Text style={s.muted}>{n.message}</Text>
            <Text style={s.small}>
              {new Date(n.created_at).toLocaleString()}
            </Text>
          </Pressable>
        ))
      ) : q.isLoading ? (
        <ActivityIndicator />
      ) : (
        <Empty
          title="You’re all caught up"
          text="New matches and updates will appear here."
        />
      )}
      {id && <MatchScreen id={id} close={() => setId(null)} />}
    </Page>
  );
}
function Profile() {
  const q = useQuery<any>({ queryKey: ["me"], queryFn: () => api("/me") });
  const [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [staffOpen, setStaffOpen] = useState(false);
  return (
    <Page>
      <Text style={s.h1}>Your profile</Text>
      <View style={[s.card, { padding: 24 }]}>
        <Text style={s.h2}>{q.data?.full_name || "Community member"}</Text>
        <Text style={s.muted}>{useSession.getState().session?.user.email}</Text>
        <Text style={s.badge}>
          {q.data?.memberships?.length
            ? "ORGANIZATION STAFF"
            : q.data?.role || "USER"}
        </Text>
      </View>
      <Text style={s.h2}>Stay connected</Text>
      <Text style={s.muted}>
        Enable push notifications for strong matches. Requires a physical device
        and an EAS development build.
      </Text>
      <Button
        secondary
        title="Enable push notifications"
        onPress={async () => {
          setError("");
          try {
            if (!Device.isDevice)
              throw new Error("Use a physical iOS or Android device");
            if (Platform.OS === "android")
              await Notifications.setNotificationChannelAsync("default", {
                name: "Matches",
                importance: Notifications.AndroidImportance.HIGH,
              });
            const p = await Notifications.requestPermissionsAsync();
            if (p.status !== "granted")
              throw new Error("Notification permission was not granted");
            const projectId =
              Constants.expoConfig?.extra?.eas?.projectId ||
              Constants.easConfig?.projectId;
            if (!projectId)
              throw new Error("Configure an EAS project ID first");
            const token = await Notifications.getExpoPushTokenAsync({
              projectId,
            });
            await api("/push-tokens", {
              method: "POST",
              body: JSON.stringify({ token: token.data }),
            });
            setNotice("Push notifications enabled");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />
      {(q.data?.memberships?.length > 0 ||
        q.data?.role === "PLATFORM_ADMIN") && (
        <Button
          secondary
          title="Staff desk"
          onPress={() => setStaffOpen(true)}
        />
      )}
      {staffOpen && <MobileStaffDesk close={() => setStaffOpen(false)} />}
      <ErrorText error={q.error?.message || error} />
      {!!notice && <Text style={s.notice}>{notice}</Text>}
      <Button
        title="Sign out"
        onPress={async () => {
          try {
            await api("/auth/logout", { method: "POST" });
            await supabase?.auth.signOut();
            qc.clear();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />
    </Page>
  );
}
function MobileStaffDesk({ close }: { close: () => void }) {
  const reports = useQuery<Report[]>({
    queryKey: ["staff-reports"],
    queryFn: () => api("/staff/reports"),
  });
  const matches = useQuery<Match[]>({
    queryKey: ["staff-matches"],
    queryFn: () => api("/staff/matches"),
  });
  const [selected, setSelected] = useState<string | null>(null),
    [storage, setStorage] = useState<Report | null>(null),
    [point, setPoint] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [handover, setHandover] = useState<Match | null>(null);
  const run = async (path: string, body: any, method = "POST") => {
    setBusy(true);
    setError("");
    try {
      await api(path, { method, body: JSON.stringify(body) });
      await refresh();
      setStorage(null);
      setHandover(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8fa" }}>
        <Page>
          <Button secondary title="← Back to profile" onPress={close} />
          <Text style={s.h1}>Staff desk</Text>
          <ErrorText
            error={reports.error?.message || matches.error?.message || error}
          />
          <Text style={s.h2}>Ready for handover</Text>
          {matches.isLoading && <ActivityIndicator />}
          {matches.data
            ?.filter((m) => m.status === "VERIFIED")
            .map((m) => (
              <View style={[s.card, { padding: 18 }]} key={m.id}>
                <Text style={s.h3}>{m.found?.item_name}</Text>
                <Text style={s.muted}>
                  {m.found?.location_name} · Ownership verified
                </Text>
                <Button
                  secondary
                  title="Open conversation"
                  onPress={() => setSelected(m.id)}
                />
                <Button
                  title="Confirm physical return"
                  disabled={busy}
                  onPress={() => setHandover(m)}
                />
              </View>
            ))}
          {matches.data &&
            !matches.data.some((m) => m.status === "VERIFIED") && (
              <Text style={s.muted}>No verified handovers waiting.</Text>
            )}
          {handover && (
            <View style={s.verification}>
              <Text style={s.h3}>
                Has the item been handed to its verified owner?
              </Text>
              <Text style={s.muted}>
                This marks both reports returned and makes the conversation
                read-only.
              </Text>
              <Button
                title="Yes, item returned"
                disabled={busy}
                onPress={() => run(`/matches/${handover.id}/return`, {})}
              />
              <Button
                secondary
                title="Cancel handover"
                disabled={busy}
                onPress={() => setHandover(null)}
              />
            </View>
          )}
          <Text style={s.h2}>Organization reports</Text>
          {reports.isLoading && <ActivityIndicator />}
          {reports.data?.map((r) => (
            <View key={r.id}>
              <Item r={r} />
              {r.storage_location && (
                <Text style={s.muted}>Storage: {r.storage_location}</Text>
              )}
              {r.type === "FOUND" && ["FOUND", "STORED"].includes(r.status) && (
                <Button
                  secondary
                  title="Assign storage"
                  onPress={() => {
                    setStorage(r);
                    setPoint(r.storage_location || "");
                  }}
                />
              )}
              {storage?.id === r.id && (
                <View style={s.verification}>
                  <Field label="Storage point" value={point} set={setPoint} />
                  <Button
                    title="Save storage"
                    disabled={busy || !point.trim()}
                    onPress={() =>
                      run(
                        `/staff/reports/${r.id}/store`,
                        { storage_location: point },
                        "PATCH",
                      )
                    }
                  />
                  <Button
                    secondary
                    title="Cancel storage"
                    onPress={() => setStorage(null)}
                  />
                </View>
              )}
            </View>
          ))}
          {reports.data?.length === 0 && (
            <Empty
              title="No organization reports"
              text="Reports at your organization's locations will appear here."
            />
          )}
          {selected && (
            <MatchScreen id={selected} close={() => setSelected(null)} />
          )}
        </Page>
      </SafeAreaView>
    </Modal>
  );
}
function ReportForm({
  type,
  close,
}: {
  type: "LOST" | "FOUND";
  close: () => void;
}) {
  const [name, setName] = useState(""),
    [category, setCategory] = useState<string>(categories[0]),
    [brand, setBrand] = useState(""),
    [color, setColor] = useState(""),
    [description, setDescription] = useState(""),
    [features, setFeatures] = useState(""),
    [location, setLocation] = useState(""),
    [locationLabel, setLocationLabel] = useState(""),
    [gpsBusy, setGpsBusy] = useState(false),
    [date, setDate] = useState(new Date().toISOString().slice(0, 16) + "Z"),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState(""),
    [image, setImage] = useState<string | null>(null),
    [gps, setGps] = useState<
      { latitude: number; longitude: number } | undefined
    >(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [draft, setDraft] = useState<string | null>(null),
    [uploaded, setUploaded] = useState(false),
    [success, setSuccess] = useState(false);
  const locations = useQuery<any[]>({
    queryKey: ["locations"],
    queryFn: () => api("/locations"),
  });
  const pick = async (camera: boolean) => {
    try {
      const permission = camera
        ? await Picker.requestCameraPermissionsAsync()
        : await Picker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error("Photo permission is required");
      const r = camera
        ? await Picker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.85,
          })
        : await Picker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.85,
          });
      if (!r.canceled) {
        if ((r.assets[0].fileSize || 0) > 10485760)
          throw new Error("Choose a photo smaller than 10 MB");
        const out = await Manipulator.manipulateAsync(
          r.assets[0].uri,
          [{ resize: { width: 1600 } }],
          { compress: 0.8, format: Manipulator.SaveFormat.JPEG },
        );
        setImage(out.uri);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => !busy && close()}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8fa" }}>
        <Page>
          {success ? (
            <>
              <Text style={s.emptySymbol}>✓</Text>
              <Text style={s.h1}>
                {type === "FOUND"
                  ? "Thank you for looking out."
                  : "We’re on the lookout."}
              </Text>
              <Text style={s.muted}>
                {type === "FOUND"
                  ? "Your found report has been received. Lost&Found will compare it with active lost reports."
                  : "Your lost report is saved. New matches will appear in your inbox."}
              </Text>
              <Button title="Back to my community" onPress={close} />
            </>
          ) : (
            <>
              <Button
                secondary
                title="← Back"
                onPress={close}
                disabled={busy}
              />
              <Text style={s.eyebrow}>
                {type === "LOST"
                  ? "LET’S FIND IT TOGETHER"
                  : "A LITTLE HELP GOES A LONG WAY"}
              </Text>
              <Text style={s.h1}>Report a {type.toLowerCase()} item</Text>
              <View
                pointerEvents={busy || draft ? "none" : "auto"}
                style={draft ? { opacity: 0.6 } : undefined}
              >
                <Field
                  label="Item name *"
                  value={name}
                  set={setName}
                  placeholder="Black Nike backpack"
                />
                <Text style={s.label}>Category *</Text>
                <View style={s.chips}>
                  {categories.map((c) => (
                    <Pressable
                      key={c}
                      style={[s.chip, category === c && s.chipActive]}
                      onPress={() => setCategory(c)}
                    >
                      <Text
                        style={category === c ? { color: "#16823e" } : s.small}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Field label="Color *" value={color} set={setColor} />
                <Field label="Brand" value={brand} set={setBrand} />
                <Field
                  label="Description"
                  value={description}
                  set={setDescription}
                  multiline
                />
                <Field
                  label="Unique features (private, comma separated)"
                  value={features}
                  set={setFeatures}
                />
                <Text style={s.label}>Location *</Text>
                {locations.data?.map((l) => (
                  <Pressable
                    key={l.id}
                    style={[s.location, location === l.id && s.chipActive]}
                    disabled={gpsBusy}
                    onPress={() => {
                      setLocation(l.id);
                      setGps(undefined);
                      setLocationLabel("");
                    }}
                  >
                    <Text>
                      {location === l.id ? "●" : "○"} {l.name}
                    </Text>
                  </Pressable>
                ))}
                <ErrorText error={locations.error?.message} />
                {locations.data?.length === 0 && (
                  <Text style={s.error}>
                    No registered locations. Use GPS to report your actual area.
                  </Text>
                )}
                <Button
                  secondary
                  disabled={gpsBusy}
                  title={
                    gpsBusy
                      ? "Getting current position…"
                      : gps
                        ? "✓ Using GPS — no venue selection needed"
                        : "Use my current GPS location"
                  }
                  onPress={async () => {
                    setGpsBusy(true);
                    setError("");
                    try {
                      const p =
                        await Location.requestForegroundPermissionsAsync();
                      if (p.status !== "granted")
                        throw new Error(
                          "Location permission denied. Choose a registered place or enable permission in settings.",
                        );
                      if (!(await Location.hasServicesEnabledAsync()))
                        throw new Error(
                          "Enable location services on your phone.",
                        );
                      const r = await Promise.race([
                        Location.getCurrentPositionAsync({
                          accuracy: Location.Accuracy.High,
                        }),
                        new Promise<never>((_, reject) =>
                          setTimeout(
                            () =>
                              reject(
                                new Error(
                                  "GPS timed out. Move outdoors and try again.",
                                ),
                              ),
                            20000,
                          ),
                        ),
                      ]);
                      setGps({
                        latitude: r.coords.latitude,
                        longitude: r.coords.longitude,
                      });
                      setLocation("");
                      setLocationLabel("GPS area");
                      try {
                        const addresses = await Promise.race([
                          Location.reverseGeocodeAsync({
                            latitude: r.coords.latitude,
                            longitude: r.coords.longitude,
                          }),
                          new Promise<Location.LocationGeocodedAddress[]>(
                            (resolve) => setTimeout(() => resolve([]), 4000),
                          ),
                        ]);
                        const first = addresses[0];
                        if (first)
                          setLocationLabel(
                            [first.city, first.district]
                              .filter(Boolean)
                              .join(", ") || "GPS area",
                          );
                      } catch {
                        /* Coordinates remain usable without reverse geocoding. */
                      }
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setGpsBusy(false);
                    }
                  }}
                />
                {gps && (
                  <View style={s.verification}>
                    <Text style={s.muted}>
                      Selected GPS: {gps.latitude.toFixed(5)},{" "}
                      {gps.longitude.toFixed(5)}. These coordinates are not
                      shown publicly.
                    </Text>
                    <Field
                      label="Area / landmark (public, no exact address)"
                      value={locationLabel}
                      set={setLocationLabel}
                    />
                    <Button
                      secondary
                      title="Remove GPS"
                      onPress={() => {
                        setGps(undefined);
                        setLocationLabel("");
                      }}
                    />
                  </View>
                )}
                <Field
                  label="Date and time * (ISO, e.g. 2026-10-18T10:30:00+05:45)"
                  value={date}
                  set={setDate}
                />
                {type === "FOUND" && (
                  <View style={s.verification}>
                    <Text style={s.h3}>Keep a detail just for the owner</Text>
                    <Text style={s.muted}>
                      Do not reveal this answer in public names or photos.
                    </Text>
                    <Field
                      label="Private verification question *"
                      value={question}
                      set={setQuestion}
                    />
                    <Field
                      label="Expected answer *"
                      value={answer}
                      set={setAnswer}
                      secure
                    />
                  </View>
                )}
                <Text style={s.label}>
                  Photo{type === "FOUND" ? " *" : " (optional)"}
                </Text>
                {image && (
                  <Image
                    source={{ uri: image }}
                    style={[s.itemImage, { borderRadius: 10 }]}
                  />
                )}
                <View style={s.row}>
                  <Button
                    secondary
                    title="Choose photo"
                    onPress={() => pick(false)}
                  />
                  <Button
                    secondary
                    title="Take photo"
                    onPress={() => pick(true)}
                  />
                </View>
              </View>
              <ErrorText error={error} />
              {draft && (
                <Text style={s.notice}>
                  Your draft is saved. Retry to continue uploading and
                  publishing.
                </Text>
              )}
              <Button
                title={
                  busy
                    ? "Saving…"
                    : draft
                      ? "Continue publishing"
                      : "Submit report →"
                }
                disabled={busy || gpsBusy}
                onPress={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    if (type === "FOUND" && !image)
                      throw new Error("Add a photo of the found item");
                    if (!date || !Number.isFinite(Date.parse(date)))
                      throw new Error("Enter a valid date and time");
                    let id = draft;
                    if (!id) {
                      const r = await api("/reports", {
                        method: "POST",
                        body: JSON.stringify({
                          type,
                          item_name: name,
                          category,
                          brand,
                          color,
                          description,
                          unique_features: features
                            .split(",")
                            .map((v) => v.trim())
                            .filter(Boolean),
                          location_id: location || null,
                          location_label: locationLabel,
                          event_at: new Date(date).toISOString(),
                          ...gps,
                          ...(type === "FOUND"
                            ? {
                                verification_question: question,
                                verification_answer: answer,
                              }
                            : {}),
                        }),
                      });
                      id = r.id;
                      setDraft(id);
                    }
                    if (image && !uploaded) {
                      const fd = new FormData();
                      fd.append("image", {
                        uri: image,
                        name: "item.jpg",
                        type: "image/jpeg",
                      } as any);
                      await api(`/reports/${id}/images`, {
                        method: "POST",
                        body: fd,
                      });
                      setUploaded(true);
                    }
                    await api(`/reports/${id}/publish`, { method: "POST" });
                    refresh();
                    setSuccess(true);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </>
          )}
        </Page>
      </SafeAreaView>
    </Modal>
  );
}
function MatchScreen({ id, close }: { id: string; close: () => void }) {
  const m = useQuery<Match>({
    queryKey: ["match", id],
    queryFn: () => api(`/matches/${id}`),
  });
  const challenge = useQuery<any>({
    queryKey: ["challenge", id],
    queryFn: () => api(`/matches/${id}/challenge`),
    enabled: m.data?.status === "VERIFYING",
    retry: false,
  });
  const msgs = useQuery<any[]>({
    queryKey: ["messages", id],
    queryFn: () => api(`/matches/${id}/messages`),
    enabled: ["VERIFIED", "RETURNED"].includes(m.data?.status || ""),
    refetchInterval: 4000,
  });
  const [answer, setAnswer] = useState(""),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const run = async (path: string, body?: any) => {
    setBusy(true);
    setError("");
    try {
      await api(`/matches/${id}/${path}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      refresh();
      if (path === "messages") setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const v = m.data;
  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8fa" }}>
        <Page>
          <Button secondary title="← Back to matches" onPress={close} />
          <ErrorText error={m.error?.message || error} />
          {!v ? (
            <ActivityIndicator />
          ) : (
            <>
              <Text style={s.h1}>
                {v.source === "MANUAL"
                  ? "Ownership claim"
                  : `${Number(v.total_score.toFixed(2))}% match`}
              </Text>
              <Text style={s.muted}>A suggestion, not proof of ownership.</Text>
              <Text style={s.small}>
                Your {v.viewer_is_owner ? "lost" : "found"} report:{" "}
                {(v.viewer_is_owner ? v.lost : v.found)?.item_name}
              </Text>
              <Item r={(v.viewer_is_owner ? v.found : v.lost)!} />
              <View style={[s.card, { padding: 20 }]}>
                {[
                  ...(v.score_version === 2
                    ? [
                        ["Name", v.visual_score, null],
                        ["Description", v.location_score, null],
                        ["Color", v.time_score, null],
                      ]
                    : [
                        ["Visual / text", v.visual_score, 40],
                        ["Location", v.location_score, 30],
                        ["Time", v.time_score, 20],
                        ["Unique features", v.feature_score, 10],
                      ]),
                ].map(([label, n, max]) => (
                  <View
                    style={[
                      s.row,
                      { justifyContent: "space-between", marginVertical: 8 },
                    ]}
                    key={String(label)}
                  >
                    <Text>{label}</Text>
                    <Text style={{ fontWeight: "700" }}>
                      {n}
                      {max ? ` / ${max}` : " points"}
                    </Text>
                  </View>
                ))}
              </View>
              {v.status === "PROPOSED" && v.viewer_is_owner && (
                <>
                  <Button
                    title="This could be mine →"
                    disabled={busy}
                    onPress={() => run("confirm")}
                  />
                  <Button
                    secondary
                    title="Not a match"
                    disabled={busy}
                    onPress={() => run("reject")}
                  />
                </>
              )}
              {v.status === "VERIFYING" &&
                (challenge.data ? (
                  <View style={s.verification}>
                    <Text style={s.h2}>Verify ownership</Text>
                    <Field
                      label={challenge.data.question}
                      value={answer}
                      set={setAnswer}
                    />
                    <Text style={s.small}>
                      Maximum 5 attempts. Answers are case insensitive.
                    </Text>
                    <Button
                      title="Verify and open chat"
                      disabled={busy}
                      onPress={() => run("verify", { answer })}
                    />
                  </View>
                ) : (
                  <Text style={s.notice}>Waiting for the owner to verify.</Text>
                ))}
              {["VERIFIED", "RETURNED"].includes(v.status) && (
                <>
                  <Text style={s.h2}>Secure conversation</Text>
                  <ErrorText error={msgs.error?.message} />
                  {msgs.data?.map((msg) => (
                    <View style={[s.card, { padding: 15 }]} key={msg.id}>
                      <Text style={s.small}>
                        {msg.sender_id ===
                        useSession.getState().session?.user.id
                          ? "You"
                          : "Other participant"}{" "}
                        · {new Date(msg.created_at).toLocaleTimeString()}
                      </Text>
                      {msg.image_url ? (
                        <Image
                          source={{ uri: msg.image_url }}
                          style={[
                            s.itemImage,
                            { borderRadius: 8, marginTop: 10 },
                          ]}
                        />
                      ) : (
                        <Text style={{ lineHeight: 23, marginTop: 5 }}>
                          {msg.message}
                        </Text>
                      )}
                    </View>
                  ))}
                  {v.status === "VERIFIED" && (
                    <>
                      <Button
                        secondary
                        title="Attach a photo"
                        disabled={busy}
                        onPress={async () => {
                          setBusy(true);
                          setError("");
                          try {
                            const permission =
                              await Picker.requestMediaLibraryPermissionsAsync();
                            if (!permission.granted)
                              throw new Error("Photo permission denied");
                            const picked = await Picker.launchImageLibraryAsync(
                              { mediaTypes: ["images"], quality: 0.8 },
                            );
                            if (picked.canceled) return;
                            if ((picked.assets[0].fileSize || 0) > 10485760)
                              throw new Error("Choose a photo up to 10 MB");
                            const out = await Manipulator.manipulateAsync(
                              picked.assets[0].uri,
                              [{ resize: { width: 1600 } }],
                              {
                                compress: 0.8,
                                format: Manipulator.SaveFormat.JPEG,
                              },
                            );
                            const fd = new FormData();
                            fd.append("image", {
                              uri: out.uri,
                              name: "chat.jpg",
                              type: "image/jpeg",
                            } as any);
                            await api(`/matches/${id}/images`, {
                              method: "POST",
                              body: fd,
                            });
                            refresh();
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      />
                      <Field
                        label="Your message"
                        value={text}
                        set={setText}
                        multiline
                      />
                      <Button
                        title="Send message →"
                        disabled={busy || !text.trim()}
                        onPress={() => run("messages", { message: text })}
                      />
                    </>
                  )}
                  {v.status === "RETURNED" && (
                    <Text style={s.notice}>
                      ✓ This item has been safely returned.
                    </Text>
                  )}
                </>
              )}
            </>
          )}
        </Page>
      </SafeAreaView>
    </Modal>
  );
}
function Root() {
  const { session, setSession } = useSession();
  const [loaded, setLoaded] = useState(!configured);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, v) => {
      setSession(v);
      qc.clear();
    });
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase?.auth.startAutoRefresh();
      else supabase?.auth.stopAutoRefresh();
    });
    return () => {
      data.subscription.unsubscribe();
      sub.remove();
    };
  }, []);
  if (!configured)
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <Page>
          <Text style={s.wordmark}>✳ Lost&Found</Text>
          <View style={{ height: 50 }} />
          <Text style={s.h1}>A home for everything that’s missing.</Text>
          <Text style={s.muted}>
            Connect your Supabase project to get started. Follow README.md and
            set mobile/.env with the public Supabase URL, anon key, and API URL.
            Server keys stay on the backend.
          </Text>
          <View style={s.verification}>
            <Text style={s.h3}>Private by design</Text>
            <Text style={s.muted}>
              Verified owners. Secure conversations. Meaningful reunions.
            </Text>
          </View>
        </Page>
      </SafeAreaView>
    );
  if (!loaded)
    return (
      <View style={s.empty}>
        <ActivityIndicator color="#16a34a" />
      </View>
    );
  if (!session)
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <Auth />
      </SafeAreaView>
    );
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerTitle: "✳ Lost&Found",
          headerTitleStyle: {
            fontWeight: "800",
            color: "#196137",
            fontSize: 24,
          },
          headerStyle: { backgroundColor: "#fff" },
          tabBarActiveTintColor: "#168c4b",
          tabBarInactiveTintColor: "#87918a",
          tabBarStyle: { borderTopColor: "#e7ece4" },
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 24 }}>{icons[route.name]}</Text>
          ),
        })}
      >
        <Tab.Screen name="Home" component={Home} />
        <Tab.Screen name="Reports" component={Reports} />
        <Tab.Screen name="Matches" component={Matches} />
        <Tab.Screen name="Notifications" component={Inbox} />
        <Tab.Screen name="Profile" component={Profile} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={qc}>
        <StatusBar style="dark" />
        <Root />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f7f8fa" },
  content: {
    padding: 22,
    paddingBottom: 45,
    maxWidth: 700,
    width: "100%",
    alignSelf: "center",
  },
  wordmark: {
    fontSize: 34,
    fontWeight: "800",
    color: "#196137",
    letterSpacing: -1,
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.3,
    color: "#7d927f",
    fontWeight: "600",
    marginBottom: 8,
  },
  h1: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -1.1,
    color: "#172e20",
    marginBottom: 12,
  },
  h2: {
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: -0.6,
    color: "#243b2b",
    marginTop: 23,
    marginBottom: 9,
  },
  h3: { fontSize: 17, fontWeight: "700", color: "#243b2b", marginBottom: 6 },
  muted: { fontSize: 13, lineHeight: 21, color: "#7c8c80" },
  small: { fontSize: 11, color: "#8c9b8d", lineHeight: 18 },
  hero: {
    backgroundColor: "#164e39",
    borderRadius: 17,
    padding: 23,
    marginTop: 23,
    marginBottom: 10,
  },
  heroLabel: { fontSize: 8, letterSpacing: 1.4, color: "#b8d4b5" },
  heroTitle: {
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.8,
    fontWeight: "700",
    color: "white",
    marginVertical: 17,
  },
  heroText: {
    fontSize: 13,
    lineHeight: 22,
    color: "#b1cbbb",
    marginBottom: 15,
  },
  heroFoot: { fontSize: 9, color: "#b8ceb9", marginTop: 15, lineHeight: 16 },
  button: {
    backgroundColor: "#16a34a",
    borderRadius: 9,
    paddingVertical: 14,
    paddingHorizontal: 19,
    alignItems: "center",
    marginTop: 10,
    minHeight: 48,
    justifyContent: "center",
  },
  secondary: {
    backgroundColor: "#edf6e8",
    borderWidth: 1,
    borderColor: "#dfead8",
  },
  buttonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  card: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e5ebe1",
    borderRadius: 13,
    overflow: "hidden",
    marginVertical: 10,
  },
  itemImage: { height: 200, width: "100%", backgroundColor: "#e6ebe0" },
  badge: {
    fontSize: 9,
    fontWeight: "600",
    color: "#4a7e4c",
    backgroundColor: "#edf7e9",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    overflow: "hidden",
    marginVertical: 5,
  },
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d6e2cf",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 28,
    alignItems: "center",
    gap: 8,
    marginVertical: 18,
  },
  emptySymbol: { fontSize: 40, color: "#86a578", padding: 10 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#58705d",
    marginBottom: 7,
    marginTop: 5,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dce6d7",
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 13,
    fontSize: 14,
    color: "#213d28",
    minHeight: 47,
  },
  error: {
    backgroundColor: "#fff0ed",
    color: "#a44838",
    padding: 14,
    borderRadius: 8,
    fontSize: 12,
    lineHeight: 20,
    marginVertical: 12,
  },
  notice: {
    backgroundColor: "#eaf6e5",
    color: "#477641",
    padding: 15,
    borderRadius: 8,
    fontSize: 12,
    lineHeight: 20,
    marginVertical: 15,
  },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 18 },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#dce6d7",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#e7f5df", borderColor: "#82b36b" },
  location: {
    padding: 13,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#dce6d7",
    borderRadius: 8,
    marginBottom: 8,
  },
  verification: {
    backgroundColor: "#eff6e8",
    padding: 18,
    borderRadius: 12,
    marginVertical: 18,
  },
});
