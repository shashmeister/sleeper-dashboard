// get-players.js

// This is a Vercel Serverless Function that fetches player data from the Sleeper API.
// It includes caching headers to ensure the data is fetched only once per day,
// adhering to Sleeper's API guidelines and improving performance.

export default async function handler(request, response) {
    try {
      const apiResponse = await fetch('https://api.sleeper.app/v1/players/nfl');
      
      // If the request to the Sleeper API fails, pass the error status to the client.
      if (!apiResponse.ok) {
        return response.status(apiResponse.status).json({ message: 'Failed to fetch data from Sleeper API' });
      }
  
      const data = await apiResponse.json();
  
      // Set caching headers for Vercel's Edge Network and the browser.
      // s-maxage=86400: Caches on the Vercel edge for 24 hours (86400 seconds).
      // stale-while-revalidate: Allows a stale response to be served while a fresh one is fetched in the background.
      response.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate');
  
      // Send the player data as a JSON response.
      return response.status(200).json(data);
    } catch (error) {
      console.error('Error in get-players serverless function:', error);
      return response.status(500).json({ message: 'Internal Server Error' });
    }
  }