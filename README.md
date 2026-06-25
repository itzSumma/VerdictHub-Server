# VerdictHub Server

Express/MongoDB API for VerdictHub, an online lawyer hiring platform. The server provides lawyer listing APIs, protected role-based dashboard APIs, hiring requests, comments, Stripe payments, webhook syncing, transactions, and admin analytics.

## Live Link

- Server: https://verdict-hub-server.vercel.app/

## Key Features

- MongoDB database configured with `DB_NAME=verdictHub`
- Better Auth JWT verification through JWKS
- Role-based API protection for user, lawyer, and admin
- Lawyer listing CRUD and publish/unpublish controls
- Hiring request flow with accepted/rejected status
- Stripe PaymentIntent creation and webhook confirmation
- Transaction history for users/lawyers and admin
- Comment system restricted to users who hired a lawyer
- Admin user management and analytics endpoints
- CORS configured by `CLIENT_URL`

## Main Packages

- Express
- MongoDB
- Stripe
- jose-cjs
- dotenv
- cors
- nodemon

## Local Setup

```bash
npm install
npm run dev
```

Create `.env` from `.env.example` and fill in MongoDB, Stripe, and client URL values.

For local Stripe webhook testing:

```bash
stripe listen --forward-to localhost:5000/webhooks/stripe
```
