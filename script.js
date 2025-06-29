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

// New function to display players by round
async function displayPlayersByRound(draftPicks, usersMap, rostersByUserIdMap, league, rosters) {
    const playersByRoundContainer = document.getElementById('players-by-round-container');
    playersByRoundContainer.innerHTML = ''; // Clear previous content

    if (!draftPicks || draftPicks.length === 0) {
        playersByRoundContainer.innerHTML = '<p>No players drafted yet to display by round.</p>';
        return;
    }

    const picksByRound = new Map(); // Map: roundNumber -> [picks]
    const numTeams = league.settings.num_teams; // Get numTeams from league object

    draftPicks.sort((a, b) => a.pick_no - b.pick_no).forEach(pick => {
        const roundNumber = Math.ceil(pick.pick_no / numTeams);
        if (!picksByRound.has(roundNumber)) {
            picksByRound.set(roundNumber, []);
        }
        picksByRound.get(roundNumber).push(pick);
    });

    // Sort rounds numerically
    const sortedRounds = Array.from(picksByRound.keys()).sort((a, b) => a - b);

    sortedRounds.forEach(roundNumber => {
        const roundDiv = document.createElement('div');
        roundDiv.classList.add('draft-round');
        roundDiv.innerHTML = `<h3>Round ${roundNumber}</h3>`;

        const picksList = document.createElement('ul');
        picksByRound.get(roundNumber).forEach(pick => {
            let userIdForPick = pick.metadata.owner_id;
            if (!userIdForPick) {
                const pickRoster = rosters.find(r => r.roster_id === pick.roster_id);
                if (pickRoster) {
                    userIdForPick = pickRoster.owner_id;
                }
            }
            const user = usersMap.get(userIdForPick);
            const rosterForPick = rostersByUserIdMap.get(userIdForPick);
            const teamNameForPick = rosterForPick?.metadata?.team_name || (user ? user.display_name : 'Unknown Team');

            const listItem = document.createElement('li');
            listItem.innerHTML = `
                Pick ${pick.pick_no} - Player ID: ${pick.player_id} by ${teamNameForPick}
            `;
            picksList.appendChild(listItem);
        });
        roundDiv.appendChild(picksList);
        playersByRoundContainer.appendChild(roundDiv);
    });
}

