import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/lib/theme';

interface StashLoaderProps {
  size?: number;
  message?: string;
}

export default function StashLoader({ size = 80, message }: StashLoaderProps) {
  const { colors, fontSizes, fontFamily } = useTheme();

  const card1Rotate = useRef(new Animated.Value(0)).current;
  const card2Rotate = useRef(new Animated.Value(0)).current;
  const card3Rotate = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Shuffle animation — cards fan out then collect back
    const shuffle = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(card1Rotate, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(card2Rotate, { toValue: 1, duration: 500, delay: 60, useNativeDriver: true }),
          Animated.timing(card3Rotate, { toValue: 1, duration: 500, delay: 120, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.05, duration: 500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(card1Rotate, { toValue: 0, duration: 500, useNativeDriver: true }),
          Animated.timing(card2Rotate, { toValue: 0, duration: 500, delay: 60, useNativeDriver: true }),
          Animated.timing(card3Rotate, { toValue: 0, duration: 500, delay: 120, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
        Animated.delay(300),
      ])
    );
    shuffle.start();
    return () => shuffle.stop();
  }, [card1Rotate, card2Rotate, card3Rotate, scale]);

  const rotate1 = card1Rotate.interpolate({ inputRange: [0, 1], outputRange: ['12deg', '18deg'] });
  const rotate2 = card2Rotate.interpolate({ inputRange: [0, 1], outputRange: ['4deg', '-2deg'] });
  const rotate3 = card3Rotate.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '-10deg'] });

  const cw = size * 0.6;
  const ch = cw * 0.6;
  const r = size * 0.04;

  const cardBase = {
    position: 'absolute' as const,
    width: cw,
    height: ch,
    borderRadius: r,
    borderWidth: 1,
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.cardsWrap, { width: size, height: size, transform: [{ scale }] }]}>
        {/* Back card */}
        <Animated.View style={[cardBase, {
          backgroundColor: '#e0ddd2',
          borderColor: '#c8c5b8',
          transform: [{ rotate: rotate1 }],
        }]} />
        {/* Middle card */}
        <Animated.View style={[cardBase, {
          backgroundColor: '#ebe8df',
          borderColor: '#d2cfc4',
          transform: [{ rotate: rotate2 }],
        }]} />
        {/* Front card */}
        <Animated.View style={[cardBase, {
          backgroundColor: '#f5f3ed',
          borderColor: '#dbd8cb',
          transform: [{ rotate: rotate3 }],
        }]} />
      </Animated.View>
      {message && (
        <Text style={[styles.message, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>
          {message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  cardsWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontWeight: '500',
  },
});
