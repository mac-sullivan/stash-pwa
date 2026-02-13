import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useTheme } from '@/lib/theme';
import { type ThemeName } from '@/lib/constants';

const THEME_OPTIONS: { name: ThemeName; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { name: 'light', label: 'Light', icon: 'sunny-outline' },
  { name: 'dark', label: 'Dark', icon: 'moon-outline' },
  { name: 'bold', label: 'Bold', icon: 'flash-outline' },
];

const THEME_ICONS: Record<ThemeName, keyof typeof Ionicons.glyphMap> = {
  light: 'sunny-outline',
  dark: 'moon-outline',
  bold: 'flash-outline',
};

function ThemeToggle() {
  const { theme, setTheme, colors } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable onPress={() => setVisible(true)} style={styles.iconBtn}>
        <Ionicons name={THEME_ICONS[theme]} size={22} color={colors.headerText} />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <View style={[styles.popup, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.popupTitle, { color: colors.text }]}>Theme</Text>
            {THEME_OPTIONS.map(opt => (
              <Pressable
                key={opt.name}
                onPress={() => { setTheme(opt.name); setVisible(false); }}
                style={[styles.optionRow, {
                  backgroundColor: theme === opt.name ? colors.accent + '18' : 'transparent',
                  borderColor: theme === opt.name ? colors.accent : 'transparent',
                }]}
              >
                <Ionicons
                  name={opt.icon}
                  size={20}
                  color={theme === opt.name ? colors.accent : colors.textMuted}
                />
                <Text style={[styles.optionText, {
                  color: theme === opt.name ? colors.accent : colors.text,
                }]}>
                  {opt.label}
                </Text>
                {theme === opt.name && (
                  <Ionicons name="checkmark" size={18} color={colors.accent} style={{ marginLeft: 'auto' }} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
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
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    marginRight: 16,
    padding: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 16,
  },
  popup: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    width: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  popupTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
    gap: 10,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
