import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  Alert, ActivityIndicator, Share, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { formatCardText } from '@/lib/sharing';
import type { MyCard } from '@/lib/types';
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
  name: '', company: '', phone: '', additionalPhone: '',
  email: '', website: '', additionalWebsite: '', address: '', notes: '',
};

const FIELDS: { key: keyof FormData; label: string; placeholder: string; multiline?: boolean }[] = [
  { key: 'name', label: 'Name *', placeholder: 'Your name' },
  { key: 'company', label: 'Company', placeholder: 'Your company' },
  { key: 'phone', label: 'Phone', placeholder: '(555) 123-4567' },
  { key: 'additionalPhone', label: 'Additional Phone', placeholder: 'Secondary phone' },
  { key: 'email', label: 'Email', placeholder: 'you@example.com' },
  { key: 'website', label: 'Website', placeholder: 'www.example.com' },
  { key: 'additionalWebsite', label: 'Additional Website', placeholder: 'Secondary website' },
  { key: 'address', label: 'Address', placeholder: '123 Main St, City, State' },
  { key: 'notes', label: 'Notes', placeholder: 'Job title, tagline, other info...', multiline: true },
];

function cardToForm(card: MyCard): FormData {
  return {
    name: card.name || '',
    company: card.company || '',
    phone: card.phone || '',
    additionalPhone: card.additional_phone || '',
    email: card.email || '',
    website: card.website || '',
    additionalWebsite: card.additional_website || '',
    address: card.address || '',
    notes: card.notes || '',
  };
}

