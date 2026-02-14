import { supabase } from './supabase';
import type { ParsedCard } from './types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/parse-card`;

// Edge Functions gateway requires JWT-format anon key (not sb_publishable_ format)
const EDGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljY3lpYXZhaGtrcm9kd3drYWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDM4ODcsImV4cCI6MjA4NjUxOTg4N30.OVilPDzsTtyIokJ8rl93MSBuuPib_3-MdLkNeTHNtFM';

async function callParseFunction(body: Record<string, unknown>): Promise<ParsedCard> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': EDGE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error('[parse] error:', response.status, responseText);
    throw new Error(`Parse error (${response.status}): ${responseText}`);
  }

  return JSON.parse(responseText);
}

export async function parseCardImage(base64: string): Promise<ParsedCard> {
  return callParseFunction({ type: 'image', base64 });
}

export async function parseQrText(text: string): Promise<ParsedCard> {
  return callParseFunction({ type: 'qr', text });
}
