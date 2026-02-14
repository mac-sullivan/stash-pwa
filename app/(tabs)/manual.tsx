import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput,
  StyleSheet, Alert, Animated, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { PRESET_CATEGORIES, cardShadow } from '@/lib/constants';
import AnimatedPressable from '@/components/AnimatedPressable';

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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type FieldDef = { key: keyof FormData; label: string; placeholder: string; multiline?: boolean };

const PRIMARY_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name *', placeholder: 'Person or business name' },
  { key: 'company', label: 'Company', placeholder: 'Company name' },
  { key: 'phone', label: 'Phone', placeholder: '(555) 123-4567' },
];

const EXTRA_FIELDS: FieldDef[] = [
  { key: 'additionalPhone', label: 'Additional Phone', placeholder: 'Secondary phone' },
  { key: 'email', label: 'Email', placeholder: 'email@example.com' },
  { key: 'website', label: 'Website', placeholder: 'www.example.com' },
  { key: 'additionalWebsite', label: 'Additional Website', placeholder: 'Secondary website' },
  { key: 'address', label: 'Address', placeholder: '123 Main St, City, State' },
  { key: 'notes', label: 'Notes', placeholder: 'Job title, tagline, other info...', multiline: true },
];

export default function ManualScreen() {
  const { colors, fontSizes, fontFamily } = useTheme();
  const { user } = useAuth();
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customCategory, setCustomCategory] = useState('');
  const [allKnownCategories, setAllKnownCategories] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Mount fade-in + slide-up animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

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
    setShowMore(false);
  };

  const validate = (): boolean => {
    if (!form.name.trim()) {
      Alert.alert('Missing Name', 'Please fill in the Name field.');
      return false;
    }
    return true;
  };

  const save = async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Session Expired', 'Please sign out and sign back in.');
        setIsSaving(false);
        return;
      }

      const row = {
        user_id: session.user.id,
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
      };

      // Direct REST call bypassing supabase-js client
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/stash`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${session.access_token}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(row),
        }
      );

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body);
      }

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
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border, ...cardShadow(colors.cardShadow) }]}>
          <Text style={[s.cardTitle, { color: colors.text, fontSize: fontSizes.lg, fontFamily }]}>New Contact</Text>
          <Text style={[s.subtitle, s.subtitleitalic, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>
            Only name is required
          </Text>

          {PRIMARY_FIELDS.map(({ key, label, placeholder }) => (
            <View key={key} style={s.field}>
              <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.xs, fontFamily }]}>{label}</Text>
              <TextInput
                value={form[key]}
                onChangeText={text => updateField(key, text)}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                style={[s.input, {
                  backgroundColor: colors.inputBg,
                  borderColor: form[key].trim() ? colors.accent + '55' : colors.inputBorder,
                  color: colors.text,
                  fontSize: fontSizes.base,
                  fontFamily,
                }]}
              />
            </View>
          ))}

          {/* More fields toggle */}
          <Pressable
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowMore(!showMore);
            }}
            style={[s.moreToggle, { borderColor: colors.border }]}
          >
            <Text style={[s.moreToggleText, { color: colors.link, fontSize: fontSizes.sm, fontFamily }]}>
              {showMore ? 'Show Less' : 'Add More Details'}
            </Text>
            <Ionicons
              name={showMore ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.link}
            />
          </Pressable>

          {showMore && (
            <>
              {EXTRA_FIELDS.map(({ key, label, placeholder, multiline }) => (
                <View key={key} style={s.field}>
                  <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.xs, fontFamily }]}>{label}</Text>
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
                      fontSize: fontSizes.base,
                      fontFamily,
                    }, multiline && s.inputMultiline]}
                  />
                </View>
              ))}

              {/* Categories */}
              <View style={s.field}>
                <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.xs, fontFamily }]}>Categories (optional)</Text>
                <View style={s.chipRow}>
                  {PRESET_CATEGORIES.map(cat => (
                    <AnimatedPressable key={cat} scaleDown={0.92} onPress={() => toggleCategory(cat)}
                      style={[s.chip, {
                        backgroundColor: selectedCategories.includes(cat) ? colors.accent : colors.border,
                      }]}>
                      <Text style={[s.chipText, {
                        color: selectedCategories.includes(cat) ? '#f7f7f7' : colors.textMuted,
                        fontSize: fontSizes.xs,
                        fontFamily,
                      }]}>{cat}</Text>
                    </AnimatedPressable>
                  ))}
                </View>
                {allCustom.length > 0 && (
                  <View style={[s.chipRow, { marginTop: 6 }]}>
                    {allCustom.map(cat => (
                      <AnimatedPressable key={cat} scaleDown={0.92} onPress={() => toggleCategory(cat)}
                        style={[s.chip, {
                          backgroundColor: selectedCategories.includes(cat) ? colors.accent : colors.border,
                        }]}>
                        <Text style={[s.chipText, {
                          color: selectedCategories.includes(cat) ? '#f7f7f7' : colors.textMuted,
                          fontSize: fontSizes.xs,
                          fontFamily,
                        }]}>{cat}</Text>
                      </AnimatedPressable>
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
                      fontSize: fontSizes.sm,
                      fontFamily,
                    }]}
                  />
                  <AnimatedPressable onPress={addCustomCategory} scaleDown={0.92}
                    style={[s.smallBtn, { backgroundColor: colors.border }]}>
                    <Text style={[s.smallBtnText, { color: colors.text, fontSize: fontSizes.xs, fontFamily }]}>Add</Text>
                  </AnimatedPressable>
                </View>
              </View>
            </>
          )}

          {/* Actions */}
          <AnimatedPressable
            scaleDown={0.95}
            onPress={save}
            disabled={isSaving}
            style={[s.primaryBtn, {
              backgroundColor: isSaving ? colors.textMuted : colors.accent,
              opacity: isSaving ? 0.7 : 1,
            }]}
          >
            <Text style={[s.primaryBtnText, { fontSize: fontSizes.base, fontFamily }]}>{isSaving ? 'Saving...' : 'Save to Stash'}</Text>
          </AnimatedPressable>

          <AnimatedPressable scaleDown={0.95} onPress={resetForm}
            style={[s.secondaryBtn, { backgroundColor: colors.border }]}>
            <Text style={[s.secondaryBtnText, { color: colors.text, fontSize: fontSizes.base, fontFamily }]}>Clear Form</Text>
          </AnimatedPressable>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    borderWidth: 0.5,
    borderRadius: 8,
    padding: 20,
    marginBottom: 12,
  },
  cardTitle: {
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitleitalic: {
    fontStyle: 'italic',
  },
  subtitle: {
    marginBottom: 16,
  },
  field: { marginBottom: 14 },
  label: { fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.2, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  moreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 14,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
  },
  moreToggleText: {
    fontWeight: '600',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  chipText: { fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  smallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  smallBtnText: { fontWeight: '600' },
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnText: {
    color: '#f7f7f7',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: {
    fontWeight: '600',
  },
});
