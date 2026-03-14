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
import StashLoader from '@/components/StashLoader';

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

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cardCameraActive, setCardCameraActive] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);
  const cameraRef = useRef<any>(null);

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
    setCardCameraActive(false);
    scannedRef.current = false;
  };

  const switchMode = (newMode: ScanMode) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const wasCameraOn = cameraActive || cardCameraActive;
    // Reset data but preserve camera if it was open
    setImages([]);
    setCoverIndex(0);
    setParsedData(null);
    setSelectedCategories([]);
    setCustomCategory('');
    scannedRef.current = false;
    if (wasCameraOn) {
      // Transition camera to the new mode
      if (newMode === 'card') {
        setCameraActive(false);
        setCardCameraActive(true);
      } else {
        setCardCameraActive(false);
        setCameraActive(true);
      }
    } else {
      setCameraActive(false);
      setCardCameraActive(false);
    }
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

  const openCardCamera = async () => {
    try {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          Alert.alert('Permission Required', 'Camera permission is needed to scan cards.');
          return;
        }
      }
      setCardCameraActive(true);
    } catch (error) {
      console.error('Camera open error:', error);
      Alert.alert('Camera Error', 'Could not open camera. Try using Gallery instead.');
    }
  };

  const takeCardPhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.8 });
      if (photo?.base64) {
        const base64 = `data:image/jpeg;base64,${photo.base64}`;
        setCardCameraActive(false);
        setImages([base64]);
        setCoverIndex(0);
        processCardImage(base64);
      }
    } catch (error) {
      console.error('Take photo error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
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

      const { error: insertError } = await supabase.from('stash').insert(row);

      if (insertError) {
        throw new Error(insertError.message);
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

  const updateSocialField = (platform: string, value: string) => {
    setParsedData(prev => prev ? {
      ...prev,
      socialMedia: { ...prev.socialMedia, [platform]: value },
    } : prev);
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

        {/* Social Media */}
        {[
          { platform: 'facebook', label: 'Facebook', icon: 'logo-facebook' as const },
          { platform: 'instagram', label: 'Instagram', icon: 'logo-instagram' as const },
          { platform: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin' as const },
        ].map(({ platform, label, icon }) => (
          <View key={platform} style={s.field}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <Ionicons name={icon} size={14} color={colors.textMuted} />
              <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.xs, fontFamily, marginBottom: 0 }]}>{label}</Text>
            </View>
            <TextInput
              value={parsedData.socialMedia?.[platform as keyof typeof parsedData.socialMedia] || ''}
              onChangeText={text => updateSocialField(platform, text)}
              placeholder={`${label} URL or handle`}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              style={[s.input, {
                backgroundColor: colors.inputBg,
                borderColor: (parsedData.socialMedia?.[platform as keyof typeof parsedData.socialMedia] || '').trim() ? colors.accent + '55' : colors.inputBorder,
                color: colors.text,
                fontSize: fontSizes.base,
                fontFamily,
              }]}
            />
          </View>
        ))}

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

  // Show the initial empty state with bottom-anchored buttons
  const showInitialState = !parsedData && !isProcessing && images.length === 0 && !cameraActive && !cardCameraActive;

  // Pulse animation for the scan icon (must be before early return)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!showInitialState) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseRing, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseRing, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [showInitialState, pulseAnim, pulseRing]);

  const ringScale = pulseRing.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const ringOpacity = pulseRing.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0] });

  // When we have results, processing, or images — use the old scroll layout
  if (!showInitialState) {
    return (
      <ScrollView style={[s.container, { backgroundColor: colors.bg }]} contentContainerStyle={[s.content, { paddingTop: headerHeight + 16, paddingBottom: tabBarHeight + 20 }]}>
        {/* Mode Toggle */}
        <View style={[s.modeToggle, { borderColor: colors.border }]}>
          <AnimatedPressable scaleDown={0.95} onPress={() => switchMode('card')}
            style={[s.modeBtn, { backgroundColor: mode === 'card' ? colors.accent : colors.bgCard }]}>
            <Text style={[s.modeBtnText, { color: mode === 'card' ? '#f7f7f7' : colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Scan Card</Text>
          </AnimatedPressable>
          <AnimatedPressable scaleDown={0.95} onPress={() => switchMode('qr')}
            style={[s.modeBtn, { backgroundColor: mode === 'qr' ? colors.accent : colors.bgCard }]}>
            <Text style={[s.modeBtnText, { color: mode === 'qr' ? '#f7f7f7' : colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Scan QR Code</Text>
          </AnimatedPressable>
        </View>

        {/* Card camera with rectangle overlay */}
        {mode === 'card' && cardCameraActive && (
          <View style={s.cameraContainer}>
            <View style={s.cameraViewWrap}>
              <CameraView
                ref={cameraRef}
                style={s.cameraFull}
                facing="back"
              />
              {/* Rectangle overlay */}
              <View style={s.cardOverlay} pointerEvents="none">
                <View style={s.cardOverlayDim} />
                <View style={s.cardOverlayMiddle}>
                  <View style={s.cardOverlayDim} />
                  <View style={s.cardRect}>
                    <View style={[s.corner, s.cornerTL]} />
                    <View style={[s.corner, s.cornerTR]} />
                    <View style={[s.corner, s.cornerBL]} />
                    <View style={[s.corner, s.cornerBR]} />
                  </View>
                  <View style={s.cardOverlayDim} />
                </View>
                <View style={s.cardOverlayDim} />
              </View>
              <Text style={s.cardCameraHint}>Align card within the frame</Text>
            </View>
            <View style={{ padding: 14, gap: 8 }}>
              <AnimatedPressable scaleDown={0.95} onPress={takeCardPhoto}
                style={[s.primaryBtn, { marginTop: 0, backgroundColor: colors.accent }]}>
                <Text style={[s.primaryBtnText, { fontSize: fontSizes.base, fontFamily }]}>Capture</Text>
              </AnimatedPressable>
              <AnimatedPressable scaleDown={0.95} onPress={() => setCardCameraActive(false)}
                style={[s.ghostBtn, { borderColor: colors.border }]}>
                <Text style={[s.secondaryBtnText, { color: colors.textMuted, fontSize: fontSizes.base, fontFamily }]}>Cancel</Text>
              </AnimatedPressable>
            </View>
          </View>
        )}

        {/* Card mode with images selected */}
        {mode === 'card' && !parsedData && !isProcessing && !cardCameraActive && images.length > 0 && (
          <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border, ...cardShadow(colors.cardShadow) }]}>
            <Image source={{ uri: images[coverIndex] || images[0] }} style={s.previewImage} resizeMode="contain" />
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
          </View>
        )}

        {/* QR mode with camera active */}
        {mode === 'qr' && cameraActive && (
          <View style={s.cameraContainer}>
            <View style={s.cameraViewWrap}>
              <CameraView
                style={s.cameraFull}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleBarcodeScan}
              />
              {/* QR crosshair overlay — just corners, no dimming */}
              <View style={s.qrOverlay} pointerEvents="none">
                <View style={s.qrRect}>
                  <View style={[s.corner, s.cornerTL]} />
                  <View style={[s.corner, s.cornerTR]} />
                  <View style={[s.corner, s.cornerBL]} />
                  <View style={[s.corner, s.cornerBR]} />
                </View>
              </View>
              <Text style={s.cardCameraHint}>Point at a QR code</Text>
            </View>
            <View style={{ padding: 14 }}>
              <AnimatedPressable scaleDown={0.95} onPress={() => setCameraActive(false)}
                style={[s.ghostBtn, { borderColor: colors.border }]}>
                <Text style={[s.secondaryBtnText, { color: colors.textMuted, fontSize: fontSizes.base, fontFamily }]}>Cancel</Text>
              </AnimatedPressable>
            </View>
          </View>
        )}

        {/* Processing */}
        {isProcessing && (
          <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border, alignItems: 'center', padding: 40, ...cardShadow(colors.cardShadow) }]}>
            <StashLoader size={70} message={mode === 'card' ? 'Analyzing card...' : 'Processing QR data...'} />
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

  return (
    <View style={[s.container, s.initialLayout, { backgroundColor: colors.bg, paddingTop: headerHeight + 16, paddingBottom: tabBarHeight + 12 }]}>
      {/* Tappable icon with pulse ring */}
      <AnimatedPressable
        scaleDown={0.9}
        onPress={mode === 'card' ? openCardCamera : startQrCamera}
        style={{ marginBottom: 24 }}
      >
        <View style={s.pulseWrap}>
          <Animated.View style={[s.pulseRing, {
            backgroundColor: colors.accent,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          }]} />
          <Animated.View style={[s.scanIconCircleLg, {
            backgroundColor: colors.accent + '15',
            transform: [{ scale: pulseAnim }],
          }]}>
            <Ionicons name={mode === 'card' ? 'camera-outline' : 'qr-code-outline'} size={44} color={colors.accent} />
          </Animated.View>
        </View>
      </AnimatedPressable>

      {/* Title + subtitle */}
      <Text style={[s.scanHeroTitle, { color: colors.text, fontSize: fontSizes.xl, fontFamily }]}>
        {mode === 'card' ? 'Scan Business Card' : 'Scan QR Code'}
      </Text>
      <Text style={[s.scanHeroSub, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily, marginTop: 6 }]}>
        {mode === 'card' ? 'Tap to open camera or choose from gallery' : 'Point your camera at a QR code'}
      </Text>

      {/* Primary action */}
      <AnimatedPressable scaleDown={0.95} onPress={mode === 'card' ? openCardCamera : startQrCamera}
        style={[s.primaryBtn, { marginTop: 28, alignSelf: 'stretch', backgroundColor: colors.accent }]}>
        <Text style={[s.primaryBtnText, { fontSize: fontSizes.base, fontFamily }]}>Open Camera</Text>
      </AnimatedPressable>

      {/* Secondary links */}
      <View style={s.secondaryLinks}>
        <Pressable onPress={() => pickImage(false)} style={s.secondaryLink}>
          <Ionicons name="images-outline" size={14} color={colors.textMuted} />
          <Text style={[{ color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>
            Choose from gallery
          </Text>
        </Pressable>
        <Pressable onPress={() => switchMode(mode === 'card' ? 'qr' : 'card')} style={s.secondaryLink}>
          <Ionicons name={mode === 'card' ? 'qr-code-outline' : 'card-outline'} size={14} color={colors.textMuted} />
          <Text style={[{ color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>
            {mode === 'card' ? 'Scan QR code instead' : 'Scan card instead'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  initialLayout: { justifyContent: 'center' as const, alignItems: 'center' as const, paddingHorizontal: 16 },
  content: { paddingHorizontal: 16 },
  modeToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
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
  scanCard: {
    borderWidth: 0.5,
    borderRadius: 12,
    padding: 20,
    marginBottom: 10,
    alignItems: 'center',
  },
  scanIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  pulseWrap: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  scanIconCircleLg: {
    width: 92,
    height: 92,
    borderRadius: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanHeroTitle: {
    fontWeight: '700',
    textAlign: 'center',
  },
  scanHeroSub: {
    textAlign: 'center',
  },
  secondaryLinks: {
    marginTop: 20,
    alignItems: 'center',
    gap: 14,
  },
  secondaryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scanCardText: {
    alignItems: 'center',
    marginBottom: 2,
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
  uploadTitle: { fontWeight: '600', marginBottom: 2 },
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
  cameraContainer: {
    marginBottom: 12,
  },
  cameraViewWrap: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  cameraFull: {
    width: '100%',
    height: 420,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  captureBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  camSideBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(128,128,128,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrRect: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 16,
    position: 'relative',
  },
  cardCameraWrap: {
    position: 'relative',
  },
  cardCamera: {
    width: '100%',
    height: 360,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardOverlayDim: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cardOverlayMiddle: {
    flexDirection: 'row',
    height: 180,
  },
  cardRect: {
    width: 300,
    height: 180,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 12,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#fff',
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  cardCameraHint: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  featuresSection: {
    marginBottom: 12,
  },
  featuresTitle: {
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    flex: 1,
  },
  featureRowTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  featureRowDesc: {
    lineHeight: 18,
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
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: {
    color: '#f7f7f7',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontWeight: '600',
  },
  ghostBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
});
