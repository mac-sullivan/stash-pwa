import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, Image,
  StyleSheet, Alert, ActivityIndicator, Animated, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { parseCardImage, parseQrText } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { PRESET_CATEGORIES, cardShadow } from '@/lib/constants';
import type { ParsedCard } from '@/lib/types';
import AnimatedPressable from '@/components/AnimatedPressable';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ScanMode = 'card' | 'qr';

function FadeInView({ children, visible }: { children: React.ReactNode; visible: boolean }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(16);
    }
  }, [visible, fadeAnim, slideAnim]);

  if (!visible) return null;

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      {children}
    </Animated.View>
  );
}

export default function ScanScreen() {
  const { colors, fontSizes, fontFamily } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 56;
  const tabBarHeight = insets.bottom + 49;
  const { user } = useAuth();
  const [mode, setMode] = useState<ScanMode>('card');
  const [images, setImages] = useState<string[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedCard | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customCategory, setCustomCategory] = useState('');
  const [allKnownCategories, setAllKnownCategories] = useState<string[]>([]);

  // QR state
  const [cameraActive, setCameraActive] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  // Fetch all categories used across existing cards
  const fetchCategories = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('stash')
        .select('categories');
      const all = new Set<string>();
      data?.forEach(row => row.categories?.forEach((c: string) => all.add(c)));
      setAllKnownCategories(Array.from(all).sort());
    } catch (e) {
      console.error('Fetch categories error:', e);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchCategories(); }, [fetchCategories]));

  useEffect(() => {
    if (parsedData?.categories) {
      setSelectedCategories(parsedData.categories);
    }
  }, [parsedData]);

  const resetAll = () => {
    setImages([]);
    setCoverIndex(0);
    setParsedData(null);
    setSelectedCategories([]);
    setCustomCategory('');
    setCameraActive(false);
    scannedRef.current = false;
  };

  const switchMode = (newMode: ScanMode) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    resetAll();
    setMode(newMode);
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

  // --- Card mode ---

  const pickImage = async (useCamera: boolean, addOnly = false) => {
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access in your device settings to scan business cards.',
        );
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
        // Just add to the list, don't re-process
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
      setParsedData(parsed);
    } catch (error) {
      console.error('Process error:', error);
      Alert.alert('Error', 'Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- QR mode ---

  const startQrCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to scan QR codes.');
        return;
      }
    }
    scannedRef.current = false;
    setCameraActive(true);
  };

  const handleBarcodeScan = async (result: BarcodeScanningResult) => {
    if (scannedRef.current) return;
    scannedRef.current = true;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCameraActive(false);
    setIsProcessing(true);

    try {
      const parsed = await parseQrText(result.data);
      setParsedData(parsed);
    } catch (error) {
      console.error('QR parse error:', error);
      Alert.alert('Error', 'Failed to parse QR code data.');
      scannedRef.current = false;
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Save ---

  const saveToStash = async () => {
    if (!parsedData) return;
    setIsSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Session Expired', 'Please sign out and sign back in.');
        setIsSaving(false);
        return;
      }

      const coverImage = images[coverIndex] || images[0] || null;
      const row = {
        user_id: session.user.id,
        name: parsedData.name || null,
        company: parsedData.company || null,
        phone: parsedData.phone || null,
        additional_phone: parsedData.additionalPhone || null,
        email: parsedData.email || null,
        website: parsedData.website || null,
        additional_website: parsedData.additionalWebsite || null,
        address: parsedData.address || null,
        social_media: parsedData.socialMedia || null,
        notes: parsedData.notes || null,
        categories: selectedCategories.length > 0 ? selectedCategories : null,
        card_image_url: coverImage,
        card_images: images.length > 0 ? images : null,
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
      resetAll();
    } catch (error: any) {
      console.error('Save error:', error);
      Alert.alert('Error', `Failed to save: ${error?.message || error}`);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Render ---

  const renderCategoryPicker = () => {
    // Combine presets + any custom categories from DB that aren't presets
    const customFromDb = allKnownCategories.filter(c => !PRESET_CATEGORIES.includes(c));
    // Also include currently selected custom categories not yet in DB
    const customSelected = selectedCategories.filter(
      c => !PRESET_CATEGORIES.includes(c) && !customFromDb.includes(c)
    );
    const allCustom = [...customFromDb, ...customSelected];

    return (
      <View style={s.section}>
        <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.xs, fontFamily }]}>Categories</Text>
        <View style={s.chipRow}>
          {PRESET_CATEGORIES.map(cat => (
            <AnimatedPressable
              key={cat}
              scaleDown={0.92}
              onPress={() => toggleCategory(cat)}
              style={[s.chip, {
                backgroundColor: selectedCategories.includes(cat) ? colors.accent : colors.border,
              }]}
            >
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
    );
  };

  const updateParsedField = (key: string, value: string) => {
    setParsedData(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const renderParsedData = () => {
    if (!parsedData) return null;

    const fields: { key: keyof ParsedCard; label: string }[] = [
      { key: 'name', label: 'Name' },
      { key: 'company', label: 'Company' },
      { key: 'phone', label: 'Phone' },
      { key: 'additionalPhone', label: 'Additional Phone' },
      { key: 'email', label: 'Email' },
      { key: 'website', label: 'Website' },
      { key: 'additionalWebsite', label: 'Additional Website' },
      { key: 'address', label: 'Address' },
      { key: 'notes', label: 'Notes' },
    ];

    return (
      <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border, ...cardShadow(colors.cardShadow) }]}>
        <Text style={[s.cardTitle, { color: colors.text, fontSize: fontSizes.lg, fontFamily }]}>Extracted Information</Text>
        <Text style={[s.editHint, { color: colors.textMuted, fontSize: fontSizes.xs, fontFamily }]}>Tap any field to edit before saving</Text>

        {fields.map(({ key, label }) => {
          const value = parsedData[key];
          if (typeof value === 'object') return null;
          return (
            <View key={key} style={s.field}>
              <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.xs, fontFamily }]}>{label}</Text>
              <TextInput
                value={value || ''}
                onChangeText={text => updateParsedField(key, text)}
                placeholder={label}
                placeholderTextColor={colors.textMuted}
                multiline={key === 'address' || key === 'notes'}
                style={[s.input, {
                  backgroundColor: colors.inputBg,
                  borderColor: (value || '').trim() ? colors.accent + '55' : colors.inputBorder,
                  color: colors.text,
                  fontSize: fontSizes.base,
                  fontFamily,
                }, (key === 'address' || key === 'notes') && s.inputMultiline]}
              />
            </View>
          );
        })}

        {renderCategoryPicker()}

        <AnimatedPressable
          scaleDown={0.95}
          onPress={saveToStash}
          disabled={isSaving}
          style={[s.primaryBtn, {
            backgroundColor: isSaving ? colors.textMuted : colors.accent,
            opacity: isSaving ? 0.7 : 1,
          }]}
        >
          <Text style={[s.primaryBtnText, { fontSize: fontSizes.base, fontFamily }]}>{isSaving ? 'Saving...' : 'Save to Stash'}</Text>
        </AnimatedPressable>
      </View>
    );
  };

  return (
    <ScrollView style={[s.container, { backgroundColor: colors.bg }]} contentContainerStyle={[s.content, { paddingTop: headerHeight + 16, paddingBottom: tabBarHeight + 20 }]}>
      {/* Mode Toggle */}
      <View style={[s.modeToggle, { borderColor: colors.border }]}>
        <AnimatedPressable
          scaleDown={0.95}
          onPress={() => switchMode('card')}
          style={[s.modeBtn, { backgroundColor: mode === 'card' ? colors.accent : colors.bgCard }]}
        >
          <Text style={[s.modeBtnText, { color: mode === 'card' ? '#f7f7f7' : colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>
            Scan Card
          </Text>
        </AnimatedPressable>
        <AnimatedPressable
          scaleDown={0.95}
          onPress={() => switchMode('qr')}
          style={[s.modeBtn, { backgroundColor: mode === 'qr' ? colors.accent : colors.bgCard }]}
        >
          <Text style={[s.modeBtnText, { color: mode === 'qr' ? '#f7f7f7' : colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>
            QR Code
          </Text>
        </AnimatedPressable>
      </View>

      {/* Card Mode */}
      {mode === 'card' && !parsedData && !isProcessing && (
        <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border, ...cardShadow(colors.cardShadow) }]}>
          {images.length > 0 ? (
            <>
              <Image source={{ uri: images[coverIndex] || images[0] }} style={s.previewImage} resizeMode="contain" />
              {/* Thumbnail strip */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.thumbStrip}>
                {images.map((img, idx) => (
                  <Pressable key={idx} onPress={() => setCoverIndex(idx)} onLongPress={() => setCoverIndex(idx)}>
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
                {/* Add more button */}
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
              <View style={[s.row, { marginTop: 12, gap: 12 }]}>
                <AnimatedPressable scaleDown={0.95} onPress={resetAll}
                  style={[s.secondaryBtn, { flex: 1, backgroundColor: colors.border }]}>
                  <Text style={[s.secondaryBtnText, { color: colors.text, fontSize: fontSizes.base, fontFamily }]}>Start Over</Text>
                </AnimatedPressable>
              </View>
            </>
          ) : (
            <View style={s.uploadArea}>
              <View style={[s.iconCircle, { backgroundColor: colors.accent + '30' }]}>
                <Ionicons name="camera-outline" size={36} color={colors.accent} />
              </View>
              <Text style={[s.uploadTitle, { color: colors.text, fontSize: fontSizes.lg, fontFamily }]}>Scan Business Card</Text>
              <Text style={[s.uploadSub, { color: colors.textMuted, fontSize: fontSizes.sm, lineHeight: 20, fontFamily }]}>Take a photo or choose from gallery</Text>
              <View style={[s.row, { marginTop: 16 }]}>
                <AnimatedPressable scaleDown={0.95} onPress={() => pickImage(true)}
                  style={[s.primaryBtn, { flex: 1, marginTop: 0, backgroundColor: colors.accent }]}>
                  <Text style={[s.primaryBtnText, { fontSize: fontSizes.base, fontFamily }]}>Camera</Text>
                </AnimatedPressable>
                <View style={{ width: 12 }} />
                <AnimatedPressable scaleDown={0.95} onPress={() => pickImage(false)}
                  style={[s.secondaryBtn, { flex: 1, backgroundColor: colors.border }]}>
                  <Text style={[s.secondaryBtnText, { color: colors.text, fontSize: fontSizes.base, fontFamily }]}>Gallery</Text>
                </AnimatedPressable>
              </View>
            </View>
          )}
        </View>
      )}

      {/* QR Mode */}
      {mode === 'qr' && !parsedData && !isProcessing && (
        <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border, overflow: 'hidden', ...cardShadow(colors.cardShadow) }]}>
          {cameraActive ? (
            <>
              <CameraView
                style={s.qrCamera}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleBarcodeScan}
              />
              <AnimatedPressable scaleDown={0.95} onPress={() => setCameraActive(false)}
                style={[s.secondaryBtn, { backgroundColor: colors.border, margin: 12 }]}>
                <Text style={[s.secondaryBtnText, { color: colors.text, fontSize: fontSizes.base, fontFamily }]}>Stop Camera</Text>
              </AnimatedPressable>
            </>
          ) : (
            <View style={s.uploadArea}>
              <View style={[s.iconCircle, { backgroundColor: colors.accent + '30' }]}>
                <Ionicons name="qr-code-outline" size={36} color={colors.accent} />
              </View>
              <Text style={[s.uploadTitle, { color: colors.text, fontSize: fontSizes.lg, fontFamily }]}>Scan QR Code</Text>
              <Text style={[s.uploadSub, { color: colors.textMuted, fontSize: fontSizes.sm, lineHeight: 20, fontFamily }]}>Point camera at a QR code</Text>
              <View style={[s.row, { marginTop: 16 }]}>
                <AnimatedPressable scaleDown={0.95} onPress={startQrCamera}
                  style={[s.primaryBtn, { flex: 1, marginTop: 0, backgroundColor: colors.accent }]}>
                  <Text style={[s.primaryBtnText, { fontSize: fontSizes.base, fontFamily }]}>Open Camera</Text>
                </AnimatedPressable>
                <View style={{ width: 12 }} />
                <AnimatedPressable scaleDown={0.95} onPress={() => pickImage(false)}
                  style={[s.secondaryBtn, { flex: 1, backgroundColor: colors.border }]}>
                  <Text style={[s.secondaryBtnText, { color: colors.text, fontSize: fontSizes.base, fontFamily }]}>Upload</Text>
                </AnimatedPressable>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Processing */}
      {isProcessing && (
        <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border, alignItems: 'center', padding: 40, ...cardShadow(colors.cardShadow) }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[s.uploadTitle, { color: colors.text, marginTop: 16, fontSize: fontSizes.lg, fontFamily }]}>
            {mode === 'card' ? 'Analyzing card...' : 'Processing QR data...'}
          </Text>
          <Text style={[s.uploadSub, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Extracting contact information</Text>
        </View>
      )}

      {/* Results */}
      <FadeInView visible={!!parsedData}>
        {renderParsedData()}
        <AnimatedPressable scaleDown={0.95} onPress={resetAll}
          style={[s.secondaryBtn, { backgroundColor: colors.border, marginTop: 8 }]}>
          <Text style={[s.secondaryBtnText, { color: colors.text, fontSize: fontSizes.base, fontFamily }]}>Scan Another</Text>
        </AnimatedPressable>
      </FadeInView>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  modeToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modeBtnText: {
    fontWeight: '600',
  },
  card: {
    borderWidth: 0.5,
    borderRadius: 8,
    padding: 20,
    marginBottom: 12,
  },
  cardTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  editHint: {
    marginBottom: 16,
  },
  uploadArea: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadTitle: { fontWeight: '600', marginBottom: 4 },
  uploadSub: { marginBottom: 8 },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    marginBottom: 12,
  },
  thumbStrip: {
    marginBottom: 4,
  },
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
  coverBadgeText: {
    color: '#f7f7f7',
    fontSize: 10,
    fontWeight: '700',
  },
  addThumbBtn: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addThumbPlus: {
    fontSize: 24,
    fontWeight: '600',
  },
  qrCamera: {
    width: '100%',
    height: 300,
  },
  section: { marginTop: 16 },
  field: { marginBottom: 12 },
  label: { fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.2, marginBottom: 6 },
  value: {},
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  chipText: { fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  smallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 8,
    marginLeft: 8,
  },
  smallBtnText: { fontWeight: '600' },
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
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
  },
  secondaryBtnText: {
    fontWeight: '600',
  },
});
