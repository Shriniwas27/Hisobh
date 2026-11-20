import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { formatMonthGroupHeader } from '../../utils/dates';

interface MonthPickerModalProps {
  visible: boolean;
  onClose: () => void;
  months: string[]; // YYYY-MM
  selectedMonth: string | null;
  onSelectMonth: (month: string | null) => void;
}

export const MonthPickerModal: React.FC<MonthPickerModalProps> = ({
  visible,
  onClose,
  months,
  selectedMonth,
  onSelectMonth,
}) => {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Jump to Month</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.allTimeButton,
              {
                backgroundColor: !selectedMonth ? colors.pillActive : colors.inputBg,
              },
            ]}
            onPress={() => {
              onSelectMonth(null);
              onClose();
            }}
          >
            <Text
              style={[
                styles.monthLabel,
                { color: !selectedMonth ? colors.pillActiveText : colors.text },
              ]}
            >
              All Months (Latest First)
            </Text>
            {!selectedMonth && (
              <Ionicons name="checkmark" size={18} color={colors.pillActiveText} />
            )}
          </TouchableOpacity>

          <FlatList
            data={months}
            keyExtractor={(item) => item}
            style={styles.list}
            renderItem={({ item }) => {
              const isSelected = item === selectedMonth;
              return (
                <TouchableOpacity
                  style={[
                    styles.monthItem,
                    {
                      backgroundColor: isSelected ? colors.pillActive : 'transparent',
                      borderBottomColor: colors.borderLight,
                    },
                  ]}
                  onPress={() => {
                    onSelectMonth(item);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.monthLabel,
                      { color: isSelected ? colors.pillActiveText : colors.text },
                    ]}
                  >
                    {formatMonthGroupHeader(item)}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={18} color={colors.pillActiveText} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxHeight: '75%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  allTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  list: {
    marginTop: 4,
  },
  monthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderBottomWidth: 1,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});

