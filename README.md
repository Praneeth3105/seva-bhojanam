# Seva Bhojanam

A public Ganesh Chaturthi Annadanam spot directory for Andhra Pradesh.

## Features
- No login required for visitors.
- Organizers can submit an Annadanam spot.
- Required committee/organizer, area, locality, **full address**, date, start/end time and contact number.
- No manual latitude/longitude fields.
- When a spot is submitted, the backend automatically geocodes the address using OpenStreetMap Nominatim and stores coordinates when a result is found.
- Spots are grouped into Today, Tomorrow and Upcoming.
- Today's spots become Expired after their end time.
- Search by area/locality/address/district.
- Nearby Me uses browser location and sorts spots by distance when stored coordinates are available.
- MongoDB persistence.
- Basic validation and rate limiting.

## Run

### Backend
```bash
cd backend
npm install
copy .env.example .env
npm start
```

For Linux/macOS:
```bash
cp .env.example .env
```

Set:
```env
MONGO_URI=mongodb://127.0.0.1:27017/seva-bhojanam
PORT=8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

The frontend defaults to http://localhost:5173 and backend to http://localhost:8000.

If deploying, set:
```env
VITE_API_URL=https://your-backend-url
```

## Address and Nearby Me

Organizers enter a normal address such as:
`Near Kanaka Durga Temple, 1 Town, Vijayawada, Andhra Pradesh`

The backend automatically attempts to convert that address into coordinates. The organizer does not need to know latitude or longitude.

For a production launch, add moderation/CAPTCHA and consider a proper map/geocoding provider with usage limits and terms appropriate for the site's traffic.
