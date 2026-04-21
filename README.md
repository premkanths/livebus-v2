# LiveBus - Real-Time Transit Tracker

LiveBus is a real-time bus tracking web application built with Next.js, Firebase, Firestore, and Leaflet maps. It includes separate dashboards for passengers, drivers, and admins.

Passengers can search for routes and view live bus locations. Drivers can broadcast their GPS position while driving. Admins can create, edit, and delete route stop sequences.

## Getting Started Locally

### 1. Install Dependencies
Open your terminal in the project folder and run:
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory and fill in your Firebase credentials:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

In Firebase, enable Email/Password authentication. Enable Google sign-in only if you want the Google login button to work.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to see the app.

## App Roles

- **Passenger**: search source/destination, view matching routes, and track active buses on the map.
- **Driver**: select a route, start service, and publish live GPS location to Firestore.
- **Admin**: manage bus route IDs, names, colors, and stop sequences.

Admin access is assigned manually by setting a user's `role` field to `admin` in the Firestore `users` collection.

## Useful Commands

```bash
npm run dev
npm run typecheck
npm run build
```

## Push to GitHub

To send this project to your own GitHub repository, follow these steps:

1. Create a new, empty repository on [GitHub](https://github.com/new).
2. In your local project folder, run:
```bash
git init
git add .
git commit -m "Initial commit of LiveBus"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Database/Auth**: Firebase & Firestore
- **Maps**: Leaflet + React Leaflet with OpenStreetMap tiles
- **UI**: ShadCN UI + Tailwind CSS
- **Icons**: Lucide React
