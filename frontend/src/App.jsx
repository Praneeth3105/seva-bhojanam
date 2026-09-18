import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Compass,
  LocateFixed,
  MapPin,
  Phone,
  Plus,
  Search,
  Utensils,
  X,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

const pad = (n) => String(n).padStart(2, "0");

function localDateString(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}`;
}

function formatDate(dateString) {
  if (!dateString) return "";

  const d = new Date(`${dateString}T00:00:00`);

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function getStatus(spot) {
  const today = localDateString();
  const tomorrow = localDateString(1);

  if (spot.date < today) return "expired";

  if (spot.date === today) {
    const now = new Date();

    const current = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    if (current >= spot.endTime) {
      return "expired";
    }

    return "today";
  }

  if (spot.date === tomorrow) {
    return "tomorrow";
  }

  return "upcoming";
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;

  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;

  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function App() {
  const [spots, setSpots] = useState([]);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [nearby, setNearby] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  const [toast, setToast] = useState("");

  async function loadSpots() {
    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/spots`);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load spots.");
      }

      setSpots(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);

      setToast("Could not load Annadanam spots.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSpots();
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast("");
    }, 3500);

    return () => clearTimeout(timer);
  }, [toast]);

  const counts = useMemo(() => {
    return {
      today: spots.filter((spot) => getStatus(spot) === "today").length,

      tomorrow: spots.filter(
        (spot) => getStatus(spot) === "tomorrow"
      ).length,

      upcoming: spots.filter(
        (spot) => getStatus(spot) === "upcoming"
      ).length,
    };
  }, [spots]);

  const visibleSpots = useMemo(() => {
    const q = query.toLowerCase().trim();

    let result = spots.filter((spot) => {
      const searchText = [
        spot.committeeName,
        spot.organizerName,
        spot.area,
        spot.locality,
        spot.landmark,
        spot.address,
        spot.district,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesText = !q || searchText.includes(q);

      const status = getStatus(spot);

      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "today" && status === "today") ||
        (activeFilter === "tomorrow" && status === "tomorrow") ||
        (activeFilter === "upcoming" && status === "upcoming");

      return matchesText && matchesFilter && status !== "expired";
    });

    if (nearby && userLocation) {
      result = result
        .map((spot) => {
          const hasCoordinates =
            typeof spot.latitude === "number" &&
            typeof spot.longitude === "number";

          return {
            ...spot,

            distance: hasCoordinates
              ? distanceKm(
                  userLocation.lat,
                  userLocation.lng,
                  spot.latitude,
                  spot.longitude
                )
              : Infinity,
          };
        })
        .sort((a, b) => a.distance - b.distance);
    }

    return result;
  }, [spots, query, activeFilter, nearby, userLocation]);

  function findNearby() {
    if (!navigator.geolocation) {
      setToast("Your browser does not support location.");

      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });

        setNearby(true);

        setToast("Showing Annadanam spots closest to you.");
      },

      () => {
        setNearby(false);
        setUserLocation(null);

        setToast(
          "Location permission was not allowed. Search by area instead."
        );
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  }

  async function addSpot(formData) {
    const response = await fetch(`${API_URL}/api/spots`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to add Annadanam spot.");
    }

    /*
      Add the new card immediately.
    */
    setSpots((current) => [data, ...current]);

    /*
      Close form and return user to all spots.
    */
    setShowForm(false);
    setActiveFilter("all");
    setQuery("");
    setNearby(false);
    setUserLocation(null);

    setToast("Annadanam spot added successfully.");

    /*
      Scroll automatically to the newly updated directory.
    */
    setTimeout(() => {
      document.getElementById("annadanam-spots")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
  }

  function updateInterestedCount(spotId, newCount) {
    setSpots((current) =>
      current.map((spot) =>
        spot._id === spotId
          ? {
              ...spot,
              interestedCount: newCount,
            }
          : spot
      )
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="container nav-inner">
          <a className="brand" href="#top">
            <span className="brand-icon">ॐ</span>

            <span>
              <strong>Seva Bhojanam</strong>
              <small>Ganesh Annadanam</small>
            </span>
          </a>

          <button
            type="button"
            className="add-top-btn"
            onClick={() => setShowForm(true)}
          >
            <Plus size={18} />

            Add Annadanam
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">
                🙏 Seva • Bhojanam • Vinayaka Seva
              </div>

              <h1>
                Find Annadanam
                <br />
                <em>near you.</em>
              </h1>

              <p>
                A simple public directory to discover Ganesh Chaturthi
                Annadanam spots across Andhra Pradesh.
              </p>

              <div className="search-box">
                <Search size={20} />

                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search area, locality, address, landmark or district..."
                />

                <button type="button" onClick={findNearby}>
                  <Compass size={17} />

                  Nearby Me
                </button>
              </div>

              <div className="hero-note">
                <MapPin size={16} />

                Andhra Pradesh only • No login required
              </div>
            </div>

            <div className="hero-art" aria-hidden="true">
              <div className="mandala">ॐ</div>

              <div className="hero-bowl">
                <span>अन्नदानम्</span>
                <small>Food is Seva</small>
              </div>
            </div>
          </div>
        </section>

        <section
          className="container quick-section"
          id="annadanam-spots"
        >
          <div className="section-heading">
            <div>
              <span className="section-kicker">LIVE DIRECTORY</span>

              <h2>Annadanam spots</h2>
            </div>

            <button
              type="button"
              className="outline-btn"
              onClick={() => setShowForm(true)}
            >
              Add a spot

              <ArrowRight size={16} />
            </button>
          </div>

          <div className="filters">
            <FilterButton
              active={activeFilter === "all"}
              onClick={() => setActiveFilter("all")}
            >
              All spots
            </FilterButton>

            <FilterButton
              active={activeFilter === "today"}
              onClick={() => setActiveFilter("today")}
            >
              Today <b>{counts.today}</b>
            </FilterButton>

            <FilterButton
              active={activeFilter === "tomorrow"}
              onClick={() => setActiveFilter("tomorrow")}
            >
              Tomorrow <b>{counts.tomorrow}</b>
            </FilterButton>

            <FilterButton
              active={activeFilter === "upcoming"}
              onClick={() => setActiveFilter("upcoming")}
            >
              Upcoming <b>{counts.upcoming}</b>
            </FilterButton>
          </div>

          {nearby && (
            <div className="nearby-banner">
              <Compass size={17} />

              Spots with exact locations are sorted by distance.

              <button
                type="button"
                onClick={() => {
                  setNearby(false);
                  setUserLocation(null);
                }}
              >
                Clear
              </button>
            </div>
          )}

          {loading ? (
            <div className="empty-state">
              Loading Annadanam spots...
            </div>
          ) : visibleSpots.length === 0 ? (
            <div className="empty-state">
              <Utensils size={30} />

              <h3>No spots found</h3>

              <p>
                Try another area or add the first Annadanam spot.
              </p>

              <button
                type="button"
                className="primary-btn"
                onClick={() => setShowForm(true)}
              >
                Add Annadanam spot
              </button>
            </div>
          ) : (
            <div className="spot-grid">
              {visibleSpots.map((spot) => (
                <SpotCard
                  key={spot._id}
                  spot={spot}
                  onInterestedChange={updateInterestedCount}
                />
              ))}
            </div>
          )}
        </section>

        <section className="how-section">
          <div className="container">
            <div className="section-heading centered">
              <div>
                <span className="section-kicker">HOW IT WORKS</span>
                <h2>One place for everyone</h2>
              </div>
            </div>

            <div className="steps">
              <Step
                number="01"
                title="Find a spot"
                text="Search by area, locality, address or use Nearby Me."
              />

              <Step
                number="02"
                title="Check details"
                text="See the address, date, timing, contact and exact map location."
              />

              <Step
                number="03"
                title="Show interest"
                text="Tap Interested to let organizers know you are interested in visiting."
              />
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container footer-inner">
          <div>
            <strong>Seva Bhojanam</strong>

            <span>
              Ganesh Annadanam Directory • Andhra Pradesh
            </span>
          </div>

          <span>🙏 అన్నదానం మహాదానం</span>
        </div>
      </footer>

      {showForm && (
        <AddSpotModal
          onClose={() => setShowForm(false)}
          onSubmit={addSpot}
        />
      )}

      {toast && (
        <div className="toast">
          <CheckCircle2 size={18} />

          {toast}
        </div>
      )}
    </div>
  );
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      className={`filter-btn ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Step({ number, title, text }) {
  return (
    <div className="step">
      <span>{number}</span>

      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

/* =====================================================
   SPOT CARD
===================================================== */

function SpotCard({ spot, onInterestedChange }) {
  const storageKey = `interested_${spot._id}`;

  const [interested, setInterested] = useState(
    () => localStorage.getItem(storageKey) === "1"
  );

  const [interestedCount, setInterestedCount] = useState(
    Number(spot.interestedCount) || 0
  );

  const [interestedLoading, setInterestedLoading] =
    useState(false);

  /*
    Keep local count synchronized with MongoDB data.
  */
  useEffect(() => {
    setInterestedCount(Number(spot.interestedCount) || 0);
  }, [spot.interestedCount]);

  async function handleInterested() {
    if (interested || interestedLoading) {
      return;
    }

    try {
      setInterestedLoading(true);

      const response = await fetch(
        `${API_URL}/api/spots/${spot._id}/interested`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to update Interested count."
        );
      }

      const newCount = Number(data.interestedCount) || 0;

      /*
        Update immediately on screen.
      */
      setInterestedCount(newCount);
      setInterested(true);

      /*
        Prevent same browser from clicking again.
      */
      localStorage.setItem(storageKey, "1");

      /*
        Update main spots state too.
      */
      onInterestedChange?.(spot._id, newCount);
    } catch (error) {
      console.error("Interested error:", error);

      alert(
        error.message ||
          "Unable to update Interested count. Please try again."
      );
    } finally {
      setInterestedLoading(false);
    }
  }

  const status = getStatus(spot);

  const statusText =
    status === "today"
      ? "TODAY"
      : status === "tomorrow"
        ? "TOMORROW"
        : "UPCOMING";

  /*
    View Maps is shown when:
    1. mapUrl exists
    OR
    2. latitude + longitude exist
  */
  const hasCoordinates =
    typeof spot.latitude === "number" &&
    typeof spot.longitude === "number";

  const mapLink = spot.mapUrl
    ? spot.mapUrl
    : hasCoordinates
      ? `https://www.google.com/maps?q=${spot.latitude},${spot.longitude}`
      : "";

  return (
    <article className="spot-card">
      <div className="card-top">
        <span className={`status ${status}`}>
          {statusText}
        </span>

        <span className="district">
          {spot.district}
        </span>
      </div>

      <h3>{spot.committeeName}</h3>

      <p className="organizer">
        Organized by {spot.organizerName}
      </p>

      <div className="detail-row">
        <MapPin size={18} />

        <div>
          <strong>{spot.area}</strong>

          {(spot.locality || spot.landmark) && (
            <span>
              {spot.locality}

              {spot.locality && spot.landmark ? " • " : ""}

              {spot.landmark}
            </span>
          )}

          {spot.address && (
            <span className="full-address">
              {spot.address}
            </span>
          )}
        </div>
      </div>

      <div className="detail-row">
        <CalendarDays size={18} />

        <div>
          <strong>{formatDate(spot.date)}</strong>

          <span>
            {spot.date === localDateString()
              ? "Today"
              : spot.date === localDateString(1)
                ? "Tomorrow"
                : "Scheduled date"}
          </span>
        </div>
      </div>

      <div className="detail-row">
        <Clock3 size={18} />

        <div>
          <strong>
            {spot.startTime} – {spot.endTime}
          </strong>

          <span>Annadanam timing</span>
        </div>
      </div>

      {spot.description && (
        <p className="description">
          {spot.description}
        </p>
      )}

      {/* INTERESTED SECTION */}

      <div className="interest-section">
        <button
          type="button"
          className={`interested-btn ${
            interested ? "interested-active" : ""
          }`}
          onClick={handleInterested}
          disabled={interested || interestedLoading}
        >
          <span className="heart-icon">
            {interested ? "♥" : "♡"}
          </span>

          <span>
            {interestedLoading
              ? "Updating..."
              : interested
                ? "Interested"
                : "I'm Interested"}
          </span>
        </button>

        <span className="interest-count">
          <strong>{interestedCount}</strong>{" "}
          {interestedCount === 1
            ? "person interested"
            : "people interested"}
        </span>
      </div>

      {/* ACTION BUTTONS */}

      <div className="card-actions">
        <a
          className="call-btn"
          href={`tel:${spot.contactNumber}`}
        >
          <Phone size={17} />
          Contact
        </a>

        {/* ONLY SHOW WHEN LOCATION EXISTS */}

        {mapLink && (
          <a
            className="map-btn"
            href={mapLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin size={17} />
            View in Maps
          </a>
        )}
      </div>
    </article>
  );
}

/* =====================================================
   ADD SPOT MODAL
===================================================== */

function AddSpotModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    committeeName: "",
    organizerName: "",
    area: "",
    locality: "",
    landmark: "",
    address: "",
    district: "",
    date: localDateString(),
    startTime: "11:00",
    endTime: "14:00",
    contactNumber: "",
    description: "",
    mapUrl: "",
    latitude: "",
    longitude: "",
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [gettingLocation, setGettingLocation] =
    useState(false);

  function update(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError(
        "Your browser does not support location services."
      );

      return;
    }

    setError("");
    setGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        const googleMapsUrl =
          `https://www.google.com/maps?q=${latitude},${longitude}`;

        setForm((current) => ({
          ...current,

          latitude: String(latitude),
          longitude: String(longitude),

          mapUrl: googleMapsUrl,
        }));

        setGettingLocation(false);
      },

      (locationError) => {
        console.error(locationError);

        setGettingLocation(false);

        if (locationError.code === 1) {
          setError(
            "Location permission was denied. Allow location access or paste a Google Maps link."
          );
        } else if (locationError.code === 2) {
          setError("Unable to determine your location.");
        } else if (locationError.code === 3) {
          setError(
            "Location request timed out. Please try again."
          );
        } else {
          setError("Unable to get your location.");
        }
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  async function submit(e) {
    e.preventDefault();

    setError("");

    const mobile = form.contactNumber.replace(/\s/g, "");

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError(
        "Please enter a valid 10-digit Indian mobile number."
      );

      return;
    }

    if (form.startTime >= form.endTime) {
      setError("End time must be after start time.");

      return;
    }

    /*
      Location is required.
      User can:
      - Use current location
      OR
      - Paste Google Maps URL
    */
    if (!form.mapUrl.trim()) {
      setError(
        "Please add the exact location using Current Location or a Google Maps link."
      );

      return;
    }

    try {
      setSaving(true);

      await onSubmit({
        ...form,

        contactNumber: mobile,

        latitude:
          form.latitude === ""
            ? undefined
            : Number(form.latitude),

        longitude:
          form.longitude === ""
            ? undefined
            : Number(form.longitude),
      });
    } catch (err) {
      setError(
        err.message ||
          "Unable to publish the Annadanam spot."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={onClose}
    >
      <div
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span className="section-kicker">
              PUBLIC SUBMISSION
            </span>

            <h2>Add Annadanam spot</h2>

            <p>
              Add the exact details of your Ganesh Chaturthi
              Annadanam.
            </p>
          </div>

          <button
            type="button"
            className="close-btn"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="form-grid">
            <Field label="Committee name *">
              <input
                required
                type="text"
                value={form.committeeName}
                onChange={(e) =>
                  update("committeeName", e.target.value)
                }
                placeholder="Sri Vinayaka Seva Committee"
              />
            </Field>

            <Field label="Organizer / main contact name *">
              <input
                required
                type="text"
                value={form.organizerName}
                onChange={(e) =>
                  update("organizerName", e.target.value)
                }
                placeholder="Ramesh Kumar"
              />
            </Field>

            <Field label="Area *">
              <input
                required
                type="text"
                value={form.area}
                onChange={(e) =>
                  update("area", e.target.value)
                }
                placeholder="Benz Circle"
              />
            </Field>

            <Field label="Locality / street *">
              <input
                required
                type="text"
                value={form.locality}
                onChange={(e) =>
                  update("locality", e.target.value)
                }
                placeholder="Near main temple"
              />
            </Field>

            <Field label="District *">
              <select
                required
                value={form.district}
                onChange={(e) =>
                  update("district", e.target.value)
                }
              >
                <option value="">Select district</option>

                {[
                  "Alluri Sitharama Raju",
                  "Anakapalli",
                  "Ananthapuramu",
                  "Annamayya",
                  "Bapatla",
                  "Chittoor",
                  "Dr. B. R. Ambedkar Konaseema",
                  "East Godavari",
                  "Eluru",
                  "Guntur",
                  "Kakinada",
                  "Krishna",
                  "Kurnool",
                  "Nandyal",
                  "NTR",
                  "Palnadu",
                  "Parvathipuram Manyam",
                  "Prakasam",
                  "Sri Potti Sriramulu Nellore",
                  "Sri Sathya Sai",
                  "Srikakulam",
                  "Tirupati",
                  "Visakhapatnam",
                  "Vizianagaram",
                  "West Godavari",
                  "YSR Kadapa",
                ].map((district) => (
                  <option
                    key={district}
                    value={district}
                  >
                    {district}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Landmark">
              <input
                type="text"
                value={form.landmark}
                onChange={(e) =>
                  update("landmark", e.target.value)
                }
                placeholder="Opposite temple / school..."
              />
            </Field>
          </div>

          <Field label="Full Annadanam address *">
            <textarea
              required
              rows="3"
              value={form.address}
              onChange={(e) =>
                update("address", e.target.value)
              }
              placeholder="Door no, street, area, city, Andhra Pradesh"
            />
          </Field>


          <div className="map-location-field">
            <div className="map-location-title">
              <MapPin size={20} />

              <div>
                <strong>Exact location *</strong>

                <span>
                  Add the exact Annadanam location so visitors can
                  open it in Maps.
                </span>
              </div>
            </div>

            <button
              type="button"
              className="location-button"
              onClick={useCurrentLocation}
              disabled={gettingLocation}
            >
              <LocateFixed size={18} />

              {gettingLocation
                ? "Getting exact location..."
                : "Use my current location"}
            </button>

            <div className="location-or">
              <span>OR</span>
            </div>

            <input
              type="url"
              value={form.mapUrl}
              onChange={(e) =>
                update("mapUrl", e.target.value)
              }
              placeholder="Paste Google Maps link here"
            />

            <small>
              Google Maps → select exact place → Share → Copy link
              → paste it here.
            </small>

            {form.mapUrl && (
              <div className="location-success">
                <CheckCircle2 size={16} />

                <span>
                  Location added. Visitors will see the View in Maps
                  button.
                </span>
              </div>
            )}
          </div>

          <div className="form-grid">
            <Field label="Date *">
              <input
                required
                type="date"
                value={form.date}
                min={localDateString()}
                onChange={(e) =>
                  update("date", e.target.value)
                }
              />
            </Field>

            <Field label="Start time *">
              <input
                required
                type="time"
                value={form.startTime}
                onChange={(e) =>
                  update("startTime", e.target.value)
                }
              />
            </Field>

            <Field label="End time *">
              <input
                required
                type="time"
                value={form.endTime}
                onChange={(e) =>
                  update("endTime", e.target.value)
                }
              />
            </Field>

            <Field label="Contact number *">
              <input
                required
                type="tel"
                inputMode="numeric"
                maxLength="10"
                value={form.contactNumber}
                onChange={(e) =>
                  update(
                    "contactNumber",
                    e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 10)
                  )
                }
                placeholder="9876543210"
              />
            </Field>
          </div>

          <Field label="Short description">
            <textarea
              rows="3"
              value={form.description}
              onChange={(e) =>
                update("description", e.target.value)
              }
              placeholder="Lunch Annadanam for devotees. Everyone is welcome."
            />
          </Field>

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              disabled={saving}
              className="primary-btn"
              type="submit"
            >
              {saving
                ? "Publishing..."
                : "Publish Annadanam spot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>

      {children}
    </label>
  );
}

export default App;