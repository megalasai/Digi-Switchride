# Azure Deployment Runbook

## Prerequisites

- Azure CLI 2.50+
- Bicep CLI
- Active Azure subscription with Contributor access

## Deploy Dev Environment

```bash
az login

az group create \
  --name rg-digi-switchride-dev \
  --location centralindia

az deployment group create \
  --resource-group rg-digi-switchride-dev \
  --template-file infra/bicep/main.bicep \
  --parameters infra/environments/dev.bicepparam
```

## Post-Deployment

1. Store secrets in Key Vault:
   - JWT_SECRET
   - Razorpay API keys
   - KYC provider credentials
   - MONGODB_URI (Cosmos DB connection string)

2. Configure APIM to proxy to Container App / App Service backend

3. Start API locally against MongoDB:
   ```bash
   docker compose up -d
   cd apps/api && cp .env.example .env && npm run dev
   ```

## Stack (aligned with DigiTrack)

| Component | Technology |
|-----------|-----------|
| Backend | NestJS 11 + Mongoose 8 |
| Database | MongoDB 7 (local) / Azure Cosmos DB MongoDB API (prod) |
| Admin | Next.js 15 |
| Mobile | Native Kotlin + Swift |
