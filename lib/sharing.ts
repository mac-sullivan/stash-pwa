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
