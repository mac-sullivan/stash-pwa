import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, Image,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { parseCardImage, parseQrText } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { PRESET_CATEGORIES } from '@/lib/constants';
import type { ParsedCard } from '@/lib/types';

type ScanMode = 'card' | 'qr';

export default function ScanScreen() {
  const { colors } = useTheme();
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
      const coverImage = images[coverIndex] || images[0] || null;
      const { error } = await supabase
        .from('stash')
        .insert([{
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
        }]);

      if (error) throw error;

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
        <Text style={[s.label, { color: colors.textMuted }]}>Categories</Text>
        <View style={s.chipRow}>
          {PRESET_CATEGORIES.map(cat => (
            <Pressable
              key={cat}
              onPress={() => toggleCategory(cat)}
              style={[s.chip, {
                backgroundColor: selectedCategories.includes(cat) ? colors.accent : colors.border,
              }]}
            >
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
    );
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
    ];

    return (
      <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[s.cardTitle, { color: colors.text }]}>Extracted Information</Text>

        {fields.map(({ key, label }) => {
          const value = parsedData[key];
          if (!value || typeof value === 'object') return null;
          return (
            <View key={key} style={s.field}>
              <Text style={[s.label, { color: colors.textMuted }]}>{label}</Text>
              <Text style={[s.value, { color: colors.text }]}>{value}</Text>
            </View>
          );
        })}

        {renderCategoryPicker()}

        <Pressable
          onPress={saveToStash}
          disabled={isSaving}
          style={[s.primaryBtn, {
            backgroundColor: isSaving ? colors.textMuted : colors.accent,
            opacity: isSaving ? 0.7 : 1,
          }]}
        >
          <Text style={s.primaryBtnText}>{isSaving ? 'Saving...' : 'Save to Stash'}</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <ScrollView style={[s.container, { backgroundColor: colors.bg }]} contentContainerStyle={s.content}>
      {/* Mode Toggle */}
      <View style={[s.modeToggle, { borderColor: colors.border }]}>
        <Pressable
          onPress={() => switchMode('card')}
          style={[s.modeBtn, { backgroundColor: mode === 'card' ? colors.accent : colors.bgCard }]}
        >
          <Text style={[s.modeBtnText, { color: mode === 'card' ? '#fff' : colors.textMuted }]}>
            📸 Scan Card
          </Text>
        </Pressable>
        <Pressable
          onPress={() => switchMode('qr')}
          style={[s.modeBtn, { backgroundColor: mode === 'qr' ? colors.accent : colors.bgCard }]}
        >
          <Text style={[s.modeBtnText, { color: mode === 'qr' ? '#fff' : colors.textMuted }]}>
            QR Code
          </Text>
        </Pressable>
      </View>

      {/* Card Mode */}
      {mode === 'card' && !parsedData && !isProcessing && (
        <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
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
                        <Text style={s.coverBadgeText}>★</Text>
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
                  <Text style={[s.addThumbPlus, { color: colors.textMuted }]}>+</Text>
                </Pressable>
              </ScrollView>
              <View style={[s.row, { marginTop: 12, gap: 12 }]}>
                <Pressable onPress={resetAll} style={[s.secondaryBtn, { flex: 1, backgroundColor: colors.border }]}>
                  <Text style={[s.secondaryBtnText, { color: colors.text }]}>Start Over</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={s.uploadArea}>
              <Text style={s.uploadIcon}>📸</Text>
              <Text style={[s.uploadTitle, { color: colors.text }]}>Scan Business Card</Text>
              <Text style={[s.uploadSub, { color: colors.textMuted }]}>Take a photo or choose from gallery</Text>
              <View style={[s.row, { marginTop: 16 }]}>
                <Pressable onPress={() => pickImage(true)}
                  style={[s.primaryBtn, { flex: 1, marginTop: 0, backgroundColor: colors.accent }]}>
                  <Text style={s.primaryBtnText}>Camera</Text>
                </Pressable>
                <View style={{ width: 12 }} />
                <Pressable onPress={() => pickImage(false)}
                  style={[s.secondaryBtn, { flex: 1, backgroundColor: colors.border }]}>
                  <Text style={[s.secondaryBtnText, { color: colors.text }]}>Gallery</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}

      {/* QR Mode */}
      {mode === 'qr' && !parsedData && !isProcessing && (
        <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border, overflow: 'hidden' }]}>
          {cameraActive ? (
            <>
              <CameraView
                style={s.qrCamera}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleBarcodeScan}
              />
              <Pressable onPress={() => setCameraActive(false)}
                style={[s.secondaryBtn, { backgroundColor: colors.border, margin: 12 }]}>
                <Text style={[s.secondaryBtnText, { color: colors.text }]}>Stop Camera</Text>
              </Pressable>
            </>
          ) : (
            <View style={s.uploadArea}>
              <Text style={s.uploadIcon}>📱</Text>
              <Text style={[s.uploadTitle, { color: colors.text }]}>Scan QR Code</Text>
              <Text style={[s.uploadSub, { color: colors.textMuted }]}>Point camera at a QR code</Text>
              <View style={[s.row, { marginTop: 16 }]}>
                <Pressable onPress={startQrCamera}
                  style={[s.primaryBtn, { flex: 1, marginTop: 0, backgroundColor: colors.accent }]}>
                  <Text style={s.primaryBtnText}>Open Camera</Text>
                </Pressable>
                <View style={{ width: 12 }} />
                <Pressable onPress={() => pickImage(false)}
                  style={[s.secondaryBtn, { flex: 1, backgroundColor: colors.border }]}>
                  <Text style={[s.secondaryBtnText, { color: colors.text }]}>Upload</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Processing */}
      {isProcessing && (
        <View style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border, alignItems: 'center', padding: 40 }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[s.uploadTitle, { color: colors.text, marginTop: 16 }]}>
            {mode === 'card' ? 'Analyzing card...' : 'Processing QR data...'}
          </Text>
          <Text style={[s.uploadSub, { color: colors.textMuted }]}>Extracting contact information</Text>
        </View>
      )}

      {/* Results */}
      {parsedData && (
        <>
          {renderParsedData()}
          <Pressable onPress={resetAll}
            style={[s.secondaryBtn, { backgroundColor: colors.border, marginTop: 8 }]}>
            <Text style={[s.secondaryBtnText, { color: colors.text }]}>Scan Another</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  modeToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  uploadArea: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  uploadIcon: { fontSize: 48, marginBottom: 12 },
  uploadTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  uploadSub: { fontSize: 14, marginBottom: 8 },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
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
    color: '#fff',
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
  label: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  value: { fontSize: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  smallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 8,
  },
  smallBtnText: { fontSize: 13, fontWeight: '600' },
  primaryBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
