import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { getTodayString } from '../../utils/dates';
import { format, parseISO, isValid } from 'date-fns';

interface CompactDateInputProps {
  storageDate: string; // YYYY-MM-DD
  onChangeStorageDate: (date: string) => void;
  label?: string;
}

export const CompactDateInput: React.FC<CompactDateInputProps> = ({
  storageDate,
  onChangeStorageDate,
  label = 'DATE',
}) => {
  const { colors } = useTheme();

  // Convert storage YYYY-MM-DD to display DD/MM/YYYY
  const getDisplayFromStorage = (s: string) => {
    try {
      const parts = s.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    } catch {}
    return s;
  };

  const displayVal = getDisplayFromStorage(storageDate);

  const handleTextChange = (text: string) => {
    // Keep only numbers to support standard numeric keypads without slash key
    const digits = text.replace(/\D/g, '').slice(0, 8);
    let formatted = '';
    if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    }

    // When all 8 digits are entered, save as standard ISO YYYY-MM-DD
    if (digits.length === 8) {
      const dd = digits.slice(0, 2);
      const mm = digits.slice(2, 4);
      const yyyy = digits.slice(4);
      onChangeStorageDate(`${yyyy}-${mm}-${dd}`);
    } else {
      // Partial input
      onChangeStorageDate(formatted);
    }
  };

  const handleSetToday = () => {
    onChangeStorageDate(getTodayString());
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
          {label} (DD/MM/YYYY)
        </Text>
      )}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons
          name="calendar-outline"
          size={18}
          color={colors.textSecondary}
          style={styles.calendarIcon}
        />

        <TextInput
          value={displayVal}
          onChangeText={handleTextChange}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          maxLength={10}
          style={[styles.inputField, { color: colors.text }]}
        />

        <TouchableOpacity
          onPress={handleSetToday}
          activeOpacity={0.7}
          style={[styles.todayBtn, { backgroundColor: colors.inputBg }]}
        >
          <Text style={[styles.todayBtnText, { color: colors.text }]}>Today</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  calendarIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    height: '100%',
  },
  todayBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
