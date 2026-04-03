# BenefitsSafe Technical Stack

Last updated: 2026-04-03

## Core Application
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 15.5.14 |
| Language | TypeScript | 5.9+ |
| Runtime | React | 19+ |
| CSS | Tailwind CSS | v4 |
| Components | shadcn/ui | Latest |
| Template | WowDash Next.js | Customized for 5-portal fintech |

## Authentication & Security
| Layer | Technology |
|-------|-----------|
| Auth | NextAuth v5 (Credentials + Google + GitHub) |
| MFA | TOTP with encrypted secrets + hashed backup codes |
| Encryption | AES-256-GCM (lib/encryption.ts) |
| Sessions | JWT with role + organizationId claims |
| Headers | `poweredByHeader: false`, secure cookie config |
| Privacy | CCPA/CPRA compliant (Privacy Policy + Terms of Service) |

## Database & ORM
| Layer | Technology |
|-------|-----------|
| Database | AWS Aurora PostgreSQL 17.7 (us-east-2) |
| ORM | Prisma v7 with PrismaPg adapter |
| Schema | 22 models, org-scoped multi-tenant |
| Connection | SSL/TLS encrypted, adapter-based (no raw URL in schema) |

## Payments & Cards
| Layer | Technology |
|-------|-----------|
| Card Issuing | Stripe Issuing (MCC-level spending controls) |
| Connect | Stripe Connect (Custom accounts per nonprofit) |
| Treasury | Stripe Treasury (pending approval) |
| Webhooks | Stripe webhook handler with signature verification |

## AI & Automation
| Layer | Technology |
|-------|-----------|
| Compliance Assistant | Anthropic Claude Sonnet (chat widget with web search) |
| Paperclip (Watchdog) | Node.js autonomous agent -- benefit threshold monitoring |
| Paperclip (Compliance) | Node.js autonomous agent -- transaction compliance scanning |
| Workflow Automation | Composio SDK v0.6.8 (Gmail, Slack, Google Calendar, Sheets, Asana, Trello) |
| Scheduling | node-cron for agent intervals |

## Infrastructure
| Layer | Technology |
|-------|-----------|
| Hosting | Vercel (production) |
| Database | AWS Aurora PostgreSQL (us-east-2) |
| File Storage | AWS S3 |
| DNS | Cloudflare (benefitssafe.com) |
| Secrets | AWS Secrets Manager |
| Audit | AWS CloudTrail |
| Monitoring | AWS Security Hub |

## Compliance Engine
| Layer | Detail |
|-------|--------|
| Federal Rules | SSI asset limits, SSDI SGA thresholds (lib/compliance-rules/) |
| State Rules | California Medi-Cal 138% FPL, CalFresh 200% gross / 100% net FPL, IHSS |
| Risk Classification | 4-tier: LIKELY_SAFE, NEEDS_REVIEW, LIKELY_RISKY, BLOCKED |
| Threshold Sources | SSA, HHS, DHCS, CDSS -- all 2025 figures with citations |

## Dev Tools & Quality
| Layer | Technology |
|-------|-----------|
| Validation | Zod (all API boundaries) |
| Charts | ApexCharts 3.44.0 + react-apexcharts 1.4.1 |
| Icons | Lucide React |
| Toasts | react-hot-toast |
| Rate Limiting | In-memory sliding window (per-endpoint) |
| Containerization | Docker (Paperclip -- ready for AWS ECS/Fargate) |

## Unique ID System
| Entity | Pattern | Example |
|--------|---------|---------|
| Organizations | `ORG-{seq}` | `ORG-00001` |
| Beneficiaries | `BS-{orgSeq}-{seq}` | `BS-0001-00001` |
| Vendors | `VN-{orgSeq}-{seq}` | `VN-0001-00001` |
| Team Members | `TM-{orgSeq}-{seq}` | `TM-00001-00001` |

All IDs are per-organization. Multi-org users get separate IDs per org via OrganizationMembership.

## Architecture Decisions
| Decision | Rationale |
|----------|-----------|
| Modular monolith | One Next.js app, 5 role-based portals via sidebar routing |
| Prisma v7 adapter pattern | No raw connection strings in schema, future-proof for edge |
| Immutable ledger | LedgerEntry + AuditLog never updated or deleted |
| Org-scoped queries | Every API query filtered by organizationId (prevents cross-org leakage) |
| Fire-and-forget workflows | Composio calls are non-blocking, failures don't break core flow |
| Paperclip separation | Autonomous agents run as separate process, write only to Notification + AuditLog |
| Per-org ID codes | Every entity (org, user, vendor) gets a human-readable code scoped to its organization |
