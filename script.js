// JavaScript Document

const LEAGUE_ID = '1229429982934077440'; // Your league ID
const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';
const SLEEPER_AVATAR_BASE = 'https://sleepercdn.com/avatars/thumbs';

// --- IndexedDB Caching Utilities ---

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('sleeper-dashboard-db', 1);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('cacheStore')) {
                db.createObjectStore('cacheStore', { keyPath: 'key' });
            }
        };
        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
    });
}

function getFromDB(db, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['cacheStore'], 'readonly');
        const store = transaction.objectStore('cacheStore');
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result ? request.result.value : undefined);
        request.onerror = event => reject(event.target.error);
    });
}

function setInDB(db, key, value) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['cacheStore'], 'readwrite');
        const store = transaction.objectStore('cacheStore');
        const request = store.put({ key, value });
        request.onsuccess = () => resolve();
        request.onerror = event => reject(event.target.error);
    });
}

// --- End IndexedDB Caching Utilities ---

async function fetchAllPlayers() {
    const CACHE_KEY = 'allPlayersData';
    const TIMESTAMP_KEY = 'allPlayersTimestamp';
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

    try {
        const db = await openDB();
        const cachedTimestamp = await getFromDB(db, TIMESTAMP_KEY);
        const now = Date.now();

        if (cachedTimestamp && (now - cachedTimestamp < CACHE_DURATION)) {
            console.log('Serving players data from IndexedDB cache.');
            const cachedData = await getFromDB(db, CACHE_KEY);
            if (cachedData) {
                return cachedData;
            }
            console.log('Cache timestamp valid, but data was empty. Fetching new data.');
        }
    } catch (dbError) {
        console.error('IndexedDB cache read failed. Will fetch from network.', dbError);
        logError('Cache Error', 'Failed to read from IndexedDB', { originalError: dbError.message });
    }

    try {
        console.log('Fetching fresh players data from Sleeper API...');
        const response = await fetch(`${SLEEPER_API_BASE}/players/nfl`);
        if (!response.ok) {
            throw new Error(`Failed to fetch players from Sleeper API: ${response.status}`);
        }
        const players = await response.json();

        try {
            const db = await openDB();
            await setInDB(db, CACHE_KEY, players);
            await setInDB(db, TIMESTAMP_KEY, Date.now());
            console.log('Players data fetched and cached in IndexedDB.');
        } catch (dbError) {
            console.error('IndexedDB cache write failed.', dbError);
            logError('Cache Error', 'Failed to write to IndexedDB', { originalError: dbError.message });
        }
        
        return players;
    } catch (fetchError) {
        logError('Client-side Fetch Error', 'Error fetching all players from Sleeper API', { originalError: fetchError.message });
        console.warn('API fetch failed. No fresh data available.');
        return {}; 
    }
}

async function fetchNews() {
    const NEWS_CACHE_KEY = 'nflNewsData';
    const NEWS_TIMESTAMP_KEY = 'nflNewsTimestamp';
    const NEWS_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

    try {
        const db = await openDB();
        const cachedTimestamp = await getFromDB(db, NEWS_TIMESTAMP_KEY);
        const now = Date.now();

        if (cachedTimestamp && (now - cachedTimestamp < NEWS_CACHE_DURATION)) {
            console.log('Serving news from IndexedDB cache.');
            const cachedData = await getFromDB(db, NEWS_CACHE_KEY);
            if (cachedData) {
                return cachedData;
            }
        }
    } catch (dbError) {
        console.error('IndexedDB cache read failed for news. Will fetch from network.', dbError);
    }

    try {
        console.log('Fetching fresh news data from ESPN API...');
        // Note: This is an unofficial, public endpoint.
        const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news');
        if (!response.ok) {
            throw new Error(`Failed to fetch news from ESPN API: ${response.status}`);
        }
        const newsData = await response.json();
        
        try {
            const db = await openDB();
            await setInDB(db, NEWS_CACHE_KEY, newsData.articles);
            await setInDB(db, NEWS_TIMESTAMP_KEY, Date.now());
            console.log('News data fetched and cached in IndexedDB.');
        } catch (dbError) {
            console.error('IndexedDB cache write failed for news.', dbError);
        }

        return newsData.articles;
    } catch (fetchError) {
        logError('API Error', 'Error fetching news', { originalError: fetchError.message });
        return []; // Return empty array on failure
    }
}

