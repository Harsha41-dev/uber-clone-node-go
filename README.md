# Uber Clone

I am building this repo feature by feature as a small Uber style project with:

- React client
- Node.js API
- Go realtime service

Right now the working parts are:

- user register and login
- rider / driver role selection
- driver onboarding form
- driver online / offline status
- rider fare estimate and ride booking
- live driver updates from shared driver location
- drivers can accept open rides and update ride progress
- rider and driver trip summaries with active ride tracking
- ride timestamps for accepted, started, completed and cancelled states

The project still uses a simple UI, but the main ride lifecycle is now connected end to end.

## Project folders

- `client` for the React app
- `server` for auth, users, drivers and ride APIs
- `realtime` for the Go service

## Run locally

Open 3 terminals.

### API

```bash
cd server
npm install
npm run dev
```

Runs on `http://localhost:4000`

### Realtime service

```bash
cd realtime
go run ./cmd/server
```

Runs on `http://localhost:8080`

### Client

```bash
cd client
npm install
npm run dev
```

Runs on `http://localhost:5173`

## Notes

- If `MONGO_URL` is not set, the API falls back to in-memory data.
- That keeps local setup easy while the project is still growing.
