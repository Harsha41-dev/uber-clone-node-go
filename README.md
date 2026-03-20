# Uber Clone Starter

Small full stack Uber style starter with:

- React client
- Node.js API
- Go realtime service

This is not overengineered on purpose. The idea is to keep the code simple but still show a better architecture than a normal CRUD project.

## Folder idea

- `client` - UI for auth, rider flow, driver flow
- `server` - auth, users, drivers, rides
- `realtime` - live driver location and nearby driver lookup

## Run it

Open 3 terminals.

### 1. API

```bash
cd server
npm install
npm run dev
```

Runs on `http://localhost:4000`

### 2. Realtime

```bash
cd realtime
go run ./cmd/server
```

Runs on `http://localhost:8080`

### 3. Client

```bash
cd client
npm install
npm run dev
```

Runs on `http://localhost:5173`

## Notes

- If `MONGO_URL` is missing, the API still runs using in-memory data for now.
- That keeps local setup easy while we build features.
- Later we can switch the app fully to Mongo only mode.
