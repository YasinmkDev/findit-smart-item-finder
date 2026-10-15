import { Check, Crown, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { PRICING } from '../plan';
import { color, makeThemedStyles, proGradient, radius, sheetShadow, space, type } from '../theme';

/**
 * FindIt Pro paywall — premium gold, in the app's own theme.
 *
 * v0.12 made this sheet midnight-dark in both themes (a deliberate
 * "gold room" contrast). User feedback: with the app in light mode
 * it read as a bug, not a feature. v0.13.2: the sheet now follows the
 * active theme (porcelain in light, midnight in dark) while the GOLD
 * system — gradient crown, gold checks, gold selected plan, gradient
 * CTA — stays constant, so Pro still owns the screen in either mode.
 */

type BillingPeriod = 'monthly' | 'yearly';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Prototype: unlocks Pro locally. Production: store billing via RevenueCat. */
  onUnlock: () => void;
}

const INCLUDED = [
  'Insurance-ready PDF report of everything you own',
  'Unlimited items — no 30-item ceiling',
  'AI photo analysis, priority queue',
  'Full search, always — your items are never locked',
  'Sync across devices (coming with Pro launch)',
  'Smarter semantic search (coming with Pro launch)',
];

// The gold system — constant across themes, this is the Pro identity.
const GOLD = '#FFB020';
const ON_GOLD = '#231600';

export default function PaywallSheet({ visible, onClose, onUnlock }: Props) {
  const [period, setPeriod] = useState<BillingPeriod>('yearly');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={styles.scrimTap} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <X size={17} color={color.muted} strokeWidth={2.4} />
          </Pressable>

          {/* Hero */}
          <View style={styles.hero}>
            <LinearGradient colors={proGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.crownRing}>
              <Crown size={30} color="#FFFFFF" strokeWidth={2.1} />
            </LinearGradient>
            <Text style={styles.title}>
              FindIt <Text style={styles.titlePro}>PRO</Text>
            </Text>
            <Text style={styles.subtitle}>
              Keep everything you own — findable forever, provable when it matters.
            </Text>
          </View>

          {/* Included */}
          <View style={styles.included}>
            {INCLUDED.map((line) => (
              <View key={line} style={styles.includedRow}>
                <View style={styles.checkBubble}>
                  <Check size={12} color={GOLD} strokeWidth={3.2} />
                </View>
                <Text style={styles.includedText}>{line}</Text>
              </View>
            ))}
          </View>

          {/* Plans */}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: period === 'yearly' }}
            onPress={() => setPeriod('yearly')}
            style={[styles.planRow, period === 'yearly' && styles.planRowSelected]}
          >
            <View style={styles.bestTag}>
              <Text style={styles.bestTagText}>BEST VALUE</Text>
            </View>
            <View style={styles.planText}>
              <Text style={styles.planName}>Yearly</Text>
              <Text style={styles.planDetail}>
                {PRICING.yearly.perMonth} per month · {PRICING.yearly.trial}
              </Text>
            </View>
            <View style={styles.planRight}>
              <Text style={styles.planPrice}>{PRICING.yearly.price}</Text>
              <Text style={styles.planSaving}>{PRICING.yearly.saving}</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: period === 'monthly' }}
            onPress={() => setPeriod('monthly')}
            style={[styles.planRow, period === 'monthly' && styles.planRowSelected]}
          >
            <View style={styles.planText}>
              <Text style={styles.planName}>Monthly</Text>
              <Text style={styles.planDetail}>Flexible, cancel any time</Text>
            </View>
            <Text style={styles.planPrice}>
              {PRICING.monthly.price}
              <Text style={styles.planPer}> /month</Text>
            </Text>
          </Pressable>

          {/* CTA */}
          <Pressable accessibilityRole="button" onPress={onUnlock} style={styles.ctaWrap}>
            <LinearGradient colors={proGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
              <Text style={styles.ctaText}>
                {period === 'yearly' ? 'Start 7-day free trial' : 'Upgrade to Pro'}
              </Text>
            </LinearGradient>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.notNow}>
            <Text style={styles.notNowText}>Not now</Text>
          </Pressable>

          <Text style={styles.finePrint}>
            Prototype build — no payment is taken. Tapping the button above unlocks Pro
            on this device only, so the full flow can be tested. Prices are test prices.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = makeThemedStyles((c) =>
  StyleSheet.create({
    scrim: { flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' },
    scrimTap: { flex: 1 },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      paddingHorizontal: space.xl,
      paddingTop: space.md,
      paddingBottom: space.xxxl,
      ...sheetShadow,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.borderStrong,
      alignSelf: 'center',
      marginBottom: space.md,
    },
    closeBtn: {
      position: 'absolute',
      top: space.lg,
      right: space.lg,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hero: { alignItems: 'center', marginTop: space.xs },
    crownRing: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#FF8A00',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 8,
      marginBottom: space.md,
    },
    title: { fontSize: 30, lineHeight: 34, fontWeight: '800', color: c.ink, letterSpacing: -0.4 },
    titlePro: { color: GOLD },
    subtitle: { ...type.body, color: c.body, textAlign: 'center', marginTop: space.xs, paddingHorizontal: space.sm },
    included: { marginTop: space.xl, marginBottom: space.sm },
    includedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
    checkBubble: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.proSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: space.sm,
    },
    includedText: { ...type.body, color: c.ink, flex: 1 },
    planRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.card,
      padding: space.lg,
      marginTop: space.md,
      backgroundColor: c.surfaceAlt,
    },
    planRowSelected: { borderColor: GOLD, borderWidth: 2 },
    bestTag: {
      position: 'absolute',
      top: -9,
      right: space.lg,
      backgroundColor: GOLD,
      borderRadius: radius.pill,
      paddingHorizontal: space.sm,
      paddingVertical: 2,
    },
    bestTagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: ON_GOLD },
    planText: { flex: 1, paddingRight: space.md },
    planName: { ...type.bodyStrong, color: c.ink },
    planDetail: { ...type.caption, color: c.body, marginTop: 2 },
    planRight: { alignItems: 'flex-end' },
    planPrice: { ...type.heading, color: c.ink },
    planPer: { ...type.caption, color: c.body },
    planSaving: { ...type.caption, fontWeight: '700', color: GOLD, marginTop: 2 },
    ctaWrap: {
      marginTop: space.xl,
      borderRadius: radius.pill,
      shadowColor: '#FF8A00',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.45,
      shadowRadius: 12,
      elevation: 8,
    },
    cta: {
      borderRadius: radius.pill,
      paddingVertical: space.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
    notNow: { alignItems: 'center', paddingVertical: space.md },
    notNowText: { ...type.bodyStrong, color: c.muted },
    finePrint: { ...type.caption, color: c.muted, textAlign: 'center', marginTop: space.xs },
  })
);
