import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput,
  StyleSheet, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { PRESET_CATEGORIES } from '@/lib/constants';

interface FormData {
  name: string;
  company: string;
  phone: string;
  additionalPhone: string;
  email: string;
  website: string;
  additionalWebsite: string;
  address: string;
  notes: string;
}

const EMPTY_FORM: FormData = {
  name: '',
  company: '',
  phone: '',
  additionalPhone: '',
  email: '',
  website: '',
  additionalWebsite: '',
  address: '',
  notes: '',
};

const FIELDS: { key: keyof FormData; label: string; placeholder: string; multiline?: boolean }[] = [
  { key: 'name', label: 'Name *', placeholder: 'Person or business name' },
  { key: 'company', label: 'Company *', placeholder: 'Company name' },
  { key: 'phone', label: 'Phone *', placeholder: '(555) 123-4567' },
  { key: 'additionalPhone', label: 'Additional Phone *', placeholder: 'Secondary phone' },
  { key: 'email', label: 'Email *', placeholder: 'email@example.com' },
  { key: 'website', label: 'Website *', placeholder: 'www.example.com' },
  { key: 'additionalWebsite', label: 'Additional Website *', placeholder: 'Secondary website' },
  { key: 'address', label: 'Address *', placeholder: '123 Main St, City, State' },
  { key: 'notes', label: 'Notes *', placeholder: 'Job title, tagline, other info...', multiline: true },
];

export default function ManualScreen() {
  const { colors } = useTheme();
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customCategory, setCustomCategory] = useState('');
  const [allKnownCategories, setAllKnownCategories] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const { data } = await supabase.from('stash').select('categories');
      const all = new Set<string>();
      data?.forEach(row => row.categories?.forEach((c: string) => all.add(c)));
      setAllKnownCategories(Array.from(all).sort());
    } catch (e) {
      console.error('Fetch categories error:', e);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchCategories(); }, [fetchCategories]));

  const updateField = (key: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const addCustomCategory = () => {
    const trimmed = customCategory.trim();
    if (trimmed && !selectedCategories.includes(trimmed)) {
      setSelectedCategories(prev => [...prev, trimmed]);
    }
    setCustomCategory('');
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setSelectedCategories([]);
    setCustomCategory('');
  };

  const validate = (): boolean => {
    const missing = FIELDS.filter(f => !form[f.key].trim()).map(f => f.label.replace(' *', ''));
    if (missing.length > 0) {
      Alert.alert('Missing Fields', `Please fill in:\n${missing.join(', ')}`);
      return false;
    }
    return true;
  };

  const save = async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('stash').insert([{
        name: form.name || null,
        company: form.company || null,
        phone: form.phone || null,
        additional_phone: form.additionalPhone || null,
        email: form.email || null,
        website: form.website || null,
        additional_website: form.additionalWebsite || null,
        address: form.address || null,
        notes: form.notes || null,
        categories: selectedCategories.length > 0 ? selectedCategories : null,
      }]);
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved!', 'Card added to your Stash.');
      resetForm();
    } catch (error: any) {
      console.error('Save error:', error);
      Alert.alert('Error', `Failed to save: ${error?.message || error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const customFromDb = allKnownCategories.filter(c => !PRESET_CATEGORIES.includes(c));
  const customSelected = selectedCategories.filter(
    c => !PRESET_CATEGORIES.includes(c) && !customFromDb.includes(c)
  );
  const allCustom = [...customFromDb, ...customSelected];

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[s.cardTitle, { color: colors.text }]}>New Contact</Text>
        <Text style={[s.subtitle, { color: colors.textMuted }]}>
          All fields except categories are required
        </Text>

        {FIELDS.map(({ key, label, placeholder, multiline }) => (
          <View key={key} style={s.field}>
            <Text style={[s.label, { color: colors.textMuted }]}>{label}</Text>
            <TextInput
              value={form[key]}
              onChangeText={text => updateField(key, text)}
              placeholder={placeholder}
              placeholderTextColor={colors.textMuted}
              multiline={multiline}
              style={[s.input, {
                backgroundColor: colors.inputBg,
                borderColor: form[key].trim() ? colors.accent + '55' : colors.inputBorder,
                color: colors.text,
              }, multiline && s.inputMultiline]}
            />
          </View>
        ))}

        {/* Categories */}
        <View style={s.field}>
          <Text style={[s.label, { color: colors.textMuted }]}>Categories (optional)</Text>
          <View style={s.chipRow}>
            {PRESET_CATEGORIES.map(cat => (
              <Pressable key={cat} onPress={() => toggleCategory(cat)}
                style={[s.chip, {
                  backgroundColor: selectedCategories.includes(cat) ? colors.accent : colors.border,
                }]}>
                <Text style={[s.chipText, {
                  color: selectedCategories.includes(cat) ? '#fff' : colors.textMuted,
                }]}>{cat}</Text>
              </Pressable>
            ))}
          </View>
          {allCustom.length > 0 && (
            <View style={[s.chipRow, { marginTop: 6 }]}>
              {allCustom.map(cat => (
                <Pressable key={cat} onPress={() => toggleCategory(cat)}
                  style={[s.chip, {
                    backgroundColor: selectedCategories.includes(cat) ? colors.accent : colors.border,
                  }]}>
                  <Text style={[s.chipText, {
                    color: selectedCategories.includes(cat) ? '#fff' : colors.textMuted,
                  }]}>{cat}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={[s.row, { marginTop: 8 }]}>
            <TextInput
              value={customCategory}
              onChangeText={setCustomCategory}
              onSubmitEditing={addCustomCategory}
              placeholder="Custom category..."
              placeholderTextColor={colors.textMuted}
              style={[s.input, {
                flex: 1,
                backgroundColor: colors.inputBg,
                borderColor: colors.inputBorder,
                color: colors.text,
              }]}
            />
            <Pressable onPress={addCustomCategory}
              style={[s.smallBtn, { backgroundColor: colors.border }]}>
              <Text style={[s.smallBtnText, { color: colors.text }]}>Add</Text>
            </Pressable>
          </View>
        </View>

        {/* Actions */}
        <Pressable
          onPress={save}
          disabled={isSaving}
          style={[s.primaryBtn, {
            backgroundColor: isSaving ? colors.textMuted : colors.accent,
            opacity: isSaving ? 0.7 : 1,
          }]}
        >
          <Text style={s.primaryBtnText}>{isSaving ? 'Saving...' : 'Save to Stash'}</Text>
        </Pressable>

        <Pressable onPress={resetForm}
          style={[s.secondaryBtn, { backgroundColor: colors.border }]}>
          <Text style={[s.secondaryBtnText, { color: colors.text }]}>Clear Form</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  smallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginLeft: 8,
  },
  smallBtnText: { fontSize: 13, fontWeight: '600' },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
