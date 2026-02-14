import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Pressable, Modal, StyleSheet, Alert, Animated } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { type FontSizeName, type FontStyleName } from '@/lib/constants';
import AnimatedPressable from '@/components/AnimatedPressable';

const FONT_SIZE_OPTIONS: { name: FontSizeName; label: string }[] = [
  { name: 'small', label: 'Small' },
  { name: 'medium', label: 'Medium' },
  { name: 'large', label: 'Large' },
];

const FONT_STYLE_OPTIONS: { name: FontStyleName; label: string }[] = [
  { name: 'sans-serif', label: 'Sans-serif' },
  { name: 'serif', label: 'Serif' },
  { name: 'retro', label: 'Retro' },
];

function ThemeToggle() {
  const { theme, setTheme, colors } = useTheme();
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const icon = theme === 'dark' ? 'moon-outline' : 'sunny-outline';
  return (
    <Pressable onPress={toggleTheme} style={styles.iconBtnRight}>
      <Ionicons name={icon} size={22} color={colors.headerText} />
    </Pressable>
  );
}

function SettingsButton() {
  const { colors, fontSize, setFontSize, fontSizes, fontStyle, setFontStyle, fontFamily } = useTheme();
  const { user, signOut } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(60)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;

  const open = () => {
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(60);
    sheetOpacity.setValue(0);
    setModalVisible(true);
  };

  useEffect(() => {
    if (modalVisible) {
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
  }, [modalVisible, backdropOpacity, sheetTranslateY, sheetOpacity]);

  const close = () => {
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
      setModalVisible(false);
    });
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          close();
          await signOut();
        },
      },
    ]);
  };

  return (
    <>
      <Pressable onPress={open} style={styles.iconBtnLeft}>
        <Ionicons name="settings-outline" size={22} color={colors.headerText} />
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={close}
      >
        <View style={styles.modalRoot}>
          {/* Animated backdrop */}
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)', opacity: backdropOpacity }]}
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />

          {/* Animated sheet */}
          <Animated.View
            style={[styles.sheet, {
              backgroundColor: colors.bgCard,
              opacity: sheetOpacity,
              transform: [{ translateY: sheetTranslateY }],
            }]}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            <Text style={[styles.sheetTitle, { color: colors.text, fontSize: fontSizes.xl, fontFamily }]}>Settings</Text>

            {/* Account section */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted, fontSize: fontSizes.sm, fontFamily }]}>Account</Text>
            <Text style={[styles.emailText, { color: colors.text, fontSize: fontSizes.sm, fontFamily }]}>
              {user?.email ?? 'Not signed in'}
            </Text>

            {/* Font Size section */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted, fontSize: fontSizes.sm, marginTop: 20, fontFamily }]}>Font Size</Text>
            <View style={styles.fontSizeRow}>
              {FONT_SIZE_OPTIONS.map(opt => (
                <AnimatedPressable
                  key={opt.name}
                  scaleDown={0.9}
                  onPress={() => setFontSize(opt.name)}
                  style={[styles.fontSizeBtn, {
                    backgroundColor: fontSize === opt.name ? colors.accent : 'transparent',
                    borderColor: fontSize === opt.name ? colors.accent : colors.border,
                  }]}
                >
                  <Text style={[styles.fontSizeBtnText, {
                    color: fontSize === opt.name ? '#f7f7f7' : colors.text,
                    fontSize: fontSizes.sm,
                    fontFamily,
                  }]}>
                    {opt.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            {/* Font Style section */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted, fontSize: fontSizes.sm, marginTop: 20, fontFamily }]}>Font Style</Text>
            <View style={styles.fontSizeRow}>
              {FONT_STYLE_OPTIONS.map(opt => (
                <AnimatedPressable
                  key={opt.name}
                  scaleDown={0.9}
                  onPress={() => setFontStyle(opt.name)}
                  style={[styles.fontSizeBtn, {
                    backgroundColor: fontStyle === opt.name ? colors.accent : 'transparent',
                    borderColor: fontStyle === opt.name ? colors.accent : colors.border,
                  }]}
                >
                  <Text style={[styles.fontSizeBtnText, {
                    color: fontStyle === opt.name ? '#f7f7f7' : colors.text,
                    fontSize: fontSizes.sm,
                    fontFamily,
                  }]}>
                    {opt.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            {/* Sign Out */}
            <AnimatedPressable
              scaleDown={0.95}
              onPress={handleSignOut}
              style={[styles.signOutBtn, { borderColor: colors.border }]}
            >
              <View style={styles.signOutRow}>
                <Ionicons name="log-out-outline" size={fontSizes.base} color="#a10c0c" style={{ marginRight: 6 }} />
                <Text style={[styles.signOutText, { fontSize: fontSizes.base, fontFamily }]}>Sign Out</Text>
              </View>
            </AnimatedPressable>

            <AnimatedPressable
              scaleDown={0.95}
              onPress={close}
              style={[styles.doneBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.doneBtnText, { fontSize: fontSizes.base, fontFamily }]}>Done</Text>
            </AnimatedPressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

function HeaderTitle() {
  const { colors } = useTheme();
  return (
    <Text style={[styles.headerTitle, { color: colors.headerText }]}>
      Stash
    </Text>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.headerBg,
        },
        headerShadowVisible: false,
        headerTintColor: colors.headerText,
        headerTitle: () => <HeaderTitle />,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
        tabBarActiveTintColor: colors.link,
        tabBarInactiveTintColor: colors.textMuted,
        headerLeft: () => <SettingsButton />,
        headerRight: () => <ThemeToggle />,
      }}
    >
      <Tabs.Screen
        name="manual"
        options={{
          title: 'Manual',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="create-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'My Stash',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="layers-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mycard"
        options={{
          title: 'My Card',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 24,
    letterSpacing: 1,
  },
  iconBtnLeft: {
    marginLeft: 16,
    padding: 4,
  },
  iconBtnRight: {
    marginRight: 16,
    padding: 4,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    boxShadow: '0px -4px 12px rgba(0,0,0,0.2)',
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
  sectionLabel: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  emailText: {
    marginBottom: 4,
  },
  fontSizeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fontSizeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  fontSizeBtnText: {
    fontWeight: '600',
  },
  signOutBtn: {
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 24,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    color: '#a10c0c',
    fontWeight: '600',
  },
  doneBtn: {
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#f7f7f7',
    fontWeight: '600',
  },
});
