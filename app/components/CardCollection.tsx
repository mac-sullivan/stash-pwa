'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';

const PRESET_CATEGORIES = [
  'Restaurant', 'Retail', 'Service', 'Health', 'Tech',
  'Finance', 'Creative', 'Education', 'Real Estate', 'Other',
];

interface StashCard {
  id: number;
  created_at: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  additional_phone: string | null;
  email: string | null;
  website: string | null;
  additional_website: string | null;
  address: string | null;
  social_media: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
  } | null;
  notes: string | null;
  card_image_url: string | null;
  categories: string[] | null;
}

interface EditForm {
  name: string;
  company: string;
  phone: string;
  additional_phone: string;
  email: string;
  website: string;
  additional_website: string;
  address: string;
  notes: string;
  categories: string[];
}

function ensureUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return 'https://' + url;
}

function cardToForm(card: StashCard): EditForm {
  return {
    name: card.name || '',
    company: card.company || '',
    phone: card.phone || '',
    additional_phone: card.additional_phone || '',
    email: card.email || '',
    website: card.website || '',
    additional_website: card.additional_website || '',
    address: card.address || '',
    notes: card.notes || '',
    categories: card.categories || [],
  };
}

export default function CardCollection() {
  const [cards, setCards] = useState<StashCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [customCategory, setCustomCategory] = useState('');

  useEffect(() => {
    async function fetchCards() {
      const { data, error } = await supabase
        .from('stash')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch error:', error);
      } else {
        setCards(data || []);
      }
      setLoading(false);
    }
    fetchCards();
  }, []);

  // All unique categories across cards
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    cards.forEach(c => c.categories?.forEach(cat => set.add(cat)));
    return Array.from(set).sort();
  }, [cards]);

  const filteredCards = activeFilter
    ? cards.filter(c => c.categories?.includes(activeFilter))
    : cards;

  const startEditing = (card: StashCard) => {
    setEditingId(card.id);
    setEditForm(cardToForm(card));
    setCustomCategory('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(null);
    setCustomCategory('');
  };

  const saveEdit = async (cardId: number) => {
    if (!editForm) return;
    setSaving(true);

    const { error } = await supabase
      .from('stash')
      .update({
        name: editForm.name || null,
        company: editForm.company || null,
        phone: editForm.phone || null,
        additional_phone: editForm.additional_phone || null,
        email: editForm.email || null,
        website: editForm.website || null,
        additional_website: editForm.additional_website || null,
        address: editForm.address || null,
        notes: editForm.notes || null,
        categories: editForm.categories.length > 0 ? editForm.categories : null,
      })
      .eq('id', cardId);

    if (error) {
      console.error('Update error:', error);
      alert('Failed to save changes.');
    } else {
      setCards(cards.map(c =>
        c.id === cardId
          ? {
              ...c,
              name: editForm.name || null,
              company: editForm.company || null,
              phone: editForm.phone || null,
              additional_phone: editForm.additional_phone || null,
              email: editForm.email || null,
              website: editForm.website || null,
              additional_website: editForm.additional_website || null,
              address: editForm.address || null,
              notes: editForm.notes || null,
              categories: editForm.categories.length > 0 ? editForm.categories : null,
            }
          : c
      ));
      setEditingId(null);
      setEditForm(null);
    }
    setSaving(false);
  };

  const updateField = (field: keyof EditForm, value: string) => {
    if (!editForm) return;
    setEditForm({ ...editForm, [field]: value });
  };

  const toggleEditCategory = (cat: string) => {
    if (!editForm) return;
    const cats = editForm.categories.includes(cat)
      ? editForm.categories.filter(c => c !== cat)
      : [...editForm.categories, cat];
    setEditForm({ ...editForm, categories: cats });
  };

  const addCustomEditCategory = () => {
    if (!editForm) return;
    const trimmed = customCategory.trim();
    if (trimmed && !editForm.categories.includes(trimmed)) {
      setEditForm({ ...editForm, categories: [...editForm.categories, trimmed] });
    }
    setCustomCategory('');
  };

  if (loading) {
    return <p className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Loading your stash...</p>;
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="mb-4" style={{ color: 'var(--text-muted)' }}>No cards saved yet.</p>
        <Link href="/" style={{ color: 'var(--accent)' }} className="hover:underline">Scan your first card</Link>
      </div>
    );
  }

  const textFields: { key: keyof Omit<EditForm, 'categories'>; label: string }[] = [
    { key: 'name', label: 'Name' },
    { key: 'company', label: 'Company' },
    { key: 'phone', label: 'Phone' },
    { key: 'additional_phone', label: 'Phone 2' },
    { key: 'email', label: 'Email' },
    { key: 'website', label: 'Website' },
    { key: 'additional_website', label: 'Website 2' },
    { key: 'address', label: 'Address' },
    { key: 'notes', label: 'Notes' },
  ];

  return (
    <div className="space-y-6">
      {/* Category filter bar */}
      {allCategories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setActiveFilter(null)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200"
            style={{
              background: activeFilter === null ? 'var(--accent)' : 'var(--border)',
              color: activeFilter === null ? '#ffffff' : 'var(--text-muted)',
            }}
          >
            All
          </button>
          {allCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200"
              style={{
                background: activeFilter === cat ? 'var(--accent)' : 'var(--border)',
                color: activeFilter === cat ? '#ffffff' : 'var(--text-muted)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredCards.map((card) => (
          <div key={card.id} className="glass-card card-hover rounded-xl p-5 space-y-3">
            {card.card_image_url && (
              <Image
                src={card.card_image_url}
                alt={card.name || 'Business card'}
                width={400}
                height={250}
                className="w-full h-40 object-cover rounded-lg"
                unoptimized
              />
            )}

            {editingId === card.id && editForm ? (
              <div className="space-y-3">
                {textFields.map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</label>
                    <input
                      type="text"
                      value={editForm[key]}
                      onChange={(e) => updateField(key, e.target.value)}
                      className="w-full rounded-lg px-3 py-1.5 text-sm transition-colors duration-200 focus:outline-none focus:ring-2"
                      style={{
                        background: 'var(--input-bg)',
                        border: '1px solid var(--input-border)',
                        color: 'var(--text)',
                        // @ts-expect-error CSS custom property for focus ring
                        '--tw-ring-color': 'var(--accent)',
                      }}
                      placeholder={label}
                    />
                  </div>
                ))}

                {/* Category picker in edit mode */}
                <div>
                  <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Categories</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {PRESET_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleEditCategory(cat)}
                        className="px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all duration-200"
                        style={{
                          background: editForm.categories.includes(cat) ? 'var(--accent)' : 'var(--border)',
                          color: editForm.categories.includes(cat) ? '#ffffff' : 'var(--text-muted)',
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  {editForm.categories.filter(c => !PRESET_CATEGORIES.includes(c)).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {editForm.categories.filter(c => !PRESET_CATEGORIES.includes(c)).map(cat => (
                        <span
                          key={cat}
                          className="px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"
                          style={{ background: 'var(--accent)', color: '#ffffff' }}
                        >
                          {cat}
                          <button type="button" onClick={() => toggleEditCategory(cat)} className="opacity-75 hover:opacity-100">&times;</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 mt-1.5">
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomEditCategory(); } }}
                      placeholder="Custom..."
                      className="flex-1 rounded-lg px-3 py-1 text-xs focus:outline-none focus:ring-2"
                      style={{
                        background: 'var(--input-bg)',
                        border: '1px solid var(--input-border)',
                        color: 'var(--text)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={addCustomEditCategory}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                      style={{ background: 'var(--border)', color: 'var(--text)' }}
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => saveEdit(card.id)}
                    disabled={saving}
                    className="flex-1 px-4 py-2 text-white rounded-lg font-semibold text-sm transition-colors duration-200 disabled:opacity-50"
                    style={{ background: 'var(--accent)' }}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-colors duration-200"
                    style={{ background: 'var(--border)', color: 'var(--text)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  {card.name && <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>{card.name}</h3>}
                  {card.company && <p style={{ color: 'var(--text-muted)' }}>{card.company}</p>}
                  {card.notes && <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>{card.notes}</p>}
                </div>

                {/* Category chips */}
                {card.categories && card.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {card.categories.map(cat => (
                      <span
                        key={cat}
                        className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                )}

                <div className="space-y-1 text-sm">
                  {card.phone && (
                    <p>
                      <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Phone: </span>
                      <a href={`tel:${card.phone}`} className="hover:underline" style={{ color: 'var(--accent)' }}>{card.phone}</a>
                    </p>
                  )}
                  {card.additional_phone && (
                    <p>
                      <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Phone 2: </span>
                      <a href={`tel:${card.additional_phone}`} className="hover:underline" style={{ color: 'var(--accent)' }}>{card.additional_phone}</a>
                    </p>
                  )}
                  {card.email && (
                    <p>
                      <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Email: </span>
                      <a href={`mailto:${card.email}`} className="hover:underline" style={{ color: 'var(--accent)' }}>{card.email}</a>
                    </p>
                  )}
                  {card.website && (
                    <p>
                      <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Website: </span>
                      <a href={ensureUrl(card.website)} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--accent)' }}>{card.website}</a>
                    </p>
                  )}
                  {card.additional_website && (
                    <p>
                      <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Website 2: </span>
                      <a href={ensureUrl(card.additional_website)} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--accent)' }}>{card.additional_website}</a>
                    </p>
                  )}
                  {card.address && (
                    <p>
                      <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Address: </span>
                      <span style={{ color: 'var(--text)' }}>{card.address}</span>
                    </p>
                  )}
                </div>

                {card.social_media && (card.social_media.facebook || card.social_media.instagram || card.social_media.linkedin) && (
                  <div className="flex gap-3 text-sm">
                    {card.social_media.facebook && (
                      <a href={ensureUrl(card.social_media.facebook)} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--accent)' }}>Facebook</a>
                    )}
                    {card.social_media.instagram && (
                      <a href={ensureUrl(card.social_media.instagram)} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--accent)' }}>Instagram</a>
                    )}
                    {card.social_media.linkedin && (
                      <a href={ensureUrl(card.social_media.linkedin)} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--accent)' }}>LinkedIn</a>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                    Added {new Date(card.created_at).toLocaleDateString()}
                  </p>
                  <button
                    onClick={() => startEditing(card)}
                    className="px-3 py-1 text-sm rounded-lg transition-colors duration-200"
                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  >
                    Edit
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
