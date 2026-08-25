import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, LogOut, Navigation, Plus } from "lucide-react";
import { ProfileSkeleton } from "@/components/loading-skeletons";
import { AppShell } from "@/components/app-shell";
import { LanguageToggle } from "@/components/language-toggle";
import { DataRow, Field, ChipGroup, MetaChip, Panel, StatusChip } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { APP_ROLE_CHIP, ROSTER_ROLE, formatDate } from "@/lib/fleet";
import { formatBdPhone, isValidBdPhone, maskBdPhoneInput } from "@/lib/phone";
import { useDepartments, useDriver, useProfile, useUpdateProfile } from "@/lib/queries";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My profile — FleetOps" },
      { name: "description", content: "Your account details and contact information." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { isEmployee, isDriver, isDispatcher } = useAuth();
  const { data, isLoading } = useProfile();

  if (isLoading) {
    return (
      <AppShell title="Profile" subtitle="Account details">
        <ProfileSkeleton />
      </AppShell>
    );
  }

  if (isEmployee && !isDispatcher && !isDriver) {
    return <EmployeeProfile profile={data?.profile ?? null} />;
  }

  if (isDriver && !isDispatcher) {
    return <DriverProfile profile={data?.profile ?? null} />;
  }

  return <OpsProfile profile={data?.profile ?? null} />;
}

type ProfileRow = {
  full_name: string | null;
  phone: string | null;
  employee_code: string | null;
  department_id: string | null;
} | null;

function useDepartmentName(departmentId: string | null | undefined) {
  const departments = useDepartments();
  if (!departmentId) return null;
  return (departments.data ?? []).find((d) => d.id === departmentId)?.name ?? null;
}

function useProfileForm(profile: ProfileRow) {
  const { refresh } = useAuth();
  const update = useUpdateProfile();
  const [fullName, setFullName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [phoneLocal, setPhoneLocal] = useState("");

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setDepartmentId(profile.department_id ?? "");
    if (profile.phone) {
      const local = profile.phone.replace(/^\+880/, "").replace(/^0/, "");
      setPhoneLocal(local);
    }
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (phoneLocal && !isValidBdPhone(phoneLocal)) {
      toast.error("Invalid Bangladesh mobile number");
      return;
    }
    try {
      await update.mutateAsync({
        full_name: fullName,
        department_id: departmentId || null,
        phone: phoneLocal || undefined,
      });
      await refresh();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    }
  }

  return {
    fullName,
    setFullName,
    departmentId,
    setDepartmentId,
    phoneLocal,
    setPhoneLocal,
    save,
    update,
  };
}

/** Compact employee portal profile — read-only details + shortcuts. */
function EmployeeProfile({ profile }: { profile: ProfileRow }) {
  const { signOut } = useAuth();
  const deptName = useDepartmentName(profile?.department_id);
  const initial = (profile?.full_name ?? "U").charAt(0).toUpperCase();

  return (
    <AppShell title="Profile" subtitle="Your details">
      <div className="employee-profile page-stack mx-auto w-full max-w-lg px-1 sm:px-0">
        <section className="employee-profile__hero">
          <div className="employee-profile__avatar" aria-hidden>
            {initial}
          </div>
          <div className="employee-profile__hero-copy min-w-0">
            <p className="employee-profile__name truncate">{profile?.full_name ?? "—"}</p>
            <p className="employee-profile__meta truncate">
              {profile?.phone ? formatBdPhone(profile.phone) : "No phone"}
              {profile?.employee_code ? ` · ${profile.employee_code}` : ""}
            </p>
            {deptName && <p className="employee-profile__dept truncate">{deptName}</p>}
          </div>
          <StatusChip label="Employee" tone="success" />
        </section>

        <div className="employee-profile__shortcuts">
          <Link to="/requests/new" className="employee-profile__shortcut">
            <Plus className="size-4" />
            New request
          </Link>
          <Link to="/requests" className="employee-profile__shortcut employee-profile__shortcut--muted">
            <ClipboardList className="size-4" />
            My requests
          </Link>
        </div>

        <Panel
          title="Account details"
          description="Managed by HR — view only"
          tone="primary"
          compact
          bodyClassName="profile-readonly-body"
        >
          <DataRow label="Full name" value={profile?.full_name ?? "—"} />
          <DataRow
            label="Mobile"
            value={profile?.phone ? <MetaChip label={formatBdPhone(profile.phone)} tone="primary" /> : "—"}
          />
          <DataRow
            label="Employee code"
            value={profile?.employee_code ? <MetaChip label={profile.employee_code} tone="neutral" /> : "—"}
          />
          <DataRow label="Department" value={deptName ?? "—"} />
        </Panel>

        <button type="button" className="employee-profile__signout" onClick={() => void signOut()}>
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </div>
    </AppShell>
  );
}

