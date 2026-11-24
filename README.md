# KuberaGold Backend API

Built with **Node.js**, **Express.js**, and **MongoDB (Mongoose)** using standard `.js` files.

## Features
- **Daily Gold Rate Engine:** Update 24K, 22K, 18K, 14K, and Silver buy/sell prices.
- **Automatic Calculations:** Tola conversions, price fluctuation percentage, and trend indicators.
- **3-Tier RBAC:** `guest`, `admin`, `superadmin` secured via JWT.
- **Dynamic CMS:** Banners, Blogs, and Global Website Settings APIs.
- **Exchange Leads:** Customer buy/sell/exchange inquiry submissions and status workflows.

## Environment Variables (.env)
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/kuberagold
JWT_SECRET=kuberagold_super_secret_jwt_key_2026_change_in_production
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:5173
```

## Available Scripts
- `npm start`: Runs `node server.js`
- `npm run dev`: Runs `nodemon server.js`
- `npm run seed`: Seeds database with SuperAdmin, Admin, Guest, sample rates, banners, blogs, and settings.
