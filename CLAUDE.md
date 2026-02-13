# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stash is a business card scanning and management app built with Next.js 16 (App Router). Users photograph/upload business cards, extract text via OCR (Tesseract.js), parse structured data via Claude API, and save to Supabase.

## Commands

- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm run lint` — ESLint (v9 flat config, extends next/core-web-vitals + next/typescript)

No test framework is configured.

## Architecture

**Data flow:** User image → Tesseract.js (client-side OCR) → `/api/parse-card` (Claude API extracts structured fields) → Supabase `stash` table

**Key files:**
- `app/components/CardScanner.tsx` — Main client component (`'use client'`). Handles image capture, OCR processing, displays parsed results, saves to DB.
- `app/api/parse-card/route.ts` — POST endpoint. Sends OCR text to Claude (`claude-sonnet-4-20250514`) with a structured prompt, returns parsed JSON.
- `lib/supabase.ts` — Supabase client init from env vars.

**Parsed card structure:** name, company, phone, email, website, additionalWebsites, address, socialMedia (facebook/instagram/linkedin).

## Environment Variables

Required in `.env.local`:
- `ANTHROPIC_API_KEY` — Claude API key (server-only)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key

## Tech Stack

- Next.js 16 with App Router, React 19, TypeScript
- Tailwind CSS v4 (via PostCSS plugin)
- Supabase for persistence
- Tesseract.js v7 for client-side OCR
- Anthropic SDK for Claude API
- Path alias: `@/*` maps to project root