/** Driver portal profile — same layout as employee, read-only roster details. */
function DriverProfile({ profile }: { profile: ProfileRow }) {
  const { driverId, signOut } = useAuth();
  const { t } = useI18n();
  const { data: driver } = useDriver(driverId ?? "");
  const initial = (profile?.full_name ?? driver?.full_name ?? "U").charAt(0).toUpperCase();
  const name = profile?.full_name ?? driver?.full_name ?? "—";
  const phone = profile?.phone ?? driver?.phone ?? null;

  return (
    <AppShell title={t("profile.title")} subtitle={t("profile.subtitle")}>
      <div className="employee-profile page-stack mx-auto w-full max-w-lg px-1 sm:px-0">
        <section className="employee-profile__hero">
          <div className="employee-profile__avatar" aria-hidden>
            {initial}
          </div>
          <div className="employee-profile__hero-copy min-w-0">
            <p className="employee-profile__name truncate">{name}</p>
            <p className="employee-profile__meta truncate">
              {phone ? formatBdPhone(phone) : t("profile.noPhone")}
              {driver?.driver_code ? ` · ${driver.driver_code}` : ""}
            </p>
            {driver?.current_status && (
              <p className="employee-profile__dept truncate capitalize">
                {driver.current_status.replace(/_/g, " ")}
              </p>
            )}
          </div>
          <StatusChip label={t("profile.roleDriver")} tone="info" />
        </section>

        <div className="employee-profile__shortcuts">
          <Link to="/dashboard" className="employee-profile__shortcut">
            <Navigation className="size-4" />
            {t("profile.home")}
          </Link>
          <Link to="/my-trips" className="employee-profile__shortcut employee-profile__shortcut--muted">
            <ClipboardList className="size-4" />
            {t("profile.myTrips")}
          </Link>
        </div>

        <Panel
          title={t("profile.language")}
          description={t("profile.languageDesc")}
          tone="neutral"
          compact
        >
          <LanguageToggle />
        </Panel>

        <Panel
          title={t("profile.accountDetails")}
          description={t("profile.accountDesc")}
          tone="primary"
          compact
          bodyClassName="profile-readonly-body"
        >
          <DataRow label={t("profile.fullName")} value={name} />
          <DataRow
            label={t("profile.mobile")}
            value={phone ? <MetaChip label={formatBdPhone(phone)} tone="primary" /> : "—"}
          />
          <DataRow
            label={t("profile.driverCode")}
            value={driver?.driver_code ? <MetaChip label={driver.driver_code} tone="neutral" /> : "—"}
          />
          <DataRow
            label={t("profile.licence")}
            value={
              driver?.license_number ? (
                <MetaChip
                  label={`${driver.license_number}${driver.license_type ? ` · ${driver.license_type}` : ""}`}
                  tone="neutral"
                />
              ) : (
                "—"
              )
            }
          />
          <DataRow
            label={t("profile.licenceExpiry")}
            value={driver?.license_expiry ? formatDate(driver.license_expiry) : "—"}
          />
          <DataRow
            label={t("profile.shift")}
            value={driver?.shift ? <MetaChip label={driver.shift} tone="info" /> : "—"}
          />
          <DataRow
            label={t("profile.status")}
            value={
              driver?.current_status ? (
                <MetaChip label={driver.current_status.replace(/_/g, " ")} tone="info" />
              ) : (
                "—"
              )
            }
          />
          {driver?.allowed_categories && driver.allowed_categories.length > 0 && (
            <DataRow
              label={t("profile.categories")}
              value={
                <ChipGroup>
                  {driver.allowed_categories.map((c) => (
                    <MetaChip key={c} label={c.replace(/_/g, " ")} tone="neutral" />
                  ))}
                </ChipGroup>
              }
            />
          )}
        </Panel>

        <button type="button" className="employee-profile__signout" onClick={() => void signOut()}>
          <LogOut className="size-3.5" />
          {t("profile.signOut")}
        </button>
      </div>
    </AppShell>
  );
}

