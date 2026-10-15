import { Check, Eye, EyeOff, Lock, Mail, MapPin, ScanSearch, Search, User } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  continueAsGuest,
  logIn,
  passwordStrength,
  signUp,
  validateCredentials,
} from '../auth';
import { color, makeThemedStyles, radius, space, type } from '../theme';

/**
 * The first screen (v0.13) — "The Living Wall".
 *
 * The idea: before asking for anything, show the product alive. The
 * user's future things drift gently behind glass, a demo search types
 * itself and answers with a place — the whole FindIt promise in five
 * seconds, no reading required. Then a calm glass card: login/signup
 * with a sliding segment, fields that glow when touched, a password
 * strength meter, a shake when something's wrong, and a success
 * moment before the app opens.
 */

const DEMOS = [
  { q: 'passport', place: 'Bedroom — blue drawer' },
  { q: 'red drill', place: 'Garage — red toolbox' },
  { q: 'spare keys', place: 'Hall — key bowl' },
  { q: 'winter jacket', place: 'Bedroom — wardrobe' },
];

const TILES = [
  { seed: 'findit-drill', rotate: '-4deg', style: { left: '4%', top: 6, width: '44%' } },
  { seed: 'findit-passport', rotate: '3deg', style: { right: '4%', top: 34, width: '40%' } },
  { seed: 'findit-keys', rotate: '2deg', style: { left: '10%', top: 128, width: '38%' } },
  { seed: 'findit-jacket', rotate: '-3deg', style: { right: '9%', top: 150, width: '42%' } },
] as const;

const STRENGTH_COLORS = ['#C13515', '#E07B39', '#E3B34C', '#7FB069', '#1E7D46'];

interface Props {
  onAuthenticated: () => void;
}