function displayNews(articles) {
    const newsContainer = document.getElementById('news-container');
    if (!articles || articles.length === 0) {
        newsContainer.innerHTML = '<p>No news available at the moment.</p>';
        return;
    }

    newsContainer.innerHTML = articles.slice(0, 10).map(article => `
        <article class="news-article">
            <h4><a href="${article.links.web.href}" target="_blank" rel="noopener noreferrer">${article.headline}</a></h4>
            <p>${article.description}</p>
            <small>${new Date(article.published).toLocaleString()}</small>
        </article>
    `).join('');
}

async function fetchLeagueDetails() {
    try {
        const response = await fetch(`${SLEEPER_API_BASE}/league/${LEAGUE_ID}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch league details: ${response.status}`);
        }
        const league = await response.json();
        
        // Update league name and avatar in the header
        document.getElementById('league-name').textContent = league.name;
        const leagueAvatar = document.getElementById('league-avatar');
        if (league.avatar) {
            leagueAvatar.src = `${SLEEPER_AVATAR_BASE}/${league.avatar}`;
            leagueAvatar.style.display = 'inline-block';
        } else {
            leagueAvatar.style.display = 'none';
        }

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
            teamCard.innerHTML = `<h3 class="clickable-team-header" data-roster-id="${roster.roster_id}" data-user-id="${roster.owner_id}">
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

            // Add click event to team header for navigation to team page
            const teamHeader = teamCard.querySelector('.clickable-team-header');
            if (teamHeader) {
                teamHeader.addEventListener('click', () => {
                    // Switch to teams tab and show team details
                    switchToTeamsTab();
                    showTeamDetails(roster.roster_id, roster.owner_id);
                });
            }

            teamsContainer.appendChild(teamCard);
        }
    });
}

async function displayLeagueInfo() {
    const league = await fetchLeagueDetails();
    const rosters = await fetchRosters();
    const users = await fetchUsers();
    const allPlayers = await fetchAllPlayers();
    const newsArticles = await fetchNews();

    if (newsArticles) {
        displayNews(newsArticles);
    }

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

        const numTeams = users.length;

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
            displayPlayersByRound(allPlayers, draftPicks, usersMap, rostersByUserIdMap, { settings: { num_teams } }, rosters);
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

        if (draft && draftPicks) {
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

function setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    const pages = document.querySelectorAll('.page-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Hide all pages
            pages.forEach(page => {
                page.style.display = 'none';
            });

            // Deactivate all tabs
            tabs.forEach(t => {
                t.classList.remove('active');
            });

            // Show the target page
            const targetPageId = tab.getAttribute('data-tab');
            const targetPage = document.getElementById(targetPageId);
            if (targetPage) {
                targetPage.style.display = 'block';
            }

            // Activate the clicked tab
            tab.classList.add('active');

            // Load teams data if teams tab is clicked
            if (targetPageId === 'teams-page') {
                displayTeamsOverview();
            }
        });
    });
}

function setupTeamNavigation() {
    // Back to teams button
    const backBtn = document.getElementById('back-to-teams-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.getElementById('teams-overview-section').style.display = 'block';
            document.getElementById('individual-team-section').style.display = 'none';
        });
    }
}

function switchToTeamsTab() {
    // Hide all pages
    const pages = document.querySelectorAll('.page-content');
    pages.forEach(page => {
        page.style.display = 'none';
    });

    // Deactivate all tabs
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(t => {
        t.classList.remove('active');
    });

    // Show teams page and activate tab
    const teamsPage = document.getElementById('teams-page');
    const teamsTab = document.querySelector('[data-tab="teams-page"]');
    
    if (teamsPage) {
        teamsPage.style.display = 'block';
    }
    
    if (teamsTab) {
        teamsTab.classList.add('active');
    }

    // Load teams data if not already loaded
    displayTeamsOverview();
}

// Global variables for team data
let globalLeagueData = {};

async function displayTeamsOverview() {
    const container = document.getElementById('teams-overview-container');
    
    // Use cached data if available
    if (globalLeagueData.rosters && globalLeagueData.users) {
        renderTeamsOverview(container, globalLeagueData);
        return;
    }

    // Fetch fresh data
    container.innerHTML = '<p>Loading teams...</p>';
    
    try {
        const league = await fetchLeagueDetails();
        const rosters = await fetchRosters();
        const users = await fetchUsers();
        const allPlayers = await fetchAllPlayers();
        let draftPicks = [];
        
        if (league && league.draft_id) {
            draftPicks = await fetchDraftPicks(league.draft_id);
        }

        // Store in global cache
        globalLeagueData = {
            league,
            rosters,
            users,
            allPlayers,
            draftPicks
        };

        renderTeamsOverview(container, globalLeagueData);
    } catch (error) {
        container.innerHTML = '<p>Error loading teams. Please try again.</p>';
        logError('Teams Overview Error', 'Failed to load teams data', { originalError: error.message });
    }
}

function renderTeamsOverview(container, data) {
    const { league, rosters, users, allPlayers, draftPicks } = data;
    
    if (!rosters || !users || rosters.length === 0) {
        container.innerHTML = '<p>No teams data available.</p>';
        return;
    }

    const usersMap = new Map(users.map(user => [user.user_id, user]));
    
    // Determine data source based on draft status
    let teamPlayerData = new Map();
    
    if (league && league.draft_id && draftPicks.length > 0) {
        // Use draft picks during/after draft
        draftPicks.forEach(pick => {
            const player = allPlayers[pick.player_id];
            if (player) {
                if (!teamPlayerData.has(pick.roster_id)) {
                    teamPlayerData.set(pick.roster_id, []);
                }
                teamPlayerData.get(pick.roster_id).push({
                    ...player,
                    pick_no: pick.pick_no,
                    round: Math.ceil(pick.pick_no / users.length)
                });
            }
        });
    } else {
        // Use current rosters (post-draft with transactions)
        rosters.forEach(roster => {
            if (roster.players) {
                const players = roster.players.map(playerId => ({
                    ...allPlayers[playerId],
                    player_id: playerId
                })).filter(p => p.player_id); // Filter out null players
                teamPlayerData.set(roster.roster_id, players);
            }
        });
    }

    // Render team cards
    container.innerHTML = '';
    rosters.forEach(roster => {
        const user = usersMap.get(roster.owner_id);
        if (!user) return;

        const teamName = user.metadata?.team_name || user.display_name || 'Unnamed Team';
        const avatarUrl = user.avatar ? `${SLEEPER_AVATAR_BASE}/${user.avatar}` : '';
        const players = teamPlayerData.get(roster.roster_id) || [];
        
        const teamCard = document.createElement('div');
        teamCard.classList.add('team-card', 'clickable');
        teamCard.setAttribute('data-roster-id', roster.roster_id);
        teamCard.setAttribute('data-user-id', roster.owner_id);
        
        teamCard.innerHTML = `
            <div class="team-detail-header">
                ${avatarUrl ? `<img src="${avatarUrl}" alt="${user.display_name} Avatar" class="avatar">` : ''}
                <div>
                    <h3>${teamName}</h3>
                    <p>${user.display_name}</p>
                </div>
            </div>
        `;

        // Add click event to show team details
        teamCard.addEventListener('click', () => {
            showTeamDetails(roster.roster_id, roster.owner_id);
        });

        container.appendChild(teamCard);
    });
}

async function showTeamDetails(rosterId, userId) {
    const overviewSection = document.getElementById('teams-overview-section');
    const detailSection = document.getElementById('individual-team-section');
    const detailContent = document.getElementById('team-detail-content');
    const detailTitle = document.getElementById('team-detail-title');

    // Hide overview, show detail
    overviewSection.style.display = 'none';
    detailSection.style.display = 'block';
    
    // Show loading
    detailContent.innerHTML = '<p>Loading team details...</p>';

    try {
        const data = globalLeagueData;
        const { league, rosters, users, allPlayers, draftPicks } = data;
        
        const roster = rosters.find(r => r.roster_id === rosterId);
        const user = users.find(u => u.user_id === userId);
        
        if (!roster || !user) {
            detailContent.innerHTML = '<p>Team not found.</p>';
            return;
        }

        const teamName = user.metadata?.team_name || user.display_name || 'Unnamed Team';
        const avatarUrl = user.avatar ? `${SLEEPER_AVATAR_BASE}/${user.avatar}` : '';
        
        // Update title
        detailTitle.textContent = teamName;

        // Get team players
        let teamPlayers = [];
        
        if (league && league.draft_id && draftPicks.length > 0) {
            // Use draft picks
            const teamDraftPicks = draftPicks.filter(pick => pick.roster_id === rosterId);
            teamPlayers = teamDraftPicks.map(pick => ({
                ...allPlayers[pick.player_id],
                pick_no: pick.pick_no,
                round: Math.ceil(pick.pick_no / users.length),
                source: 'draft'
            })).filter(p => p.player_id);
        } else if (roster.players) {
            // Use current roster
            teamPlayers = roster.players.map(playerId => ({
                ...allPlayers[playerId],
                player_id: playerId,
                source: 'current'
            })).filter(p => p.player_id);
        }

        renderTeamDetails(detailContent, {
            user,
            roster,
            teamName,
            avatarUrl,
            teamPlayers,
            isDrafting: league?.status === 'drafting'
        });

    } catch (error) {
        detailContent.innerHTML = '<p>Error loading team details.</p>';
        logError('Team Detail Error', 'Failed to load team details', { rosterId, userId, originalError: error.message });
    }
}

function renderTeamDetails(container, { user, roster, teamName, avatarUrl, teamPlayers, isDrafting }) {
    // Group players by position
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    const playersByPosition = {};
    
    positions.forEach(pos => {
        playersByPosition[pos] = teamPlayers.filter(p => p.position === pos);
    });
    
    // Add any players not in standard positions
    const otherPlayers = teamPlayers.filter(p => !positions.includes(p.position));
    if (otherPlayers.length > 0) {
        playersByPosition['OTHER'] = otherPlayers;
    }

    container.innerHTML = `
        <div class="team-detail-card">
            <div class="team-detail-header">
                ${avatarUrl ? `<img src="${avatarUrl}" alt="${user.display_name} Avatar" class="avatar">` : ''}
                <div>
                    <h3>${teamName}</h3>
                    <p><strong>Manager:</strong> ${user.display_name}</p>
                    <p><strong>Record:</strong> ${roster.settings?.wins || 0}-${roster.settings?.losses || 0}${roster.settings?.ties ? `-${roster.settings.ties}` : ''}</p>
                    <p><strong>Points:</strong> ${roster.settings?.fpts || 0}</p>
                </div>
            </div>
        </div>

        <div class="team-detail-card">
            <div class="roster-section">
                <h4>${isDrafting ? 'Drafted Players' : 'Current Roster'} (${teamPlayers.length} players)</h4>
                ${Object.keys(playersByPosition).map(position => {
                    const posPlayers = playersByPosition[position];
                    if (posPlayers.length === 0) return '';
                    
                    return `
                        <div class="position-group">
                            <h5>${position} (${posPlayers.length})</h5>
                            ${posPlayers.map(player => `
                                <div class="player-card">
                                    <div class="player-name">
                                        <a href="https://www.nfl.com/players/${player.full_name ? player.full_name.toLowerCase().replace(/\s/g, '-') : ''}" target="_blank" rel="noopener noreferrer">
                                            ${player.full_name || 'Unknown Player'}
                                        </a>
                                    </div>
                                    <div class="player-details">
                                        ${player.team || 'FA'} • ${player.position || 'N/A'}
                                        ${player.bye_week ? ` • Bye: ${player.bye_week}` : ''}
                                        ${player.pick_no ? ` • Pick ${player.pick_no} (Round ${player.round})` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// Run the function when the page loads
document.addEventListener('DOMContentLoaded', () => {
    displayLeagueInfo();
    setupDarkModeToggle();
    setupTabNavigation();
    setupTeamNavigation();
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