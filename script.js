// JavaScript Document

const LEAGUE_ID = '1229429982934077440'; // Your league ID
const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';
const SLEEPER_AVATAR_BASE = 'https://sleepercdn.com/avatars/thumbs';

async function fetchAllPlayers() {
    try {
        // Fetch all NFL players directly from the Sleeper API
        const response = await fetch(`${SLEEPER_API_BASE}/players/nfl`);
        if (!response.ok) {
            throw new Error(`Failed to fetch players from Sleeper API: ${response.status}`);
        }
        const players = await response.json();
        return players;
    } catch (error) {
        logError('Client-side Fetch Error', 'Error fetching all players from Sleeper API', { originalError: error.message });
        return {};
    }
}

async function fetchLeagueDetails() {
    try {
        const response = await fetch(`${SLEEPER_API_BASE}/league/${LEAGUE_ID}`);
        const league = await response.json();
        
        // Update league name and avatar
        document.getElementById('league-name').textContent = league.name;
        const leagueAvatar = document.getElementById('league-avatar');
        if (league.avatar) {
            leagueAvatar.src = `${SLEEPER_AVATAR_BASE}/${league.avatar}`;
            leagueAvatar.style.display = 'inline-block'; // Ensure it's visible
        } else {
            leagueAvatar.style.display = 'none'; // Hide if no avatar
        }
        
        // Display additional league details
        document.getElementById('league-season').textContent = league.season;
        document.getElementById('league-num-teams').textContent = league.settings.num_teams;

        return league;
    } catch (error) {
        logError('API Error', 'Error fetching league details', { originalError: error.message });
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
        logError('API Error', 'Error fetching rosters', { originalError: error.message });
        return [];
    }
}

async function fetchUsers() {
    try {
        const response = await fetch(`${SLEEPER_API_BASE}/league/${LEAGUE_ID}/users`);
        const users = await response.json();
        return users;
    } catch (error) {
        logError('API Error', 'Error fetching users', { originalError: error.message });
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
        logError('API Error', `Error fetching draft details for ID: ${draftId}`, { originalError: error.message });
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
        logError('API Error', `Error fetching draft picks for ID: ${draftId}`, { originalError: error.message });
        return [];
    }
}

async function displayPlayersByRound(allPlayers, draftPicks, usersMap, rostersByUserIdMap, league, rosters) {
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
            const player = allPlayers[pick.player_id];
            let userIdForPick = pick.metadata.owner_id;
            if (!userIdForPick) {
                const pickRoster = rosters.find(r => r.roster_id === pick.roster_id);
                if (pickRoster) {
                    userIdForPick = pickRoster.owner_id;
                }
            }
            const user = usersMap.get(userIdForPick);
            const rosterForPick = rostersByUserIdMap.get(userIdForPick);
            const teamNameForPick = user?.metadata?.team_name || (user ? user.display_name : 'Unknown Team');

            if (player) {
                const listItem = document.createElement('li');
                const formattedName = player.full_name ? player.full_name.toLowerCase().replace(/\s/g, '-') : '';
                const nflProfileUrl = formattedName ? `https://www.nfl.com/players/${formattedName}/` : '#';

                listItem.innerHTML = `
                    Pick ${pick.pick_no} - <a href="${nflProfileUrl}" target="_blank" rel="noopener noreferrer">${player.full_name}</a> (${player.position}, ${player.team || 'N/A'})
                    ${player.bye_week ? `(Bye: ${player.bye_week})` : ''}
                    by ${teamNameForPick}
                `;
                picksList.appendChild(listItem);
            }
        });
        roundDiv.appendChild(picksList);
        playersByRoundContainer.appendChild(roundDiv);
    });
}

