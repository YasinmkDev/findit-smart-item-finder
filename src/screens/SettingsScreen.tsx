import { ArrowLeft, Crown, Moon, MonitorSmartphone, Sun, Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { PlanKind } from '../plan';
import { Settings, ThemeMode } from '../settings';
import { color, makeThemedStyles, proGradient, radius, space, type } from '../theme';

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
  plan: PlanKind;
  onUpgrade: () => void;
  itemCount: number;
  sampleCount: number;
  onLoadSamples: () => void;
  onClearSamples: () => void;
  onWipe: () => void;
  onBack: () => void;
  version: string;
  /** Account (v0.13): signed-in identity, or guest. */
  accountName?: string;
  accountEmail?: string;
  isGuest?: boolean;
  onSignOut: () => void;
  onCreateAccount: () => void;
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Row({
  label,
  hint,
  right,
  onPress,
  danger = false,
}: {
  label: string;
  hint?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const body = (
    <>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
        {!!hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      {right}
    </>
  );
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
        {body}
      </Pressable>
    );
  }
  return <View style={styles.row}>{body}</View>;
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; Icon: typeof Moon }[] = [
  { mode: 'dark', label: 'Dark', Icon: Moon },
  { mode: 'light', label: 'Light', Icon: Sun },
  { mode: 'system', label: 'System', Icon: MonitorSmartphone },
];

export default function SettingsScreen({
  settings,
  onChange,
  plan,
  onUpgrade,
  itemCount,
  sampleCount,
  onLoadSamples,
  onClearSamples,
  onWipe,
  onBack,
  version,
  accountName,
  accountEmail,
  isGuest,
  onSignOut,
  onCreateAccount,
}: Props) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  function confirmWipe() {
    Alert.alert(
      'Erase everything?',
      'All items, photos and places stored in FindIt on this phone will be deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Erase everything', style: 'destructive', onPress: onWipe },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.backBtn} hitSlop={8}>
            <ArrowLeft size={20} color={color.ink} strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.title}>Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Pro banner — the dominant element on this screen */}
        {plan === 'pro' ? (
          <View style={styles.proActive}>
            <Crown size={22} color={color.pro} strokeWidth={2.2} />
            <View style={styles.rowText}>
              <Text style={styles.proActiveTitle}>You're Pro</Text>
              <Text style={styles.rowHint}>Unlimited items + the insurance report are on.</Text>
            </View>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={onUpgrade} style={styles.proBannerWrap}>
            <LinearGradient colors={proGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.proBanner}>
              <Crown size={26} color="#FFFFFF" strokeWidth={2.2} />
              <View style={styles.rowText}>
                <Text style={styles.proBannerTitle}>Unlock FindIt Pro</Text>
                <Text style={styles.proBannerText}>
                  Unlimited items + the insurance-ready PDF report.
                </Text>
              </View>
              <Text style={styles.proBannerCta}>Upgrade</Text>
            </LinearGradient>
          </Pressable>
        )}

        <SectionTitle>Account</SectionTitle>
        <View style={styles.card}>
          {isGuest ? (
            <>
              <Row
                label="You're browsing as a guest"
                hint="Create an account to keep your identity with your things"
              />
              <View style={styles.divider} />
              <Row label="Create account / Log in" onPress={onCreateAccount} />
            </>
          ) : (
            <>
              <Row label={accountName || 'Signed in'} hint={accountEmail} />
              <View style={styles.divider} />
              <Row label="Sign out" onPress={onSignOut} />
            </>
          )}
        </View>

        <SectionTitle>Appearance</SectionTitle>
        <View style={styles.card}>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map(({ mode, label, Icon }) => {
              const active = settings.themeMode === mode;
              return (
                <Pressable
                  key={mode}
                  accessibilityRole="button"
                  onPress={() => set({ themeMode: mode })}
                  style={[styles.themeChip, active && styles.themeChipOn]}
                >
                  <Icon size={17} color={active ? '#FFFFFF' : color.brand} strokeWidth={2.2} />
                  <Text style={[styles.themeChipText, active && styles.themeChipTextOn]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.rowHint}>
            Dark is FindIt's new signature look. System follows your phone's own setting.
          </Text>
        </View>

        <SectionTitle>Capture</SectionTitle>
        <View style={styles.card}>
          <Row
            label="Auto-analyse photos"
            hint="Gemini names and tags each new photo automatically"
            right={
              <Switch
                value={settings.autoAnalyse}
                onValueChange={(v) => set({ autoAnalyse: v })}
                trackColor={{ true: color.brand, false: color.borderStrong }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <View style={styles.divider} />
          <Row
            label="Shield documents automatically"
            hint="When the AI spots a document, turn its privacy shield on"
            right={
              <Switch
                value={settings.shieldDocuments}
                onValueChange={(v) => set({ shieldDocuments: v })}
                trackColor={{ true: color.brand, false: color.borderStrong }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </View>

        <SectionTitle>Safety</SectionTitle>
        <View style={styles.card}>
          <Row
            label="Confirm before deleting"
            hint="Ask before an item and its photo are removed"
            right={
              <Switch
                value={settings.confirmDelete}
                onValueChange={(v) => set({ confirmDelete: v })}
                trackColor={{ true: color.brand, false: color.borderStrong }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </View>

        <SectionTitle>Your data</SectionTitle>
        <View style={styles.card}>
          <Row label="Items stored" hint="Everything lives on this phone" right={<Text style={styles.countText}>{itemCount}</Text>} />
          <View style={styles.divider} />
          {sampleCount > 0 ? (
            <Row label="Clear sample data" hint={`${sampleCount} test items` } onPress={onClearSamples} />
          ) : (
            <Row label="Load sample data" hint="12 test items to try the app with" onPress={onLoadSamples} />
          )}
          <View style={styles.divider} />
          <Row
            label="Erase everything"
            hint="Delete all items and photos from this phone"
            danger
            onPress={confirmWipe}
            right={<Trash2 size={18} color={color.danger} strokeWidth={2.2} />}
          />
        </View>

        <SectionTitle>About</SectionTitle>
        <View style={styles.card}>
          <Row label="Version" right={<Text style={styles.countText}>{version}</Text>} />
          <View style={styles.divider} />
          <Row label="FindIt" hint="Never lose your things again — photograph it, stash it, find it in seconds." />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = makeThemedStyles((c) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    content: { padding: space.screen, paddingBottom: space.huge, gap: space.md },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerSpacer: { width: 40 },
    title: { ...type.title, color: c.ink, flex: 1, textAlign: 'center' },
    sectionTitle: {
      ...type.overline,
      color: c.muted,
      marginTop: space.lg,
      marginBottom: space.xs,
      marginLeft: space.xs,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.card,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
    rowText: { flex: 1 },
    rowLabel: { ...type.bodyStrong, color: c.ink },
    rowLabelDanger: { color: c.danger },
    rowHint: { ...type.caption, color: c.muted, marginTop: 2 },
    divider: { height: 1, backgroundColor: c.border, marginVertical: space.xs },
    countText: { ...type.bodyStrong, color: c.body },
    themeRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm },
    themeChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: c.brand,
      borderRadius: radius.pill,
      paddingVertical: 9,
    },
    themeChipOn: { backgroundColor: c.brand },
    themeChipText: { ...type.small, color: c.brand, fontWeight: '700' },
    themeChipTextOn: { color: '#FFFFFF' },
    proBannerWrap: { borderRadius: radius.card, overflow: 'hidden' },
    proBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      padding: space.lg,
    },
    proBannerTitle: { fontSize: 18, lineHeight: 22, fontWeight: '800', color: '#FFFFFF' },
    proBannerText: { ...type.caption, color: 'rgba(255,255,255,0.92)', marginTop: 2 },
    proBannerCta: {
      fontSize: 13,
      fontWeight: '800',
      color: '#7A4A00',
      backgroundColor: '#FFFFFF',
      borderRadius: radius.pill,
      paddingHorizontal: space.md,
      paddingVertical: 7,
      overflow: 'hidden',
    },
    proActive: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      backgroundColor: c.proSoft,
      borderRadius: radius.card,
      padding: space.lg,
    },
    proActiveTitle: { ...type.bodyStrong, color: c.pro },
  })
);
