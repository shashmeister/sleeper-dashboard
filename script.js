// JavaScript Document

const LEAGUE_ID = '1229429982934077440'; // Your league ID
const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';

async function fetchAllPlayers() {
    try {
        // Fetch all NFL players. This dataset is large but necessary to map player IDs to names.
        const response = await fetch(`${SLEEPER_API_BASE}/players/nfl`);
        const players = await response.json();
        return players;
    } catch (error) {
        console.error('Error fetching all players:', error);
        return {};
    }
}

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

async function fetchDraftPicks(draftId) {
    if (!draftId) {
        console.warn('No draft ID provided. Cannot fetch draft picks.');
        return [];
    }
    try {
        const response = await fetch(`${SLEEPER_API_BASE}/draft/${draftId}/picks`);
        const picks = await response.json();
        return picks;
    } catch (error) {
        console.error('Error fetching draft picks:', error);
        return [];
    }
}

async function displayLeagueInfo() {
    const league = await fetchLeagueDetails();
    const rosters = await fetchRosters();
    const users = await fetchUsers();
    const allPlayers = await fetchAllPlayers(); // Fetch all players here

    let draft = null;
    let draftPicks = [];
    if (league && league.draft_id) {
        draft = await fetchDraftDetails(league.draft_id);
        draftPicks = await fetchDraftPicks(league.draft_id);
    }

    if (league && rosters.length > 0 && users.length > 0) {
        const teamsContainer = document.getElementById('teams-container');
        teamsContainer.innerHTML = ''; // Clear loading text

        // Create a map to easily look up users by user_id
        const usersMap = new Map(users.map(user => [user.user_id, user]));

        // Process draft picks to get drafted players for each team
        const teamDraftedPlayers = new Map(); // Map: roster_id -> [player objects]
        if (draftPicks.length > 0) {
            draftPicks.forEach(pick => {
                const player = allPlayers[pick.player_id];
                if (player) {
                    if (!teamDraftedPlayers.has(pick.roster_id)) {
                        teamDraftedPlayers.set(pick.roster_id, []);
                    }
                    teamDraftedPlayers.get(pick.roster_id).push(player);
                }
            });
        }

        rosters.forEach(roster => {
            const user = usersMap.get(roster.owner_id);
            if (user) {
                const teamName = user.display_name || 'Unnamed Team';
                const teamCard = document.createElement('div');
                teamCard.classList.add('team-card');
                teamCard.innerHTML = `<h3>${teamName}</h3>`;

                // Display drafted players for this team from draft.picks
                const draftedPlayers = teamDraftedPlayers.get(roster.roster_id);
                if (draftedPlayers && draftedPlayers.length > 0) {
                    const playersList = document.createElement('ul');
                    draftedPlayers.forEach(player => {
                        const listItem = document.createElement('li');
                        listItem.textContent = `${player.full_name} (${player.position})`;
                        playersList.appendChild(listItem);
                    });
                    teamCard.appendChild(playersList);
                } else {
                    const p = document.createElement('p');
                    p.textContent = 'No players drafted yet.';
                    teamCard.appendChild(p);
                }

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

        // Display Recent Picks
        const recentPicksList = document.getElementById('recent-picks-list');
        recentPicksList.innerHTML = ''; // Clear loading text

        if (draftPicks.length > 0) {
            // Sort by pick_no descending and take the top N picks (e.g., last 5)
            const sortedPicks = [...draftPicks].sort((a, b) => b.pick_no - a.pick_no);
            const recentPicks = sortedPicks.slice(0, 5);

            recentPicks.forEach(pick => {
                const player = allPlayers[pick.player_id];
                const user = usersMap.get(pick.picked_by);
                if (player && user) {
                    const listItem = document.createElement('li');
                    listItem.textContent = `Pick ${pick.pick_no} - ${player.full_name} (${player.position}) by ${user.display_name}`;
                    recentPicksList.appendChild(listItem);
                }
            });
        } else {
            recentPicksList.innerHTML = '<li>No picks made yet.</li>';
        }

    } else {
        document.getElementById('teams-container').innerHTML = '<p>Could not load league data. Please check the league ID or try again later.</p>';
        document.getElementById('draft-status').textContent = 'Failed to load';
        document.getElementById('draft-type').textContent = 'Failed to load';
        document.getElementById('draft-order-list').innerHTML = '<li>Failed to load draft order.</li>';
        document.getElementById('recent-picks-list').innerHTML = '<li>Failed to load recent picks.</li>';
    }
}

// Run the function when the page loads
document.addEventListener('DOMContentLoaded', displayLeagueInfo);