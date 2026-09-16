import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import Spot from "./models/Spot.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json({ limit: "100kb" }));

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many submissions. Please try again later." }
});

const clean = (value) => String(value ?? "").trim();

const isValidDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date);

const isValidTime = (time) => /^\d{2}:\d{2}$/.test(time);

const isIndianMobile = (number) => /^[6-9]\d{9}$/.test(number);

async function geocodeAddress(address, district) {
  const query = `${address}, ${district}, Andhra Pradesh, India`;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`,
      { headers: { "User-Agent": "SevaBhojanam/1.0 (public-annadanam-directory)" } }
    );
    if (!response.ok) return null;
    const results = await response.json();
    if (!results.length) return null;
    return { latitude: Number(results[0].lat), longitude: Number(results[0].lon) };
  } catch (error) {
    console.error("Geocoding failed:", error.message);
    return null;
  }
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "Seva Bhojanam" });
});

app.get("/api/spots", async (req, res) => {
  try {
    const { area, locality, date } = req.query;
    const filter = { state: "Andhra Pradesh" };

    if (date && isValidDate(date)) filter.date = date;

    if (area) {
      filter.area = { $regex: clean(area), $options: "i" };
    }

    if (locality) {
      filter.locality = { $regex: clean(locality), $options: "i" };
    }

    const spots = await Spot.find(filter).sort({ date: 1, startTime: 1, createdAt: -1 });
    res.json(spots);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load spots." });
  }
});

app.post("/api/spots", createLimiter, async (req, res) => {
  try {
    const data = {
      committeeName: clean(req.body.committeeName),
      organizerName: clean(req.body.organizerName),
      area: clean(req.body.area),
      locality: clean(req.body.locality),
      landmark: clean(req.body.landmark),
      address: clean(req.body.address),
      district: clean(req.body.district),
      state: "Andhra Pradesh",
      date: clean(req.body.date),
      startTime: clean(req.body.startTime),
      endTime: clean(req.body.endTime),
      contactNumber: clean(req.body.contactNumber).replace(/\s+/g, ""),
      description: clean(req.body.description),
      latitude: undefined,
      longitude: undefined
    };

    const required = [
      "committeeName",
      "organizerName",
      "area",
      "locality",
      "address",
      "district",
      "date",
      "startTime",
      "endTime",
      "contactNumber"
    ];

    for (const field of required) {
      if (!data[field]) {
        return res.status(400).json({ message: `${field} is required.` });
      }
    }

    if (!isValidDate(data.date)) {
      return res.status(400).json({ message: "Invalid date." });
    }

    if (!isValidTime(data.startTime) || !isValidTime(data.endTime)) {
      return res.status(400).json({ message: "Invalid timing." });
    }

    if (data.startTime >= data.endTime) {
      return res.status(400).json({ message: "End time must be after start time." });
    }

    if (!isIndianMobile(data.contactNumber)) {
      return res.status(400).json({ message: "Enter a valid 10-digit Indian mobile number." });
    }

    const coordinates = await geocodeAddress(data.address, data.district);
    if (coordinates) {
      data.latitude = coordinates.latitude;
      data.longitude = coordinates.longitude;
    }

    const created = await Spot.create(data);
    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to add the Annadanam spot." });
  }
});

app.delete("/api/spots/:id", async (req, res) => {
  // Optional endpoint for future admin/moderation use.
  res.status(403).json({ message: "Public deletion is disabled." });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
