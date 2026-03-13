import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { themes, cardShadow } from '@/lib/constants';

WebBrowser.maybeCompleteAuthSession();

// Login screen always uses light theme with default (sans-serif) font
const colors = themes.light;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resetSent, setResetSent] = useState(false);

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

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setGoogleLoading(true);
    try {
      const redirectUrl = 'stash://auth/callback';

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data?.url) {
        throw error || new Error('Failed to start Google sign-in.');
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, 'stash://');

      if (result.type === 'success') {
        const url = result.url;
        // Supabase returns tokens in the URL fragment
        const fragment = url.split('#')[1];
        if (fragment) {
          const params = new URLSearchParams(fragment);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
          }
        }
      }
    } catch (error: any) {
      setErrorMsg(error?.message || 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setErrorMsg('');
    if (!email.trim()) {
      setErrorMsg('Enter your email address first.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setResetSent(true);
    } catch (error: any) {
      setErrorMsg(error?.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
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
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, ...cardShadow(colors.cardShadow) }]}>
          {/* Apple Sign In */}
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={8}
              style={styles.socialBtn}
              onPress={handleAppleSignIn}
            />
          )}

          {/* Google Sign In */}
          <Pressable
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
            style={[styles.googleBtn, { borderColor: colors.border }]}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={colors.text} style={{ marginRight: 8 }} />
                <Text style={[styles.googleBtnText, { color: colors.text }]}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textMuted }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

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

          {/* Forgot Password (sign-in mode only) */}
          {!isSignUp && !resetSent && (
            <Pressable onPress={handleResetPassword} style={styles.forgotRow}>
              <Text style={[styles.forgotText, { color: colors.link }]}>Forgot password?</Text>
            </Pressable>
          )}

          {/* Reset email sent confirmation */}
          {resetSent && (
            <View style={[styles.resetBanner, { backgroundColor: colors.accent + '18' }]}>
              <Text style={[styles.resetBannerText, { color: colors.accent }]}>
                Check your email for a password reset link.
              </Text>
            </View>
          )}

          {/* Error message */}
          {errorMsg ? (
            <Text style={[styles.errorText, {}]}>{errorMsg}</Text>
          ) : null}

          <Pressable
            onPress={handleEmailAuth}
            disabled={loading}
            style={[styles.primaryBtn, {
              backgroundColor: loading ? colors.textMuted : colors.accent,
              opacity: loading ? 0.7 : 1,
            }]}
          >
            {loading && <ActivityIndicator color="#f7f7f7" size="small" style={{ marginRight: 8 }} />}
            <Text style={[styles.primaryBtnText, {}]}>{buttonLabel}</Text>
          </Pressable>

          <Pressable onPress={() => { setIsSignUp(!isSignUp); setErrorMsg(''); setResetSent(false); }} style={styles.toggleRow}>
            <Text style={[styles.toggleText, { color: colors.textMuted }]}>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              {' '}
              <Text style={{ color: colors.link, fontWeight: '600' }}>
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
    borderWidth: 0.5,
    borderRadius: 8,
    padding: 24,
  },
  socialBtn: {
    height: 50,
    width: '100%',
    marginBottom: 10,
  },
  googleBtn: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  googleBtnText: {
    fontWeight: '600',
    fontSize: 16,
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
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  forgotRow: {
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 0,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
  },
  resetBanner: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  resetBannerText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorText: {
    color: '#a10c0c',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#f7f7f7',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  toggleRow: {
    marginTop: 16,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
  },
});
