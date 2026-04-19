// POST /api/ai/chat — AI Compliance Assistant
// Two-layer system:
//   Layer 1 (ALWAYS ON): Live government compliance data via web search
//   Layer 2 (OPTIONAL): Grant-specific context from uploaded documents

import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { captureApiError } from "@/lib/error-handler";
import { errorResponse } from "@/lib/error-response";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

const ROUTE = "api/ai/chat:POST";

const ALLOWED_ROLES = [
  "nonprofit_admin",
  "nonprofit_staff",
  "cpa",
  "auditor",
  "attorney",
  "grant_officer",
  "platform_admin",
  "compliance_officer",
];

const chatSchema = z.object({
  message: z.string().min(1, "Message is required").max(4000),
  conversationHistory: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional().default([]),
  grantId: z.string().optional(),
  beneficiaryId: z.string().optional(),
  customContext: z.string().max(50000).optional(),
  image: z.object({
    mediaType: z.string(),
    base64: z.string(),
  }).optional(),
});

const SYSTEM_PROMPT = `You are the BenefitsSafe Compliance Assistant. You help nonprofits understand how grant disbursements interact with government benefits programs including SSI, SSDI, Medi-Cal, Medicaid, ABLE accounts, CalFresh, and IHSS.

For EVERY question:
- Search current government sources (SSA.gov, IRS.gov, CMS.gov) using your web search tool
- Cite specific regulations, POMS sections, or IRS publications
- Explain how the expense would be classified under SSA rules
- If grant context is provided below, also reference the grant terms

Always structure your answer with these sections:

**GOVERNMENT RULES**
What current federal and state regulations say about this specific situation. Cite sources.

**GRANT TERMS** (only if grant context was provided)
What the grant agreement allows or restricts regarding this expense.

**RECOMMENDATION**
Your guidance on how to proceed, including any precautions.

**DISCLAIMER**
This is guidance based on general SSI/Medi-Cal/Medicaid rules, not legal advice. Consult a benefits attorney or WIPA specialist for decisions affecting government benefits.

You must NEVER recommend:
- Cash payments directly to beneficiaries
- Ways to hide income from SSA
- Workarounds to avoid benefit reporting
- Actions that could constitute fraud

If you are unsure about a specific rule, say so clearly and recommend consulting a WIPA specialist or benefits attorney. Do not guess about specific dollar thresholds or dates — search for the current values.`;

