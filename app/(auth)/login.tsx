import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleEmailAuth = async () => {
    setErrorMsg('');
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      const { error } = isSignUp
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (error) throw error;
    } catch (error: any) {
      setErrorMsg(error?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setErrorMsg('');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple.');
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) throw error;
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') return;
      setErrorMsg(error?.message || 'Apple sign-in failed.');
    }
  };

  const buttonLabel = loading
    ? (isSignUp ? 'Signing Up...' : 'Signing In...')
    : (isSignUp ? 'Sign Up' : 'Sign In');

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Branding */}
        <View style={styles.brandingArea}>
          <Text style={[styles.brandTitle, { color: colors.text, fontFamily: 'PlayfairDisplay-Bold' }]}>
            Stash
          </Text>
          <Text style={[styles.brandSubtitle, { color: colors.textMuted }]}>
            Your business card vault
          </Text>
        </View>

        {/* Auth card */}
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {/* Apple Sign In */}
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={styles.appleBtn}
              onPress={handleAppleSignIn}
            />
          )}

          {Platform.OS === 'ios' && (
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textMuted }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>
          )}

          {/* Email/Password */}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, {
              backgroundColor: colors.inputBg,
              borderColor: colors.inputBorder,
              color: colors.text,
            }]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={[styles.input, {
              backgroundColor: colors.inputBg,
              borderColor: colors.inputBorder,
              color: colors.text,
            }]}
          />

          {/* Error message */}
          {errorMsg ? (
            <Text style={styles.errorText}>{errorMsg}</Text>
          ) : null}

          <Pressable
            onPress={handleEmailAuth}
            disabled={loading}
            style={[styles.primaryBtn, {
              backgroundColor: loading ? colors.textMuted : colors.accent,
              opacity: loading ? 0.7 : 1,
            }]}
          >
            {loading && <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />}
            <Text style={styles.primaryBtnText}>{buttonLabel}</Text>
          </Pressable>

          <Pressable onPress={() => { setIsSignUp(!isSignUp); setErrorMsg(''); }} style={styles.toggleRow}>
            <Text style={[styles.toggleText, { color: colors.textMuted }]}>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              {' '}
              <Text style={{ color: colors.accent, fontWeight: '600' }}>
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  brandingArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brandTitle: {
    fontSize: 48,
    letterSpacing: 1,
  },
  brandSubtitle: {
    fontSize: 16,
    marginTop: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
  },
  appleBtn: {
    height: 50,
    width: '100%',
    marginBottom: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  toggleRow: {
    marginTop: 16,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
  },
});
