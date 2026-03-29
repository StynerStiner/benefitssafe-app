"use client";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

type MfaStep = "status" | "setup" | "verify" | "backup" | "disable";

interface MfaStatusData {
  mfaEnabled: boolean;
}

const MfaSetupPage = () => {
  const { data: session } = useSession();
  const [step, setStep] = useState<MfaStep>("status");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Setup state
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [manualSecret, setManualSecret] = useState<string | null>(null);
  const [verifyToken, setVerifyToken] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Disable state
  const [disableToken, setDisableToken] = useState("");

  // MFA status
  const [mfaEnabled, setMfaEnabled] = useState(false);

  const checkMfaStatus = useCallback(async () => {
    try {
      setChecking(true);
      const res = await fetch("/api/auth/session");
      const data: MfaStatusData | null = await res.json();
      // We check the user's DB status via a dedicated endpoint
      // For now, rely on what the user model has
      if (data) {
        // Re-fetch the actual MFA status from the database
        const statusRes = await fetch("/api/mfa/status");
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setMfaEnabled(statusData.mfaEnabled);
        }
      }
    } catch {
      // Silently fail, default to not enabled
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkMfaStatus();
  }, [checkMfaStatus]);

  const handleStartSetup = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to initiate MFA setup.");
        return;
      }

      setQrCodeDataUrl(data.qrCodeDataUrl);
      setManualSecret(data.secret);
      setStep("verify");
    } catch {
      toast.error("Failed to start MFA setup. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    if (!verifyToken.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/mfa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verifyToken.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Verification failed.");
        setVerifyToken("");
        return;
      }

      setBackupCodes(data.backupCodes);
      setMfaEnabled(true);
      setStep("backup");
      toast.success("Two-factor authentication has been enabled.");
    } catch {
      toast.error("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!disableToken.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: disableToken.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to disable MFA.");
        setDisableToken("");
        return;
      }

      setMfaEnabled(false);
      setDisableToken("");
      setStep("status");
      toast.success("Two-factor authentication has been disabled.");
    } catch {
      toast.error("Failed to disable MFA. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBackupCodes = async () => {
    try {
      const text = backupCodes.join("\n");
      await navigator.clipboard.writeText(text);
      setCopiedCodes(true);
      toast.success("Backup codes copied to clipboard.");
      setTimeout(() => setCopiedCodes(false), 3000);
    } catch {
      toast.error("Failed to copy codes. Please copy them manually.");
    }
  };

  if (checking) {
    return (
      <>
        <DashboardBreadcrumb title="Two-Factor Authentication" text="MFA Setup" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardBreadcrumb title="Two-Factor Authentication" text="MFA Setup" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 lg:col-start-3">

          {/* Status view */}
          {step === "status" && (
            <Card className="card">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Two-Factor Authentication
                </CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account. When enabled,
                  you will need to enter a code from your authenticator app each
                  time you sign in.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-slate-800">
                  <div>
                    <p className="font-semibold text-sm">
                      Status: {mfaEnabled ? "Enabled" : "Disabled"}
                    </p>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
                      {mfaEnabled
                        ? "Your account is protected with two-factor authentication."
                        : "Two-factor authentication is not currently enabled."}
                    </p>
                  </div>
                  <div
                    className={`w-3 h-3 rounded-full ${
                      mfaEnabled ? "bg-green-500" : "bg-neutral-300 dark:bg-neutral-600"
                    }`}
                  />
                </div>

                <div className="mt-6 flex gap-3">
                  {!mfaEnabled ? (
                    <Button
                      onClick={handleStartSetup}
                      disabled={loading}
                      className="rounded-lg"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin h-4 w-4 mr-2" />
                          Setting up...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 mr-2" />
                          Enable Two-Factor Authentication
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setStep("disable")}
                      variant="outline"
                      className="rounded-lg text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
                    >
                      <ShieldOff className="w-4 h-4 mr-2" />
                      Disable Two-Factor Authentication
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* QR Code + Verification step */}
          {step === "verify" && qrCodeDataUrl && (
            <Card className="card">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Scan QR Code
                </CardTitle>
                <CardDescription>
                  Scan this QR code with your authenticator app (Google Authenticator,
                  Authy, 1Password, etc.), then enter the 6-digit code below to verify.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-6">
                  {/* QR Code */}
                  <div className="p-4 bg-white rounded-lg border border-neutral-200">
                    <Image
                      src={qrCodeDataUrl}
                      alt="MFA QR Code"
                      width={256}
                      height={256}
                      unoptimized
                    />
                  </div>

                  {/* Manual entry secret */}
                  {manualSecret && (
                    <div className="w-full">
                      <Label className="text-sm text-neutral-500 dark:text-neutral-400">
                        Or enter this key manually:
                      </Label>
                      <div className="mt-1 p-3 bg-neutral-100 dark:bg-slate-800 rounded-lg border border-neutral-200 dark:border-neutral-700 font-mono text-sm text-center tracking-wider select-all">
                        {manualSecret}
                      </div>
                    </div>
                  )}

                  {/* Verification input */}
                  <div className="w-full max-w-xs">
                    <Label htmlFor="mfa-verify-token" className="text-sm font-semibold">
                      Verification Code
                    </Label>
                    <Input
                      id="mfa-verify-token"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="000000"
                      value={verifyToken}
                      onChange={(e) => setVerifyToken(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleVerifySetup();
                        }
                      }}
                      className="mt-2 h-14 rounded-xl bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary text-center text-lg tracking-widest !shadow-none !ring-0"
                      maxLength={6}
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-3 w-full max-w-xs">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setStep("status");
                        setQrCodeDataUrl(null);
                        setManualSecret(null);
                        setVerifyToken("");
                      }}
                      className="flex-1 rounded-lg"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleVerifySetup}
                      disabled={loading || verifyToken.length !== 6}
                      className="flex-1 rounded-lg"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin h-4 w-4" />
                      ) : (
                        "Verify"
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Backup codes display */}
          {step === "backup" && backupCodes.length > 0 && (
            <Card className="card">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                  Save Your Backup Codes
                </CardTitle>
                <CardDescription>
                  Store these backup codes in a secure location. Each code can only
                  be used once. If you lose access to your authenticator app, you can
                  use a backup code to sign in.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-neutral-50 dark:bg-slate-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <div className="grid grid-cols-2 gap-2">
                    {backupCodes.map((code, index) => (
                      <div
                        key={index}
                        className="font-mono text-sm p-2 bg-white dark:bg-slate-900 rounded border border-neutral-200 dark:border-neutral-700 text-center"
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handleCopyBackupCodes}
                    className="rounded-lg"
                  >
                    {copiedCodes ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Codes
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setStep("status");
                      setBackupCodes([]);
                      setQrCodeDataUrl(null);
                      setManualSecret(null);
                      setVerifyToken("");
                    }}
                    className="rounded-lg"
                  >
                    Done
                  </Button>
                </div>

                <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
                  Warning: These codes will not be shown again. If you lose them and
                  lose access to your authenticator app, you will need to contact
                  support to regain access to your account.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Disable MFA confirmation */}
          {step === "disable" && (
            <Card className="card">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <ShieldOff className="w-5 h-5 text-red-600" />
                  Disable Two-Factor Authentication
                </CardTitle>
                <CardDescription>
                  To disable two-factor authentication, enter a verification code
                  from your authenticator app or use a backup code.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full max-w-xs">
                  <Label htmlFor="mfa-disable-token" className="text-sm font-semibold">
                    Verification Code
                  </Label>
                  <Input
                    id="mfa-disable-token"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    value={disableToken}
                    onChange={(e) => setDisableToken(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleDisableMfa();
                      }
                    }}
                    className="mt-2 h-14 rounded-xl bg-neutral-100 dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 focus:border-primary text-center text-lg tracking-widest !shadow-none !ring-0"
                    maxLength={9}
                    autoFocus
                  />
                </div>

                <div className="mt-6 flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep("status");
                      setDisableToken("");
                    }}
                    className="rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDisableMfa}
                    disabled={loading || !disableToken.trim()}
                    variant="destructive"
                    className="rounded-lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-2" />
                        Disabling...
                      </>
                    ) : (
                      "Disable MFA"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </>
  );
};

export default MfaSetupPage;
