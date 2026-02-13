import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text, source } = await request.json();

    const contextLine = source === 'qr'
      ? 'This text was decoded from a QR code. It may be in vCard/vCF format, meCard format, a URL, or plain text with contact information.'
      : 'This text was extracted via OCR from a business card photo.';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Parse this contact information and extract structured data. Return ONLY valid JSON (no markdown, no code blocks, just raw JSON) with these fields:
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
}

${contextLine}

Text:
${text}`
      }]
    });

    const content = message.content[0];
    if (content.type === 'text') {
      // Strip markdown code blocks if present
      let jsonText = content.text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);
      return NextResponse.json(parsed);
    }

    return NextResponse.json({ error: 'Unexpected response format' }, { status: 500 });
  } catch (error) {
    console.error('Parse error:', error);
    return NextResponse.json({ error: 'Failed to parse card' }, { status: 500 });
  }
}
