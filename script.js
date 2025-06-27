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
                        listItem.innerHTML = `
                            ${player.full_name} (${player.position}, ${player.team || 'N/A'})
                            ${player.bye_week ? `(Bye: ${player.bye_week})` : ''}
                            <a href="https://sleeper.app/player/${player.player_id}" target="_blank" rel="noopener noreferrer">Profile</a>
                        `;
                        console.log('Team Card Player Data:', player);
                        console.log('Team Card ListItem HTML:', listItem.innerHTML);
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
                    const user = usersMap.get(userId); // Use usersMap here
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

        // Display Current Pick
        const onTheClockSpan = document.getElementById('on-the-clock');
        const pickNumberSpan = document.getElementById('pick-number');
        const pickTimerP = document.getElementById('pick-timer'); // Placeholder for timer

        if (draft && draftPicks && usersMap.size > 0 && rosters.length > 0) {
            const currentPickNumber = draftPicks.length + 1; // The next pick number
            const numTeams = league.settings.num_teams; // Number of teams in the league

            pickNumberSpan.textContent = `Pick: ${currentPickNumber}`;

            let currentPickSlot;
            const currentRound = Math.ceil(currentPickNumber / numTeams);
            const pickInRound = currentPickNumber % numTeams === 0 ? numTeams : currentPickNumber % numTeams;

            if (draft.type === 'snake' && currentRound % 2 === 0) {
                // Even rounds for snake draft, pick order reverses
                currentPickSlot = numTeams - pickInRound + 1;
            } else {
                // Odd rounds for snake draft, or linear draft
                currentPickSlot = pickInRound;
            }
            
            // Find the roster_id from slot_to_roster_id map
            const currentRosterId = draft.slot_to_roster_id[currentPickSlot];
            
            // Find the user_id from the rosters array based on roster_id
            const currentRoster = rosters.find(r => r.roster_id === parseInt(currentRosterId));

            let currentPicker = null;
            if (currentRoster) {
                currentPicker = usersMap.get(currentRoster.owner_id);
            }

            if (currentPicker) {
                onTheClockSpan.textContent = `${currentPicker.display_name} is on the clock!`;
            } else {
                onTheClockSpan.textContent = 'Unknown manager on the clock.';
            }

            // For the timer, Sleeper API has draft_metadata.pick_start_time and draft_metadata.pick_timer
            if (draft.settings.enforce_module_timer) {
                // If you want to implement a live timer later, this is where you'd do it.
                // For now, we'll leave this empty.
                // pickTimerP.textContent = 'Pick timer is active.'; 
            } else {
                pickTimerP.textContent = ''; // Clear the message if no timer enforced
            }

        } else {
            onTheClockSpan.textContent = 'Draft not in progress or details unavailable.';
            pickNumberSpan.textContent = 'Pick: N/A';
            pickTimerP.textContent = '';
        }

        // Display Draft Progress Bar
        const draftProgressFill = document.getElementById('draft-progress-fill');
        const draftProgressText = document.getElementById('draft-progress-text');

        if (draft && draftPicks && league) {
            const totalRounds = draft.settings.rounds || 0; // Or from draft.draft_rounds if available
            const numTeams = league.settings.num_teams || 0;
            const totalPicks = totalRounds * numTeams;
            const completedPicks = draftPicks.length;

            if (totalPicks > 0) {
                const progressPercentage = (completedPicks / totalPicks) * 100;
                draftProgressFill.style.width = `${progressPercentage.toFixed(2)}%`;
                draftProgressText.textContent = `${progressPercentage.toFixed(0)}% complete (${completedPicks}/${totalPicks} picks)`;
            } else {
                draftProgressFill.style.width = '0%';
                draftProgressText.textContent = '0% complete (0/0 picks)';
            }
        } else {
            draftProgressFill.style.width = '0%';
            draftProgressText.textContent = '0% complete (0/0 picks)';
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
                    listItem.innerHTML = `
                        Pick ${pick.pick_no} - ${player.full_name} (${player.position}, ${player.team || 'N/A'})
                        ${player.bye_week ? `(Bye: ${player.bye_week})` : ''}
                        <a href="https://sleeper.app/player/${player.player_id}" target="_blank" rel="noopener noreferrer">Profile</a>
                        by ${user.display_name}
                    `;
                    console.log('Recent Pick Player Data:', player);
                    console.log('Recent Pick ListItem HTML:', listItem.innerHTML);
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
        document.getElementById('on-the-clock').textContent = 'Failed to load';
        document.getElementById('pick-number').textContent = 'Pick: Failed to load';
        document.getElementById('pick-timer').textContent = '';
        // Update progress bar on failure as well
        document.getElementById('draft-progress-fill').style.width = '0%';
        document.getElementById('draft-progress-text').textContent = '0% complete (0/0 picks)';
    }
}

// Run the function when the page loads
document.addEventListener('DOMContentLoaded', displayLeagueInfo);