"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";

interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
}

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();

  // Profile
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // 2FA setup flow
  const [twoFactorSecret, setTwoFactorSecret] = useState("");
  const [twoFactorOtpauthUrl, setTwoFactorOtpauthUrl] = useState("");
  const [twoFactorBackupCodes, setTwoFactorBackupCodes] = useState<string[]>([]);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [setUp2fa, setSetUp2fa] = useState(false);
  const [enabling2fa, setEnabling2fa] = useState(false);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);

  // 2FA disable flow
  const [twoFactorDisablePassword, setTwoFactorDisablePassword] = useState("");
  const [twoFactorDisableCode, setTwoFactorDisableCode] = useState("");
  const [disabling2fa, setDisabling2fa] = useState(false);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch("/api/users/me", { name });
      setUser(res.data);
      toast.success("Profile updated");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setChangingPassword(true);
    try {
      await api.post("/api/users/me/change-password", {
        currentPassword,
        newPassword,
      });
      toast.success("Password changed. Other sessions have been signed out.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleSetup2fa() {
    if (user?.twoFactorEnabled) return;
    setTwoFactorBusy(true);
    try {
      const res = await api.post<TwoFactorSetupResponse>("/api/auth/2fa/setup");
      setTwoFactorSecret(res.data.secret);
      setTwoFactorOtpauthUrl(res.data.otpauthUrl);
      setTwoFactorBackupCodes(res.data.backupCodes);
      setSetUp2fa(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTwoFactorBusy(false);
    }
  }

  async function handleEnable2fa(e: React.FormEvent) {
    e.preventDefault();
    setEnabling2fa(true);
    try {
      const res = await api.post<{ backupCodes: string[] }>("/api/auth/2fa/enable", {
        code: twoFactorCode,
      });
      setTwoFactorBackupCodes(res.data.backupCodes);
      const updated = user ? { ...user, twoFactorEnabled: true } : user;
      if (updated) setUser(updated);
      toast.success("Two-factor authentication enabled.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setEnabling2fa(false);
    }
  }

  async function handleDisable2fa(e: React.FormEvent) {
    e.preventDefault();
    setDisabling2fa(true);
    try {
      await api.post("/api/auth/2fa/disable", {
        currentPassword: twoFactorDisablePassword,
        code: twoFactorDisableCode,
      });
      const updated = user ? { ...user, twoFactorEnabled: false } : user;
      if (updated) setUser(updated);
      setTwoFactorDisablePassword("");
      setTwoFactorDisableCode("");
      setSetUp2fa(false);
      setTwoFactorSecret("");
      setTwoFactorOtpauthUrl("");
      setTwoFactorBackupCodes([]);
      toast.success("Two-factor authentication disabled.");
      api.post("/api/auth/send-verification-email").catch(() => {});
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDisabling2fa(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <div className="max-w-lg space-y-6">
        {/* Profile Info */}
        <form onSubmit={handleUpdateProfile} className="rounded-lg border p-6 space-y-4">
          <h2 className="font-medium">Profile information</h2>

          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={user?.email ?? ""}
              disabled
              className="w-full rounded-md border bg-muted px-3 py-2 text-sm opacity-70"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>

        {/* Change Password */}
        <form onSubmit={handleChangePassword} className="rounded-lg border p-6 space-y-4">
          <h2 className="font-medium">Change password</h2>

          <div className="space-y-2">
            <label className="text-sm font-medium">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={changingPassword}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {changingPassword ? "Changing..." : "Change password"}
          </button>
        </form>

        {/* Two-Factor Authentication */}
        <div className="rounded-lg border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium">Two-factor authentication</h2>
              <p className="text-sm text-muted-foreground">
                {user?.twoFactorEnabled
                  ? "Enabled. An extra code is required at login."
                  : "Add an extra layer of security with an authenticator app."}
              </p>
            </div>
            {user?.twoFactorEnabled ? (
              <span className="rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
                Enabled
              </span>
            ) : (
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                Off
              </span>
            )}
          </div>

          {!user?.twoFactorEnabled && !setUp2fa && (
            <button
              type="button"
              onClick={handleSetup2fa}
              disabled={twoFactorBusy}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {twoFactorBusy ? "Starting..." : "Set up 2FA"}
            </button>
          )}

          {!user?.twoFactorEnabled && setUp2fa && (
            <form onSubmit={handleEnable2fa} className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Scan this code with your authenticator app</p>
                <p className="break-all rounded-md bg-muted p-3 text-xs font-mono text-muted-foreground">
                  {twoFactorOtpauthUrl || "Use your authenticator app to scan the QR code."}
                </p>
                {twoFactorSecret ? (
                  <p className="text-xs text-muted-foreground">
                    Manual entry key: <span className="font-mono">{twoFactorSecret}</span>
                  </p>
                ) : null}
              </div>

              {twoFactorBackupCodes.length > 0 && (
                <div className="rounded-md border p-3 space-y-2">
                  <p className="text-sm font-medium">One-time backup codes</p>
                  <p className="text-xs text-muted-foreground">
                    Store these safely. Each can be used only once if you lose your authenticator.
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {twoFactorBackupCodes.map((code) => (
                      <code key={code} className="text-xs font-mono">
                        {code}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Enter the 6-digit code from your app</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={enabling2fa || twoFactorCode.length !== 6}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {enabling2fa ? "Enabling..." : "Enable 2FA"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSetUp2fa(false);
                    setTwoFactorSecret("");
                    setTwoFactorOtpauthUrl("");
                    setTwoFactorBackupCodes([]);
                  }}
                  className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {user?.twoFactorEnabled && (
            <form onSubmit={handleDisable2fa} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Current password</label>
                <input
                  type="password"
                  value={twoFactorDisablePassword}
                  onChange={(e) => setTwoFactorDisablePassword(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">6-digit code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFactorDisableCode}
                  onChange={(e) => setTwoFactorDisableCode(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={disabling2fa}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {disabling2fa ? "Disabling..." : "Disable 2FA"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
