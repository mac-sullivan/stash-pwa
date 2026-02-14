import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function stripCodeBlocks(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?/g, "");
  }
  return cleaned;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse request body
    const body = await req.json();
    const { type } = body;

    let messages;

    if (type === "image") {
      const { base64 } = body;
      if (!base64) {
        return new Response(
          JSON.stringify({ error: "Missing base64 image data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const mediaType = base64.startsWith("data:image/png")
        ? "image/png"
        : "image/jpeg";
      const rawBase64 = base64.replace(/^data:image\/\w+;base64,/, "");

      messages = [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: rawBase64,
              },
            },
            {
              type: "text",
              text: `${PARSE_PROMPT}\n\nThis is a photo of a business card. Extract all visible contact information.`,
            },
          ],
        },
      ];
    } else if (type === "qr") {
      const { text } = body;
      if (!text) {
        return new Response(
          JSON.stringify({ error: "Missing QR text data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      messages = [
        {
          role: "user",
          content: `${PARSE_PROMPT}\n\nThis text was decoded from a QR code. It may be in vCard/vCF format, meCard format, a URL, or plain text with contact information.\n\nText:\n${text}`,
        },
      ];
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid type. Expected "image" or "qr".' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Call Anthropic API
    const anthropicResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages,
        }),
      },
    );

    if (!anthropicResponse.ok) {
      const err = await anthropicResponse.text();
      return new Response(
        JSON.stringify({ error: `Anthropic API error: ${err}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await anthropicResponse.json();
    const content = data.content?.[0];

    if (content?.type !== "text") {
      return new Response(
        JSON.stringify({ error: "Unexpected response format from Anthropic" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const parsed = JSON.parse(stripCodeBlocks(content.text));

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
