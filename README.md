# FormHub Worker

A high-performance, multi-tenant form intake platform built on Node.js and MongoDB. It allows users to register, log in, define custom form fields, and securely collect submissions via dedicated endpoints (`/:username/:appname/`) with optional Shopify metaobject synchronization.

## Features

- **Multi-Tenant Architecture**: Supports multiple users, each with their own isolated apps, API keys, and submission buckets.
- **Customizable Form Apps & Bundles**: Create individual form apps or bundle multiple apps together.
- **Top-Notch Security**: 
  - Strict security headers (Helmet, CSP, HSTS, X-DNS-Prefetch-Control, X-Permitted-Cross-Domain-Policies).
  - PBKDF2 with 100,000 iterations for password hashing.
  - AES-GCM encryption for API keys and sensitive data at rest in MongoDB.
  - Cloudflare Turnstile integration to prevent spam and bot submissions.
  - Dynamic rate-limiting and auto-throttling based on real-time server load.
- **Shopify Metaobject Sync**: Seamlessly synchronize collected form submissions directly to a Shopify store.
- **API Gateway**: Generate API keys and manage your form data programmatically.
- **Highly Optimized & Lightweight**: Compressed backend code, dual-stack IPv4/IPv6 support, and zero-allocation health checks.
- **Built-in UI Dashboard**: A simple, fast HTML/JS UI dashboard built right into the server for managing apps, keys, and viewing submissions.

## Requirements

- Node.js 18+ (Uses native `fetch`, `Request`, `Response`)
- MongoDB (Local or Atlas)
- Docker (optional, for deployment)

## Setup & Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Create a `.env` file in the root directory. Required variables:
   ```env
   # Core
   PORT=3000
   HOST=::
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB_NAME=formhub
   
   # Security
   JWT_SECRET=your_super_secret_jwt_key
   ENCRYPTION_KEY=your_32_byte_hex_encryption_key

   # Optional (Anti-bot)
   PLATFORM_TURNSTILE_SECRET_KEY=your_cloudflare_turnstile_secret
   
   # Optional (CORS)
   DASHBOARD_ALLOWED_ORIGINS=http://localhost:3000
   ```

3. **Start the server**:
   ```bash
   npm start
   # or for development with auto-restart:
   npm run dev
   ```

## Project Structure

```text
src/
├── server.js              # Entry point: Express middleware, rate-limiting, and lifecycle management
├── index.js               # Core request handler and UI/API routing
├── db.js                  # MongoDB connection pooling and indexing
├── auth.js                # JWT authentication and user sessions
├── security.js            # Security headers, CORS, rate limits, and Turnstile verify
├── crypto-utils.js        # PBKDF2 hashing and AES-GCM encryption utilities
├── shopify.js             # Shopify Metaobject sync logic
├── validation.js          # Request payload and configuration validation
├── routes/                # API Endpoints
│   ├── apps.js            # CRUD for form apps
│   ├── bundles.js         # CRUD for app bundles
│   ├── submissions.js     # Viewing form submissions
│   ├── submit.js          # Core form intake POST handler
│   ├── apikeys.js         # API Key generation and management
│   ├── apigateway.js      # Programmatic API access handling
│   ├── login.js           # User login authentication
│   ├── register.js        # User registration
│   └── files.js           # File upload handling
└── ui/                    # Built-in Dashboard UI
    ├── html.js            # HTML templates
    ├── scripts.js         # Frontend JavaScript
    └── styles.js          # CSS styles
```

## Deployment (Fly.io / Docker)

This project is fully Dockerized and optimized for platforms like Fly.io.

```bash
fly deploy
```

- Binds to `::` (IPv6 & IPv4 dual-stack).
- Optimized Docker `HEALTHCHECK` ensures the container is marked unhealthy only if the Node process actually hangs.
- Built-in load factor detection prevents memory exhaustion by shedding non-critical requests during traffic spikes.