export default function MyCardScreen() {
  const { colors, fontSizes } = useTheme();
  const { user } = useAuth();
  const [card, setCard] = useState<MyCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const fetchCard = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/my_cards?user_id=eq.${session.user.id}&limit=1`,
        {
          headers: {
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        setCard(data[0]);
      } else {
        setCard(null);
      }
    } catch (e) {
      console.error('Fetch my card error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchCard(); }, [fetchCard]));

  const updateField = (key: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const startEditing = () => {
    setForm(card ? cardToForm(card) : { ...EMPTY_FORM });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setForm({ ...EMPTY_FORM });
  };

  const save = async () => {
    if (!form.name.trim()) {
      Alert.alert('Missing Name', 'Please enter your name.');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Session Expired', 'Please sign out and sign back in.');
        setSaving(false);
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
      };

      const url = card
        ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/my_cards?id=eq.${card.id}`
        : `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/my_cards`;

      const res = await fetch(url, {
        method: card ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${session.access_token}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(card ? { ...row, updated_at: new Date().toISOString() } : row),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body);
      }

      const data = await res.json();
      setCard(Array.isArray(data) ? data[0] : data);
      setEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      console.error('Save my card error:', error);
      Alert.alert('Error', `Failed to save: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  const shareCard = async () => {
    if (!card) return;
    try {
      await Share.share({ message: formatCardText(card) });
    } catch (error) {
      console.log('Share cancelled:', error);
    }
  };

  const qrValue = card ? formatCardText(card) : '';

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Edit / Create mode
  if (editing || !card) {
    return (
      <ScrollView
        style={[s.container, { backgroundColor: colors.bg }]}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[s.title, { color: colors.text, fontSize: fontSizes.lg }]}>
              {card ? 'Edit Your Card' : 'Create Your Card'}
            </Text>
            <Text style={[s.subtitle, { color: colors.textMuted, fontSize: fontSizes.sm }]}>
              This is the card you share with others
            </Text>

            {FIELDS.map(({ key, label, placeholder, multiline }) => (
              <View key={key} style={s.field}>
                <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.xs }]}>{label}</Text>
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
                  }, multiline && s.inputMultiline]}
                />
              </View>
            ))}

            <AnimatedPressable
              scaleDown={0.95}
              onPress={save}
              disabled={saving}
              style={[s.primaryBtn, {
                backgroundColor: saving ? colors.textMuted : colors.accent,
                opacity: saving ? 0.7 : 1,
              }]}
            >
              <Text style={[s.primaryBtnText, { fontSize: fontSizes.base }]}>
                {saving ? 'Saving...' : 'Save Card'}
              </Text>
            </AnimatedPressable>

            {card && (
              <AnimatedPressable scaleDown={0.95} onPress={cancelEditing}
                style={[s.secondaryBtn, { backgroundColor: colors.border }]}>
                <Text style={[s.secondaryBtnText, { color: colors.text, fontSize: fontSizes.base }]}>Cancel</Text>
              </AnimatedPressable>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    );
  }

  // View mode
  const infoFields: { label: string; value: string | null | undefined }[] = [
    { label: 'Phone', value: card.phone },
    { label: 'Phone', value: card.additional_phone },
    { label: 'Email', value: card.email },
    { label: 'Website', value: card.website },
    { label: 'Website', value: card.additional_website },
    { label: 'Address', value: card.address },
  ];

  const socials = card.social_media
    ? Object.entries(card.social_media).filter(([, url]) => url)
    : [];

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={s.content}
    >
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        {/* Card Preview */}
        <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[s.cardName, { color: colors.text, fontSize: fontSizes.xl }]}>
            {card.name}
          </Text>
          {card.company && (
            <Text style={[s.cardCompany, { color: colors.textMuted, fontSize: fontSizes.base }]}>
              {card.company}
            </Text>
          )}

          <View style={s.infoSection}>
            {infoFields.map((f, i) => f.value ? (
              <View key={`${f.label}-${i}`} style={s.infoRow}>
                <Text style={[s.infoLabel, { color: colors.textMuted, fontSize: fontSizes.xs }]}>{f.label}</Text>
                <Text style={[s.infoValue, { color: colors.text, fontSize: fontSizes.sm }]}>{f.value}</Text>
              </View>
            ) : null)}

            {socials.map(([platform, url]) => (
              <View key={platform} style={s.infoRow}>
                <Text style={[s.infoLabel, { color: colors.textMuted, fontSize: fontSizes.xs }]}>
                  {platform.charAt(0).toUpperCase() + platform.slice(1)}
                </Text>
                <Text style={[s.infoValue, { color: colors.text, fontSize: fontSizes.sm }]}>{url}</Text>
              </View>
            ))}

            {card.notes && (
              <View style={s.infoRow}>
                <Text style={[s.infoLabel, { color: colors.textMuted, fontSize: fontSizes.xs }]}>Notes</Text>
                <Text style={[s.infoValue, { color: colors.text, fontSize: fontSizes.sm }]}>{card.notes}</Text>
              </View>
            )}
          </View>
        </View>

        {/* QR Code */}
        <View style={[s.card, s.qrCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[s.qrTitle, { color: colors.text, fontSize: fontSizes.base }]}>Scan to get my info</Text>
          <View style={s.qrWrapper}>
            <QRCode
              value={qrValue}
              size={200}
              backgroundColor="white"
              color="black"
            />
          </View>
        </View>

        {/* Actions */}
        <View style={s.actions}>
          <AnimatedPressable scaleDown={0.95} onPress={shareCard}
            style={[s.actionBtn, { backgroundColor: colors.accent }]}>
            <View style={s.actionBtnInner}>
              <Ionicons name="share-outline" size={18} color="#fff" />
              <Text style={[s.actionBtnText, { fontSize: fontSizes.base }]}>Share</Text>
            </View>
          </AnimatedPressable>
          <AnimatedPressable scaleDown={0.95} onPress={startEditing}
            style={[s.actionBtn, { backgroundColor: colors.border }]}>
            <View style={s.actionBtnInner}>
              <Ionicons name="create-outline" size={18} color={colors.text} />
              <Text style={[s.actionBtnText, { color: colors.text, fontSize: fontSizes.base }]}>Edit</Text>
            </View>
          </AnimatedPressable>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  title: { fontWeight: '700', marginBottom: 2 },
  subtitle: { marginBottom: 16 },
  field: { marginBottom: 14 },
  label: { fontWeight: '600', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: { fontWeight: '600' },
  cardName: { fontWeight: '700' },
  cardCompany: { marginTop: 2 },
  infoSection: { marginTop: 16 },
  infoRow: { marginBottom: 10 },
  infoLabel: { fontWeight: '600', marginBottom: 1 },
  infoValue: {},
  qrCard: { alignItems: 'center' },
  qrTitle: { fontWeight: '600', marginBottom: 16 },
  qrWrapper: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnText: { color: '#fff', fontWeight: '600' },
});
