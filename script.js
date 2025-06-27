// JavaScript Document

const LEAGUE_ID = '1229429982934077440'; // Your league ID
const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';

async function fetchLeagueDetails() {
    try {
        const response = await fetch(`${SLEEPER_API_BASE}/league/${LEAGUE_ID}`);
        const league = await response.json();
        document.getElementById('league-name').textContent = league.name;
        
        // Display additional league details
        document.getElementById('league-season').textContent = league.season;
        document.getElementById('league-num-teams').textContent = league.settings.num_teams;

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

async function fetchDraftDetails(draftId) {
    if (!draftId) {
        console.warn('No draft ID provided. Cannot fetch draft details.');
        return null;
    }
    try {
        const response = await fetch(`${SLEEPER_API_BASE}/draft/${draftId}`);
        const draft = await response.json();
        return draft;
    } catch (error) {
        console.error('Error fetching draft details:', error);
        return null;
    }
}

async function displayLeagueInfo() {
    const league = await fetchLeagueDetails();
    const rosters = await fetchRosters();
    const users = await fetchUsers();

    let draft = null;
    if (league && league.draft_id) {
        draft = await fetchDraftDetails(league.draft_id);
    }

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
                teamsContainer.appendChild(teamCard);
            }
        });

        // Display Draft Details
        const draftStatusSpan = document.getElementById('draft-status');
        const draftTypeSpan = document.getElementById('draft-type');
        const draftOrderList = document.getElementById('draft-order-list');

        if (draft) {
            draftStatusSpan.textContent = draft.status;
            draftTypeSpan.textContent = draft.type;
            draftOrderList.innerHTML = ''; // Clear loading text

            if (draft.draft_order) {
                // Map draft_order (user_id -> pick_number) to display_name
                Object.keys(draft.draft_order).sort((a,b) => draft.draft_order[a] - draft.draft_order[b]).forEach(userId => {
                    const user = users.find(u => u.user_id === userId);
                    const pickNumber = draft.draft_order[userId];
                    const listItem = document.createElement('li');
                    listItem.textContent = `Pick ${pickNumber}: ${user ? user.display_name : 'Unknown User'}`;
                    draftOrderList.appendChild(listItem);
                });
            } else {
                draftOrderList.innerHTML = '<li>Draft order not yet available or configured.</li>';
            }
        } else {
            draftStatusSpan.textContent = 'N/A';
            draftTypeSpan.textContent = 'N/A';
            draftOrderList.innerHTML = '<li>Draft details could not be loaded.</li>';
        }

    } else {
        document.getElementById('teams-container').innerHTML = '<p>Could not load league data. Please check the league ID or try again later.</p>';
        document.getElementById('draft-status').textContent = 'Failed to load';
        document.getElementById('draft-type').textContent = 'Failed to load';
        document.getElementById('draft-order-list').innerHTML = '<li>Failed to load draft order.</li>';
    }
}

// Run the function when the page loads
document.addEventListener('DOMContentLoaded', displayLeagueInfo);