export default function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<'name' | 'email' | 'password' | null>(null);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  /* ------------------------------ Animation ------------------------------ */
  const entrance = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const segmentX = useRef(new Animated.Value(1)).current; // 1 = signup (default tab)
  const nameExpand = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(0.4)).current;
  const successFade = useRef(new Animated.Value(0)).current;
  const cursor = useRef(new Animated.Value(1)).current;
  const meterW = useRef(new Animated.Value(0)).current;
  const floats = useRef(TILES.map((_, i) => new Animated.Value(0))).current;
  const [segmentW, setSegmentW] = useState(0);

  // Entrance + ambient motion
  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 750, useNativeDriver: true }).start();
    floats.forEach((v, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 2600 + i * 450, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 2600 + i * 450, useNativeDriver: true }),
        ])
      );
      loop.start();
    });
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursor, { toValue: 0, duration: 60, delay: 530, useNativeDriver: true }),
        Animated.timing(cursor, { toValue: 1, duration: 60, delay: 530, useNativeDriver: true }),
      ])
    );
    blink.start();
    return () => blink.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Segmented control + name-field expansion follow the mode
  useEffect(() => {
    Animated.spring(segmentX, {
      toValue: mode === 'signup' ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 60,
    }).start();
    Animated.timing(nameExpand, {
      toValue: mode === 'signup' ? 1 : 0,
      duration: 240,
      useNativeDriver: false,
    }).start();
    setErrors({});
    setFormError('');
  }, [mode, segmentX, nameExpand]);

  // Password strength meter
  const strength = passwordStrength(password);
  useEffect(() => {
    Animated.spring(meterW, {
      toValue: password.length === 0 ? 0 : (strength.score + 1) / 5,
      useNativeDriver: false,
      friction: 8,
    }).start();
  }, [strength.score, password.length, meterW]);

  function shake() {
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -3, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start();
  }

  /* ------------------------------ Typing demo ----------------------------- */
  const [demoIndex, setDemoIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [demoDone, setDemoDone] = useState(false);

  useEffect(() => {
    const word = DEMOS[demoIndex].q;
    let char = 0;
    let timer: ReturnType<typeof setTimeout>;
    setDemoDone(false);
    const typeNext = () => {
      char++;
      setTyped(word.slice(0, char));
      if (char < word.length) {
        timer = setTimeout(typeNext, 62);
      } else {
        setDemoDone(true);
        timer = setTimeout(() => {
          setTyped('');
          setDemoIndex((i) => (i + 1) % DEMOS.length);
        }, 2100);
      }
    };
    timer = setTimeout(typeNext, 350);
    return () => clearTimeout(timer);
  }, [demoIndex]);

  /* -------------------------------- Submit -------------------------------- */
  async function submit() {
    if (busy || success) return;
    const fieldErrors = validateCredentials({ mode, name, email, password });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      shake();
      return;
    }
    setBusy(true);
    setFormError('');
    // A short, honest pause so the state reads as "working" — the
    // account operations themselves are local and instant.
    await new Promise((r) => setTimeout(r, 850));
    let result;
    try {
      result = mode === 'signup' ? await signUp(name, email, password) : await logIn(email, password);
    } catch {
      // Storage must never surface as an uncaught promise crash.
      setBusy(false);
      setFormError('Storage is not available in this build, so accounts cannot be saved. Please reload the app and try again.');
      shake();
      return;
    }
    setBusy(false);
    if (!result.ok) {
      setFormError(result.error);
      shake();
      return;
    }
    setSuccess(true);
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 80 }),
      Animated.timing(successFade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    setTimeout(onAuthenticated, 900);
  }

  async function guest() {
    if (busy || success) return;
    try {
      await continueAsGuest();
    } catch {
      // Session persistence is best-effort for guest mode — entering
      // the app matters more than remembering the choice.
    }
    onAuthenticated();
  }

  const fadeUp = (delayUnits: number) => ({
    opacity: entrance.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
    transform: [
      {
        translateY: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [18 + delayUnits * 10, 0],
        }),
      },
    ],
  });

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
        {/* ------------------------- The Living Wall ------------------------- */}
        <View style={styles.wall}>
          {TILES.map((tile, i) => (
            <Animated.View
              key={tile.seed}
              style={[
                styles.tile,
                tile.style,
                {
                  transform: [
                    { rotate: tile.rotate },
                    {
                      translateY: floats[i].interpolate({ inputRange: [0, 1], outputRange: [0, -9 - i * 2] }),
                    },
                  ],
                },
              ]}
            >
              <Image
                source={{ uri: `https://picsum.photos/seed/${tile.seed}/440/330` }}
                style={styles.tileImage}
                resizeMode="cover"
              />
            </Animated.View>
          ))}
          <LinearGradient
            colors={['transparent', color.bg]}
            style={styles.wallFade}
            pointerEvents="none"
          />

          {/* Demo search — the promise, performing itself */}
          <Animated.View style={[styles.demoWrap, fadeUp(1)]}>
            <View style={styles.demoPill}>
              <Search size={16} color={color.brand} strokeWidth={2.4} />
              <Text style={styles.demoText}>{typed}</Text>
              <Animated.View style={[styles.cursor, { opacity: cursor }]} />
            </View>
            {demoDone && (
              <View style={styles.demoAnswer}>
                <MapPin size={12} color={color.brand} strokeWidth={2.6} />
                <Text style={styles.demoAnswerText}>{DEMOS[demoIndex].place}</Text>
              </View>
            )}
          </Animated.View>
        </View>

        {/* ------------------------------ Brand ------------------------------ */}
        <Animated.View style={[styles.brandBlock, fadeUp(2)]}>
          <LinearGradient colors={[color.brand, color.brandPressed]} style={styles.logoMark}>
            <ScanSearch size={24} color="#FFFFFF" strokeWidth={2.2} />
          </LinearGradient>
          <View>
            <Text style={styles.wordmark}>
              Find<Text style={{ color: color.brand }}>It</Text>
            </Text>
            <Text style={styles.tagline}>Never lose a thing again.</Text>
          </View>
        </Animated.View>

        {/* ------------------------------- Card ------------------------------ */}
        <Animated.View style={[styles.card, fadeUp(3), { transform: [{ translateX: shakeX }] }]}>
          {/* Segmented login / signup */}
          <View
            style={styles.segment}
            onLayout={(e) => setSegmentW(e.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                styles.segmentThumb,
                {
                  width: segmentW > 0 ? (segmentW - 8) / 2 : undefined,
                  transform: [
                    {
                      translateX: segmentX.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, segmentW > 0 ? (segmentW - 8) / 2 : 0],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Pressable style={styles.segmentBtn} onPress={() => setMode('login')}>
              <Text style={[styles.segmentText, mode === 'login' && styles.segmentTextOn]}>Log in</Text>
            </Pressable>
            <Pressable style={styles.segmentBtn} onPress={() => setMode('signup')}>
              <Text style={[styles.segmentText, mode === 'signup' && styles.segmentTextOn]}>Sign up</Text>
            </Pressable>
          </View>

          <Text style={styles.cardTitle}>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</Text>
          <Text style={styles.cardSub}>
            {mode === 'signup'
              ? 'Your things, one search away — free for your first 30 items.'
              : 'Your things are where you left them. So is everything you saved.'}
          </Text>

          {!!formError && (
            <View style={styles.formError}>
              <Text style={styles.formErrorText}>{formError}</Text>
            </View>
          )}

          {/* Name (signup only, expands/collapses) */}
          <Animated.View
            style={{
              height: nameExpand.interpolate({ inputRange: [0, 1], outputRange: [0, 84] }),
              opacity: nameExpand,
              overflow: 'hidden',
            }}
          >
            <AuthField
              label="Your name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Ahmed Khan"
              error={errors.name}
              focused={focused === 'name'}
              onFocus={() => setFocused('name')}
              onBlur={() => setFocused(null)}
              Icon={User}
              autoCapitalize="words"
            />
          </Animated.View>

          <AuthField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            error={errors.email}
            focused={focused === 'email'}
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused(null)}
            Icon={Mail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <AuthField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'signup' ? '8+ characters' : 'Your password'}
            error={errors.password}
            focused={focused === 'password'}
            onFocus={() => setFocused('password')}
            onBlur={() => setFocused(null)}
            Icon={Lock}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            right={
              <Pressable accessibilityRole="button" onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                {showPassword ? (
                  <EyeOff size={19} color={color.muted} strokeWidth={2.2} />
                ) : (
                  <Eye size={19} color={color.muted} strokeWidth={2.2} />
                )}
              </Pressable>
            }
          />

          {/* Strength meter (signup) */}
          {mode === 'signup' && password.length > 0 && (
            <View style={styles.meterWrap}>
              <View style={styles.meterTrack}>
                <Animated.View
                  style={[
                    styles.meterFill,
                    {
                      width: meterW.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                      backgroundColor: STRENGTH_COLORS[strength.score],
                    },
                  ]}
                />
              </View>
              <Text style={styles.meterLabel}>{strength.label}</Text>
            </View>
          )}

          {/* CTA */}
          <Pressable accessibilityRole="button" onPress={submit} disabled={busy || success} style={styles.ctaWrap}>
            <LinearGradient
              colors={[color.brand, color.brandPressed]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.ctaText}>{mode === 'signup' ? 'Create account' : 'Log in'}</Text>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable accessibilityRole="button" onPress={guest} style={styles.guestBtn}>
            <Text style={styles.guestText}>Continue as guest</Text>
          </Pressable>

          <Text style={styles.finePrint}>
            Prototype build — accounts are stored only on this device. Cloud accounts arrive
            with the FindIt backend.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* --------------------------- Success moment -------------------------- */}
      {success && (
        <Animated.View style={[styles.successOverlay, { opacity: successFade }]}>
          <Animated.View style={{ transform: [{ scale: successScale }] }}>
            <LinearGradient colors={[color.brand, color.brandPressed]} style={styles.successCircle}>
              <Check size={40} color="#FFFFFF" strokeWidth={3} />
            </LinearGradient>
          </Animated.View>
          <Text style={styles.successText}>{mode === 'signup' ? 'Welcome to FindIt' : 'Welcome back'}</Text>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

/* --------------------------------- Field --------------------------------- */

function AuthField({
  label,
  error,
  focused,
  Icon,
  right,
  ...inputProps
}: {
  label: string;
  error?: string;
  focused: boolean;
  Icon: typeof Mail;
  right?: React.ReactNode;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.fieldBox,
          focused && styles.fieldBoxFocused,
          !!error && styles.fieldBoxError,
        ]}
      >
        <Icon size={18} color={focused ? color.brand : color.muted} strokeWidth={2.2} />
        <TextInput
          {...inputProps}
          placeholderTextColor={color.muted}
          style={styles.fieldInput}
        />
        {right}
      </View>
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

const styles = makeThemedStyles((c) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.bg },
    scroll: { flexGrow: 1, paddingBottom: space.huge },
    wall: { height: 268, position: 'relative' },
    tile: {
      position: 'absolute',
      borderRadius: 18,
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
      elevation: 6,
    },
    tileImage: { width: '100%', aspectRatio: 4 / 3 },
    wallFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 },
    demoWrap: { position: 'absolute', left: space.screen, right: space.screen, bottom: 8, alignItems: 'center' },
    demoPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      backgroundColor: c.surface,
      borderRadius: radius.pill,
      paddingHorizontal: space.lg,
      paddingVertical: 10,
      minWidth: 210,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 16,
      elevation: 8,
    },
    demoText: { ...type.bodyStrong, color: c.ink, minWidth: 90 },
    cursor: { width: 2, height: 18, backgroundColor: c.brand },
    demoAnswer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: c.brandSoft,
      borderRadius: radius.pill,
      paddingHorizontal: space.md,
      paddingVertical: 5,
      marginTop: space.sm,
    },
    demoAnswerText: { ...type.caption, color: c.brand, fontWeight: '700' },
    brandBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingHorizontal: space.screen,
      marginTop: space.md,
    },
    logoMark: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wordmark: { fontSize: 30, fontWeight: '800', color: c.ink, letterSpacing: -0.5 },
    tagline: { ...type.body, color: c.body },
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.sheet,
      marginHorizontal: space.screen,
      marginTop: space.xl,
      padding: space.xl,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 10,
    },
    segment: {
      flexDirection: 'row',
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.pill,
      padding: 4,
      position: 'relative',
    },
    segmentThumb: {
      position: 'absolute',
      top: 4,
      left: 4,
      bottom: 4,
      borderRadius: radius.pill,
      backgroundColor: c.brand,
    },
    segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 9 },
    segmentText: { ...type.bodyStrong, color: c.muted },
    segmentTextOn: { color: '#FFFFFF' },
    cardTitle: { ...type.title, color: c.ink, marginTop: space.xl },
    cardSub: { ...type.body, color: c.body, marginTop: space.xs, marginBottom: space.md },
    formError: {
      backgroundColor: c.dangerSoft,
      borderRadius: radius.field,
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      marginBottom: space.sm,
    },
    formErrorText: { ...type.small, color: c.danger, fontWeight: '600' },
    fieldWrap: { marginTop: space.md },
    fieldLabel: { ...type.small, fontWeight: '600', color: c.ink, marginBottom: 6 },
    fieldBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: radius.field,
      paddingHorizontal: space.md,
      backgroundColor: c.bg,
    },
    fieldBoxFocused: { borderColor: c.brand },
    fieldBoxError: { borderColor: c.danger },
    fieldInput: { flex: 1, ...type.body, color: c.ink, paddingVertical: 12 },
    fieldError: { ...type.caption, color: c.danger, marginTop: 4, fontWeight: '600' },
    meterWrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
    meterTrack: {
      flex: 1,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.surfaceAlt,
      overflow: 'hidden',
    },
    meterFill: { height: '100%', borderRadius: 3 },
    meterLabel: { ...type.caption, color: c.body, fontWeight: '700', width: 52, textAlign: 'right' },
    ctaWrap: {
      marginTop: space.xl,
      borderRadius: radius.pill,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 6,
    },
    cta: { borderRadius: radius.pill, paddingVertical: space.lg, alignItems: 'center', justifyContent: 'center' },
    ctaText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
    guestBtn: { alignItems: 'center', paddingVertical: space.md },
    guestText: { ...type.bodyStrong, color: c.brand },
    finePrint: { ...type.caption, color: c.muted, textAlign: 'center' },
    successOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: c.bg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.lg,
    },
    successCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successText: { ...type.title, color: c.ink },
  })
);
