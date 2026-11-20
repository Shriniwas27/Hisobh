# Hisobh

> A private, offline-first personal finance and expense ledger for React Native.

Hisobh helps you record everyday spending, deposits, transfers, and recurring bills without depending on a server. It combines a fast local SQLite database with a simple dashboard, searchable activity history, account balances, reports, receipt photos, reminders, and portable exports.

## Highlights

- **Offline-first storage** with SQLite and no account or backend required.
- **Expense tracking** for single expenses and multi-item bills.
- **Receipt capture** using the camera or photo library, with files stored in the app's document directory.
- **Accounts and wallets** for cash, bank accounts, and UPI accounts.
- **Deposits and transfers** to keep account balances and activity history meaningful.
- **Dashboard and reports** with monthly totals, category breakdowns, trends, and account summaries.
- **Search and filtering** across the activity ledger by vendor, category, account, date, and activity type.
- **Recurring bill reminders** delivered through local notifications.
- **App lock support** with PIN and biometric authentication.
- **CSV export** for spreadsheet workflows.
- **Full ZIP backups** containing the SQLite database and attached bill images.
- **Light and dark themes**, configurable currency, and optional Indian digit grouping.

## Tech stack

- [Expo](https://expo.dev/) SDK 58
- [React Native](https://reactnative.dev/) 0.88
- [TypeScript](https://www.typescriptlang.org/)
- [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) for local persistence
- [react-native-svg](https://github.com/software-mansion/react-native-svg) for charts
- [date-fns](https://date-fns.org/) for date handling
- [JSZip](https://stuk.github.io/jszip/) for backup archives

## Requirements

- Node.js LTS (Node 20 or newer recommended)
- npm
- For Android development: Android Studio and an emulator or USB-connected device
- For iOS development: macOS with Xcode, or an iOS device running Expo Go
- For an Expo Go workflow: the Expo Go app on the target device

## Getting started

Clone the repository, install dependencies, and start the Expo development server:

```bash
npm install
npm start
```

Then choose a target from the Expo CLI:

```bash
npm run android   # Android emulator or connected device
npm run ios      # iOS simulator or connected device
npm run web      # Web browser
```

You can also scan the QR code shown by `npm start` with Expo Go. The SQLite database is created automatically on first launch and is migrated through the current schema version.

## Available scripts

| Script | Description |
| --- | --- |
| `npm start` | Start the Expo development server |
| `npm run android` | Build and run the native Android project |
| `npm run ios` | Build and run the native iOS project |
| `npm run web` | Start the Expo web target |

## App navigation

The main tabs are:

- **Home** - spending overview, account summary, recent activity, and due reminders.
- **Activity** - searchable and filterable ledger of expenses, deposits, and transfers.
- **Category ledger** - category-focused spending history.
- **Reports** - monthly and category-level financial insights.
- **Settings** - profile/security, currency, accounts, categories, appearance, exports, and data maintenance.

Additional screens support adding and editing bills, viewing receipts, managing accounts, managing categories, configuring reminders, and editing the user profile.

## Data and privacy

Hisobh is designed to keep financial data on the device:

- The database file is `expense_ledger.db`.
- Monetary values are stored as integer paise/cents to avoid floating-point rounding errors.
- SQLite uses WAL mode and foreign-key enforcement.
- Receipt images are copied into the app's permanent document storage rather than relying on temporary picker cache files.
- Deleting a bill removes its related line items and receipt records; associated image files are also managed by the app.
- CSV and ZIP exports are created locally and opened through the platform share sheet.

The app does request permissions for features that need them:

- Camera and photo library access for receipt images.
- Notifications for recurring bill reminders.
- Biometric authentication when app lock is enabled.

## Database model

The local schema is versioned in [`src/db/database.ts`](src/db/database.ts). Its core entities are:

- `bills` - expense headers such as date, vendor, amount, payment method, and account.
- `bill_items` - optional line items for multi-item bills.
- `bill_images` - receipt image references.
- `categories` - customizable spending categories.
- `accounts` - cash, bank, and UPI accounts.
- `incomes` - deposits and received payments.
- `transfers` - movements between accounts.
- `bill_reminders` - recurring monthly notification schedules.
- `app_settings` - user preferences and security settings.

Database access and reporting queries are centralized in [`src/db/queries.ts`](src/db/queries.ts). Currency conversion and formatting live in [`src/utils/currency.ts`](src/utils/currency.ts).

## Project structure

```text
.
├── assets/                 # App icons, splash art, and branding
├── src/
│   ├── app/                # Expo Router screens and route layouts
│   ├── components/         # Reusable UI, ledger, account, and chart components
│   ├── constants/          # Categories, colors, and app constants
│   ├── context/            # App state and theme providers
│   ├── db/                 # SQLite initialization, migrations, queries, and seed data
│   ├── services/           # Notifications and other platform services
│   ├── types/              # Shared TypeScript types
│   └── utils/              # Currency, date, file, and import/export helpers
├── app.json                # Expo app configuration and permissions
├── eas.json                # EAS build profiles
├── metro.config.js         # Metro bundler configuration
└── package.json            # Dependencies and development scripts
```

## Demo data and development testing

The project includes a demo-data seeder in [`src/db/seed.ts`](src/db/seed.ts). It can create a realistic set of expenses, deposits, and transfers for testing dashboard calculations, filters, charts, and scrolling performance.

When testing locally:

1. Launch the app.
2. Use the in-app demo-data action, if enabled in the current build.
3. Verify the Home, Activity, Category ledger, and Reports tabs.
4. Test receipt capture, CSV export, ZIP backup, reminders, and account transfers on a physical device where possible.

## Android builds with EAS

Install the EAS CLI and authenticate with Expo:

```bash
npm install --global eas-cli
eas login
```

Build an installable preview APK:

```bash
eas build --platform android --profile preview
```

Build a production Android App Bundle:

```bash
eas build --platform android --profile production
```

The profiles are defined in [`eas.json`](eas.json). The Android package name is `com.hisobh.app`; the iOS bundle identifier is `com.hisobh.app`.

## Common troubleshooting

### The app does not load after changing native configuration

Clear the Metro cache and restart:

```bash
npx expo start --clear
```

### A native permission or module is missing

Reinstall the Expo-compatible package version and rebuild the native app:

```bash
npx expo install
npm run android
```

Expo Go cannot provide every native capability in every configuration. Use a development build or a standalone EAS build when a feature requires native configuration.

### Local data looks stale during development

Reload the app first. If you intentionally need a clean local database, use the app's data-maintenance action; it preserves categories and settings while removing bill data.

## Contributing

Keep changes focused and consistent with the existing TypeScript and Expo patterns. Before opening a pull request:

1. Run the affected app flow on at least one target.
2. Verify database migrations against an existing local database when changing the schema.
3. Confirm export, image, notification, and account-related changes on a physical device when practical.
4. Keep sensitive financial data and generated backups out of source control.

## License

See [`LICENSE`](LICENSE) for the project's license.
