import type { ParsedCard } from './types';

const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY!;

const PARSE_PROMPT = `Parse this contact information and extract structured data. Return ONLY valid JSON (no markdown, no code blocks, just raw JSON) with these fields:
{
  "name": "person or business name",
  "company": "company name if different from person name",
  "phone": "primary phone number",
  "additionalPhone": "secondary phone number if present",
  "email": "email address",
  "website": "primary website URL",
  "additionalWebsite": "secondary website URL if present",
  "address": "physical address if present",
  "socialMedia": {
    "facebook": "url if present",
    "instagram": "url if present",
    "linkedin": "url if present"
  },
  "notes": "any other relevant info like job title, tagline, etc.",
  "categories": ["suggest 1-2 categories from this list: Restaurant, Retail, Service, Health, Tech, Finance, Creative, Education, Real Estate, Other"]
}`;

function stripCodeBlocks(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  }
  return cleaned;
}

export async function parseCardImage(base64: string): Promise<ParsedCard> {
  const mediaType = base64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
  const rawBase64 = base64.replace(/^data:image\/\w+;base64,/, '');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: rawBase64,
            },
          },
          {
            type: 'text',
            text: `${PARSE_PROMPT}\n\nThis is a photo of a business card. Extract all visible contact information.`,
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error: ${err}`);
  }

  const data = await response.json();
  const content = data.content?.[0];
  if (content?.type === 'text') {
    return JSON.parse(stripCodeBlocks(content.text));
  }
  throw new Error('Unexpected response format');
}

export async function parseQrText(text: string): Promise<ParsedCard> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `${PARSE_PROMPT}\n\nThis text was decoded from a QR code. It may be in vCard/vCF format, meCard format, a URL, or plain text with contact information.\n\nText:\n${text}`,
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error: ${err}`);
  }

  const data = await response.json();
  const content = data.content?.[0];
  if (content?.type === 'text') {
    return JSON.parse(stripCodeBlocks(content.text));
  }
  throw new Error('Unexpected response format');
}
