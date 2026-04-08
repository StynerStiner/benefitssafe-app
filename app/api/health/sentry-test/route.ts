import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export async function GET() {
  try {
    throw new Error('BenefitsSafe production Sentry test');
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ success: true });
  }
}
