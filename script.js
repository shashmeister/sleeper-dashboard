// JavaScript Document

const LEAGUE_ID = '1229429984066555904'; // Your league ID
const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';

async function fetchLeagueDetails() {
    try {
        const response = await fetch(`${SLEEPER_API_BASE}/league/${LEAGUE_ID}`);
        const league = await response.json();
        document.getElementById('league-name').textContent = league.name;
        return league;
    } catch (error) {
        console.error('Error fetching league details:', error);
        document.getElementById('league-name').textContent = 'Failed to load league name';
        return null;
    }
}

async function fetchRosters() {
    try {
        const response = await fetch(`${SLEEPER_API_BASE}/league/${LEAGUE_ID}/rosters`);
        const rosters = await response.json();
        return rosters;
    } catch (error) {
        console.error('Error fetching rosters:', error);
        return [];
    }
}

async function fetchUsers() {
    try {
        const response = await fetch(`${SLEEPER_API_BASE}/league/${LEAGUE_ID}/users`);
        const users = await response.json();
        return users;
    } catch (error) {
        console.error('Error fetching users:', error);
        return [];
    }
}

async function displayLeagueInfo() {
    const league = await fetchLeagueDetails();
    const rosters = await fetchRosters();
    const users = await fetchUsers();

    if (league && rosters.length > 0 && users.length > 0) {
        const teamsContainer = document.getElementById('teams-container');
        teamsContainer.innerHTML = ''; // Clear loading text

        rosters.forEach(roster => {
            const user = users.find(u => u.user_id === roster.owner_id);
            if (user) {
                const teamName = user.display_name || 'Unnamed Team';
                const teamCard = document.createElement('div');
                teamCard.classList.add('team-card');
                teamCard.innerHTML = `<h3>${teamName}</h3>`;
                // You can add more roster details here later, e.g., total points
                teamsContainer.appendChild(teamCard);
            }
        });
    } else {
        document.getElementById('teams-container').innerHTML = '<p>Could not load league data. Please check the league ID or try again later.</p>';
    }
}

// Run the function when the page loads
document.addEventListener('DOMContentLoaded', displayLeagueInfo);