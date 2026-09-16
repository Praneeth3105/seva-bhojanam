import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Compass,
  MapPin,
  Phone,
  Plus,
  Search,
  Utensils,
  X
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const pad = (n) => String(n).padStart(2, "0");

function localDateString(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(dateString) {
  const d = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(d);
}

function getStatus(spot) {
  const today = localDateString();
  const tomorrow = localDateString(1);

  if (spot.date < today) return "expired";
  if (spot.date === today) {
    const now = new Date();
    const current = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (current >= spot.endTime) return "expired";
    return "today";
  }
  if (spot.date === tomorrow) return "tomorrow";
  return "upcoming";
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
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
      if (!response.ok) throw new Error(data.message || "Failed");
      setSpots(data);
    } catch (error) {
      setToast("Could not load spots. Please check the backend.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSpots();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const counts = useMemo(() => {
    return {
      today: spots.filter((s) => getStatus(s) === "today").length,
      tomorrow: spots.filter((s) => getStatus(s) === "tomorrow").length,
      upcoming: spots.filter((s) => getStatus(s) === "upcoming").length
    };
  }, [spots]);

  const visibleSpots = useMemo(() => {
    const q = query.toLowerCase().trim();

    let result = spots.filter((spot) => {
      const matchesText =
        !q ||
        [spot.committeeName, spot.organizerName, spot.area, spot.locality, spot.landmark, spot.district]
          .join(" ")
          .toLowerCase()
          .includes(q);

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
        .map((spot) => ({
          ...spot,
          distance:
            typeof spot.latitude === "number" && typeof spot.longitude === "number"
              ? distanceKm(userLocation.lat, userLocation.lng, spot.latitude, spot.longitude)
              : Infinity
        }))
        .sort((a, b) => a.distance - b.distance);
    }

    return result;
  }, [spots, query, activeFilter, nearby, userLocation]);

  function findNearby() {
    if (!navigator.geolocation) {
      setToast("Your browser does not support location.");
      return;
    }

    setNearby(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setToast("Showing spots closest to your location.");
      },
      () => {
        setNearby(false);
        setToast("Location permission was not allowed. You can still search by area.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function addSpot(formData) {
    try {
      const response = await fetch(`${API_URL}/api/spots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not add spot.");

      setSpots((current) => [data, ...current]);
      setShowForm(false);
      setToast("Annadanam spot added successfully.");
      setActiveFilter("all");
    } catch (error) {
      throw error;
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="container nav-inner">
          <a className="brand" href="#">
            <span className="brand-icon">ॐ</span>
            <span>
              <strong>Seva Bhojanam</strong>
              <small>Ganesh Annadanam</small>
            </span>
          </a>

          <button className="add-top-btn" onClick={() => setShowForm(true)}>
            <Plus size={18} />
            Add Annadanam
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">🙏 Seva • Bhojanam • Vinayaka Seva</div>
              <h1>Find Annadanam<br /><em>near you.</em></h1>
              <p>
                A simple public directory to discover Ganesh Chaturthi Annadanam
                spots across Andhra Pradesh.
              </p>

              <div className="search-box">
                <Search size={20} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search area, locality, landmark or district..."
                />
                <button onClick={findNearby}>
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

        <section className="container quick-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">LIVE DIRECTORY</span>
              <h2>Today's Annadanam spots</h2>
            </div>
            <button className="outline-btn" onClick={() => setShowForm(true)}>
              Add a spot <ArrowRight size={16} />
            </button>
          </div>

          <div className="filters">
            <FilterButton active={activeFilter === "all"} onClick={() => setActiveFilter("all")}>
              All spots
            </FilterButton>
            <FilterButton active={activeFilter === "today"} onClick={() => setActiveFilter("today")}>
              Today <b>{counts.today}</b>
            </FilterButton>
            <FilterButton active={activeFilter === "tomorrow"} onClick={() => setActiveFilter("tomorrow")}>
              Tomorrow <b>{counts.tomorrow}</b>
            </FilterButton>
            <FilterButton active={activeFilter === "upcoming"} onClick={() => setActiveFilter("upcoming")}>
              Upcoming <b>{counts.upcoming}</b>
            </FilterButton>
          </div>

          {nearby && (
            <div className="nearby-banner">
              <Compass size={17} />
              Nearby mode is on. Spots with location coordinates are sorted by distance.
              <button onClick={() => { setNearby(false); setUserLocation(null); }}>Clear</button>
            </div>
          )}

          {loading ? (
            <div className="empty-state">Loading Annadanam spots...</div>
          ) : visibleSpots.length === 0 ? (
            <div className="empty-state">
              <Utensils size={30} />
              <h3>No spots found</h3>
              <p>Try another area or add the first Annadanam spot.</p>
              <button className="primary-btn" onClick={() => setShowForm(true)}>Add Annadanam spot</button>
            </div>
          ) : (
            <div className="spot-grid">
              {visibleSpots.map((spot) => (
                <SpotCard key={spot._id} spot={spot} />
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
              <Step number="01" title="Find a spot" text="Search by area, locality, landmark or use Nearby Me." />
              <Step number="02" title="Check timing" text="See the date, Annadanam timing and contact number." />
              <Step number="03" title="Share a spot" text="Organizers can add their public Annadanam details without login." />
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container footer-inner">
          <div>
            <strong>Seva Bhojanam</strong>
            <span>Ganesh Annadanam Directory • Andhra Pradesh</span>
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

      {toast && <div className="toast"><CheckCircle2 size={18} /> {toast}</div>}
    </div>
  );
}

function FilterButton({ active, onClick, children }) {
  return (
    <button className={`filter-btn ${active ? "active" : ""}`} onClick={onClick}>
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

function SpotCard({ spot }) {
  const status = getStatus(spot);
  const statusText = status === "today" ? "TODAY" : status === "tomorrow" ? "TOMORROW" : "UPCOMING";

  return (
    <article className="spot-card">
      <div className="card-top">
        <span className={`status ${status}`}>{statusText}</span>
        <span className="district">{spot.district}</span>
      </div>

      <h3>{spot.committeeName}</h3>
      <p className="organizer">Organized by {spot.organizerName}</p>

      <div className="detail-row">
        <MapPin size={17} />
        <div>
          <strong>{spot.area}</strong>
          <span>{spot.locality}{spot.landmark ? ` • ${spot.landmark}` : ""}</span>
          {spot.address && <span>{spot.address}</span>}
        </div>
      </div>

      <div className="detail-row">
        <CalendarDays size={17} />
        <div>
          <strong>{formatDate(spot.date)}</strong>
          <span>{spot.date === localDateString() ? "Today" : spot.date === localDateString(1) ? "Tomorrow" : "Scheduled date"}</span>
        </div>
      </div>

      <div className="detail-row">
        <Clock3 size={17} />
        <div>
          <strong>{spot.startTime} – {spot.endTime}</strong>
          <span>Annadanam timing</span>
        </div>
      </div>

      {spot.description && <p className="description">{spot.description}</p>}

      <a className="call-btn" href={`tel:${spot.contactNumber}`}>
        <Phone size={17} />
        Contact {spot.contactNumber}
      </a>
    </article>
  );
}

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
    latitude: "",
    longitude: ""
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (!/^[6-9]\d{9}$/.test(form.contactNumber.replace(/\s/g, ""))) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (form.startTime >= form.endTime) {
      setError("End time must be after start time.");
      return;
    }

    try {
      setSaving(true);
      await onSubmit({ ...form, contactNumber: form.contactNumber.replace(/\s/g, "") });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="section-kicker">PUBLIC SUBMISSION</span>
            <h2>Add Annadanam spot</h2>
            <p>Anyone can add a public Ganesh Chaturthi Annadanam location.</p>
          </div>
          <button className="close-btn" onClick={onClose}><X /></button>
        </div>

        <form onSubmit={submit}>
          <div className="form-grid">
            <Field label="Committee name *">
              <input required value={form.committeeName} onChange={(e) => update("committeeName", e.target.value)} placeholder="Sri Vinayaka Committee" />
            </Field>
            <Field label="Organizer / main contact name *">
              <input required value={form.organizerName} onChange={(e) => update("organizerName", e.target.value)} placeholder="Ramesh Kumar" />
            </Field>
            <Field label="Area *">
              <input required value={form.area} onChange={(e) => update("area", e.target.value)} placeholder="Benz Circle" />
            </Field>
            <Field label="Locality / street *">
              <input required value={form.locality} onChange={(e) => update("locality", e.target.value)} placeholder="Near main temple" />
            </Field>
            <Field label="District *">
              <select required value={form.district} onChange={(e) => update("district", e.target.value)}>
                <option value="">Select district</option>
                {[
                  "Alluri Sitharama Raju","Anakapalli","Ananthapuramu","Annamayya","Bapatla","Chittoor",
                  "Dr. B. R. Ambedkar Konaseema","East Godavari","Eluru","Guntur","Kakinada","Krishna",
                  "Kurnool","Nandyal","NTR","Palnadu","Parvathipuram Manyam","Prakasam","Sri Potti Sriramulu Nellore",
                  "Sri Sathya Sai","Srikakulam","Tirupati","Visakhapatnam","Vizianagaram","West Godavari","YSR Kadapa"
                ].map((d) => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Landmark">
              <input value={form.landmark} onChange={(e) => update("landmark", e.target.value)} placeholder="Opposite temple / school..." />
            </Field>
            <Field label="Full Annadanam address *">
              <input required value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Door no, street, area, city, Andhra Pradesh" />
            </Field>
            <Field label="Date *">
              <input required type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
            </Field>
            <Field label="Start time *">
              <input required type="time" value={form.startTime} onChange={(e) => update("startTime", e.target.value)} />
            </Field>
            <Field label="End time *">
              <input required type="time" value={form.endTime} onChange={(e) => update("endTime", e.target.value)} />
            </Field>
            <Field label="Contact number *">
              <input required inputMode="numeric" maxLength="10" value={form.contactNumber} onChange={(e) => update("contactNumber", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="9876543210" />
            </Field>
          </div>

          <Field label="Short description">
            <textarea rows="3" value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Example: Lunch Annadanam for devotees. Everyone is welcome." />
          </Field>

          <div className="location-box">
            <div>
              <strong>📍 Location is address-based</strong>
              <p>You only enter the Annadanam address. The website automatically finds the map coordinates in the background for Nearby Me.</p>
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
            <button disabled={saving} className="primary-btn" type="submit">
              {saving ? "Adding..." : "Publish Annadanam spot"}
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
