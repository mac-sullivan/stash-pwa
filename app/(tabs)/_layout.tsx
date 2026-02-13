import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Pressable, Modal, StyleSheet, Alert } from 'react-native';
import { useState } from 'react';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { type FontSizeName } from '@/lib/constants';
import AnimatedPressable from '@/components/AnimatedPressable';

const FONT_SIZE_OPTIONS: { name: FontSizeName; label: string }[] = [
  { name: 'small', label: 'Small' },
  { name: 'medium', label: 'Medium' },
  { name: 'large', label: 'Large' },
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
  const { colors, fontSize, setFontSize, fontSizes } = useTheme();
  const { user, signOut } = useAuth();
  const [visible, setVisible] = useState(false);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setVisible(false);
          await signOut();
        },
      },
    ]);
  };

  return (
    <>
      <Pressable onPress={() => setVisible(true)} style={styles.iconBtnLeft}>
        <Ionicons name="settings-outline" size={22} color={colors.headerText} />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <View
            style={[styles.sheet, { backgroundColor: colors.bgCard }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            <Text style={[styles.sheetTitle, { color: colors.text, fontSize: fontSizes.xl }]}>Settings</Text>

            {/* Account section */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted, fontSize: fontSizes.sm }]}>Account</Text>
            <Text style={[styles.emailText, { color: colors.text, fontSize: fontSizes.sm }]}>
              {user?.email ?? 'Not signed in'}
            </Text>

            {/* Font Size section */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted, fontSize: fontSizes.sm, marginTop: 20 }]}>Font Size</Text>
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
                    color: fontSize === opt.name ? '#fff' : colors.text,
                    fontSize: fontSizes.sm,
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
                <Ionicons name="log-out-outline" size={18} color="#ef4444" style={{ marginRight: 6 }} />
                <Text style={styles.signOutText}>Sign Out</Text>
              </View>
            </AnimatedPressable>

            <AnimatedPressable
              scaleDown={0.95}
              onPress={() => setVisible(false)}
              style={[styles.doneBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.doneBtnText, { fontSize: fontSizes.base }]}>Done</Text>
            </AnimatedPressable>
          </View>
        </Pressable>
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
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        headerTitle: () => <HeaderTitle />,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
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
    fontSize: 22,
    letterSpacing: 0.5,
  },
  iconBtnLeft: {
    marginLeft: 16,
    padding: 4,
  },
  iconBtnRight: {
    marginRight: 16,
    padding: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
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
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  fontSizeBtnText: {
    fontWeight: '600',
  },
  signOutBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 24,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 15,
  },
  doneBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});
