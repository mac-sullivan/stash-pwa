import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, FlatList, TextInput, Image, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Linking, RefreshControl,
  Animated, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { PRESET_CATEGORIES } from '@/lib/constants';
import type { StashCard } from '@/lib/types';
import { useFocusEffect } from 'expo-router';
import ImageLightbox from '@/components/ImageLightbox';

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
  const { colors } = useTheme();
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editCoverUrl, setEditCoverUrl] = useState<string | null>(null);
  const [removedCategories, setRemovedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'recent' | 'a-z' | 'z-a'>('recent');

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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
    });
    setEditCategories(card.categories || []);
    setEditImages(getCardImages(card));
    setEditCoverUrl(card.card_image_url);
    setRemovedCategories([]);
    setCustomCategory('');
  };

  const cancelEdit = () => {
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
          try {
            const { error } = await supabase.from('stash').delete().eq('id', id);
            if (error) throw error;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setExpandedId(null);
            fetchCards();
          } catch (error) {
            console.error('Delete error:', error);
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

  const removeUnusedCategory = (cat: string) => {
    // Count how many OTHER cards (not the one being edited) use this category
    const otherCards = cards.filter(c => c.id !== editingId && c.categories?.includes(cat));
    const otherCount = otherCards.length;

    const message = otherCount > 0
      ? `"${cat}" is also used by ${otherCount} other card${otherCount === 1 ? '' : 's'}. Remove it from all cards?`
      : `Remove "${cat}"? No other cards are using it.`;

    Alert.alert('Remove Category', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            // Remove from all OTHER cards that have this category
            for (const c of otherCards) {
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
            fetchCards();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            console.error('Remove category error:', error);
            Alert.alert('Error', 'Failed to remove category.');
          }
        },
      },
    ]);
  };

  const addEditCustomCategory = () => {
    const trimmed = customCategory.trim();
    if (trimmed && !editCategories.includes(trimmed)) {
      setEditCategories(prev => [...prev, trimmed]);
    }
    setCustomCategory('');
  };

  const openLink = (url: string) => {
    const formatted = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(formatted);
  };

  const renderEditField = (label: string, key: keyof StashCard) => (
    <View style={s.field} key={key}>
      <Text style={[s.label, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        value={(editData[key] as string) || ''}
        onChangeText={text => setEditData(prev => ({ ...prev, [key]: text }))}
        style={[s.editInput, {
          backgroundColor: colors.inputBg,
          borderColor: colors.inputBorder,
          color: colors.text,
        }]}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );

  const renderCard = ({ item: card, index }: { item: StashCard; index: number }) => {
    const isExpanded = expandedId === card.id;
    const isEditing = editingId === card.id;

    return (
      <FadeInCard index={index} key={`${card.id}-${animKey}`}>
        <Pressable
          onPress={() => {
            if (!isEditing) toggleExpand(card.id);
          }}
          style={[s.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
        >
          {/* Top section: info + image side by side */}
          <View style={s.cardTop}>
            <View style={s.cardInfo}>
              <Text style={[s.cardName, { color: colors.text }]} numberOfLines={isExpanded ? undefined : 1}>
                {card.name || 'Unknown'}
              </Text>
              {card.company && (
                <Text style={[s.cardCompany, { color: colors.textMuted }]} numberOfLines={1}>
                  {card.company}
                </Text>
              )}

              {/* Category chips */}
              {card.categories && card.categories.length > 0 && !isEditing && (
                <View style={s.chipRow}>
                  {card.categories.map(cat => (
                    <View key={cat} style={[s.chip, { backgroundColor: colors.accent + '22' }]}>
                      <Text style={[s.chipText, { color: colors.accent }]}>{cat}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Quick info (collapsed) */}
              {!isExpanded && !isEditing && (
                <View style={s.quickInfo}>
                  {card.phone && (
                    <Text style={[s.quickText, { color: colors.textMuted }]} numberOfLines={1}>
                      {card.phone}
                    </Text>
                  )}
                  {card.email && (
                    <Text style={[s.quickText, { color: colors.textMuted }]} numberOfLines={1}>
                      {card.email}
                    </Text>
                  )}
                </View>
              )}
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
            <View style={s.expandedContent}>
              {card.phone && (
                <Pressable onPress={() => Linking.openURL(`tel:${card.phone}`)}>
                  <View style={s.field}>
                    <Text style={[s.label, { color: colors.textMuted }]}>Phone</Text>
                    <Text style={[s.value, { color: colors.accent }]}>{card.phone}</Text>
                  </View>
                </Pressable>
              )}
              {card.additional_phone && (
                <Pressable onPress={() => Linking.openURL(`tel:${card.additional_phone}`)}>
                  <View style={s.field}>
                    <Text style={[s.label, { color: colors.textMuted }]}>Additional Phone</Text>
                    <Text style={[s.value, { color: colors.accent }]}>{card.additional_phone}</Text>
                  </View>
                </Pressable>
              )}
              {card.email && (
                <Pressable onPress={() => Linking.openURL(`mailto:${card.email}`)}>
                  <View style={s.field}>
                    <Text style={[s.label, { color: colors.textMuted }]}>Email</Text>
                    <Text style={[s.value, { color: colors.accent }]}>{card.email}</Text>
                  </View>
                </Pressable>
              )}
              {card.website && (
                <Pressable onPress={() => openLink(card.website!)}>
                  <View style={s.field}>
                    <Text style={[s.label, { color: colors.textMuted }]}>Website</Text>
                    <Text style={[s.value, { color: colors.accent }]}>{card.website}</Text>
                  </View>
                </Pressable>
              )}
              {card.additional_website && (
                <Pressable onPress={() => openLink(card.additional_website!)}>
                  <View style={s.field}>
                    <Text style={[s.label, { color: colors.textMuted }]}>Additional Website</Text>
                    <Text style={[s.value, { color: colors.accent }]}>{card.additional_website}</Text>
                  </View>
                </Pressable>
              )}
              {card.address && (
                <View style={s.field}>
                  <Text style={[s.label, { color: colors.textMuted }]}>Address</Text>
                  <Text style={[s.value, { color: colors.text }]}>{card.address}</Text>
                </View>
              )}
              {card.notes && (
                <View style={s.field}>
                  <Text style={[s.label, { color: colors.textMuted }]}>Notes</Text>
                  <Text style={[s.value, { color: colors.text }]}>{card.notes}</Text>
                </View>
              )}
              {card.social_media && Object.entries(card.social_media).some(([, v]) => v) && (
                <View style={s.field}>
                  <Text style={[s.label, { color: colors.textMuted }]}>Social Media</Text>
                  {Object.entries(card.social_media).map(([platform, url]) =>
                    url ? (
                      <Pressable key={platform} onPress={() => openLink(url)}>
                        <Text style={[s.socialLink, { color: colors.accent }]}>
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
                  <Text style={[s.label, { color: colors.textMuted }]}>
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

              <View style={[s.actionRow, { borderTopColor: colors.border }]}>
                <Pressable onPress={() => startEdit(card)}
                  style={[s.actionBtn, { backgroundColor: colors.accent }]}>
                  <Text style={s.actionBtnText}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => deleteCard(card.id)}
                  style={[s.actionBtn, { backgroundColor: '#ef4444' }]}>
                  <Text style={s.actionBtnText}>Delete</Text>
                </Pressable>
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

              {/* Image editor */}
              <View style={s.field}>
                <Text style={[s.label, { color: colors.textMuted }]}>Images</Text>
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
                          <Ionicons name="star" size={12} color={img === editCoverUrl ? '#fff' : colors.textMuted} />
                        </Pressable>
                        <Pressable onPress={() => {
                          setEditImages(prev => prev.filter((_, i) => i !== idx));
                          if (editCoverUrl === img) setEditCoverUrl(editImages[0] === img ? editImages[1] || null : editImages[0]);
                        }} hitSlop={4}
                          style={[s.thumbActionBtn, { backgroundColor: '#ef4444' }]}>
                          <Ionicons name="close" size={12} color="#fff" />
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
                <Text style={[s.label, { color: colors.textMuted }]}>Categories</Text>
                <View style={s.chipRow}>
                  {PRESET_CATEGORIES.map(cat => (
                    <View key={cat} style={s.chipWithRemove}>
                      <Pressable onPress={() => toggleEditCategory(cat)}
                        style={[s.chip, {
                          backgroundColor: editCategories.includes(cat) ? colors.accent : colors.border,
                        }]}>
                        <Text style={[s.chipText, {
                          color: editCategories.includes(cat) ? '#fff' : colors.textMuted,
                        }]}>{cat}</Text>
                      </Pressable>
                      {(() => {
                        const otherUse = cards.filter(c => c.id !== editingId && c.categories?.includes(cat)).length;
                        return otherUse === 0;
                      })() && (
                        <Pressable onPress={() => removeUnusedCategory(cat)} hitSlop={4}
                          style={s.chipRemoveBtn}>
                          <Ionicons name="close-circle" size={16} color="#ef4444" />
                        </Pressable>
                      )}
                    </View>
                  ))}
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
                        return (
                          <View key={cat} style={s.chipWithRemove}>
                            <Pressable onPress={() => toggleEditCategory(cat)}
                              style={[s.chip, {
                                backgroundColor: editCategories.includes(cat) ? colors.accent : colors.border,
                              }]}>
                              <Text style={[s.chipText, {
                                color: editCategories.includes(cat) ? '#fff' : colors.textMuted,
                              }]}>{cat}</Text>
                            </Pressable>
                            {otherUse === 0 && (
                              <Pressable onPress={() => removeUnusedCategory(cat)} hitSlop={4}
                                style={s.chipRemoveBtn}>
                                <Ionicons name="close-circle" size={16} color="#ef4444" />
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
                    }]}
                  />
                  <Pressable onPress={addEditCustomCategory}
                    style={[s.smallBtn, { backgroundColor: colors.border }]}>
                    <Text style={[s.smallBtnText, { color: colors.text }]}>Add</Text>
                  </Pressable>
                </View>
              </View>

              <View style={[s.actionRow, { borderTopColor: colors.border }]}>
                <Pressable onPress={() => saveEdit(card.id)}
                  disabled={savingId === card.id}
                  style={[s.actionBtn, {
                    backgroundColor: savingId === card.id ? colors.textMuted : colors.accent,
                    flex: 1,
                  }]}>
                  <Text style={s.actionBtnText}>
                    {savingId === card.id ? 'Saving...' : 'Save'}
                  </Text>
                </Pressable>
                <Pressable onPress={cancelEdit}
                  style={[s.actionBtn, { backgroundColor: colors.border, flex: 1 }]}>
                  <Text style={[s.actionBtnText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* View/Hide Details toggle - always at bottom */}
          {!isEditing && (
            <View style={[s.detailsToggle, { borderTopColor: colors.border }]}>
              <Text style={[s.detailsText, { color: colors.textMuted }]}>
                {isExpanded ? 'Hide Details' : 'View Details'}
              </Text>
              <ChevronAnimated expanded={isExpanded} color={colors.textMuted} />
            </View>
          )}
        </Pressable>
      </FadeInCard>
    );
  };

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: colors.bg }]}>
      {/* Sort bar */}
      <View style={[s.sortBar, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
        <View style={s.sortBarInner}>
          <Ionicons name="swap-vertical-outline" size={18} color={colors.textMuted} />
          <Text style={[s.sortLabel, { color: colors.text }]}>Sort</Text>
        </View>
        <View style={s.sortOptions}>
          {([
            { key: 'recent' as const, label: 'Recent' },
            { key: 'a-z' as const, label: 'A–Z' },
            { key: 'z-a' as const, label: 'Z–A' },
          ]).map(opt => (
            <Pressable
              key={opt.key}
              onPress={() => setSortBy(opt.key)}
              style={[s.sortChip, {
                backgroundColor: sortBy === opt.key ? colors.accent : 'transparent',
                borderColor: sortBy === opt.key ? colors.accent : colors.border,
              }]}
            >
              <Text style={[s.sortChipText, {
                color: sortBy === opt.key ? '#fff' : colors.textMuted,
              }]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Categories dropdown */}
      {allCategories.length > 0 && (
        <View style={[s.filterBar, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setFilterOpen(prev => !prev);
            }}
            style={s.filterHeader}
          >
            <View style={s.filterHeaderLeft}>
              <Ionicons name="pricetag-outline" size={18} color={colors.textMuted} />
              <Text style={[s.filterLabel, { color: colors.text }]}>
                Categories{activeFilters.length > 0 ? ` (${activeFilters.length})` : ''}
              </Text>
            </View>
            <View style={s.filterHeaderRight}>
              {activeFilters.length > 0 && (
                <Pressable
                  onPress={(e) => { e.stopPropagation(); setActiveFilters([]); }}
                  style={s.clearBtn}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                  <Text style={[s.clearBtnText, { color: colors.textMuted }]}>Clear</Text>
                </Pressable>
              )}
              <ChevronAnimated expanded={filterOpen} color={colors.textMuted} />
            </View>
          </Pressable>

          {filterOpen && (
            <View style={s.filterChipsContainer}>
              <Pressable
                onPress={() => setActiveFilters([])}
                style={[s.filterChip, {
                  backgroundColor: activeFilters.length === 0 ? colors.accent : colors.bgCard,
                  borderColor: activeFilters.length === 0 ? colors.accent : colors.border,
                }, activeFilters.length === 0 && s.filterChipActive]}
              >
                <Text style={[s.filterChipText, {
                  color: activeFilters.length === 0 ? '#fff' : colors.text,
                }]}>All</Text>
                <View style={[s.filterCount, {
                  backgroundColor: activeFilters.length === 0 ? 'rgba(255,255,255,0.25)' : colors.border,
                }]}>
                  <Text style={[s.filterCountText, {
                    color: activeFilters.length === 0 ? '#fff' : colors.textMuted,
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
                      color: isActive ? '#fff' : colors.text,
                    }]}>{item}</Text>
                    <View style={[s.filterCount, {
                      backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : colors.border,
                    }]}>
                      <Text style={[s.filterCountText, {
                        color: isActive ? '#fff' : colors.textMuted,
                      }]}>{count}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Card list */}
      <FlatList
        data={filteredAndSorted}
        keyExtractor={item => `${item.id}-${animKey}`}
        renderItem={renderCard}
        contentContainerStyle={s.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Text style={[s.emptyIcon]}>📇</Text>
            <Text style={[s.emptyTitle, { color: colors.text }]}>
              {activeFilters.length > 0 ? 'No cards match these filters' : 'No cards yet'}
            </Text>
            <Text style={[s.emptySub, { color: colors.textMuted }]}>
              {activeFilters.length > 0 ? 'Try different filters' : 'Scan a business card or QR code to get started'}
            </Text>
          </View>
        }
      />

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
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  sortBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  sortOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
  },
  sortChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterBar: {
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  filterHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  filterChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
  },
  filterChipActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  filterChipText: { fontSize: 16, fontWeight: '600' },
  filterCount: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 22,
    alignItems: 'center',
  },
  filterCountText: {
    fontSize: 16,
    fontWeight: '700',
  },
  listContent: { padding: 16, paddingBottom: 40 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
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
  },
  cardThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginLeft: 12,
  },
  cardName: { fontSize: 18, fontWeight: '700' },
  cardCompany: { fontSize: 16, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  chipText: { fontSize: 16, fontWeight: '600' },
  chipWithRemove: {
    position: 'relative',
  },
  chipRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  quickInfo: { marginTop: 8 },
  quickText: { fontSize: 16, marginTop: 2 },
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
    fontSize: 16,
    fontWeight: '600',
  },
  expandedContent: {
    marginTop: 12,
  },
  editContent: {
    marginTop: 12,
  },
  field: { marginBottom: 12 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  value: { fontSize: 16 },
  socialLink: { fontSize: 16, marginTop: 4 },
  editInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  smallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginLeft: 8,
  },
  smallBtnText: { fontSize: 16, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  actionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  emptySub: { fontSize: 16, textAlign: 'center' },
});
