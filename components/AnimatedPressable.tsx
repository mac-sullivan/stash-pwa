import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, type PressableProps, type ViewStyle, type StyleProp } from 'react-native';

interface AnimatedPressableProps extends PressableProps {
  scaleDown?: number;
  style?: StyleProp<ViewStyle>;
}

const LAYOUT_KEYS = new Set([
  'flex', 'flexGrow', 'flexShrink', 'flexBasis',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
  'alignSelf', 'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'position', 'top', 'left', 'right', 'bottom', 'zIndex',
]);

export default function AnimatedPressable({
  children,
  scaleDown = 0.95,
  style,
  onPressIn,
  onPressOut,
  ...props
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (e: any) => {
    Animated.spring(scale, {
      toValue: scaleDown,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
    onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
    onPressOut?.(e);
  };

  const flat = StyleSheet.flatten(style) || {};
  const outerStyle: Record<string, any> = {};
  const innerStyle: Record<string, any> = {};

  for (const [key, value] of Object.entries(flat)) {
    if (LAYOUT_KEYS.has(key)) {
      outerStyle[key] = value;
    } else {
      innerStyle[key] = value;
    }
  }

  return (
    <Animated.View style={[{ transform: [{ scale }] }, outerStyle]}>
      <Pressable
        style={innerStyle}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        {...props}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
