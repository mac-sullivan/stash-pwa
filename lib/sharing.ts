import { Platform, Share } from 'react-native';
import { File, Paths } from 'expo-file-system';
import type { StashCard, MyCard } from './types';

type ShareableCard = StashCard | MyCard;

export function formatCardText(card: ShareableCard): string {
  const lines: string[] = [];

  if (card.name) lines.push(card.name);
  if (card.company) lines.push(card.company);
  lines.push('');

  if (card.phone) lines.push(`Phone: ${card.phone}`);
  if (card.additional_phone) lines.push(`Phone: ${card.additional_phone}`);
  if (card.email) lines.push(`Email: ${card.email}`);
  if (card.website) lines.push(`Website: ${card.website}`);
  if (card.additional_website) lines.push(`Website: ${card.additional_website}`);
  if (card.address) lines.push(`Address: ${card.address}`);

  if (card.social_media) {
    const socials = Object.entries(card.social_media)
      .filter(([, url]) => url)
      .map(([platform, url]) =>
        `${platform.charAt(0).toUpperCase() + platform.slice(1)}: ${url}`
      );
    if (socials.length > 0) {
      lines.push('');
      lines.push(...socials);
    }
  }

  if (card.notes) {
    lines.push('');
    lines.push(`Notes: ${card.notes}`);
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function formatCategoryCards(cards: StashCard[], categoryLabel: string): string {
  const header = `--- ${categoryLabel} Contacts ---\n\n`;
  return header + cards.map(formatCardText).join('\n\n---\n\n');
}

function escapeVCard(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function generateVCard(card: ShareableCard): string {
  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];

  if (card.name) {
    lines.push(`FN:${escapeVCard(card.name)}`);
    // Best-effort N field: assume last word is surname
    const parts = card.name.trim().split(/\s+/);
    const last = parts.length > 1 ? parts.pop()! : '';
    const first = parts.join(' ');
    lines.push(`N:${escapeVCard(last)};${escapeVCard(first)};;;`);
  }

  if (card.company) lines.push(`ORG:${escapeVCard(card.company)}`);
  if (card.phone) lines.push(`TEL;TYPE=WORK:${card.phone}`);
  if (card.additional_phone) lines.push(`TEL;TYPE=WORK:${card.additional_phone}`);
  if (card.email) lines.push(`EMAIL:${card.email}`);
  if (card.website) lines.push(`URL:${card.website}`);
  if (card.additional_website) lines.push(`URL:${card.additional_website}`);
  if (card.address) lines.push(`ADR;TYPE=WORK:;;${escapeVCard(card.address)};;;;`);

  if (card.social_media) {
    for (const [, url] of Object.entries(card.social_media)) {
      if (url) lines.push(`URL:${url}`);
    }
  }

  if (card.notes) lines.push(`NOTE:${escapeVCard(card.notes)}`);

  lines.push('END:VCARD');
  return lines.join('\r\n');
}

export async function shareAsContact(card: ShareableCard): Promise<void> {
  const vcf = generateVCard(card);
  const fileName = `${(card.name || 'Contact').replace(/[^a-zA-Z0-9]/g, '_')}.vcf`;
  const file = new File(Paths.cache, fileName);
  file.write(vcf);

  if (Platform.OS === 'ios') {
    await Share.share({ url: file.uri });
  } else {
    await Share.share({ message: vcf, title: fileName });
  }
}
