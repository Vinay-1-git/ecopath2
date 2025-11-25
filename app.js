/**
 * GREENPATH CLIENT LOGIC
 * ------------------------------------------------
 * 1. State Management (Current User, Map State)
 * 2. Google Maps Interaction (Rendering, Routing, Styling)
 * 3. Eco-Calculations (CO2, AQI)
 * 4. Backend API Integration (Auth, Carpool)
 */

const API_BASE = "http://localhost:3000/api";

// --- GLOBAL STATE ---
const appState = {
    token: null,
    user: null,
    originPlace: null,
    destinationPlace: null,
    transportMode: 'DRIVING',
    routeDistanceKm: 0
};

// --- MAP OBJECTS ---
let map;
let directionsService;
let directionsRenderer;
let airQualityOverlay;

// --- INITIALIZATION ---
// Callback for Google Maps Script
function initApp() {
    console.log(" Google Maps API Ready");
    initMap();
    setupEventListeners();
}

function initMap() {
    // 1. VISUAL STYLING FOR "GREEN PATH" [8]
    // We modify the map style to emphasize nature (landscape.natural, poi.park)
    // and de-emphasize urban clutter.
    const natureStyle = },
        { "featureType": "poi.park", "stylers": [{ "color": "#6aa84f" }, { "visibility": "simplified" }] },
        { "featureType": "road.highway", "stylers": [{ "color": "#ffffff" }] },
        { "featureType": "water", "stylers": [{ "color": "#cfe2f3" }] },
        { "featureType": "administrative", "elementType": "labels", "stylers": [{ "visibility": "off" }] } // Clean look
    ];

    map = new google.maps.Map(document.getElementById('map-canvas'), {
        center: { lat: 37.7749, lng: -122.4194 }, // Default: San Francisco
        zoom: 13,
        styles: natureStyle,
        mapTypeControl: false,
        streetViewControl: false
    });

    // 2. ROUTING SERVICES
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        polylineOptions: {
            strokeColor: "#27ae60", // Green line for the path
            strokeWeight: 6,
            strokeOpacity: 0.8
        },
        suppressMarkers: false
    });

    // 3. AUTOCOMPLETE SETUP
    setupAutocomplete('origin-input', 'originPlace');
    setupAutocomplete('destination-input', 'destinationPlace');
    setupAutocomplete('cp-location-search', null); // For carpool modal
}

function setupAutocomplete(elementId, stateKey) {
    const input = document.getElementById(elementId);
    const autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.bindTo('bounds', map);

    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry) {
            alert("No details available for input: '" + place.name + "'");
            return;
        }

        if (stateKey) {
            appState[stateKey] = place.geometry.location;
            
            // Center map on selection
            if (place.geometry.viewport) {
                map.fitBounds(place.geometry.viewport);
            } else {
                map.setCenter(place.geometry.location);
                map.setZoom(15);
            }
        }
    });
}

// --- CORE FEATURE: ROUTING & ECOLOGY ---

function handleRouteRequest() {
    if (!appState.originPlace ||!appState.destinationPlace) {
        alert("Please select both a valid origin and destination from the suggestions.");
        return;
    }

    const mode = document.getElementById('transport-mode').value;
    appState.transportMode = mode;

    const request = {
        origin: appState.originPlace,
        destination: appState.destinationPlace,
        travelMode: google.maps.TravelMode[mode],
        provideRouteAlternatives: true, // Needed to compare routes
        // OPTIMIZATION: Requesting traffic-aware optimal routes (Eco-bias) 
        drivingOptions: {
            departureTime: new Date(),
            trafficModel: 'bestguess'
        }
    };

    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
            
            // Extract Data from the primary route
            const routeLeg = result.routes.legs;
            appState.routeDistanceKm = routeLeg.distance.value / 1000;
            
            // Update UI Stats
            document.getElementById('metric-distance').innerText = `${appState.routeDistanceKm.toFixed(1)} km`;
            
            calculateCarbonFootprint();
            fetchAirQualityData(routeLeg.end_location); // Check AQI at destination
            
        } else {
            console.error('Directions request failed due to ' + status);
            alert('Could not calculate route. Please try different locations.');
        }
    });
}

