import json
import requests
import time

# Cache variable to store player data and timestamp
player_data_cache = {
    "data": None,
    "timestamp": 0
}

# Define how long the data should be considered valid (e.g., 24 hours in seconds)
CACHE_DURATION = 24 * 60 * 60 # 24 hours

def handler(request):
    global player_data_cache

    current_time = time.time()

    # Check if cache is valid and not expired
    if player_data_cache["data"] and (current_time - player_data_cache["timestamp"]) < CACHE_DURATION:
        # Serve from cache
        response_data = player_data_cache["data"]
        print("Serving player data from cache.")
    else:
        # Fetch new data from Sleeper API
        try:
            sleeper_api_url = "https://api.sleeper.app/v1/players/nfl"
            response = requests.get(sleeper_api_url)
            response.raise_for_status() # Raise an exception for bad status codes
            player_data = response.json()

            # Update cache
            player_data_cache["data"] = player_data
            player_data_cache["timestamp"] = current_time
            response_data = player_data
            print("Fetched new player data and updated cache.")

        except requests.exceptions.RequestException as e:
            print(f"Error fetching player data from Sleeper: {e}")
            # If fetching fails, try to return old cached data if available
            if player_data_cache["data"]:
                response_data = player_data_cache["data"]
                print("Error fetching new data, serving stale cache.")
            else:
                return {
                    "statusCode": 500,
                    "headers": { "Content-Type": "application/json" },
                    "body": json.dumps({ "error": "Failed to fetch player data and no cache available." })
                }
    
    # Set Cache-Control header for Vercel's Edge Network and client browsers
    # max-age is for client caching, s-maxage is for CDN caching (Vercel)
    # Stale-while-revalidate allows serving stale content while revalidating in background
    cache_control_header = f"public, max-age={CACHE_DURATION}, s-maxage={CACHE_DURATION}, stale-while-revalidate={CACHE_DURATION * 2}"

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Cache-Control": cache_control_header
        },
        "body": json.dumps(response_data)
    } 