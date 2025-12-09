# InvoTrack

> AI-powered inventory and document management system for small businesses

A full-stack web application built with Next.js 15, Firebase, and Google Gemini AI. Automates invoice processing, manages inventory, and integrates with POS systems.

## ✨ Features

- **AI Document Scanning** - Automatically extract data from invoices and delivery notes using Gemini AI
- **Inventory Management** - Track stock levels with low inventory alerts
- **POS Integration** - Sync with Caspit and Hashavshevet systems
- **Analytics Dashboard** - Real-time KPIs and business insights
- **Barcode Scanner** - Quick product lookup and management
- **Expense Tracking** - Monitor and categorize business expenses
- **Multi-language** - Supports Hebrew and English
- **Dark Mode** - Full dark theme support
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile

## 🛠️ Tech Stack

**Frontend:**
- Next.js 15 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Radix UI Components

**Backend:**
- Firebase (Firestore, Auth, Storage)
- Next.js Server Actions
- Google Gemini AI (Genkit)

**State Management:**
- React Query
- Context API

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd studio
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy `.env.example` to `.env.local` and fill in your Firebase and Google AI credentials.

4. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:9002](http://localhost:9002)

## 📁 Project Structure

```
src/
├── app/              # Next.js pages and routes
├── components/       # Reusable React components
├── actions/          # Server Actions
├── services/         # Business logic and API calls
├── contexts/         # React Context providers
├── hooks/            # Custom React hooks
├── lib/              # Utility functions
├── ai/               # Gemini AI integration
└── locales/          # i18n translations
```

## 🎯 Key Technical Highlights

- **Modern Architecture** - Next.js 15 App Router with Server Actions
- **AI Integration** - Google Gemini for intelligent document processing
- **Real-time Data** - Firebase Firestore for instant synchronization
- **Type Safety** - Full TypeScript implementation
- **Performance** - React Query for optimized data fetching and caching

## 📄 License

This project is [MIT](LICENSE) licensed.

## 👤 Author

**Omry** - Full-Stack Developer

Feel free to reach out for collaboration or opportunities!

---

**Built with Next.js, TypeScript, and Firebase**