// Existing logic for displaying players by team, refactored into a new function
async function displayPlayersByTeam(allPlayers, rosters, users, usersMap, teamDraftedPlayers, teamsContainer) {
    teamsContainer.innerHTML = ''; // Clear previous content, including the "Loading teams..." message
    rosters.forEach(roster => {
        const user = usersMap.get(roster.owner_id);
        if (user) {
            const teamName = user.metadata?.team_name || user.display_name || 'Unnamed Team';
            const avatarUrl = user.avatar ? `${SLEEPER_AVATAR_BASE}/${user.avatar}` : '';
            const teamCard = document.createElement('div');
            teamCard.classList.add('team-card');
            teamCard.innerHTML = `<h3>
                ${avatarUrl ? `<img src="${avatarUrl}" alt="${user.display_name} Avatar" class="avatar">` : ''}
                ${teamName}
            </h3>`;

            const draftedPicks = teamDraftedPlayers.get(roster.roster_id);
            if (draftedPicks && draftedPicks.length > 0) {
                const playersList = document.createElement('ul');
                draftedPicks.sort((a, b) => a.pick_no - b.pick_no).forEach(pick => {
                    const player = allPlayers[pick.player_id];
                    if (!player) return;

                    const listItem = document.createElement('li');
                    const formattedName = player.full_name ? player.full_name.toLowerCase().replace(/\s/g, '-') : '';
                    const nflProfileUrl = formattedName ? `https://www.nfl.com/players/${formattedName}/` : '#';

                    const numTeams = users.length; // Use users.length for numTeams, as league might not be available here directly
                    const roundNumber = Math.ceil(pick.pick_no / numTeams);

                    listItem.innerHTML = `
                        Round ${roundNumber}, Pick ${pick.pick_no} - <a href="${nflProfileUrl}" target="_blank" rel="noopener noreferrer">${player.full_name}</a> (${player.position}, ${player.team || 'N/A'})
                        ${player.bye_week ? `(Bye: ${player.bye_week})` : ''}
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
    const allPlayers = await fetchAllPlayers(); // Fetch all players here

    let draft = null;
    let draftPicks = [];
    if (league && league.draft_id) {
        draft = await fetchDraftDetails(league.draft_id);
        draftPicks = await fetchDraftPicks(league.draft_id);
    }

    if (league && rosters.length > 0 && users.length > 0 && allPlayers) {
        // Get references to sections and buttons
        const draftedByTeamSection = document.getElementById('drafted-by-team-section');
        const draftedByRoundSection = document.getElementById('drafted-by-round-section');
        const viewByTeamBtn = document.getElementById('view-by-team-btn');
        const viewByRoundBtn = document.getElementById('view-by-round-btn');

        // Create a map to easily look up users by user_id
        const usersMap = new Map(users.map(user => [user.user_id, user]));

        // Create a map to easily look up rosters by user_id
        const rostersByUserIdMap = new Map(rosters.map(roster => [roster.owner_id, roster]));

        const numTeams = league.settings.num_teams; // Declare numTeams once here

        // Process draft picks to get drafted players for each team
        const teamDraftedPlayers = new Map(); // Map: roster_id -> [pick objects]
        if (draftPicks.length > 0) {
            draftPicks.forEach(pick => {
                const player = allPlayers[pick.player_id]; // Use allPlayers here
                if (player) {
                    if (!teamDraftedPlayers.has(pick.roster_id)) {
                        teamDraftedPlayers.set(pick.roster_id, []);
                    }
                    teamDraftedPlayers.get(pick.roster_id).push(pick); // Store the entire pick object
                }
            });
        }

        // Initial display: View by Team
        displayPlayersByTeam(allPlayers, rosters, users, usersMap, teamDraftedPlayers, document.getElementById('teams-container'));
        draftedByRoundSection.style.display = 'none'; // Ensure it's hidden initially
        viewByTeamBtn.classList.add('active'); // Add an active class for styling (you can define this in CSS)

        // Event Listeners for buttons
        viewByTeamBtn.addEventListener('click', () => {
            draftedByTeamSection.style.display = 'block';
            draftedByRoundSection.style.display = 'none';
            viewByTeamBtn.classList.add('active');
            viewByRoundBtn.classList.remove('active');
            // Re-render by team in case data changed
            displayPlayersByTeam(allPlayers, rosters, users, usersMap, teamDraftedPlayers, document.getElementById('teams-container'));
        });

        viewByRoundBtn.addEventListener('click', () => {
            draftedByTeamSection.style.display = 'none';
            draftedByRoundSection.style.display = 'block';
            viewByTeamBtn.classList.remove('active');
            viewByRoundBtn.classList.add('active');
            // Render by round
            displayPlayersByRound(allPlayers, draftPicks, usersMap, rostersByUserIdMap, league, rosters);
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
                    const teamNameForDraftOrder = user.metadata?.team_name || user.display_name || 'Unknown Team';
                    const avatarUrl = user.avatar ? `${SLEEPER_AVATAR_BASE}/${user.avatar}` : '';
                    const pickNumber = draft.draft_order[userId];
                    const listItem = document.createElement('li');
                    listItem.innerHTML = `
                        Pick ${pickNumber}: 
                        ${avatarUrl ? `<img src="${avatarUrl}" alt="${user.display_name} Avatar" class="avatar">` : ''}
                        ${teamNameForDraftOrder}
                    `;
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

        if (draftPicks.length > 0 && allPlayers) {
            // Get the last 5 picks or fewer if less than 5 picks have been made
            const lastFivePicks = draftPicks.slice(-5);

            lastFivePicks.reverse().forEach(pick => {
                const player = allPlayers[pick.player_id];
                let userIdForPick = pick.metadata.owner_id; // Prioritize owner_id from metadata

                if (!userIdForPick) {
                    // If owner_id is not in metadata, find it from the roster
                    const pickRoster = rosters.find(r => r.roster_id === pick.roster_id);
                    if (pickRoster) {
                        userIdForPick = pickRoster.owner_id;
                    }
                }
                const user = usersMap.get(userIdForPick);
                const rosterForPick = rostersByUserIdMap.get(userIdForPick);
                const teamNameForPick = user?.metadata?.team_name || (user ? user.display_name : 'Unknown Team');
                const avatarUrl = user.avatar ? `${SLEEPER_AVATAR_BASE}/${user.avatar}` : '';

                // Calculate round number
                const roundNumber = Math.ceil(pick.pick_no / numTeams);

                if (player && user) {
                    const listItem = document.createElement('li');
                    const formattedName = player.full_name ? player.full_name.toLowerCase().replace(/\s/g, '-') : '';
                    const nflProfileUrl = formattedName ? `https://www.nfl.com/players/${formattedName}/` : '#';

                    listItem.innerHTML = `
                        Round ${roundNumber}, Pick ${pick.pick_no} - <a href="${nflProfileUrl}" target="_blank" rel="noopener noreferrer">${player.full_name}</a> (${player.position}, ${player.team || 'N/A'})
                        ${player.bye_week ? `(Bye: ${player.bye_week})` : ''}
                        by ${avatarUrl ? `<img src="${avatarUrl}" alt="${user.display_name} Avatar" class="avatar">` : ''}
                        ${teamNameForPick}
                    `;
                    recentPicksList.appendChild(listItem);
                }
            });
        } else {
            recentPicksList.innerHTML = '<p>No recent picks available.</p>';
        }
    } else {
        document.getElementById('teams-container').innerHTML = '<p>Could not load league data. Please check the league ID or try again later.</p>';
        document.getElementById('draft-status').textContent = 'N/A';
        document.getElementById('draft-type').textContent = 'N/A';
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

// --- Error Logging Functions ---

function logError(errorType, message, errorDetails = {}) {
    const errorLogSection = document.getElementById('error-log-section');
    const errorLogContainer = document.getElementById('error-log-container');

    if (errorLogSection) {
        errorLogSection.style.display = 'block'; // Make the section visible
    }

    const errorEntry = document.createElement('div');
    errorEntry.classList.add('error-log-entry');

    let detailsHtml = '';
    for (const key in errorDetails) {
        detailsHtml += `<strong>${key}:</strong> ${JSON.stringify(errorDetails[key])}<br>`;
    }

    errorEntry.innerHTML = `
        <p><strong>Error Type:</strong> ${errorType}</p>
        <p><strong>Message:</strong> ${message}</p>
        ${detailsHtml ? `<p>${detailsHtml}</p>` : ''}
        <p><small>Timestamp: ${new Date().toLocaleString()}</small></p>
        <hr>
    `;

    if (errorLogContainer) {
        errorLogContainer.prepend(errorEntry); // Add new errors to the top
    }

    console.error(`[${errorType}] ${message}`, errorDetails);

    // Store error in local storage (optional, for persistence across reloads)
    const storedErrors = JSON.parse(localStorage.getItem('appErrors') || '[]');
    storedErrors.unshift({ errorType, message, errorDetails, timestamp: new Date().toISOString() });
    localStorage.setItem('appErrors', JSON.stringify(storedErrors.slice(0, 50))); // Keep last 50 errors
}

// Global error handler for uncaught JavaScript errors
window.onerror = function(message, source, lineno, colno, error) {
    logError('Unhandled JavaScript Error', message, {
        source: source,
        line: lineno,
        column: colno,
        errorObject: error ? error.toString() : 'N/A'
    });
    // Return true to prevent the browser's default error handling (e.g., console output)
    return true;
};

// Clear Errors button functionality
document.addEventListener('DOMContentLoaded', () => {
    const clearErrorsBtn = document.getElementById('clear-errors-btn');
    const errorLogContainer = document.getElementById('error-log-container');
    const errorLogSection = document.getElementById('error-log-section');

    if (clearErrorsBtn && errorLogContainer) {
        clearErrorsBtn.addEventListener('click', () => {
            errorLogContainer.innerHTML = '';
            localStorage.removeItem('appErrors');
            if (errorLogSection) {
                errorLogSection.style.display = 'none'; // Hide section after clearing
            }
        });
    }

    // Load existing errors from localStorage on page load
    const storedErrors = JSON.parse(localStorage.getItem('appErrors') || '[]');
    if (storedErrors.length > 0 && errorLogContainer) {
        errorLogSection.style.display = 'block';
        storedErrors.forEach(err => {
            const errorEntry = document.createElement('div');
            errorEntry.classList.add('error-log-entry');
            let detailsHtml = '';
            for (const key in err.errorDetails) {
                detailsHtml += `<strong>${key}:</strong> ${JSON.stringify(err.errorDetails[key])}<br>`;
            }
            errorEntry.innerHTML = `
                <p><strong>Error Type:</strong> ${err.errorType}</p>
                <p><strong>Message:</strong> ${err.message}</p>
                ${detailsHtml ? `<p>${detailsHtml}</p>` : ''}
                <p><small>Timestamp: ${new Date(err.timestamp).toLocaleString()}</small></p>
                <hr>
            `;
            errorLogContainer.appendChild(errorEntry); // Append existing errors
        });
    }
});