// Existing logic for displaying players by team, refactored into a new function
async function displayPlayersByTeam(rosters, users, usersMap, teamDraftedPlayers, teamsContainer) {
    teamsContainer.innerHTML = ''; // Clear previous content, including the "Loading teams..." message
    rosters.forEach(roster => {
        const user = usersMap.get(roster.owner_id);
        if (user) {
            const teamName = roster.metadata?.team_name || user.display_name || 'Unnamed Team';
            const teamCard = document.createElement('div');
            teamCard.classList.add('team-card');
            teamCard.innerHTML = `<h3>${teamName}</h3>`;

            const draftedPicks = teamDraftedPlayers.get(roster.roster_id);
            if (draftedPicks && draftedPicks.length > 0) {
                const playersList = document.createElement('ul');
                draftedPicks.sort((a, b) => a.pick_no - b.pick_no).forEach(pick => {
                    const listItem = document.createElement('li');

                    const numTeams = users.length; // Use users.length for numTeams, as league might not be available here directly
                    const roundNumber = Math.ceil(pick.pick_no / numTeams);

                    listItem.innerHTML = `
                        Round ${roundNumber}, Pick ${pick.pick_no} - Player ID: ${pick.player_id}
                    `;
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
}

async function displayLeagueInfo() {
    const league = await fetchLeagueDetails();
    const rosters = await fetchRosters();
    const users = await fetchUsers();

    let draft = null;
    let draftPicks = [];
    if (league && league.draft_id) {
        draft = await fetchDraftDetails(league.draft_id);
        draftPicks = await fetchDraftPicks(league.draft_id);
    }

    if (league && rosters.length > 0 && users.length > 0) {
        // Get references to sections and buttons
        const draftedByTeamSection = document.getElementById('drafted-by-team-section');
        const draftedByRoundSection = document.getElementById('drafted-by-round-section');
        const viewByTeamBtn = document.getElementById('view-by-team-btn');
        const viewByRoundBtn = document.getElementById('view-by-round-btn');

        // Create a map to easily look up users by user_id
        const usersMap = new Map(users.map(user => [user.user_id, user]));

        // Create a map to easily look up rosters by user_id
        const rostersByUserIdMap = new Map(rosters.map(roster => [roster.owner_id, roster]));

        // Process draft picks to get drafted players for each team
        const teamDraftedPlayers = new Map(); // Map: roster_id -> [pick objects]
        if (draftPicks.length > 0) {
            draftPicks.forEach(pick => {
                if (pick.player_id) {
                    if (!teamDraftedPlayers.has(pick.roster_id)) {
                        teamDraftedPlayers.set(pick.roster_id, []);
                    }
                    teamDraftedPlayers.get(pick.roster_id).push(pick); // Store the entire pick object
                }
            });
        }

        // Initial display: View by Team
        displayPlayersByTeam(rosters, users, usersMap, teamDraftedPlayers, document.getElementById('teams-container'));
        draftedByRoundSection.style.display = 'none'; // Ensure it's hidden initially
        viewByTeamBtn.classList.add('active'); // Add an active class for styling (you can define this in CSS)

        // Event Listeners for buttons
        viewByTeamBtn.addEventListener('click', () => {
            draftedByTeamSection.style.display = 'block';
            draftedByRoundSection.style.display = 'none';
            viewByTeamBtn.classList.add('active');
            viewByRoundBtn.classList.remove('active');
            // Re-render by team in case data changed
            displayPlayersByTeam(rosters, users, usersMap, teamDraftedPlayers, document.getElementById('teams-container'));
        });

        viewByRoundBtn.addEventListener('click', () => {
            draftedByTeamSection.style.display = 'none';
            draftedByRoundSection.style.display = 'block';
            viewByTeamBtn.classList.remove('active');
            viewByRoundBtn.classList.add('active');
            // Render by round
            displayPlayersByRound(draftPicks, usersMap, rostersByUserIdMap, league, rosters);
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
                // Map draft_order (user_id -> pick_number) to display_name or team_name
                Object.keys(draft.draft_order).sort((a,b) => draft.draft_order[a] - draft.draft_order[b]).forEach(userId => {
                    const user = usersMap.get(userId); // Use usersMap here
                    const rosterForDraftOrder = rostersByUserIdMap.get(userId);
                    const teamNameForDraftOrder = rosterForDraftOrder?.metadata?.team_name || user.display_name || 'Unknown Team';
                    const pickNumber = draft.draft_order[userId];
                    const listItem = document.createElement('li');
                    listItem.textContent = `Pick ${pickNumber}: ${teamNameForDraftOrder}`;
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

        // Display Draft Progress Bar
        const draftProgressFill = document.getElementById('draft-progress-fill');
        const draftProgressText = document.getElementById('draft-progress-text');

        if (draft && draftPicks && league) {
            const totalRounds = draft.settings.rounds || 0;
            const numTeams = league.settings.num_teams; // Declare once here
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
            // Get the last 5 picks or fewer if less than 5 picks have been made
            const lastFivePicks = draftPicks.slice(-5);

            lastFivePicks.reverse().forEach(pick => {
                let userIdForPick = pick.metadata.owner_id; // Prioritize owner_id from metadata

                if (!userIdForPick) {
                    // If owner_id is not in metadata, find it from the roster
                    const pickRoster = rosters.find(r => r.roster_id === pick.roster_id);
                    if (pickRoster) {
                        userIdForPick = pickRoster.owner_id;
                    }
                }
                const user = usersMap.get(userIdForPick);

                if (user) {
                    const listItem = document.createElement('li');
                    const rosterForPick = rostersByUserIdMap.get(userIdForPick);
                    const teamNameForPick = rosterForPick?.metadata?.team_name || user.display_name || 'Unknown Team';

                    // Calculate round number
                    const numTeams = league.settings.num_teams; // Assuming league object is accessible here
                    const roundNumber = Math.ceil(pick.pick_no / numTeams);

                    listItem.innerHTML = `
                        Round ${roundNumber}, Pick ${pick.pick_no} - Player ID: ${pick.player_id} by ${teamNameForPick}
                    `;
                    recentPicksList.appendChild(listItem);
                }
            });
        } else {
            recentPicksList.innerHTML = '<p>No recent picks available.</p>';
        }

    } else {
        document.getElementById('teams-container').innerHTML = '<p>Could not load league data. Please check the league ID or try again later.</p>';
        document.getElementById('draft-status').textContent = 'Failed to load';
        document.getElementById('draft-type').textContent = 'Failed to load';
        document.getElementById('draft-order-list').innerHTML = '<li>Failed to load draft order.</li>';
        document.getElementById('recent-picks-list').innerHTML = '<p>Failed to load recent picks.</p>';
        // Update progress bar on failure as well
        document.getElementById('draft-progress-fill').style.width = '0%';
        document.getElementById('draft-progress-text').textContent = '0% complete (0/0 picks)';
    }
}

function setupDarkModeToggle() {
    const toggleButton = document.getElementById('dark-mode-toggle');
    const body = document.body;

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        body.classList.add(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        // Default to dark mode if user's system prefers it and no preference is saved
        body.classList.add('dark-mode');
    }

    toggleButton.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        if (body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark-mode');
        } else {
            localStorage.setItem('theme', ''); // Clear the item or set to 'light-mode' if you have a specific light class
        }
    });
}

// Run the function when the page loads
document.addEventListener('DOMContentLoaded', () => {
    displayLeagueInfo();
    setupDarkModeToggle(); // Call the dark mode setup function
});