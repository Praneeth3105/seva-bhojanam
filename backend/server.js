import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";

import Spot from "./models/Spot.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 8000;

/*
  Required for Render + express-rate-limit.
*/
app.set("trust proxy", 1);

app.use(cors());

app.use(
  express.json({
    limit: "100kb",
  }),
);

/* =========================
   RATE LIMITERS
========================= */

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  max: 30,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    message: "Too many submissions. Please try again later.",
  },
});

const interestedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  max: 100,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    message: "Too many requests. Please try again later.",
  },
});

/* =========================
   HELPERS
========================= */

const clean = (value) => String(value ?? "").trim();

const isValidDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date);

const isValidTime = (time) => /^\d{2}:\d{2}$/.test(time);

const isIndianMobile = (number) => /^[6-9]\d{9}$/.test(number);

function isValidLatitude(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  );
}

function isValidLongitude(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  );
}

function isValidMapUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/* =========================
   ADDRESS GEOCODING FALLBACK
========================= */

async function geocodeAddress(address, district) {
  const query = `${address}, ${district}, Andhra Pradesh, India`;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(
        query,
      )}`,
      {
        headers: {
          "User-Agent": "SevaBhojanam/1.0 (public-annadanam-directory)",
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const results = await response.json();

    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    const latitude = Number(results[0].lat);

    const longitude = Number(results[0].lon);

    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      return null;
    }

    return {
      latitude,
      longitude,
    };
  } catch (error) {
    console.error("Geocoding failed:", error.message);

    return null;
  }
}

/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Seva Bhojanam",
  });
});

/* =========================
   GET ALL SPOTS
========================= */

app.get("/api/spots", async (req, res) => {
  try {
    const { area, locality, date } = req.query;

    const filter = {
      state: "Andhra Pradesh",
    };

    if (date && isValidDate(date)) {
      filter.date = date;
    }

    if (area) {
      filter.area = {
        $regex: clean(area),
        $options: "i",
      };
    }

    if (locality) {
      filter.locality = {
        $regex: clean(locality),
        $options: "i",
      };
    }

    const spots = await Spot.find(filter).sort({
      date: 1,
      startTime: 1,
      createdAt: -1,
    });

    res.json(spots);
  } catch (error) {
    console.error("GET spots error:", error);

    res.status(500).json({
      message: "Unable to load spots.",
    });
  }
});

/* =========================
   GET SINGLE SPOT
========================= */

app.get("/api/spots/:id", async (req, res) => {
  try {
    const spot = await Spot.findById(req.params.id);

    if (!spot) {
      return res.status(404).json({
        message: "Annadanam spot not found.",
      });
    }

    res.json(spot);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Unable to load Annadanam spot.",
    });
  }
});

/* =========================
   CREATE SPOT
========================= */

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

      contactNumber: clean(req.body.contactNumber),

      description: clean(req.body.description),

      mapUrl: clean(req.body.mapUrl),

      latitude:
        req.body.latitude === "" || req.body.latitude == null
          ? undefined
          : Number(req.body.latitude),

      longitude:
        req.body.longitude === "" || req.body.longitude == null
          ? undefined
          : Number(req.body.longitude),

      interestedCount: 0,
    };

    /* REQUIRED FIELDS */

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
      "contactNumber",
    ];

    for (const field of required) {
      if (!data[field]) {
        return res.status(400).json({
          message: `${field} is required.`,
        });
      }
    }

    /* DATE */

    if (!isValidDate(data.date)) {
      return res.status(400).json({
        message: "Invalid date.",
      });
    }

    /* TIME */

    if (!isValidTime(data.startTime) || !isValidTime(data.endTime)) {
      return res.status(400).json({
        message: "Invalid timing.",
      });
    }

    if (data.startTime >= data.endTime) {
      return res.status(400).json({
        message: "End time must be after start time.",
      });
    }

    /* PHONE */

    if (!isIndianMobile(data.contactNumber)) {
      return res.status(400).json({
        message: "Enter a valid 10-digit Indian mobile number.",
      });
    }

    /* MAP URL */

    if (data.mapUrl && !isValidMapUrl(data.mapUrl)) {
      return res.status(400).json({
        message: "Please enter a valid Maps link.",
      });
    }

    const hasLatitude = data.latitude !== undefined;

    const hasLongitude = data.longitude !== undefined;

    /*
        Must receive both coordinates,
        not only one.
      */

    if (hasLatitude !== hasLongitude) {
      return res.status(400).json({
        message: "Both latitude and longitude are required.",
      });
    }

    /*
        Validate exact GPS coordinates.
      */

    if (hasLatitude && hasLongitude) {
      if (!isValidLatitude(data.latitude)) {
        return res.status(400).json({
          message: "Invalid latitude.",
        });
      }

      if (!isValidLongitude(data.longitude)) {
        return res.status(400).json({
          message: "Invalid longitude.",
        });
      }
    }

    /*
        IMPORTANT:

        If organizer used current location,
        DO NOT overwrite exact GPS.

        Only geocode address when exact
        coordinates were not provided.
      */

    if (!hasLatitude && !hasLongitude) {
      const coordinates = await geocodeAddress(data.address, data.district);

      if (coordinates) {
        data.latitude = coordinates.latitude;

        data.longitude = coordinates.longitude;
      }
    }

    /*
        If coordinates exist but mapUrl doesn't,
        automatically generate Maps URL.
      */

    if (
      !data.mapUrl &&
      data.latitude !== undefined &&
      data.longitude !== undefined
    ) {
      data.mapUrl = `https://www.google.com/maps?q=${data.latitude},${data.longitude}`;
    }

    const created = await Spot.create(data);

    res.status(201).json(created);
  } catch (error) {
    console.error("CREATE SPOT ERROR:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: Object.values(error.errors)
          .map((item) => item.message)
          .join(", "),
      });
    }

    res.status(500).json({
      message: "Unable to add the Annadanam spot.",
    });
  }
});

/* =========================
   INTERESTED
========================= */

app.post("/api/spots/:id/interested", interestedLimiter, async (req, res) => {
  try {
    /*
        Atomic MongoDB increment.

        0 -> 1
        1 -> 2
        2 -> 3
        etc.
      */

    const spot = await Spot.findByIdAndUpdate(
      req.params.id,

      {
        $inc: {
          interestedCount: 1,
        },
      },

      {
        new: true,
        runValidators: true,
      },
    );

    if (!spot) {
      return res.status(404).json({
        message: "Annadanam spot not found.",
      });
    }

    /*
        Send new count back to React.
      */

    res.json({
      success: true,

      interestedCount: spot.interestedCount || 0,
    });
  } catch (error) {
    console.error("INTERESTED ERROR:", error);

    res.status(500).json({
      message: "Unable to update Interested count.",
    });
  }
});

/* =========================
   DELETE DISABLED
========================= */

app.delete("/api/spots/:id", (req, res) => {
  res.status(403).json({
    message: "Public deletion is disabled.",
  });
});

/* =========================
   DATABASE
========================= */

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
