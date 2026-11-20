import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { Account } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatCompactCurrency } from '../../utils/currency';
import { DepositModal } from './DepositModal';
import { TransferModal } from './TransferModal';

interface AccountsSummaryCardProps {
  accounts: Account[];
  onRefresh?: () => void;
}

export const AccountsSummaryCard: React.FC<AccountsSummaryCardProps> = ({
  accounts,
  onRefresh,
}) => {
  const { colors, isDark } = useTheme();
  const { settings } = useApp();
  const router = useRouter();

  const [depositVisible, setDepositVisible] = useState(false);
  const [transferVisible, setTransferVisible] = useState(false);
  const [isAtmMode, setIsAtmMode] = useState(false);

  // Compute balances (do not double-count bank funds in linked UPI handles)
  let totalBalance = 0;
  let cashBalance = 0;
  let bankBalance = 0;
  let upiBalance = 0;

  for (const acc of accounts) {
    const bal = acc.current_balance ?? 0;
    if (acc.type === 'cash') {
      cashBalance += bal;
      totalBalance += bal;
    } else if (acc.type === 'bank') {
      bankBalance += bal;
      totalBalance += bal;
    } else if (acc.type === 'upi' || acc.type === 'wallet') {
      upiBalance += bal;
      if (!acc.linked_bank_id) {
        totalBalance += bal;
      }
    }
  }

  const getAccountIcon = (type: string, customIcon?: string) => {
    if (customIcon) return customIcon as any;
    switch (type) {
      case 'cash':
        return 'cash-outline';
      case 'bank':
        return 'business-outline';
      case 'upi':
        return 'phone-portrait-outline';
      case 'wallet':
        return 'wallet-outline';
      default:
        return 'card-outline';
    }
  };

  return (
    <>
      <Card style={styles.card}>
        {/* Header (Manage button removed) */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={[styles.titleIcon, { backgroundColor: `${colors.accent}18` }]}>
              <Ionicons name="wallet-outline" size={16} color={colors.accent} />
            </View>
            <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
              ACCOUNTS & LIQUID FUNDS
            </Text>
          </View>
        </View>

        {/* Total Available Balance */}
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: colors.textMuted }]}>
            Total Net Funds
          </Text>
          <Text style={[styles.totalAmount, { color: colors.text }]}>
            {formatCurrency(totalBalance, settings)}
          </Text>
        </View>

        {/* Big Action Buttons: Deposit & Withdraw */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            onPress={() => setDepositVisible(true)}
            activeOpacity={0.8}
            style={[
              styles.bigActionBtn,
              {
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.12)',
                borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.3)',
              },
            ]}
          >
            <Ionicons name="add-circle" size={19} color={colors.success} />
            <Text style={[styles.bigBtnText, { color: colors.success }]}>
              Deposit
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setIsAtmMode(false);
              setTransferVisible(true);
            }}
            activeOpacity={0.8}
            style={[
              styles.bigActionBtn,
              {
                backgroundColor: isDark ? `${colors.accent}1A` : `${colors.accent}14`,
                borderColor: isDark ? `${colors.accent}40` : `${colors.accent}30`,
              },
            ]}
          >
            <Ionicons name="swap-horizontal" size={19} color={colors.accent} />
            <Text style={[styles.bigBtnText, { color: colors.accent }]}>
              Withdraw / Transfer
            </Text>
          </TouchableOpacity>
        </View>

        {/* Individual Accounts Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.accountsScroll}
        >
          {accounts.map((acc) => {
            const isNegative = (acc.current_balance ?? 0) < 0;
            return (
              <TouchableOpacity
                key={acc.id}
                onPress={() => router.push('/manage-accounts')}
                activeOpacity={0.75}
                style={[
                  styles.accountChip,
                  {
                    backgroundColor: isDark ? '#232328' : '#F6F5F0',
                    borderColor: colors.borderLight,
                  },
                ]}
              >
                <View style={styles.chipTopRow}>
                  <View
                    style={[
                      styles.chipIconWrap,
                      { backgroundColor: `${acc.color}25` },
                    ]}
                  >
                    <Ionicons
                      name={getAccountIcon(acc.type, acc.icon)}
                      size={14}
                      color={acc.color}
                    />
                  </View>
                  <Text
                    style={[
                      styles.chipTypeBadge,
                      { color: colors.textMuted },
                    ]}
                  >
                    {acc.type.toUpperCase()}
                  </Text>
                </View>

                <Text
                  style={[styles.chipName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {acc.name}
                </Text>

                {acc.linked_bank_name ? (
                  <Text style={[styles.chipLinkedSub, { color: colors.accent }]} numberOfLines={1}>
                    via {acc.linked_bank_name}
                  </Text>
                ) : null}

                <Text
                  style={[
                    styles.chipBalance,
                    { color: isNegative ? colors.danger : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {formatCurrency(acc.current_balance ?? 0, settings)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Card>

      {/* Deposit Modal */}
      <DepositModal
        visible={depositVisible}
        onClose={() => setDepositVisible(false)}
        accounts={accounts}
        onDepositSuccess={onRefresh}
      />

      {/* Transfer & ATM Cash Withdrawal Modal */}
      <TransferModal
        visible={transferVisible}
        onClose={() => setTransferVisible(false)}
        accounts={accounts}
        isAtmWithdrawalMode={isAtmMode}
        onTransferSuccess={onRefresh}
      />
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  totalRow: {
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalAmount: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  bigActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 46,
    borderRadius: 13,
    borderWidth: 1,
  },
  bigBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  accountsScroll: {
    gap: 10,
    paddingVertical: 2,
  },
  accountChip: {
    width: 140,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chipIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipTypeBadge: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chipName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  chipLinkedSub: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 3,
  },
  chipBalance: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});

