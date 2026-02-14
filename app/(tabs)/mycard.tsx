import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, Image,
  Alert, ActivityIndicator, Share, Animated, Pressable,
  LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { parseCardImage } from '@/lib/api';
import { formatCardText } from '@/lib/sharing';
import type { MyCard, ParsedCard } from '@/lib/types';
import { cardShadow } from '@/lib/constants';
import AnimatedPressable from '@/components/AnimatedPressable';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ScreenMode = 'list' | 'detail' | 'choose-method' | 'scan' | 'form';

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

function parsedToForm(parsed: ParsedCard): FormData {
  return {
    name: parsed.name || '',
    company: parsed.company || '',
    phone: parsed.phone || '',
    additionalPhone: parsed.additionalPhone || '',
    email: parsed.email || '',
    website: parsed.website || '',
    additionalWebsite: parsed.additionalWebsite || '',
    address: parsed.address || '',
    notes: parsed.notes || '',
  };
}

export default function MyCardScreen() {
  const { colors, fontSizes, fontFamily } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 56;
  const tabBarHeight = insets.bottom + 49;
  const { user } = useAuth();
  const navigation = useNavigation();

  const [cards, setCards] = useState<MyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<ScreenMode>('list');
  const [selectedCard, setSelectedCard] = useState<MyCard | null>(null);

  // Form state
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });
  const [images, setImages] = useState<string[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  // Scan state
  const [isProcessing, setIsProcessing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Dynamic tab label
  useEffect(() => {
    navigation.setOptions({
      tabBarLabel: cards.length > 1 ? 'My Cards' : 'My Card',
    });
  }, [cards.length, navigation]);

  const navigate = (to: ScreenMode) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setScreen(to);
  };

  // --- Data ---

  const fetchCards = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/my_cards?user_id=eq.${session.user.id}&order=created_at.desc`,
        {
          headers: {
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      const data = await res.json();
      setCards(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Fetch my cards error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fetchCards();
  }, [fetchCards]));

  // Auto-show detail if only 1 card
  useEffect(() => {
    if (!loading && screen === 'list') {
      if (cards.length === 1) {
        setSelectedCard(cards[0]);
        setScreen('detail');
      }
    }
  }, [cards, loading]);

  // --- Form helpers ---

  const updateField = (key: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const resetFormState = () => {
    setForm({ ...EMPTY_FORM });
    setImages([]);
    setCoverIndex(0);
    setSelectedCard(null);
  };

  const goBack = () => {
    if (cards.length > 1) {
      navigate('list');
    } else if (cards.length === 1) {
      setSelectedCard(cards[0]);
      navigate('detail');
    } else {
      navigate('list');
    }
  };

  // --- Scan ---

  const pickImage = async (useCamera: boolean, addOnly = false) => {
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera Permission Required', 'Please enable camera access in your device settings.');
        return;
      }
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    };

    const result = useCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const base64 = `data:image/jpeg;base64,${asset.base64}`;
      if (addOnly) {
        setImages(prev => [...prev, base64]);
      } else {
        setImages([base64]);
        setCoverIndex(0);
        processCardImage(base64);
      }
    }
  };

  const processCardImage = async (base64: string) => {
    setIsProcessing(true);
    try {
      const parsed = await parseCardImage(base64);
      setForm(parsedToForm(parsed));
      navigate('form');
    } catch (error) {
      console.error('Process error:', error);
      Alert.alert('Error', 'Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Save ---

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

      const coverImage = images[coverIndex] || images[0] || null;
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
        card_image_url: coverImage,
        card_images: images.length > 0 ? images : null,
      };

      const url = selectedCard
        ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/my_cards?id=eq.${selectedCard.id}`
        : `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/my_cards`;

      const res = await fetch(url, {
        method: selectedCard ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${session.access_token}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(selectedCard ? { ...row, updated_at: new Date().toISOString() } : row),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetFormState();
      await fetchCards();
      navigate('list');
    } catch (error: any) {
      console.error('Save my card error:', error);
      Alert.alert('Error', `Failed to save: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  // --- Delete ---

  const deleteCard = (card: MyCard) => {
    Alert.alert('Delete Card', 'Are you sure you want to delete this card?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch(
              `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/my_cards?id=eq.${card.id}`,
              {
                method: 'DELETE',
                headers: {
                  'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                  'Authorization': `Bearer ${session.access_token}`,
                },
              }
            );
            if (!res.ok) throw new Error(await res.text());
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setSelectedCard(null);
            await fetchCards();
            navigate('list');
          } catch (e: any) {
            Alert.alert('Error', `Failed to delete: ${e?.message || e}`);
          }
        },
      },
    ]);
  };

  // --- Share ---

  const shareCard = async (card: MyCard) => {
    try {
      await Share.share({ message: formatCardText(card) });
    } catch (error) {
      console.log('Share cancelled:', error);
    }
  };

  // --- Render: Loading ---

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // --- Render: Empty / List ---

  const renderList = () => {
    if (cards.length === 0) {
      return (
        <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border, ...cardShadow(colors.cardShadow) }]}>
          <View style={s.emptyArea}>
            <View style={[s.iconCircle, { backgroundColor: colors.accent + '30' }]}>
              <Ionicons name="person-add-outline" size={36} color={colors.accent} />
            </View>
            <Text style={[s.emptyTitle, { color: colors.text, fontSize: fontSizes.lg, fontFamily }]}>
              Create Your Card
            </Text>
            <Text style={[s.emptySub, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>
              Add your business card to share with others
            </Text>
            <AnimatedPressable
              scaleDown={0.95}
              onPress={() => navigate('choose-method')}
              style={[s.primaryBtn, { backgroundColor: colors.accent, marginTop: 20, alignSelf: 'stretch' }]}
            >
              <Text style={[s.primaryBtnText, { fontSize: fontSizes.base, fontFamily }]}>Get Started</Text>
            </AnimatedPressable>
          </View>
        </View>
      );
    }

    return (
      <>
        {cards.map((card) => (
          <AnimatedPressable
            key={card.id}
            scaleDown={0.97}
            onPress={() => { setSelectedCard(card); navigate('detail'); }}
            style={[s.listCard, { backgroundColor: colors.bgCard, borderColor: colors.border, ...cardShadow(colors.cardShadow) }]}
          >
            <View style={s.listCardRow}>
              {card.card_image_url ? (
                <Image source={{ uri: card.card_image_url }} style={s.listThumb} resizeMode="cover" />
              ) : (
                <View style={[s.listThumbPlaceholder, { backgroundColor: colors.accent + '20' }]}>
                  <Ionicons name="person" size={24} color={colors.accent} />
                </View>
              )}
              <View style={s.listCardInfo}>
                <Text style={[s.listCardName, { color: colors.text, fontSize: fontSizes.base, fontFamily }]} numberOfLines={1}>
                  {card.name || 'Untitled'}
                </Text>
                {card.company && (
                  <Text style={[s.listCardCompany, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]} numberOfLines={1}>
                    {card.company}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
          </AnimatedPressable>
        ))}

        <AnimatedPressable
          scaleDown={0.95}
          onPress={() => { resetFormState(); navigate('choose-method'); }}
          style={[s.addBtn, { borderColor: colors.border }]}
        >
          <View style={s.actionBtnInner}>
            <Ionicons name="add" size={20} color={colors.link} />
            <Text style={[s.addBtnText, { color: colors.link, fontSize: fontSizes.base, fontFamily }]}>Add Another Card</Text>
          </View>
        </AnimatedPressable>
      </>
    );
  };

  // --- Render: Detail ---

  const renderDetail = () => {
    if (!selectedCard) return null;
    const card = selectedCard;
    const qrValue = formatCardText(card);

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
      <>
        {cards.length > 1 && (
          <AnimatedPressable scaleDown={0.95} onPress={() => navigate('list')} style={s.backRow}>
            <Ionicons name="chevron-back" size={20} color={colors.link} />
            <Text style={[s.backText, { color: colors.link, fontSize: fontSizes.sm, fontFamily }]}>All Cards</Text>
          </AnimatedPressable>
        )}

        <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border, ...cardShadow(colors.cardShadow) }]}>
          {card.card_image_url && (
            <Image source={{ uri: card.card_image_url }} style={s.detailImage} resizeMode="contain" />
          )}

          <Text style={[s.cardName, { color: colors.text, fontSize: fontSizes.xl, fontFamily }]}>
            {card.name}
          </Text>
          {card.company && (
            <Text style={[s.cardCompany, { color: colors.textMuted, fontSize: fontSizes.base, fontFamily }]}>
              {card.company}
            </Text>
          )}

          <View style={s.infoSection}>
            {infoFields.map((f, i) => f.value ? (
              <View key={`${f.label}-${i}`} style={s.infoRow}>
                <Text style={[s.infoLabel, { color: colors.textMuted, fontSize: fontSizes.xs, fontFamily }]}>{f.label}</Text>
                <Text style={[s.infoValue, { color: colors.link, fontSize: fontSizes.sm, fontFamily }]}>{f.value}</Text>
              </View>
            ) : null)}

            {socials.map(([platform, url]) => (
              <View key={platform} style={s.infoRow}>
                <Text style={[s.infoLabel, { color: colors.textMuted, fontSize: fontSizes.xs, fontFamily }]}>
                  {platform.charAt(0).toUpperCase() + platform.slice(1)}
                </Text>
                <Text style={[s.infoValue, { color: colors.link, fontSize: fontSizes.sm, fontFamily }]}>{url}</Text>
              </View>
            ))}

            {card.notes && (
              <View style={s.infoRow}>
                <Text style={[s.infoLabel, { color: colors.textMuted, fontSize: fontSizes.xs, fontFamily }]}>Notes</Text>
                <Text style={[s.infoValue, { color: colors.text, fontSize: fontSizes.sm, fontFamily }]}>{card.notes}</Text>
              </View>
            )}
          </View>
        </View>

        {/* QR Code */}
        <View style={[s.card, s.qrCard, { backgroundColor: colors.bgCard, borderColor: colors.border, ...cardShadow(colors.cardShadow) }]}>
          <Text style={[s.qrTitle, { color: colors.text, fontSize: fontSizes.base, fontFamily }]}>Scan to get my info</Text>
          <View style={s.qrWrapper}>
            <QRCode value={qrValue} size={200} backgroundColor="white" color="black" />
          </View>
        </View>

        {/* Actions */}
        <View style={s.actions}>
          <AnimatedPressable scaleDown={0.95} onPress={() => shareCard(card)}
            style={[s.actionBtn, { backgroundColor: colors.accent }]}>
            <View style={s.actionBtnInner}>
              <Ionicons name="share-outline" size={18} color="#f7f7f7" />
              <Text style={[s.actionBtnText, { fontSize: fontSizes.base, fontFamily }]}>Share</Text>
            </View>
          </AnimatedPressable>
          <AnimatedPressable scaleDown={0.95} onPress={() => {
            setForm(cardToForm(card));
            setImages(card.card_images || []);
            setCoverIndex(0);
            navigate('form');
          }}
            style={[s.actionBtn, { backgroundColor: colors.border }]}>
            <View style={s.actionBtnInner}>
              <Ionicons name="create-outline" size={18} color={colors.text} />
              <Text style={[s.actionBtnText, { color: colors.text, fontSize: fontSizes.base, fontFamily }]}>Edit</Text>
            </View>
          </AnimatedPressable>
        </View>

        <AnimatedPressable
          scaleDown={0.95}
          onPress={() => { resetFormState(); navigate('choose-method'); }}
          style={[s.addBtn, { borderColor: colors.border }]}
        >
          <View style={s.actionBtnInner}>
            <Ionicons name="add" size={20} color={colors.link} />
            <Text style={[s.addBtnText, { color: colors.link, fontSize: fontSizes.base, fontFamily }]}>Add Another Card</Text>
          </View>
        </AnimatedPressable>

        <AnimatedPressable scaleDown={0.95} onPress={() => deleteCard(card)}
          style={[s.deleteBtn, { borderColor: colors.border }]}>
          <View style={s.actionBtnInner}>
            <Ionicons name="trash-outline" size={16} color="#a10c0c" />
            <Text style={[s.deleteBtnText, { fontSize: fontSizes.sm, fontFamily }]}>Delete Card</Text>
          </View>
        </AnimatedPressable>
      </>
    );
  };

  // --- Render: Choose Method ---

  const renderChooseMethod = () => (
    <>
      <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border, ...cardShadow(colors.cardShadow) }]}>
        <Text style={[s.title, { color: colors.text, fontSize: fontSizes.lg, fontFamily }]}>New Card</Text>
        <Text style={[s.subtitle, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>
          How would you like to create your card?
        </Text>

        <AnimatedPressable
          scaleDown={0.97}
          onPress={() => {
            navigate('scan');
            Alert.alert('Scan Card', 'Choose source', [
              { text: 'Camera', onPress: () => pickImage(true) },
              { text: 'Gallery', onPress: () => pickImage(false) },
              { text: 'Cancel', style: 'cancel', onPress: () => navigate('choose-method') },
            ]);
          }}
          style={[s.methodCard, { borderColor: colors.border }]}
        >
          <View style={s.methodCardInner}>
            <View style={[s.iconCircle, { backgroundColor: colors.accent + '30' }]}>
              <Ionicons name="camera-outline" size={36} color={colors.accent} />
            </View>
            <Text style={[s.methodTitle, { color: colors.text, fontSize: fontSizes.base, fontFamily }]}>Scan Your Card</Text>
            <Text style={[s.methodSub, { color: colors.textMuted, fontSize: fontSizes.xs, fontFamily }]}>
              Take a photo or choose from gallery
            </Text>
          </View>
        </AnimatedPressable>

        <AnimatedPressable
          scaleDown={0.97}
          onPress={() => {
            resetFormState();
            navigate('form');
          }}
          style={[s.methodCard, { borderColor: colors.border }]}
        >
          <View style={s.methodCardInner}>
            <View style={[s.iconCircle, { backgroundColor: colors.accent + '30' }]}>
              <Ionicons name="create-outline" size={36} color={colors.accent} />
            </View>
            <Text style={[s.methodTitle, { color: colors.text, fontSize: fontSizes.base, fontFamily }]}>Enter Manually</Text>
            <Text style={[s.methodSub, { color: colors.textMuted, fontSize: fontSizes.xs, fontFamily }]}>
              Type in your card details
            </Text>
          </View>
        </AnimatedPressable>
      </View>

      <AnimatedPressable scaleDown={0.95} onPress={goBack}
        style={[s.secondaryBtn, { backgroundColor: colors.border }]}>
        <Text style={[s.secondaryBtnText, { color: colors.text, fontSize: fontSizes.base, fontFamily }]}>Cancel</Text>
      </AnimatedPressable>
    </>
  );

  // --- Render: Scan processing ---

  const renderScan = () => (
    <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border, alignItems: 'center', padding: 40, ...cardShadow(colors.cardShadow) }]}>
      {isProcessing ? (
        <>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[s.emptyTitle, { color: colors.text, marginTop: 16, fontSize: fontSizes.lg, fontFamily }]}>
            Analyzing card...
          </Text>
          <Text style={[s.emptySub, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>
            Extracting contact information
          </Text>
        </>
      ) : (
        <>
          <Text style={[s.emptyTitle, { color: colors.text, fontSize: fontSizes.lg, fontFamily }]}>
            Ready to scan
          </Text>
          <View style={[s.row, { marginTop: 16, gap: 12 }]}>
            <AnimatedPressable scaleDown={0.95} onPress={() => pickImage(true)}
              style={[s.primaryBtn, { flex: 1, backgroundColor: colors.accent }]}>
              <Text style={[s.primaryBtnText, { fontSize: fontSizes.base, fontFamily }]}>Camera</Text>
            </AnimatedPressable>
            <AnimatedPressable scaleDown={0.95} onPress={() => pickImage(false)}
              style={[s.secondaryBtn, { flex: 1, backgroundColor: colors.border }]}>
              <Text style={[s.secondaryBtnText, { color: colors.text, fontSize: fontSizes.base, fontFamily }]}>Gallery</Text>
            </AnimatedPressable>
          </View>
          <AnimatedPressable scaleDown={0.95} onPress={() => navigate('choose-method')}
            style={{ marginTop: 16 }}>
            <Text style={[{ color: colors.link, fontSize: fontSizes.sm, fontWeight: '600', fontFamily }]}>Back</Text>
          </AnimatedPressable>
        </>
      )}
    </View>
  );

  // --- Render: Form ---

  const renderForm = () => {
    const isEditing = !!selectedCard;

    return (
      <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border, ...cardShadow(colors.cardShadow) }]}>
        <Text style={[s.title, { color: colors.text, fontSize: fontSizes.lg, fontFamily }]}>
          {isEditing ? 'Edit Card' : 'New Card'}
        </Text>
        <Text style={[s.subtitle, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>
          {isEditing ? 'Update your card details' : 'Fill in your card details'}
        </Text>

        {/* Image thumbnails if from scan */}
        {images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.thumbStrip}>
            {images.map((img, idx) => (
              <Pressable key={idx} onPress={() => setCoverIndex(idx)}>
                <Image source={{ uri: img }} style={[s.thumbImg, {
                  borderColor: idx === coverIndex ? colors.accent : colors.border,
                }]} resizeMode="cover" />
                {idx === coverIndex && (
                  <View style={[s.coverBadge, { backgroundColor: colors.accent }]}>
                    <Text style={s.coverBadgeText}>&#9733;</Text>
                  </View>
                )}
              </Pressable>
            ))}
            <Pressable onPress={() => {
              Alert.alert('Add Image', 'Choose source', [
                { text: 'Camera', onPress: () => pickImage(true, true) },
                { text: 'Gallery', onPress: () => pickImage(false, true) },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }} style={[s.addThumbBtn, { borderColor: colors.border }]}>
              <Text style={[s.addThumbPlus, { color: colors.textMuted, fontFamily }]}>+</Text>
            </Pressable>
          </ScrollView>
        )}

        {FIELDS.map(({ key, label, placeholder, multiline }) => (
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

        <AnimatedPressable
          scaleDown={0.95}
          onPress={save}
          disabled={saving}
          style={[s.primaryBtn, {
            backgroundColor: saving ? colors.textMuted : colors.accent,
            opacity: saving ? 0.7 : 1,
          }]}
        >
          <Text style={[s.primaryBtnText, { fontSize: fontSizes.base, fontFamily }]}>
            {saving ? 'Saving...' : 'Save Card'}
          </Text>
        </AnimatedPressable>

        <AnimatedPressable scaleDown={0.95} onPress={() => {
          resetFormState();
          goBack();
        }}
          style={[s.secondaryBtn, { backgroundColor: colors.border }]}>
          <Text style={[s.secondaryBtnText, { color: colors.text, fontSize: fontSizes.base, fontFamily }]}>Cancel</Text>
        </AnimatedPressable>
      </View>
    );
  };

  // --- Main render ---

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={[s.content, { paddingTop: headerHeight + 16, paddingBottom: tabBarHeight + 20 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        {screen === 'list' && renderList()}
        {screen === 'detail' && renderDetail()}
        {screen === 'choose-method' && renderChooseMethod()}
        {screen === 'scan' && renderScan()}
        {screen === 'form' && renderForm()}
      </Animated.View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    borderWidth: 0.5,
    borderRadius: 8,
    padding: 20,
    marginBottom: 12,
  },
  title: { fontWeight: '700', marginBottom: 2 },
  subtitle: { marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },

  // Empty state
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyArea: { alignItems: 'center', paddingVertical: 24 },
  emptyTitle: { fontWeight: '600', marginTop: 12, marginBottom: 4 },
  emptySub: { textAlign: 'center', marginBottom: 8 },

  // List
  listCard: {
    borderWidth: 0.5,
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
  },
  listCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 14,
  },
  listThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listCardInfo: {
    flex: 1,
  },
  listCardName: { fontWeight: '600' },
  listCardCompany: { marginTop: 2 },
  addBtn: {
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 4,
    alignItems: 'center',
  },
  addBtnText: { fontWeight: '600' },

  // Detail
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backText: { fontWeight: '600' },
  cardName: { fontWeight: '700' },
  cardCompany: { marginTop: 2 },
  detailImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoSection: { marginTop: 16 },
  infoRow: { marginBottom: 10 },
  infoLabel: { fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.2, marginBottom: 2 },
  infoValue: {},
  qrCard: { alignItems: 'center' },
  qrTitle: { fontWeight: '600', marginBottom: 16 },
  qrWrapper: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnText: { color: '#f7f7f7', fontWeight: '600' },
  deleteBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteBtnText: { color: '#a10c0c', fontWeight: '600' },

  // Choose method
  methodCard: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
  },
  methodCardInner: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  methodTitle: { fontWeight: '600', marginTop: 4, marginBottom: 4 },
  methodSub: { textAlign: 'center' },

  // Form
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
  thumbStrip: { marginBottom: 16 },
  thumbImg: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 2,
    marginRight: 8,
  },
  coverBadge: {
    position: 'absolute',
    top: -4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverBadgeText: { color: '#f7f7f7', fontSize: 10, fontWeight: '700' },
  addThumbBtn: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addThumbPlus: { fontSize: 24, fontWeight: '600' },

  // Buttons
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnText: { color: '#f7f7f7', fontWeight: '600', letterSpacing: 0.3 },
  secondaryBtn: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: { fontWeight: '600' },
});
