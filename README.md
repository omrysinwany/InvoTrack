# InvoTrack

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat&logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Backend-FFCA28?style=flat&logo=firebase&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.0-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-AI-8E75B2?style=flat&logo=google-gemini&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)

> Smart inventory & financial management system. Automates stock updates from delivery notes via GenAI, provides actionable business insights, and syncs real-time with POS.

A full-stack SaaS platform built with **Next.js 16**, **Firebase**, and **Google Genkit**. It bridges the gap between physical paperwork and digital business management by automating document processing and synchronizing inventory across systems.

### 🌐 Live Demo
You can try the live application here: [**invo-track-seven.vercel.app**](https://invo-track-seven.vercel.app)


https://github.com/user-attachments/assets/6f0b3ced-4f30-4b92-b497-f3a191630d41


## 💡 How It Works

InvoTrack creates a seamless automated workflow for small businesses:

1.  **AI Document Agents**: Uses Google Genkit to parse Hebrew invoices and delivery notes with high precision, extracting line items, prices, and supplier details.
2.  **Automated Inventory Control**: Scanned delivery notes immediately update stock levels in the system, eliminating manual data entry errors.
3.  **Bi-Directional POS Sync**: Real-time synchronization with external POS systems (Caspit, Hashavshevet) ensures stock levels and prices are always accurate across all channels.
4.  **360° Business Intelligence**: Aggregates data into a visual dashboard enabling tracking of expenses, supplier payments, and real-time profitability (KPIs).

## ✨ Key Features

- **Generative AI Parsing** - Extracts structured data from images (Invoices/Delivery Notes) using Gemini AI models.
- **Smart Inventory Management** - Automatic stock adjustments based on document scans and low-inventory alerts.
- **POS Integrations** - Plugin-based architecture supporting sync with **Caspit** and **Hashavshevet**.
- **Financial Control** - Track expenses, manage supplier payments ("Paid"/"Pending"), and monitor cash flow.
- **Analytics Dashboard** - Real-time graphs for monthly expenses, revenue, and top-selling items.
- **Barcode Scanner** - Built-in scanner for quick product lookup and management.
- **Localization** - Full support for Hebrew (RTL) and English currencies and date formats.

## 🛠️ Tech Stack

**Frontend:**
- **Next.js 16** (App Router & Server Actions)
- **React 19**
- TypeScript
- Tailwind CSS & Shadcn UI
- Recharts (Analytics)

**Backend & AI:**
- **Google Genkit** (AI Agent Framework)
- **Google Gemini** (LLM)
- Firebase (Firestore, Auth, Storage)
- Node.js Server Actions

**Architecture:**
- **Adapter Pattern** - For scalable POS system integrations.
- **Server Actions** - For type-safe backend logic execution.
- **React Query** - For optimized server state management.

## 📁 Project Structure

```bash
src/
├── app/              # Next.js 16 App Router pages
├── ai/               # Genkit flows and prompt engineering
├── actions/          # Server Actions (Backend logic)
├── services/         # Business logic & POS Adapters
├── components/       # Reusable UI components (Shadcn)
├── hooks/            # Custom React hooks
├── lib/              # Utility functions & Firebase config
└── locales/          # i18n translation files
```

## 🎯 Key Technical Highlights

- **Cutting-Edge Stack**: Built on the latest **Next.js 16** and **React 19**, utilizing modern features like Server Components and Actions.
- **Robust AI Engineering**: Implements retry mechanisms and exponential backoff for AI flows to ensure reliability in production.
- **Scalable Architecture**: The POS integration layer uses the **Factory and Adapter patterns**, making it easy to add new POS providers without changing core logic.
- **Type Safety**: End-to-end type safety with **TypeScript** and **Zod** schema validation for AI outputs.

## 📄 License

This project is [MIT](LICENSE) licensed.

## 👤 Author

**Omry** - Full-Stack Developer

Feel free to reach out for collaboration or opportunities!

---

**Built with Next.js, TypeScript, and Firebase**


