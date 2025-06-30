let cachedPlayers = null;
let lastFetchTimestamp = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow requests from any origin
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const now = Date.now();

    if (cachedPlayers && (now - lastFetchTimestamp < CACHE_DURATION)) {
        // Serve from cache
        console.log('Serving players data from cache.');
        return res.status(200).json(cachedPlayers);
    }

    // Fetch new data
    try {
        console.log('Fetching fresh players data from Sleeper API...');
        const response = await fetch('https://api.sleeper.app/v1/players/nfl');
        if (!response.ok) {
            throw new Error(`Sleeper API responded with status: ${response.status}`);
        }
        const players = await response.json();

        // Update cache
        cachedPlayers = players;
        lastFetchTimestamp = now;
        console.log('Players data fetched and cached successfully.');

        res.status(200).json(players);
    } catch (error) {
        console.error('Error fetching players data:', error);
        res.status(500).json({ error: 'Failed to fetch player data', details: error.message });
    }
} 