/** Ops / admin profile — editable contact details. */
function OpsProfile({ profile }: { profile: ProfileRow }) {
  const { roles, isDispatcher } = useAuth();
  const departments = useDepartments();
  const form = useProfileForm(profile);
  const rosterRole = isDispatcher ? "admin_hr" : null;

  return (
    <AppShell title="Profile" subtitle="Account details and contact information">
      <form onSubmit={form.save} className="role-dashboard page-stack mx-auto w-full max-w-2xl">
        <Panel title="Account" description="Roles and personal details" tone="primary" compact bodyClassName="profile-panel-body">
          <div className="mb-3">
            <ChipGroup>
              {roles.map((r) => {
                const chip = APP_ROLE_CHIP[r as keyof typeof APP_ROLE_CHIP];
                return (
                  <StatusChip
                    key={r}
                    label={chip?.label ?? r.replace(/_/g, " ")}
                    tone={chip?.tone ?? "info"}
                  />
                );
              })}
              {rosterRole && (
                <StatusChip label={ROSTER_ROLE[rosterRole].label} tone={ROSTER_ROLE[rosterRole].tone} />
              )}
            </ChipGroup>
          </div>
          <div className="profile-form-fields">
            <Field label="Full name" className="profile-field-span">
              <input
                className="app-field-input"
                value={form.fullName}
                onChange={(e) => form.setFullName(e.target.value)}
                required
              />
            </Field>
            <Field label="Employee code" hint="From HR records">
              <input className="app-field-input" value={profile?.employee_code ?? ""} disabled />
            </Field>
            <Field label="Department">
              <select
                className="app-field-select"
                value={form.departmentId}
                onChange={(e) => form.setDepartmentId(e.target.value)}
              >
                <option value="">Not set</option>
                {(departments.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mobile" hint="Bangladesh number without country code" className="profile-field-span">
              <div className="app-phone-field">
                <span className="app-phone-prefix">+880</span>
                <input
                  className="app-phone-input"
                  inputMode="numeric"
                  value={form.phoneLocal}
                  onChange={(e) => form.setPhoneLocal(maskBdPhoneInput(e.target.value))}
                  placeholder="1711234567"
                  maxLength={10}
                />
              </div>
              {form.phoneLocal && !isValidBdPhone(form.phoneLocal) && (
                <p className="mt-1.5 text-xs text-destructive">Invalid mobile number</p>
              )}
              {profile?.phone && (
                <p className="mt-1.5 text-xs text-muted-foreground">Saved: {formatBdPhone(profile.phone)}</p>
              )}
            </Field>
          </div>
        </Panel>

        <Panel title="Summary" tone="info" compact bodyClassName="profile-overview-body">
          <DataRow label="Name" value={profile?.full_name ?? "—"} />
          <DataRow
            label="Phone"
            value={profile?.phone ? <MetaChip label={formatBdPhone(profile.phone)} tone="primary" /> : "—"}
          />
          <DataRow
            label="Employee code"
            value={profile?.employee_code ? <MetaChip label={profile.employee_code} tone="neutral" /> : "—"}
          />
        </Panel>

        <Button
          type="submit"
          size="sm"
          className="min-h-9 w-full sm:w-auto"
          disabled={form.update.isPending}
          tooltip="Save your name, phone, and department"
        >
          {form.update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </AppShell>
  );
}
