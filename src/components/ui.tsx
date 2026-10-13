import { ReactNode, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown } from 'lucide-react-native';
import { FREE_ITEM_LIMIT } from '../plan';
import { color, proGradient, radius, space, type } from '../theme';
import { makeThemedStyles } from '../theme';

/* ------------------------- Springy press (M3 Expressive) ------------------------ */

/**
 * Pressable with spring motion — top apps (M3E, Airbnb) use physics-feel
 * feedback, never flat opacity. Scale springs to 0.97 on press-in and
 * back with a slight overshoot on release.
 */
export function SpringPressable({
  onPress,
  style,
  innerStyle,
  children,
  accessibilityLabel,
}: {
  onPress?: () => void;
  style?: PressableProps['style'];
  /** Style for the animated inner view — use for row layouts inside the pressable. */
  innerStyle?: object;
  children: ReactNode;
  accessibilityLabel?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 28, bounciness: 7 }).start();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => springTo(0.97)}
      onPressOut={() => springTo(1)}
      style={style}
    >
      <Animated.View style={[{ flex: 1, transform: [{ scale }] }, innerStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dangerGhost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading }: ButtonProps) {
  const busy = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: pressed ? color.brandPressed : color.brand },
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'dangerGhost' && styles.buttonDangerGhost,
        busy && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? color.onBrand : color.brand} />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            variant === 'primary' && { color: color.onBrand },
            variant === 'secondary' && { color: color.ink },
            variant === 'ghost' && { color: color.brand },
            variant === 'dangerGhost' && { color: color.danger },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/* ---------------------------------- Chips ---------------------------------- */

export function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.filterChip, selected ? styles.filterChipSelected : styles.filterChipIdle]}
    >
      <Text style={[styles.filterChipText, selected && { color: '#FFFFFF' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TagChip({ label, tone = 'brand' }: { label: string; tone?: 'brand' | 'pro' }) {
  return (
    <View
      style={[
        styles.tagChip,
        { backgroundColor: tone === 'pro' ? color.proSoft : color.brandSoft },
      ]}
    >
      <Text style={[styles.tagChipText, { color: tone === 'pro' ? color.pro : color.brand }]}>
        {label}
      </Text>
    </View>
  );
}

export function ProBadge() {
  return (
    <LinearGradient colors={proGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.proBadge}>
      <Crown size={12} color="#FFFFFF" strokeWidth={2.6} />
      <Text style={styles.proBadgeText}>PRO</Text>
    </LinearGradient>
  );
}

/* -------------------------------- Text field ------------------------------- */

interface FieldProps extends TextInputProps {
  label: string;
  hint?: string;
}

export function Field({ label, hint, ...props }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={color.muted}
        style={[styles.field, props.multiline && styles.fieldMultiline]}
        {...props}
      />
      {!!hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

/* ------------------------------- Usage meter ------------------------------- */

export function UsageMeter({
  used,
  onUpgrade,
}: {
  used: number;
  onUpgrade: () => void;
}) {
  const ratio = Math.min(1, used / FREE_ITEM_LIMIT);
  const atLimit = used >= FREE_ITEM_LIMIT;
  return (
    <View style={styles.meterCard}>
      <View style={styles.meterRow}>
        <Text style={styles.meterTitle}>
          {atLimit ? 'Free limit reached' : `${used} of ${FREE_ITEM_LIMIT} free items`}
        </Text>
        <Pressable accessibilityRole="button" onPress={onUpgrade} hitSlop={8}>
          <Text style={styles.meterUpgrade}>Upgrade</Text>
        </Pressable>
      </View>
      <View style={styles.meterTrack}>
        <View
          style={[
            styles.meterFill,
            { width: `${Math.round(ratio * 100)}%`, backgroundColor: atLimit ? color.danger : color.brand },
          ]}
        />
      </View>
      <Text style={styles.meterCaption}>
        {atLimit
          ? 'Your items are safe and still searchable. Pro removes the limit.'
          : 'Pro removes the limit and unlocks future sync and smarter search.'}
      </Text>
    </View>
  );
}

/* --------------------------------- Banners --------------------------------- */

export function WarningBanner({ text }: { text: string }) {
  return (
    <View style={styles.warningBanner}>
      <Text style={styles.warningText}>{text}</Text>
    </View>
  );
}

/* -------------------------------- Empty state ------------------------------ */

export function EmptyState({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {children}
    </View>
  );
}

/* ---------------------------------- Styles --------------------------------- */

const styles = makeThemedStyles((c) => StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDangerGhost: { backgroundColor: 'transparent' },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { ...type.bodyStrong },

  filterChip: {
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    marginRight: space.sm,
    borderWidth: 1,
  },
  filterChipIdle: { backgroundColor: c.surface, borderColor: c.borderStrong },
  filterChipSelected: { backgroundColor: c.ink, borderColor: c.ink },
  filterChipText: { ...type.small, fontWeight: '600', color: c.ink },

  tagChip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  tagChipText: { ...type.caption, fontWeight: '600' },

  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  proBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: '#FFFFFF' },

  fieldWrap: { marginTop: space.lg },
  fieldLabel: { ...type.small, fontWeight: '600', color: c.ink, marginBottom: 6 },
  field: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: radius.field,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    fontSize: 15,
    color: c.ink,
  },
  fieldMultiline: { minHeight: 64, textAlignVertical: 'top' },
  fieldHint: { ...type.caption, color: c.muted, marginTop: 5 },

  meterCard: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.lg,
  },
  meterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meterTitle: { ...type.bodyStrong, color: c.ink },
  meterUpgrade: { ...type.bodyStrong, color: c.brand },
  meterTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: c.surfaceAlt,
    marginTop: space.md,
    overflow: 'hidden',
  },
  meterFill: { height: 6, borderRadius: 3 },
  meterCaption: { ...type.caption, color: c.muted, marginTop: space.sm },

  warningBanner: {
    backgroundColor: c.warningBg,
    borderRadius: radius.field,
    padding: space.md,
    marginTop: space.md,
  },
  warningText: { ...type.small, color: c.warning, lineHeight: 19 },

  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxxl, paddingVertical: space.huge },
  emptyTitle: { ...type.title, color: c.ink, textAlign: 'center', marginBottom: space.sm },
  emptyText: { ...type.body, color: c.body, textAlign: 'center' },
}));
