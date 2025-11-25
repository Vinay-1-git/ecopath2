/**
 * GREEN MOBILITY BACKEND
 * ------------------------------------------------
 * Core Functionality:
 * 1. User Authentication (In-Memory)
 * 2. Carpool Ride Matching (Geospatial Logic)
 * 3. API Endpoints for Frontend Consumption
 * 
 * Tech Stack: Node.js, Express, CORS, Body-Parser
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = 3000;

// --- MIDDLEWARE ---
// CORS enabled to allow the frontend (running on a different port/file) to communicate
app.use(cors());
// Parse incoming JSON payloads
app.use(bodyParser.json());

// --- IN-MEMORY DATA STRUCTURES ---
// These arrays replace the SQL/NoSQL database.
// WARNING: All data is lost when the server restarts.
const users =;
const rides =;

// --- HELPER FUNCTIONS ---

/**
 * Haversine Distance Calculation
 * Determines the great-circle distance between two points on a sphere.
 * Used for filtering carpool matches within a specific radius.
 * Ref: [15, 17]
 */
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

// --- AUTHENTICATION ENDPOINTS ---

/**
 * POST /api/signup
 * Registers a new user in the in-memory array.
 * Validates email uniqueness.
 */
app.post('/api/signup', (req, res) => {
    const { email, password, name } = req.body;
    
    // Input Validation
    if (!email ||!password ||!name) {
        return res.status(400).json({ error: "All fields (name, email, password) are required." });
    }

    // Check for duplicate user
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
        return res.status(409).json({ error: "User already exists with this email." });
    }

    // Create User Object
    // Note: In production, use bcrypt to hash the password before storage [22]
    const newUser = { 
        id: Date.now().toString(), // Simple unique ID generation
        email, 
        password, // Plaintext storage for prototype only
        name 
    };
    
    users.push(newUser);
    
    console.log(` New User Registered: ${email}`);
    res.status(201).json({ message: "Registration successful", user: { id: newUser.id, name: newUser.name } });
});

/**
 * POST /api/login
 * Validates credentials and returns a session identifier.
 */
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    // Find user by email and password
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) {
        return res.status(401).json({ error: "Invalid email or password." });
    }

    console.log(` User Logged In: ${email}`);
    // Return the user ID as a simple "token"
    res.json({ 
        message: "Login successful", 
        token: user.id, 
        name: user.name 
    });
});

// --- CARPOOLING ENDPOINTS ---

/**
 * POST /api/rides
 * Allows a user to publish a ride offer or request.
 */
app.post('/api/rides', (req, res) => {
    const { token, lat, lng, transportMode, passengers, destination } = req.body;
    
    // Basic validation
    if (!token ||!lat ||!lng) {
        return res.status(400).json({ error: "Missing ride details (location or user token)." });
    }

    const rideRequest = {
        rideId: Date.now().toString(),
        userId: token,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        destination, // Text description or coordinates
        transportMode, // 'DRIVER' or 'RIDER'
        passengers: parseInt(passengers),
        timestamp: new Date()
    };

    rides.push(rideRequest);
    console.log(` New Request: ${transportMode} at [${lat}, ${lng}]`);
    res.status(201).json({ message: "Ride request published successfully", rideId: rideRequest.rideId });
});

/**
 * GET /api/rides/search
 * Implements the geospatial matching logic.
 * Returns rides within a 10km radius of the requester.
 */
app.get('/api/rides/search', (req, res) => {
    const { lat, lng, userId } = req.query;

    if (!lat ||!lng) {
        return res.status(400).json({ error: "Latitude and Longitude required for search." });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const SEARCH_RADIUS_KM = 10.0; // Configurable matching radius

    // Filter Logic:
    // 1. Exclude the user's own rides.
    // 2. Check Haversine distance.
    const matches = rides.filter(ride => {
        if (userId && ride.userId === userId) return false; // Don't match self

        const distance = getDistanceFromLatLonInKm(userLat, userLng, ride.lat, ride.lng);
        return distance <= SEARCH_RADIUS_KM;
    });

    // Format response to include calculated distance
    const responseMatches = matches.map(m => ({
        transportMode: m.transportMode,
        destination: m.destination,
        passengers: m.passengers,
        distanceKm: getDistanceFromLatLonInKm(userLat, userLng, m.lat, m.lng).toFixed(2)
    }));

    res.json({ matches: responseMatches });
});

// --- SERVER START ---
app.listen(PORT, () => {
    console.log(`Green Mobility Backend Server running on port ${PORT}`);
    console.log(`Access at: http://localhost:${PORT}`);
});
