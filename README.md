# 🚀 RealTimeChat - Industry-Grade Real-Time System

A professional, full-stack real-time communication platform built with Node.js, Socket.IO, and MongoDB. This project has been hardened to meet industry standards for security, performance, and UI/UX excellence.

## ✨ Key Features
- **Real-Time Messaging**: Instant public and private messaging with optimized Socket.IO delivery.
- **Segmented File Sharing**: Large file uploads (Images/Videos) handled via segmented chunking to ensure stability and efficiency.
- **WebRTC Integration**: Foundational support for peer-to-peer signaling for future video/voice expansions.
- **Industry-Grade Security**:
  - **JWT Authentication**: Secure stateless authentication for all API endpoints.
  - **DDoS/Brute-Force Protection**: IP-based rate limiting on sensitive auth routes.
  - **HTTP Hardening**: Secure headers via `helmet` and robust CORS configurations.
  - **XSS Prevention**: Strict input sanitization and secure DOM injection practices.
- **Modern UI/UX**: A polished, responsive interface featuring glassmorphism, smooth animations, and a sleek dark mode.

## 🛠️ Technical Stack
- **Frontend**: Vanilla JS (ES6+), HTML5, Modern CSS (HSL Palettes, Glassmorphism).
- **Backend**: Node.js, Express.js.
- **Real-Time**: Socket.IO.
- **Database**: MongoDB (Mongoose), Firebase (Firestore for metadata).
- **Storage**: Azure Blob Storage & Google Drive API (File Attachments).

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas Account
- Firebase Service Account Key

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   - Create a `.env` file in the root directory.
   - Refer to `.env.example` for the required keys.
4. Start the development server:
   ```bash
   npm run dev
   ```

## 🏗️ Architecture Note
The system uses a hybrid real-time architecture where metadata resides in MongoDB/Firebase, and high-bandwidth file transfers are optimized through segmented Socket.IO emitters combined with cloud storage providers. The backend is designed for high availability with graceful shutdown handling and efficient socket resource management.

---
*Developed with a focus on visual excellence and production-level security.*