# Deploying the backend to Vercel

The Express API runs as one Vercel serverless function (`api/index.js`, routed by `vercel.json`).
Locally, `npm run dev` still runs it as a normal server.

## 1. MongoDB Atlas

1. **Database user:** Atlas > Database Access. Use a long random password.
2. **Network access:** Atlas > Network Access > Add IP Address > **Allow access from anywhere (`0.0.0.0/0`)**.
   Vercel functions have no fixed IP address, so this is required. The strong database password is what protects the data.
3. Copy the connection string (`mongodb+srv://...`) for `MONGO_URI`.

## 2. Create the Vercel project

1. Vercel > Add New > Project > import the `kuberagold/backend` GitHub repository.
2. Framework preset: **Other**. Leave the build and output settings empty.
3. Add the environment variables below, then deploy.

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGO_URI` | Atlas connection string |
| `JWT_SECRET` | 64+ random characters (generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`). Do not reuse the development value. |
| `JWT_EXPIRE` | `1d` (or `7d`) |
| `CLIENT_URL` | Frontend address(es), comma-separated, e.g. `https://kuberagold.com,https://kuberagold-frontend-*.vercel.app` (the `*` stands for one part of the name and allows Vercel preview links) |
| `REGISTRATION_SECRET` | Private key for the hidden `/staff-register` page. Leave unset to close registration. |
| `REGISTRATION_ROLE` | `admin` or `guest` |

The function refuses to start with a weak or example `JWT_SECRET`, or with `CLIENT_URL` set to a bare `*`.
If that happens, Vercel's function logs show the reason.

## 3. Check it

- `https://<backend>.vercel.app/api/health` should show `"database":"connected"`.
- If it shows `disconnected`, check `MONGO_URI` and the Atlas network access setting. The API answers 503 until the database is reachable; it never falls back to the demo data in production.

## 4. First data

Vercel does not run the seed scripts. From your own computer, with `MONGO_URI` in `.env` pointing at Atlas:

```bash
npm run seed
```

Then **immediately log in and change the demo admin passwords** (`Admin@123456`), or create real staff accounts and delete the demo ones.
The seed script wipes existing data and refuses to run with `NODE_ENV=production`.

## Notes

- **Rate limits** are counted per serverless instance, so on Vercel they are a first line of defence, not a hard limit.
  For strict limits, connect a shared store such as Upstash Redis to `express-rate-limit`.
- **Security tests:** `npm run security:check` runs 50 API checks against a local development backend.