/**
 * Calculates CO2 Emissions based on mode and distance.
 * Factors derived from ISO 14083 / UK Gov Standards 
 */
function calculateCarbonFootprint() {
    const dist = appState.routeDistanceKm;
    const mode = appState.transportMode;
    let factor = 0; // kg CO2 per km

    // Factors
    const FACTOR_CAR_GAS = 0.192;
    const FACTOR_BUS = 0.05; // Per passenger
    const FACTOR_BIKE_WALK = 0.0;

    switch (mode) {
        case 'DRIVING': factor = FACTOR_CAR_GAS; break;
        case 'TRANSIT': factor = FACTOR_BUS; break;
        case 'BICYCLING': 
        case 'WALKING': factor = FACTOR_BIKE_WALK; break;
    }

    const totalEmissions = (dist * factor).toFixed(2);
    const co2Element = document.getElementById('metric-co2');
    
    co2Element.innerText = `${totalEmissions} kg`;
    
    // Update Comparison Text
    const comparisonEl = document.getElementById('co2-comparison');
    if (mode === 'DRIVING') {
        // Calculate savings if they HAD taken the bus
        const busEmissions = dist * FACTOR_BUS;
        const saving = ((totalEmissions - busEmissions) / totalEmissions * 100).toFixed(0);
        comparisonEl.innerText = `Could save ${saving}% by Bus`;
        co2Element.classList.remove('good');
        co2Element.classList.add('bad');
    } else {
        comparisonEl.innerText = "Excellent Choice!";
        co2Element.classList.remove('bad');
        co2Element.classList.add('good');
    }
}

/**
 * Mocks an Air Quality API call.
 * In a real production app, this would use:
 * https://airquality.googleapis.com/v1/currentConditions:lookup
 */
function fetchAirQualityData(latLng) {
    // Simulating AQI response for prototype
    // Random AQI between 20 (Good) and 160 (Unhealthy)
    const mockAQI = Math.floor(Math.random() * 140) + 20;
    
    const aqiEl = document.getElementById('metric-aqi');
    aqiEl.innerText = mockAQI;
    
    // Visual Cues
    aqiEl.classList.remove('good', 'bad');
    if (mockAQI < 50) {
        aqiEl.innerText += " (Good)";
        aqiEl.classList.add('good');
    } else if (mockAQI > 100) {
        aqiEl.innerText += " (Unhealthy)";
        aqiEl.classList.add('bad');
    } else {
        aqiEl.innerText += " (Moderate)";
    }
}

// --- CARPOOLING & NOTIFICATIONS ---

async function publishRideRequest() {
    if (!appState.token) {
        alert("You must be logged in to use Carpooling.");
        return;
    }
    
    if (!appState.originPlace) {
        alert("Please set a location on the dashboard first.");
        return;
    }

    const mode = document.getElementById('cp-role').value;
    const seats = document.getElementById('cp-seats').value;
    const lat = appState.originPlace.lat();
    const lng = appState.originPlace.lng();

    try {
        const response = await fetch(`${API_BASE}/rides`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: appState.token,
                lat, lng,
                transportMode: mode,
                passengers: seats,
                destination: document.getElementById('destination-input').value
            })
        });

        if (response.ok) {
            alert("Ride Request Published!");
            findMatches(); // Auto-search
            handleNotificationSetup(); // Check for reminder
        }
    } catch (e) {
        console.error("Ride Publish Error", e);
    }
}

