import { StyleSheet, Text, View } from 'react-native';
import { qrMatrix } from '../qr';
import { color, radius, space, type } from '../theme';
import { makeThemedStyles } from '../theme';

/**
 * On-screen QR box label: the module matrix drawn with plain Views
 * (white quiet-zone padding included), so it is scannable from the
 * screen and needs no native SVG/QR module.
 */
export function QrLabel({ payload, placeName, count }: { payload: string; placeName: string; count: number }) {
  const matrix = qrMatrix(payload);
  return (
    <View style={styles.wrap}>
      <View style={styles.qrBox}>
        {matrix.map((row, y) => (
          <View key={y} style={styles.row}>
            {row.map((dark, x) => (
              <View key={x} style={[styles.cell, dark && styles.cellDark]} />
            ))}
          </View>
        ))}
      </View>
      <Text style={styles.name}>{placeName}</Text>
      <Text style={styles.count}>
        {count} item{count === 1 ? '' : 's'} inside · Scan to open in FindIt
      </Text>
    </View>
  );
}

const styles = makeThemedStyles((c) => StyleSheet.create({
  wrap: {
    backgroundColor: c.surface,
    borderRadius: radius.card,
    padding: space.lg,
    alignItems: 'center',
    gap: space.xs,
  },
  qrBox: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.surfaceAlt,
  },
  row: { flexDirection: 'row' },
  cell: { width: 5, height: 5, backgroundColor: '#fff' },
  cellDark: { backgroundColor: '#111' },
  name: { ...type.heading, color: c.ink, marginTop: space.sm, textAlign: 'center' },
  count: { ...type.caption, color: c.muted, textAlign: 'center' },
}));
