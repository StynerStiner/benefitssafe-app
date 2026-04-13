// POST /api/auth/record-login -- Record device fingerprint on successful login
// Updates lastLoginIp, lastLoginUserAgent, trustedDevices, and creates audit log

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/services/email-service";
import { buildDeviceLoginEmail } from "@/lib/services/email-templates";
import { NextRequest, NextResponse } from "next/server";

interface TrustedDevice {
  ip: string;
  userAgent: string;
  firstSeen: string;
  lastSeen: string;
}

function parseBrowser(userAgent: string): string {
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Edg/")) return "Edge";
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Safari")) return "Safari";
  if (userAgent.includes("Opera") || userAgent.includes("OPR")) return "Opera";
  return "Unknown Browser";
}

function parseOS(userAgent: string): string {
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Mac OS")) return "macOS";
  if (userAgent.includes("Linux")) return "Linux";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("iPhone") || userAgent.includes("iPad")) return "iOS";
  return "Unknown OS";
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Fetch current user to get existing trustedDevices + details needed
    // for the security alert email.
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        trustedDevices: true,
        organizationId: true,
        email: true,
        firstName: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const devices: TrustedDevice[] = Array.isArray(user.trustedDevices)
      ? (user.trustedDevices as unknown as TrustedDevice[])
      : [];

    // Check if this device (ip + userAgent combo) is already trusted
    const existingDeviceIndex = devices.findIndex(
      (d) => d.ip === ip && d.userAgent === userAgent
    );

    let isNewDevice = false;

    if (existingDeviceIndex >= 0) {
      // Known device -- update lastSeen
      devices[existingDeviceIndex].lastSeen = now;
    } else {
      // New device -- add to trusted list
      isNewDevice = true;
      devices.push({
        ip,
        userAgent,
        firstSeen: now,
        lastSeen: now,
      });

      // Keep only the last 20 trusted devices
      if (devices.length > 20) {
        devices.splice(0, devices.length - 20);
      }
    }

    // Update user record with login details
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        lastLoginIp: ip,
        lastLoginUserAgent: userAgent,
        lastLoginAt: new Date(),
        trustedDevices: JSON.parse(JSON.stringify(devices)),
      },
    });

    // Create notification for new device (in-app + security alert email)
    if (isNewDevice) {
      const browser = parseBrowser(userAgent);
      const os = parseOS(userAgent);

      await prisma.notification.create({
        data: {
          userId: session.user.id,
          organizationId: user.organizationId,
          type: "security_new_device",
          title: "New device detected",
          message: `New login from ${browser} on ${os} (IP: ${ip.substring(0, ip.lastIndexOf(".") + 1)}***)`,
          entityType: "user",
          entityId: session.user.id,
        },
      });

      // Fire-and-forget security alert email. Notification already persisted,
      // so a failed email never blocks the login flow.
      if (user.email) {
        const baseUrl = process.env.NEXTAUTH_URL || "https://app.benefitssafe.com";
        const tmpl = buildDeviceLoginEmail({
          firstName: user.firstName || "there",
          orgName: session.user.organizationName,
          ipAddress: ip,
          userAgent: `${browser} on ${os}`,
          when: new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" }),
          accountUrl: `${baseUrl}/profile`,
        });
        sendEmail({
          to: user.email,
          subject: tmpl.subject,
          html: tmpl.html,
          text: tmpl.text,
          orgName: session.user.organizationName,
          userId: session.user.id,
          organizationId: user.organizationId,
          emailType: "device_login",
        }).catch((err) => console.error("[device_login email] failed:", err));
      }
    }

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: user.organizationId,
        action: isNewDevice ? "login_new_device" : "login_known_device",
        entityType: "auth",
        entityId: session.user.id,
        ipAddress: ip,
        userAgent,
        newValue: {
          browser: parseBrowser(userAgent),
          os: parseOS(userAgent),
          isNewDevice,
        },
      },
    });

    return NextResponse.json({
      success: true,
      isNewDevice,
    });
  } catch (error) {
    console.error("POST /api/auth/record-login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
