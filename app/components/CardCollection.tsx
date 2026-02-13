'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';

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
  };
}

export default function CardCollection() {
  const [cards, setCards] = useState<StashCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

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

  const startEditing = (card: StashCard) => {
    setEditingId(card.id);
    setEditForm(cardToForm(card));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(null);
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

  if (loading) {
    return <p className="text-gray-500 text-center py-12">Loading your stash...</p>;
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">No cards saved yet.</p>
        <Link href="/" className="text-blue-600 hover:underline">Scan your first card</Link>
      </div>
    );
  }

  const fields: { key: keyof EditForm; label: string }[] = [
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {cards.map((card) => (
        <div key={card.id} className="bg-white border border-gray-200 rounded-lg p-5 space-y-3 shadow-sm">
          {card.card_image_url && (
            <Image
              src={card.card_image_url}
              alt={card.name || 'Business card'}
              width={400}
              height={250}
              className="w-full h-40 object-cover rounded"
              unoptimized
            />
          )}

          {editingId === card.id && editForm ? (
            <div className="space-y-3">
              {fields.map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-gray-500">{label}</label>
                  <input
                    type="text"
                    value={editForm[key]}
                    onChange={(e) => updateField(key, e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={label}
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => saveEdit(card.id)}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded font-semibold text-sm hover:bg-green-700 disabled:bg-gray-400"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={cancelEditing}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded font-semibold text-sm hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                {card.name && <h3 className="font-bold text-lg text-gray-900">{card.name}</h3>}
                {card.company && <p className="text-gray-600">{card.company}</p>}
                {card.notes && <p className="text-sm text-gray-500 italic">{card.notes}</p>}
              </div>

              <div className="space-y-1 text-sm">
                {card.phone && (
                  <p>
                    <span className="font-semibold text-gray-600">Phone: </span>
                    <a href={`tel:${card.phone}`} className="text-blue-600 hover:underline">{card.phone}</a>
                  </p>
                )}
                {card.additional_phone && (
                  <p>
                    <span className="font-semibold text-gray-600">Phone 2: </span>
                    <a href={`tel:${card.additional_phone}`} className="text-blue-600 hover:underline">{card.additional_phone}</a>
                  </p>
                )}
                {card.email && (
                  <p>
                    <span className="font-semibold text-gray-600">Email: </span>
                    <a href={`mailto:${card.email}`} className="text-blue-600 hover:underline">{card.email}</a>
                  </p>
                )}
                {card.website && (
                  <p>
                    <span className="font-semibold text-gray-600">Website: </span>
                    <a href={ensureUrl(card.website)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{card.website}</a>
                  </p>
                )}
                {card.additional_website && (
                  <p>
                    <span className="font-semibold text-gray-600">Website 2: </span>
                    <a href={ensureUrl(card.additional_website)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{card.additional_website}</a>
                  </p>
                )}
                {card.address && (
                  <p>
                    <span className="font-semibold text-gray-600">Address: </span>
                    <span className="text-gray-900">{card.address}</span>
                  </p>
                )}
              </div>

              {card.social_media && (card.social_media.facebook || card.social_media.instagram || card.social_media.linkedin) && (
                <div className="flex gap-3 text-sm">
                  {card.social_media.facebook && (
                    <a href={ensureUrl(card.social_media.facebook)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Facebook</a>
                  )}
                  {card.social_media.instagram && (
                    <a href={ensureUrl(card.social_media.instagram)} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:underline">Instagram</a>
                  )}
                  {card.social_media.linkedin && (
                    <a href={ensureUrl(card.social_media.linkedin)} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">LinkedIn</a>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-gray-400">
                  Added {new Date(card.created_at).toLocaleDateString()}
                </p>
                <button
                  onClick={() => startEditing(card)}
                  className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-100"
                >
                  Edit
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
