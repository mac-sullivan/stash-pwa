import React, { useState } from 'react';
import {
  View, Image, Pressable, Modal, StyleSheet, Dimensions, Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedPressable from './AnimatedPressable';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface ImageLightboxProps {
  images: string[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

export default function ImageLightbox({ images, initialIndex = 0, visible, onClose }: ImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex);

  // Reset index when opening with a new initialIndex
  React.useEffect(() => {
    if (visible) setIndex(initialIndex);
  }, [visible, initialIndex]);

  if (images.length === 0) return null;

  const current = images[index] ?? images[0];
  const hasMultiple = images.length > 1;

  const goPrev = () => setIndex(i => (i > 0 ? i - 1 : images.length - 1));
  const goNext = () => setIndex(i => (i < images.length - 1 ? i + 1 : 0));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.imageContainer} onPress={e => e.stopPropagation()}>
          <Image source={{ uri: current }} style={s.fullImage} resizeMode="contain" />
        </Pressable>

        {/* Close button */}
        <AnimatedPressable style={s.closeBtn} onPress={onClose} scaleDown={0.85} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </AnimatedPressable>

        {/* Navigation arrows */}
        {hasMultiple && (
          <>
            <AnimatedPressable style={[s.arrowBtn, s.arrowLeft]} onPress={goPrev} scaleDown={0.85} hitSlop={8}>
              <Ionicons name="chevron-back" size={32} color="#fff" />
            </AnimatedPressable>
            <AnimatedPressable style={[s.arrowBtn, s.arrowRight]} onPress={goNext} scaleDown={0.85} hitSlop={8}>
              <Ionicons name="chevron-forward" size={32} color="#fff" />
            </AnimatedPressable>
          </>
        )}

        {/* Page indicator */}
        {hasMultiple && (
          <View style={s.indicator}>
            <Text style={s.indicatorText}>{index + 1} / {images.length}</Text>
          </View>
        )}
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: SCREEN_W,
    height: SCREEN_H * 0.7,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowLeft: { left: 12 },
  arrowRight: { right: 12 },
  indicator: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  indicatorText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