export async function POST(request: Request) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 10 requests per minute per user
    const rateLimitResult = rateLimit(
      `ai-chat:${session.user.id}`,
      RATE_LIMIT_CONFIGS.aiChat,
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before sending another message." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000)),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          },
        },
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "AI service not configured. Add ANTHROPIC_API_KEY to environment variables." },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { message, conversationHistory, grantId, beneficiaryId, customContext, image } = parsed.data;

    // Build grant context (Layer 2 — optional)
    let grantContext = "";

    // Beneficiary context
    if (beneficiaryId) {
      const ben = await prisma.user.findFirst({
        where: {
          id: beneficiaryId,
          organizationId: session.user.organizationId,
          role: "beneficiary",
        },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          dateOfBirth: true,
          addressCity: true,
          addressState: true,
          benefitPrograms: true,
          grants: {
            where: { archivedAt: null },
            select: { name: true, grantIssuerName: true, totalAmount: true, spentAmount: true, remainingAmount: true, status: true },
            take: 5,
          },
        },
      });

      if (ben) {
        grantContext += `\n\n--- BENEFICIARY CONTEXT ---\n`;
        grantContext += `Name: ${ben.firstName} ${ben.lastName}\n`;
        grantContext += `Email: ${ben.email}\n`;
        if (ben.dateOfBirth) grantContext += `DOB: ${new Date(ben.dateOfBirth).toLocaleDateString()}\n`;
        if (ben.addressCity) grantContext += `Location: ${ben.addressCity}${ben.addressState ? `, ${ben.addressState}` : ""}\n`;
        if (ben.benefitPrograms) {
          const progs = ben.benefitPrograms as Record<string, boolean>;
          const active = Object.entries(progs).filter(([, v]) => v).map(([k]) => k);
          if (active.length > 0) {
            grantContext += `Government Benefits: ${active.join(", ")}\n`;
          }
        }
        if (ben.grants.length > 0) {
          grantContext += `Active Grants:\n`;
          for (const g of ben.grants) {
            grantContext += `  - ${g.name} (${g.grantIssuerName}): $${g.totalAmount} total, $${g.spentAmount} spent, $${g.remainingAmount} remaining [${g.status}]\n`;
          }
        }
        grantContext += `--- END BENEFICIARY CONTEXT ---`;
      }
    }
    if (grantId) {
      const grant = await prisma.grant.findFirst({
        where: {
          id: grantId,
          organizationId: session.user.organizationId,
          archivedAt: null,
        },
        select: {
          name: true,
          grantIssuerName: true,
          description: true,
          restrictions: true,
          totalAmount: true,
          spentAmount: true,
          remainingAmount: true,
          benefitFlags: true,
          grantDocumentText: true,
          grantDocumentName: true,
          beneficiary: {
            select: {
              firstName: true,
              lastName: true,
              benefitPrograms: true,
            },
          },
        },
      });

      if (grant) {
        grantContext += `\n\n--- GRANT CONTEXT (Layer 2) ---\n`;
        grantContext += `Grant Name: ${grant.name}\n`;
        grantContext += `Grant Issuer: ${grant.grantIssuerName}\n`;
        if (grant.description) grantContext += `Description: ${grant.description}\n`;
        if (grant.restrictions) grantContext += `Restrictions: ${grant.restrictions}\n`;
        grantContext += `Total: $${grant.totalAmount}, Spent: $${grant.spentAmount}, Remaining: $${grant.remainingAmount}\n`;

        if (grant.benefitFlags) {
          const flags = grant.benefitFlags as Record<string, boolean>;
          const activeFlags = Object.entries(flags).filter(([, v]) => v).map(([k]) => k);
          if (activeFlags.length > 0) {
            grantContext += `Beneficiary Benefit Programs: ${activeFlags.join(", ")}\n`;
          }
        }

        if (grant.beneficiary) {
          grantContext += `Beneficiary: ${grant.beneficiary.firstName} ${grant.beneficiary.lastName}\n`;
          if (grant.beneficiary.benefitPrograms) {
            const progs = grant.beneficiary.benefitPrograms as Record<string, boolean>;
            const active = Object.entries(progs).filter(([, v]) => v).map(([k]) => k);
            if (active.length > 0) {
              grantContext += `Beneficiary's Government Benefits: ${active.join(", ")}\n`;
            }
          }
        }

        if (grant.grantDocumentText) {
          grantContext += `\n--- GRANT DOCUMENT (${grant.grantDocumentName || "uploaded"}) ---\n`;
          // Limit document text to avoid token overflow
          const docText = grant.grantDocumentText.length > 8000
            ? grant.grantDocumentText.substring(0, 8000) + "\n[Document truncated at 8000 characters]"
            : grant.grantDocumentText;
          grantContext += docText;
        }

        grantContext += `\n--- END GRANT CONTEXT ---`;
      }
    }

    // Add custom pasted context
    if (customContext) {
      grantContext += `\n\n--- ADDITIONAL CONTEXT (provided by user) ---\n`;
      grantContext += customContext;
      grantContext += `\n--- END ADDITIONAL CONTEXT ---`;
    }

    // Build messages for Claude
    const systemPrompt = grantContext
      ? SYSTEM_PROMPT + grantContext
      : SYSTEM_PROMPT + "\n\nNo grant context was provided. Answer based on government rules only (Layer 1).";

    // Build user message content — may include image
    const userContent: Anthropic.ContentBlockParam[] = [];
    if (image) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: image.mediaType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
          data: image.base64,
        },
      });
    }
    userContent.push({ type: "text", text: message });

    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: userContent },
    ];

    // Call Claude with web search enabled
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      messages,
    });

    // Extract text from response
    let responseText = "";
    const citations: string[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        responseText += block.text;
        // Extract citations from the text block if present
        if ("citations" in block && Array.isArray(block.citations)) {
          for (const cite of block.citations) {
            if ("url" in cite && typeof cite.url === "string") {
              citations.push(cite.url);
            }
          }
        }
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
        action: "ai_chat",
        entityType: "compliance_assistant",
        entityId: grantId || "general",
        newValue: JSON.parse(JSON.stringify({
          question: message.substring(0, 200),
          hadGrantContext: !!grantId,
          hadCustomContext: !!customContext,
        })),
      },
    });

    return NextResponse.json({
      response: responseText,
      citations: [...new Set(citations)],
      model: response.model,
      usage: response.usage,
    });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE,
        method: "POST",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    captureApiError(error, { route: "POST /api/ai/chat" });
    console.error("POST /api/ai/chat error:", error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `AI service error: ${error.message}` },
        { status: error.status || 500 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