async function findMatches() {
    if (!appState.originPlace) return;
    const lat = appState.originPlace.lat();
    const lng = appState.originPlace.lng();

    const response = await fetch(`${API_BASE}/rides/search?lat=${lat}&lng=${lng}&userId=${appState.token}`);
    const data = await response.json();

    const list = document.getElementById('matches-list');
    list.innerHTML = ""; // Clear existing

    if (data.matches.length === 0) {
        list.innerHTML = '<li class="empty-msg">No matches nearby.</li>';
        return;
    }

    data.matches.forEach(m => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>${m.transportMode}</strong> (${m.passengers} pax) <br>
            Distance: ${m.distanceKm} km away <br>
            <small>Dest: ${m.destination |

| 'Unspecified'}</small>
        `;
        list.appendChild(li);
    });
}

// Notification Logic [23, 24]
function handleNotificationSetup() {
    const enabled = document.getElementById('notification-toggle').checked;
    if (enabled && "Notification" in window) {
        if (Notification.permission === "granted") {
            scheduleReminder();
        } else if (Notification.permission!== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") scheduleReminder();
            });
        }
    }
}

function scheduleReminder() {
    // Set a timeout to simulate a 15-minute warning
    // For demo purposes, we set this to 5 seconds
    setTimeout(() => {
        new Notification("GreenPath Alert", {
            body: "Your carpool pickup is approaching in 15 minutes!",
            icon: "https://maps.google.com/mapfiles/kml/shapes/cabs.png"
        });
    }, 5000);
}

// --- AUTH HANDLERS & EVENT LISTENERS ---

function setupEventListeners() {
    // Auth UI Toggles
    document.getElementById('tab-login').addEventListener('click', (e) => toggleAuthView(e, 'login'));
    document.getElementById('tab-signup').addEventListener('click', (e) => toggleAuthView(e, 'signup'));

    // Auth Actions
    document.getElementById('login-form').addEventListener('submit', performLogin);
    document.getElementById('signup-form').addEventListener('submit', performSignup);
    document.getElementById('logout-btn').addEventListener('click', performLogout);

    // Dashboard Actions
    document.getElementById('find-route-btn').addEventListener('click', handleRouteRequest);

    // Carpool Modal
    const modal = document.getElementById('carpool-modal');
    document.getElementById('open-carpool-hub').addEventListener('click', () => modal.classList.remove('hidden'));
    document.querySelector('.close-modal').addEventListener('click', () => modal.classList.add('hidden'));
    
    document.getElementById('cp-publish-btn').addEventListener('click', publishRideRequest);
    document.getElementById('refresh-matches-btn').addEventListener('click', findMatches);
}

async function performLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email, password})
        });
        const data = await res.json();
        
        if (res.ok) {
            appState.token = data.token;
            appState.user = data;
            document.getElementById('user-name-display').innerText = data.name;
            switchSection('dashboard-section');
        } else {
            document.getElementById('auth-feedback').innerText = data.error;
        }
    } catch (err) { console.error(err); }
}

async function performSignup(e) {
    e.preventDefault();
    // Implementation mirrors login but hits /signup endpoint...
    // (Omitted for brevity, follows same pattern)
    alert("Signup Simulation: Success. Please Log In.");
    toggleAuthView({target: document.getElementById('tab-login')}, 'login');
}

function performLogout() {
    appState.token = null;
    switchSection('welcome-section');
}

function toggleAuthView(event, type) {
    document.querySelectorAll('.auth-tabs button').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    
    if (type === 'login') {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('signup-form').classList.add('hidden');
    } else {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('signup-form').classList.remove('hidden');
    }
}

function switchSection(sectionId) {
    document.getElementById('welcome-section').classList.remove('active-section', 'hidden');
    document.getElementById('welcome-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
    
    const target = document.getElementById(sectionId);
    target.classList.remove('hidden');
    if (sectionId === 'welcome-section') target.classList.add('active-section');
    
    // Resize map trigger
    if (sectionId === 'dashboard-section' && map) {
        google.maps.event.trigger(map, "resize");
    }
}
