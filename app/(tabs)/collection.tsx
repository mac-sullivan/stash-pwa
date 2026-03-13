import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, FlatList, TextInput, Image, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Linking, RefreshControl,
  Animated, LayoutAnimation, Platform, UIManager, Share, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { PRESET_CATEGORIES, cardShadow } from '@/lib/constants';
import type { StashCard } from '@/lib/types';
import { formatCardText, formatCategoryCards, shareAsContact } from '@/lib/sharing';
import { useFocusEffect } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import ImageLightbox from '@/components/ImageLightbox';
import AnimatedPressable from '@/components/AnimatedPressable';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function FadeInCard({ index, children }: { index: number; children: React.ReactNode }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const delay = index * 80;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      {children}
    </Animated.View>
  );
}

function ChevronAnimated({ expanded, color }: { expanded: boolean; color: string }) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rotation, {
      toValue: expanded ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [expanded, rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Ionicons name="chevron-down" size={16} color={color} />
    </Animated.View>
  );
}

export default function CollectionScreen() {
  const { colors, fontSizes, fontFamily } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const [cards, setCards] = useState<StashCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<StashCard>>({});
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [customCategory, setCustomCategory] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editCoverUrl, setEditCoverUrl] = useState<string | null>(null);
  const [removedCategories, setRemovedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'recent' | 'a-z' | 'z-a'>('recent');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(60)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;

  const filtersActive = activeFilters.length > 0 || sortBy !== 'recent';

  const openSheet = () => {
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(60);
    sheetOpacity.setValue(0);
    setSheetVisible(true);
  };

  useEffect(() => {
    if (sheetVisible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          tension: 55,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(sheetOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [sheetVisible, backdropOpacity, sheetTranslateY, sheetOpacity]);

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 60,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(sheetOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSheetVisible(false);
    });
  };

  const fetchCards = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('stash')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCards(data || []);
      setAnimKey(prev => prev + 1);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCards();
    }, [fetchCards])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchCards();
  };

  const toggleExpand = (id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const filteredAndSorted = (() => {
    const filtered = activeFilters.length > 0
      ? cards.filter(c => activeFilters.some(f => c.categories?.includes(f)))
      : cards;
    if (sortBy === 'recent') return filtered;
    return [...filtered].sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return sortBy === 'a-z' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
  })();

  const categoryCounts = cards.reduce<Record<string, number>>((acc, c) => {
    (c.categories || []).forEach(cat => { acc[cat] = (acc[cat] || 0) + 1; });
    return acc;
  }, {});

  const allCategories = Object.keys(categoryCounts).sort();

  // Sort: active filters first, then alphabetical
  const sortedFilterCategories = [...allCategories].sort((a, b) => {
    const aActive = activeFilters.includes(a);
    const bActive = activeFilters.includes(b);
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return a.localeCompare(b);
  });

  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxVisible(true);
  };

  const getCardImages = (card: StashCard): string[] => {
    if (card.card_images && card.card_images.length > 0) return card.card_images;
    if (card.card_image_url) return [card.card_image_url];
    return [];
  };

  const addEditImage = async (useCamera: boolean) => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    };
    const result = useCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]?.base64) {
      const uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setEditImages(prev => [...prev, uri]);
    }
  };

  const startEdit = (card: StashCard) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditingId(card.id);
    setEditData({
      name: card.name,
      company: card.company,
      phone: card.phone,
      additional_phone: card.additional_phone,
      email: card.email,
      website: card.website,
      additional_website: card.additional_website,
      address: card.address,
      notes: card.notes,
      social_media: card.social_media || { facebook: '', instagram: '', linkedin: '' },
    });
    setEditCategories(card.categories || []);
    setEditImages(getCardImages(card));
    setEditCoverUrl(card.card_image_url);
    setRemovedCategories([]);
    setCustomCategory('');
  };

  const cancelEdit = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditingId(null);
    setEditData({});
    setEditCategories([]);
    setEditImages([]);
    setEditCoverUrl(null);
    setRemovedCategories([]);
    setCustomCategory('');
  };

  const saveEdit = async (id: number) => {
    setSavingId(id);
    try {
      const coverUrl = editCoverUrl && editImages.includes(editCoverUrl)
        ? editCoverUrl
        : editImages[0] || null;
      const { error } = await supabase
        .from('stash')
        .update({
          name: editData.name || null,
          company: editData.company || null,
          phone: editData.phone || null,
          additional_phone: editData.additional_phone || null,
          email: editData.email || null,
          website: editData.website || null,
          additional_website: editData.additional_website || null,
          address: editData.address || null,
          notes: editData.notes || null,
          social_media: editData.social_media && Object.values(editData.social_media).some(v => v)
            ? editData.social_media
            : null,
          categories: editCategories.length > 0 ? editCategories : null,
          card_image_url: coverUrl,
          card_images: editImages.length > 0 ? editImages : null,
        })
        .eq('id', id);

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      cancelEdit();
      fetchCards();
    } catch (error: any) {
      console.error('Save error:', error);
      Alert.alert('Error', `Failed to save changes: ${error?.message || error}`);
    } finally {
      setSavingId(null);
    }
  };

  const deleteCard = (id: number) => {
    Alert.alert('Delete Card', 'Are you sure you want to delete this card?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(id);
          try {
            const { error } = await supabase.from('stash').delete().eq('id', id);
            if (error) throw error;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setExpandedId(null);
            // Remove card from local state immediately — no flash
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setCards(prev => prev.filter(c => c.id !== id));
            setDeletingId(null);
          } catch (error) {
            console.error('Delete error:', error);
            setDeletingId(null);
            Alert.alert('Error', 'Failed to delete card.');
          }
        },
      },
    ]);
  };

  const toggleEditCategory = (cat: string) => {
    setEditCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const removeUnusedCategory = async (cat: string) => {
    try {
      // Remove from ALL cards that have this category (including the current one)
      const cardsWithCat = cards.filter(c => c.categories?.includes(cat));
      for (const c of cardsWithCat) {
        const updated = (c.categories || []).filter(x => x !== cat);
        await supabase.from('stash').update({
          categories: updated.length > 0 ? updated : null,
        }).eq('id', c.id);
      }
      // Remove from current card's edit state
      setEditCategories(prev => prev.filter(c => c !== cat));
      // Hide from the edit UI immediately
      setRemovedCategories(prev => [...prev, cat]);
      // Refresh cards so categoryCounts updates
      await fetchCards();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Remove category error:', error);
      Alert.alert('Error', 'Failed to remove category.');
    }
  };

  const addEditCustomCategory = () => {
    const trimmed = customCategory.trim();
    if (trimmed && !editCategories.includes(trimmed)) {
      setEditCategories(prev => [...prev, trimmed]);
    }
    setCustomCategory('');
  };

  const openLink = (url: string, platform?: string) => {
    let formatted = url.trim();
    // Handle social media handles (e.g. @username or plain username)
    if (platform && !formatted.includes('.') && !formatted.startsWith('http')) {
      const handle = formatted.replace(/^@/, '');
      const bases: Record<string, string> = {
        instagram: `https://instagram.com/${handle}`,
        facebook: `https://facebook.com/${handle}`,
        linkedin: `https://linkedin.com/in/${handle}`,
      };
      formatted = bases[platform] || `https://${formatted}`;
    } else if (!formatted.startsWith('http')) {
      formatted = `https://${formatted}`;
    }
    Linking.openURL(formatted);
  };

  const shareCard = async (card: StashCard) => {
    try {
      await Share.share({ message: formatCardText(card) });
    } catch (error) {
      console.log('Share cancelled:', error);
    }
  };

  const shareFilteredCards = async () => {
    try {
      const label = activeFilters.length === 1
        ? activeFilters[0]
        : `${activeFilters.length} Categories`;
      await Share.share({ message: formatCategoryCards(filteredAndSorted, label) });
    } catch (error) {
      console.log('Share cancelled:', error);
    }
  };

  const renderEditField = (label: string, key: keyof StashCard) => (
    <View style={s.field} key={key}>
      <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>{label}</Text>
      <TextInput
        value={(editData[key] as string) || ''}
        onChangeText={text => setEditData(prev => ({ ...prev, [key]: text }))}
        style={[s.editInput, {
          backgroundColor: colors.inputBg,
          borderColor: colors.inputBorder,
          color: colors.text,
          fontSize: fontSizes.base,
          fontFamily,
        }]}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );

  const renderCard = ({ item: card, index }: { item: StashCard; index: number }) => {
    const isExpanded = expandedId === card.id;
    const isEditing = editingId === card.id;
    const isDeleting = deletingId === card.id;
    const quickField = card.phone ? 'phone' : card.email ? 'email' : card.address ? 'address' : null;

    return (
      <FadeInCard index={index} key={`${card.id}-${animKey}`}>
        <AnimatedPressable
          scaleDown={0.98}
          disabled={isDeleting}
          onPress={() => {
            if (!isEditing) toggleExpand(card.id);
          }}
          style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border, ...cardShadow(colors.cardShadow) }, isDeleting && { opacity: 0.5 }]}
        >
          {isDeleting && (
            <View style={s.deletingOverlay}>
              <ActivityIndicator size="small" color="#a10c0c" />
              <Text style={[s.deletingText, { fontFamily }]}>Deleting...</Text>
            </View>
          )}
          {/* Top section: info + image side by side */}
          <View style={s.cardTop}>
            <View style={s.cardInfo}>
              <Text style={[s.cardName, { color: colors.text, fontSize: fontSizes.lg, fontFamily }]} numberOfLines={1}>
                {card.name || 'Unknown'}
              </Text>
              {card.company && (
                <Text style={[s.cardCompany, { color: colors.textMuted, fontSize: fontSizes.base, fontFamily }]} numberOfLines={1}>
                  {card.company}
                </Text>
              )}

              {/* Category chips */}
              {card.categories && card.categories.length > 0 && !isEditing && (
                <View style={s.chipRow}>
                  {card.categories.map(cat => (
                    <AnimatedPressable key={cat} scaleDown={0.92}
                      style={[s.chip, { backgroundColor: colors.accent }]}>
                      <Text style={[s.chipText, { color: '#f7f7f7', fontSize: fontSizes.sm, fontFamily }]}>{cat}</Text>
                    </AnimatedPressable>
                  ))}
                </View>
              )}

              {/* Quick info — show first available field */}
              {!isEditing && (() => {
                if (card.phone) return (
                  <View style={s.quickInfo}>
                    <Pressable onPress={(e) => { e.stopPropagation(); Linking.openURL(`tel:${card.phone}`); }}>
                      <View style={s.field}>
                        <View style={s.fieldLabel}>
                          <Ionicons name="call-outline" size={14} color={colors.textMuted} />
                          <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Phone</Text>
                        </View>
                        <Text style={[s.value, { color: colors.link, fontSize: fontSizes.base, fontFamily, textDecorationLine: 'underline' }]} numberOfLines={1}>{card.phone}</Text>
                      </View>
                    </Pressable>
                  </View>
                );
                if (card.email) return (
                  <View style={s.quickInfo}>
                    <Pressable onPress={(e) => { e.stopPropagation(); Linking.openURL(`mailto:${card.email}`); }}>
                      <View style={s.field}>
                        <View style={s.fieldLabel}>
                          <Ionicons name="mail-outline" size={14} color={colors.textMuted} />
                          <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Email</Text>
                        </View>
                        <Text style={[s.value, { color: colors.link, fontSize: fontSizes.base, fontFamily, textDecorationLine: 'underline' }]} numberOfLines={1}>{card.email}</Text>
                      </View>
                    </Pressable>
                  </View>
                );
                if (card.address) return (
                  <View style={s.quickInfo}>
                    <Pressable onPress={(e) => { e.stopPropagation(); Linking.openURL(`maps:0,0?q=${encodeURIComponent(card.address!)}`); }}>
                      <View style={s.field}>
                        <View style={s.fieldLabel}>
                          <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                          <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Address</Text>
                        </View>
                        <Text style={[s.value, { color: colors.link, fontSize: fontSizes.base, fontFamily, textDecorationLine: 'underline' }]} numberOfLines={1}>{card.address}</Text>
                      </View>
                    </Pressable>
                  </View>
                );
                return null;
              })()}
            </View>

            {card.card_image_url && (
              <Pressable onPress={(e) => {
                e.stopPropagation();
                openLightbox(getCardImages(card), 0);
              }}>
                <Image
                  source={{ uri: card.card_image_url }}
                  style={s.cardThumb}
                  resizeMode="cover"
                />
              </Pressable>
            )}
          </View>

          {/* Expanded view */}
          {isExpanded && !isEditing && (
            <View>
              {card.phone && quickField !== 'phone' && (
                <Pressable onPress={() => Linking.openURL(`tel:${card.phone}`)} style={s.linkField}>
                  <View style={s.field}>
                    <View style={s.fieldLabel}>
                      <Ionicons name="call-outline" size={14} color={colors.textMuted} />
                      <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Phone</Text>
                    </View>
                    <View style={s.linkValue}>
                      <Text style={[s.value, { color: colors.link, fontSize: fontSizes.base, fontFamily, textDecorationLine: 'underline' }]}>{card.phone}</Text>
                      <Ionicons name="open-outline" size={14} color={colors.link} />
                    </View>
                  </View>
                </Pressable>
              )}
              {card.additional_phone && (
                <Pressable onPress={() => Linking.openURL(`tel:${card.additional_phone}`)} style={s.linkField}>
                  <View style={s.field}>
                    <View style={s.fieldLabel}>
                      <Ionicons name="call-outline" size={14} color={colors.textMuted} />
                      <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Additional Phone</Text>
                    </View>
                    <View style={s.linkValue}>
                      <Text style={[s.value, { color: colors.link, fontSize: fontSizes.base, fontFamily, textDecorationLine: 'underline' }]}>{card.additional_phone}</Text>
                      <Ionicons name="open-outline" size={14} color={colors.link} />
                    </View>
                  </View>
                </Pressable>
              )}
              {card.email && quickField !== 'email' && (
                <Pressable onPress={() => Linking.openURL(`mailto:${card.email}`)} style={s.linkField}>
                  <View style={s.field}>
                    <View style={s.fieldLabel}>
                      <Ionicons name="mail-outline" size={14} color={colors.textMuted} />
                      <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Email</Text>
                    </View>
                    <View style={s.linkValue}>
                      <Text style={[s.value, { color: colors.link, fontSize: fontSizes.base, fontFamily, textDecorationLine: 'underline' }]}>{card.email}</Text>
                      <Ionicons name="open-outline" size={14} color={colors.link} />
                    </View>
                  </View>
                </Pressable>
              )}
              {card.website && (
                <Pressable onPress={() => openLink(card.website!)} style={s.linkField}>
                  <View style={s.field}>
                    <View style={s.fieldLabel}>
                      <Ionicons name="globe-outline" size={14} color={colors.textMuted} />
                      <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Website</Text>
                    </View>
                    <View style={s.linkValue}>
                      <Text style={[s.value, { color: colors.link, fontSize: fontSizes.base, fontFamily, textDecorationLine: 'underline' }]}>{card.website}</Text>
                      <Ionicons name="open-outline" size={14} color={colors.link} />
                    </View>
                  </View>
                </Pressable>
              )}
              {card.additional_website && (
                <Pressable onPress={() => openLink(card.additional_website!)} style={s.linkField}>
                  <View style={s.field}>
                    <View style={s.fieldLabel}>
                      <Ionicons name="globe-outline" size={14} color={colors.textMuted} />
                      <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Additional Website</Text>
                    </View>
                    <View style={s.linkValue}>
                      <Text style={[s.value, { color: colors.link, fontSize: fontSizes.base, fontFamily, textDecorationLine: 'underline' }]}>{card.additional_website}</Text>
                      <Ionicons name="open-outline" size={14} color={colors.link} />
                    </View>
                  </View>
                </Pressable>
              )}
              {card.address && quickField !== 'address' && (
                <Pressable onPress={() => Linking.openURL(`maps:0,0?q=${encodeURIComponent(card.address!)}`)} style={s.linkField}>
                  <View style={s.field}>
                    <View style={s.fieldLabel}>
                      <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                      <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Address</Text>
                    </View>
                    <View style={s.linkValue}>
                      <Text style={[s.value, { color: colors.link, fontSize: fontSizes.base, fontFamily, textDecorationLine: 'underline' }]}>{card.address}</Text>
                      <Ionicons name="open-outline" size={14} color={colors.link} />
                    </View>
                  </View>
                </Pressable>
              )}
              {card.notes && (
                <View style={s.field}>
                  <View style={s.fieldLabel}>
                    <Ionicons name="document-text-outline" size={14} color={colors.textMuted} />
                    <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Notes</Text>
                  </View>
                  <Text style={[s.value, { color: colors.text, fontSize: fontSizes.base, fontFamily }]}>{card.notes}</Text>
                </View>
              )}
              {card.social_media && Object.entries(card.social_media).some(([, v]) => v) && (
                <View style={s.field}>
                  <View style={s.fieldLabel}>
                    <Ionicons name="people-outline" size={14} color={colors.textMuted} />
                    <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Social Media</Text>
                  </View>
                  {Object.entries(card.social_media).map(([platform, url]) =>
                    url ? (
                      <Pressable key={platform} onPress={() => openLink(url, platform)}>
                        <Text style={[s.socialLink, { color: colors.link, fontSize: fontSizes.base, fontFamily }]}>
                          {platform.charAt(0).toUpperCase() + platform.slice(1)}
                        </Text>
                      </Pressable>
                    ) : null
                  )}
                </View>
              )}

              {/* Image gallery thumbnails */}
              {getCardImages(card).length > 1 && (
                <View style={s.field}>
                  <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>
                    Images ({getCardImages(card).length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.galleryRow}>
                    {getCardImages(card).map((img, idx) => (
                      <Pressable key={idx} onPress={() => openLightbox(getCardImages(card), idx)}>
                        <Image source={{ uri: img }} style={[s.galleryThumb, {
                          borderColor: img === card.card_image_url ? colors.accent : colors.border,
                        }]} resizeMode="cover" />
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={[s.actionGrid, { borderTopColor: colors.border }]}>
                <View style={s.actionRow}>
                  <AnimatedPressable onPress={() => shareCard(card)} scaleDown={0.95}
                    style={[s.actionBtn, { flex: 1, backgroundColor: colors.border }]}>
                    <View style={s.actionBtnInner}>
                      <Ionicons name="share-outline" size={16} color={colors.text} />
                      <Text style={[s.actionBtnText, { color: colors.text, fontSize: fontSizes.base, fontFamily }]}>Share</Text>
                    </View>
                  </AnimatedPressable>
                  <AnimatedPressable onPress={() => shareAsContact(card)} scaleDown={0.95}
                    style={[s.actionBtn, { flex: 1, backgroundColor: colors.border }]}>
                    <View style={s.actionBtnInner}>
                      <Ionicons name="person-add-outline" size={16} color={colors.text} />
                      <Text style={[s.actionBtnText, { color: colors.text, fontSize: fontSizes.base, fontFamily }]}>Contact</Text>
                    </View>
                  </AnimatedPressable>
                </View>
                <View style={s.actionRow}>
                  <AnimatedPressable onPress={() => startEdit(card)} scaleDown={0.95}
                    style={[s.actionBtn, { flex: 1, backgroundColor: colors.accent }]}>
                    <View style={s.actionBtnInner}>
                      <Ionicons name="create-outline" size={16} color="#f7f7f7" />
                      <Text style={[s.actionBtnText, { fontSize: fontSizes.base, fontFamily }]}>Edit</Text>
                    </View>
                  </AnimatedPressable>
                  <AnimatedPressable onPress={() => deleteCard(card.id)} scaleDown={0.95}
                    style={[s.actionBtn, { flex: 1, backgroundColor: '#a10c0c' }]}>
                    <View style={s.actionBtnInner}>
                      <Ionicons name="trash-outline" size={16} color="#f7f7f7" />
                      <Text style={[s.actionBtnText, { fontSize: fontSizes.base, fontFamily }]}>Delete</Text>
                    </View>
                  </AnimatedPressable>
                </View>
              </View>
            </View>
          )}

          {/* Edit mode */}
          {isEditing && (
            <View style={s.editContent}>
              {renderEditField('Name', 'name')}
              {renderEditField('Company', 'company')}
              {renderEditField('Phone', 'phone')}
              {renderEditField('Additional Phone', 'additional_phone')}
              {renderEditField('Email', 'email')}
              {renderEditField('Website', 'website')}
              {renderEditField('Additional Website', 'additional_website')}
              {renderEditField('Address', 'address')}
              {renderEditField('Notes', 'notes')}

              {/* Social Media */}
              {[
                { platform: 'facebook', label: 'Facebook', icon: 'logo-facebook' as const },
                { platform: 'instagram', label: 'Instagram', icon: 'logo-instagram' as const },
                { platform: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin' as const },
              ].map(({ platform, label, icon }) => (
                <View style={s.field} key={platform}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <Ionicons name={icon} size={14} color={colors.textMuted} />
                    <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily, marginBottom: 0 }]}>{label}</Text>
                  </View>
                  <TextInput
                    value={(editData.social_media as any)?.[platform] || ''}
                    onChangeText={text => setEditData(prev => ({
                      ...prev,
                      social_media: { ...(prev.social_media as any), [platform]: text },
                    }))}
                    placeholder={`${label} URL or handle`}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    style={[s.editInput, {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                      color: colors.text,
                      fontSize: fontSizes.base,
                      fontFamily,
                    }]}
                  />
                </View>
              ))}

              {/* Image editor */}
              <View style={s.field}>
                <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Images</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.galleryRow}>
                  {editImages.map((img, idx) => (
                    <View key={idx} style={s.editThumbWrap}>
                      <Pressable onPress={() => openLightbox(editImages, idx)}>
                        <Image source={{ uri: img }} style={[s.galleryThumb, {
                          borderColor: img === editCoverUrl ? colors.accent : colors.border,
                        }]} resizeMode="cover" />
                      </Pressable>
                      <View style={s.editThumbActions}>
                        <Pressable onPress={() => setEditCoverUrl(img)} hitSlop={4}
                          style={[s.thumbActionBtn, { backgroundColor: img === editCoverUrl ? colors.accent : colors.border }]}>
                          <Ionicons name="star" size={12} color={img === editCoverUrl ? '#f7f7f7' : colors.textMuted} />
                        </Pressable>
                        <Pressable onPress={() => {
                          setEditImages(prev => prev.filter((_, i) => i !== idx));
                          if (editCoverUrl === img) setEditCoverUrl(editImages[0] === img ? editImages[1] || null : editImages[0]);
                        }} hitSlop={4}
                          style={[s.thumbActionBtn, { backgroundColor: '#a10c0c' }]}>
                          <Ionicons name="close" size={12} color="#f7f7f7" />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                  <Pressable
                    onPress={() => {
                      Alert.alert('Add Image', 'Choose source', [
                        { text: 'Camera', onPress: () => addEditImage(true) },
                        { text: 'Gallery', onPress: () => addEditImage(false) },
                        { text: 'Cancel', style: 'cancel' },
                      ]);
                    }}
                    style={[s.addImageBtn, { borderColor: colors.border }]}
                  >
                    <Ionicons name="add" size={24} color={colors.textMuted} />
                  </Pressable>
                </ScrollView>
              </View>

              {/* Category editor */}
              <View style={s.field}>
                <Text style={[s.label, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Categories</Text>
                <View style={s.chipRow}>
                  {PRESET_CATEGORIES.filter(cat => !removedCategories.includes(cat)).map(cat => {
                    const otherUse = cards.filter(c => c.id !== editingId && c.categories?.includes(cat)).length;
                    const canRemove = otherUse === 0;
                    return (
                      <View key={cat} style={s.row}>
                        <AnimatedPressable onPress={() => toggleEditCategory(cat)} scaleDown={0.92}
                          style={[s.chip, {
                            backgroundColor: editCategories.includes(cat) ? colors.accent : colors.border,
                          }]}>
                          <Text style={[s.chipText, {
                            color: editCategories.includes(cat) ? '#f7f7f7' : colors.textMuted,
                            fontSize: fontSizes.sm,
                            fontFamily,
                          }]}>{cat}</Text>
                        </AnimatedPressable>
                        {canRemove && (
                          <Pressable onPress={() => removeUnusedCategory(cat)}
                            style={s.chipRemoveInline}>
                            <Ionicons name="close-circle" size={18} color="#a10c0c" />
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
                {(() => {
                  const customFromCards = allCategories.filter(
                    c => !PRESET_CATEGORIES.includes(c) && !removedCategories.includes(c)
                  );
                  const customSelected = editCategories.filter(
                    c => !PRESET_CATEGORIES.includes(c) && !customFromCards.includes(c) && !removedCategories.includes(c)
                  );
                  const allCustom = [...customFromCards, ...customSelected];
                  if (allCustom.length === 0) return null;
                  return (
                    <View style={[s.chipRow, { marginTop: 6 }]}>
                      {allCustom.map(cat => {
                        const otherUse = cards.filter(c => c.id !== editingId && c.categories?.includes(cat)).length;
                        const canRemove = otherUse === 0;
                        return (
                          <View key={cat} style={s.row}>
                            <AnimatedPressable onPress={() => toggleEditCategory(cat)} scaleDown={0.92}
                              style={[s.chip, {
                                backgroundColor: editCategories.includes(cat) ? colors.accent : colors.border,
                              }]}>
                              <Text style={[s.chipText, {
                                color: editCategories.includes(cat) ? '#f7f7f7' : colors.textMuted,
                                fontSize: fontSizes.sm,
                                fontFamily,
                              }]}>{cat}</Text>
                            </AnimatedPressable>
                            {canRemove && (
                              <Pressable onPress={() => removeUnusedCategory(cat)}
                                style={s.chipRemoveInline}>
                                <Ionicons name="close-circle" size={18} color="#a10c0c" />
                              </Pressable>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
                <View style={[s.row, { marginTop: 8 }]}>
                  <TextInput
                    value={customCategory}
                    onChangeText={setCustomCategory}
                    onSubmitEditing={addEditCustomCategory}
                    placeholder="Custom category..."
                    placeholderTextColor={colors.textMuted}
                    style={[s.editInput, {
                      flex: 1,
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                      color: colors.text,
                      fontSize: fontSizes.base,
                      fontFamily,
                    }]}
                  />
                  <AnimatedPressable onPress={addEditCustomCategory} scaleDown={0.92}
                    style={[s.smallBtn, { backgroundColor: colors.border }]}>
                    <Text style={[s.smallBtnText, { color: colors.text, fontSize: fontSizes.sm, fontFamily }]}>Add</Text>
                  </AnimatedPressable>
                </View>
              </View>

              <View style={[s.actionGrid, { borderTopColor: colors.border }]}>
                <View style={s.actionRow}>
                <AnimatedPressable onPress={() => saveEdit(card.id)}
                  disabled={savingId === card.id} scaleDown={0.95}
                  style={[s.actionBtn, {
                    backgroundColor: savingId === card.id ? colors.textMuted : colors.accent,
                    flex: 1,
                  }]}>
                  <Text style={[s.actionBtnText, { fontSize: fontSizes.base, fontFamily }]}>
                    {savingId === card.id ? 'Saving...' : 'Save'}
                  </Text>
                </AnimatedPressable>
                <AnimatedPressable onPress={cancelEdit} scaleDown={0.95}
                  style={[s.actionBtn, { backgroundColor: colors.border, flex: 1 }]}>
                  <Text style={[s.actionBtnText, { color: colors.text, fontSize: fontSizes.base, fontFamily }]}>Cancel</Text>
                </AnimatedPressable>
                </View>
              </View>
            </View>
          )}

          {/* View/Hide Details toggle - always at bottom */}
          {!isEditing && (
            <View style={[s.detailsToggle, { borderTopColor: colors.border }]}>
              <Text style={[s.detailsText, { color: colors.textMuted, fontSize: fontSizes.base, fontFamily }]}>
                {isExpanded ? 'Hide Details' : 'View Details'}
              </Text>
              <ChevronAnimated expanded={isExpanded} color={colors.textMuted} />
            </View>
          )}
        </AnimatedPressable>
      </FadeInCard>
    );
  };

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.link} />
      </View>
    );
  }

  const filterSummary = (() => {
    const parts: string[] = [];
    if (activeFilters.length > 0) parts.push(activeFilters.join(', '));
    if (sortBy !== 'recent') parts.push(sortBy === 'a-z' ? 'A\u2013Z' : 'Z\u2013A');
    const suffix = ` \u00b7 ${filteredAndSorted.length} card${filteredAndSorted.length !== 1 ? 's' : ''}`;
    return parts.join(' \u00b7 ') + suffix;
  })();

  return (
    <View style={[s.container, { backgroundColor: colors.bg }]}>
      {/* Card list */}
      <FlatList
        data={filteredAndSorted}
        keyExtractor={item => `${item.id}-${animKey}`}
        renderItem={renderCard}
        contentContainerStyle={[s.listContent, { paddingTop: headerHeight + 16, paddingBottom: tabBarHeight + 20 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.link} progressViewOffset={headerHeight} />
        }
        ListHeaderComponent={filtersActive ? (
          <View style={[s.activeFilterBar, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={s.activeFilterBarContent}>
              <Ionicons name="funnel" size={14} color={colors.accent} />
              <Text style={[s.activeFilterText, { color: colors.text, fontSize: fontSizes.sm, fontFamily }]} numberOfLines={1}>
                {filterSummary}
              </Text>
            </View>
            <View style={s.activeFilterBarActions}>
              {activeFilters.length > 0 && (
                <Pressable onPress={shareFilteredCards} style={s.activeFilterShareBtn} hitSlop={8}>
                  <Ionicons name="share-outline" size={16} color={colors.accent} />
                </Pressable>
              )}
              <Pressable
                onPress={() => { setActiveFilters([]); setSortBy('recent'); }}
                style={s.activeFilterClearBtn}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                <Text style={[s.activeFilterClearText, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Clear</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <View style={[s.iconCircle, { backgroundColor: colors.accent + '30' }]}>
              <Ionicons name="layers-outline" size={36} color={colors.accent} />
            </View>
            <Text style={[s.emptyTitle, { color: colors.text, fontSize: fontSizes.xl, fontFamily }]}>
              {activeFilters.length > 0 ? 'No cards match these filters' : 'No cards yet'}
            </Text>
            <Text style={[s.emptySub, { color: colors.textMuted, fontSize: fontSizes.base, lineHeight: 22, fontFamily }]}>
              {activeFilters.length > 0 ? 'Try different filters' : 'Scan a business card or QR code to get started'}
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); openSheet(); }}
        style={[s.fab, { backgroundColor: colors.accent, bottom: tabBarHeight + 20 }]}
      >
        <Ionicons name="funnel-outline" size={22} color="#f7f7f7" />
      </Pressable>

      {/* Bottom Sheet Modal */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
      >
        <View style={s.modalRoot}>
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)', opacity: backdropOpacity }]}
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />

          <Animated.View
            style={[s.sheet, {
              backgroundColor: colors.bgCard,
              opacity: sheetOpacity,
              transform: [{ translateY: sheetTranslateY }],
            }]}
          >
            <View style={[s.handle, { backgroundColor: colors.border }]} />
            <Text style={[s.sheetTitle, { color: colors.text, fontSize: fontSizes.xl, fontFamily }]}>Sort &amp; Filter</Text>

            <ScrollView style={s.sheetScroll} showsVerticalScrollIndicator={false}>
              {/* Sort section */}
              <Text style={[s.sheetSectionLabel, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Sort</Text>
              <View style={s.sortOptions}>
                {([
                  { key: 'recent' as const, label: 'Recent' },
                  { key: 'a-z' as const, label: 'A\u2013Z' },
                  { key: 'z-a' as const, label: 'Z\u2013A' },
                ]).map(opt => (
                  <AnimatedPressable
                    key={opt.key}
                    scaleDown={0.92}
                    onPress={() => setSortBy(opt.key)}
                    style={[s.sortChip, {
                      backgroundColor: sortBy === opt.key ? colors.accent : 'transparent',
                      borderColor: sortBy === opt.key ? colors.accent : colors.border,
                    }]}
                  >
                    <Text style={[s.sortChipText, {
                      color: sortBy === opt.key ? '#f7f7f7' : colors.textMuted,
                      fontSize: fontSizes.sm,
                      fontFamily,
                    }]}>{opt.label}</Text>
                  </AnimatedPressable>
                ))}
              </View>

              {/* Categories section */}
              {allCategories.length > 0 && (
                <>
                  <Text style={[s.sheetSectionLabel, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily, marginTop: 20 }]}>Categories</Text>
                  <View style={s.filterChipsContainer}>
                    <Pressable
                      onPress={() => setActiveFilters([])}
                      style={[s.filterChip, {
                        backgroundColor: activeFilters.length === 0 ? colors.accent : colors.bgCard,
                        borderColor: activeFilters.length === 0 ? colors.accent : colors.border,
                      }, activeFilters.length === 0 && s.filterChipActive]}
                    >
                      <Text style={[s.filterChipText, {
                        color: activeFilters.length === 0 ? '#f7f7f7' : colors.text,
                        fontSize: fontSizes.sm,
                        fontFamily,
                      }]}>All</Text>
                      <View style={[s.filterCount, {
                        backgroundColor: activeFilters.length === 0 ? 'rgba(255,255,255,0.25)' : colors.border,
                      }]}>
                        <Text style={[s.filterCountText, {
                          color: activeFilters.length === 0 ? '#f7f7f7' : colors.textMuted,
                          fontSize: fontSizes.xs,
                          fontFamily,
                        }]}>{cards.length}</Text>
                      </View>
                    </Pressable>
                    {sortedFilterCategories.map(item => {
                      const isActive = activeFilters.includes(item);
                      const count = categoryCounts[item] || 0;
                      return (
                        <Pressable
                          key={item}
                          onPress={() => {
                            setActiveFilters(prev =>
                              prev.includes(item) ? prev.filter(f => f !== item) : [...prev, item]
                            );
                          }}
                          style={[s.filterChip, {
                            backgroundColor: isActive ? colors.accent : colors.bgCard,
                            borderColor: isActive ? colors.accent : colors.border,
                          }, isActive && s.filterChipActive]}
                        >
                          <Text style={[s.filterChipText, {
                            color: isActive ? '#f7f7f7' : colors.text,
                            fontSize: fontSizes.sm,
                            fontFamily,
                          }]}>{item}</Text>
                          <View style={[s.filterCount, {
                            backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : colors.border,
                          }]}>
                            <Text style={[s.filterCountText, {
                              color: isActive ? '#f7f7f7' : colors.textMuted,
                              fontSize: fontSizes.xs,
                              fontFamily,
                            }]}>{count}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Share filtered cards */}
              {activeFilters.length > 0 && (
                <AnimatedPressable
                  scaleDown={0.95}
                  onPress={shareFilteredCards}
                  style={[s.sheetShareBtn, { borderColor: colors.accent }]}
                >
                  <View style={s.sheetShareBtnInner}>
                    <Ionicons name="share-outline" size={16} color={colors.accent} />
                    <Text style={[s.sheetShareBtnText, { color: colors.accent, fontSize: fontSizes.base, fontFamily }]}>
                      Share {filteredAndSorted.length} Filtered Card{filteredAndSorted.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </AnimatedPressable>
              )}

              {/* Clear all filters */}
              {filtersActive && (
                <AnimatedPressable
                  scaleDown={0.95}
                  onPress={() => { setActiveFilters([]); setSortBy('recent'); }}
                  style={[s.sheetClearBtn, { borderColor: colors.border }]}
                >
                  <View style={s.sheetClearBtnInner}>
                    <Ionicons name="close-circle-outline" size={16} color={colors.textMuted} />
                    <Text style={[s.sheetClearBtnText, { color: colors.textMuted, fontSize: fontSizes.base, fontFamily }]}>
                      Clear All Filters
                    </Text>
                  </View>
                </AnimatedPressable>
              )}
            </ScrollView>

            {/* Done button — always visible, outside ScrollView */}
            <AnimatedPressable
              scaleDown={0.95}
              onPress={closeSheet}
              style={[s.sheetDoneBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={[s.sheetDoneBtnText, { fontSize: fontSizes.base, fontFamily }]}>Done</Text>
            </AnimatedPressable>
          </Animated.View>
        </View>
      </Modal>

      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        visible={lightboxVisible}
        onClose={() => setLightboxVisible(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sortOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  sortChipText: {
    fontWeight: '600',
  },
  filterChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  filterChipActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  filterChipText: { fontWeight: '600' },
  filterCount: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 22,
    alignItems: 'center',
  },
  filterCountText: {
    fontWeight: '700',
  },
  listContent: { paddingHorizontal: 16 },
  // Active filter pill bar
  activeFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  activeFilterBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  activeFilterText: {
    fontWeight: '600',
    flexShrink: 1,
  },
  activeFilterBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeFilterShareBtn: {
    padding: 4,
  },
  activeFilterClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeFilterClearText: {
    fontWeight: '600',
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 0,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  // Bottom sheet
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  sheetScroll: {
    marginBottom: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontWeight: '700',
    marginBottom: 20,
  },
  sheetSectionLabel: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  sheetShareBtn: {
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 20,
  },
  sheetShareBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sheetShareBtnText: {
    fontWeight: '600',
  },
  sheetClearBtn: {
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
  },
  sheetClearBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sheetClearBtnText: {
    fontWeight: '600',
  },
  sheetDoneBtn: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  sheetDoneBtnText: {
    color: '#f7f7f7',
    fontWeight: '600',
  },
  card: {
    borderWidth: 0.5,
    borderRadius: 8,
    overflow: 'hidden',
    padding: 16,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
    overflow: 'hidden',
  },
  cardThumb: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginLeft: 8,
  },
  cardName: { fontWeight: '700' },
  cardCompany: { marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  chipText: { fontWeight: '600' },
  chipRemoveInline: {
    marginLeft: 2,
    padding: 2,
  },
  quickInfo: { marginTop: 8 },
  quickText: { marginTop: 2 },
  deletingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 8,
  },
  deletingText: {
    color: '#a10c0c',
    fontSize: 14,
    fontWeight: '600',
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingTop: 16,
    paddingBottom: 2,
    borderTopWidth: 1,
  },
  detailsText: {
    fontWeight: '600',
  },
  expandedContent: {
    marginTop: 12,
  },
  editContent: {
    marginTop: 12,
  },
  field: { marginBottom: 12 },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  label: { fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.2 },
  value: {},
  linkField: {},
  linkValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  socialLink: { marginTop: 4 },
  editInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  smallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 8,
    marginLeft: 8,
  },
  smallBtnText: { fontWeight: '600' },
  actionGrid: {
    gap: 10,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: { color: '#f7f7f7', fontWeight: '600' },
  actionBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  galleryRow: {
    marginTop: 8,
  },
  galleryThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 2,
  },
  editThumbWrap: {
    marginRight: 8,
  },
  editThumbActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
  },
  thumbActionBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageBtn: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontWeight: '600', marginBottom: 4 },
  emptySub: { textAlign: 'center' },
});
