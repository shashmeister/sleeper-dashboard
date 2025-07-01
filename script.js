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

            // Load data based on tab
            if (targetPageId === 'teams-page') {
                displayTeamsOverview();
            } else if (targetPageId === 'standings-page') {
                displayStandings();
            } else if (targetPageId === 'transactions-page') {
                displayTransactions();
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

async function displayStandings() {
    const standingsContainer = document.getElementById('standings-container');
    const playoffContainer = document.getElementById('playoff-picture-container');
    
    // Use cached data if available
    if (globalLeagueData.rosters && globalLeagueData.users) {
        renderStandings(standingsContainer, playoffContainer, globalLeagueData);
        return;
    }

    // Fetch fresh data
    standingsContainer.innerHTML = '<p>Loading standings...</p>';
    playoffContainer.innerHTML = '<p>Loading playoff picture...</p>';
    
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

        renderStandings(standingsContainer, playoffContainer, globalLeagueData);
    } catch (error) {
        standingsContainer.innerHTML = '<p>Error loading standings. Please try again.</p>';
        playoffContainer.innerHTML = '<p>Error loading playoff picture. Please try again.</p>';
        logError('Standings Error', 'Failed to load standings data', { originalError: error.message });
    }
}

function renderStandings(standingsContainer, playoffContainer, data) {
    const { league, rosters, users } = data;
    
    if (!rosters || !users || rosters.length === 0) {
        standingsContainer.innerHTML = '<p>No standings data available.</p>';
        playoffContainer.innerHTML = '<p>No playoff data available.</p>';
        return;
    }

    const usersMap = new Map(users.map(user => [user.user_id, user]));
    
    // Calculate standings data
    const standingsData = rosters.map(roster => {
        const user = usersMap.get(roster.owner_id);
        const teamName = user?.metadata?.team_name || user?.display_name || 'Unnamed Team';
        const avatarUrl = user?.avatar ? `${SLEEPER_AVATAR_BASE}/${user.avatar}` : '';
        
        const wins = roster.settings?.wins || 0;
        const losses = roster.settings?.losses || 0;
        const ties = roster.settings?.ties || 0;
        const totalGames = wins + losses + ties;
        const winPct = totalGames > 0 ? (wins + ties * 0.5) / totalGames : 0;
        
        const pointsFor = roster.settings?.fpts || 0;
        const pointsAgainst = roster.settings?.fpts_against || 0;
        const pointDiff = pointsFor - pointsAgainst;
        
        return {
            rosterId: roster.roster_id,
            userId: roster.owner_id,
            teamName,
            managerName: user?.display_name || 'Unknown',
            avatarUrl,
            wins,
            losses,
            ties,
            winPct,
            pointsFor,
            pointsAgainst,
            pointDiff,
            totalGames
        };
    });

    // Sort by win percentage, then by points for
    standingsData.sort((a, b) => {
        if (b.winPct !== a.winPct) {
            return b.winPct - a.winPct;
        }
        return b.pointsFor - a.pointsFor;
    });

    // Determine playoff positions (assuming top 6 teams make playoffs, top 2 get byes)
    const playoffSpots = Math.min(6, rosters.length);
    const byeWeeks = Math.min(2, rosters.length);

    // Render standings table
    standingsContainer.innerHTML = `
        <table class="standings-table">
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>Record</th>
                    <th>Win %</th>
                    <th>PF</th>
                    <th>PA</th>
                    <th>Diff</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${standingsData.map((team, index) => {
                    const rank = index + 1;
                    let statusBadge = '';
                    
                    if (rank <= byeWeeks) {
                        statusBadge = '<span class="playoff-position">Bye Week</span>';
                    } else if (rank <= playoffSpots) {
                        statusBadge = '<span class="playoff-position">Playoffs</span>';
                    } else {
                        statusBadge = '<span class="eliminated">Eliminated</span>';
                    }

                    const diffClass = team.pointDiff > 0 ? 'positive' : team.pointDiff < 0 ? 'negative' : '';
                    const record = team.ties > 0 ? `${team.wins}-${team.losses}-${team.ties}` : `${team.wins}-${team.losses}`;

                    return `
                        <tr>
                            <td class="number-cell">${rank}</td>
                            <td>
                                <div class="team-info">
                                    ${team.avatarUrl ? `<img src="${team.avatarUrl}" alt="${team.managerName} Avatar" class="avatar">` : ''}
                                    <div>
                                        <div class="team-name">${team.teamName}</div>
                                        <div class="manager-name">${team.managerName}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="number-cell">${record}</td>
                            <td class="number-cell">${(team.winPct * 100).toFixed(1)}%</td>
                            <td class="number-cell">${team.pointsFor.toFixed(1)}</td>
                            <td class="number-cell">${team.pointsAgainst.toFixed(1)}</td>
                            <td class="number-cell ${diffClass}">${team.pointDiff > 0 ? '+' : ''}${team.pointDiff.toFixed(1)}</td>
                            <td>${statusBadge}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    // Render playoff picture
    const playoffTeams = standingsData.slice(0, playoffSpots);
    const byeTeams = playoffTeams.slice(0, byeWeeks);
    const wildcardTeams = playoffTeams.slice(byeWeeks);

    playoffContainer.innerHTML = `
        <div class="playoff-bracket">
            ${byeTeams.map((team, index) => `
                <div class="playoff-spot bye-week">
                    <h4>#${index + 1} Seed - First Round Bye</h4>
                    <div class="playoff-team">
                        ${team.avatarUrl ? `<img src="${team.avatarUrl}" alt="${team.managerName} Avatar" class="avatar">` : ''}
                        <div>
                            <div class="team-name">${team.teamName}</div>
                            <div class="manager-name">${team.wins}-${team.losses}${team.ties > 0 ? `-${team.ties}` : ''}</div>
                        </div>
                    </div>
                </div>
            `).join('')}
            
            ${wildcardTeams.map((team, index) => `
                <div class="playoff-spot">
                    <h4>#${index + byeWeeks + 1} Seed - Wild Card</h4>
                    <div class="playoff-team">
                        ${team.avatarUrl ? `<img src="${team.avatarUrl}" alt="${team.managerName} Avatar" class="avatar">` : ''}
                        <div>
                            <div class="team-name">${team.teamName}</div>
                            <div class="manager-name">${team.wins}-${team.losses}${team.ties > 0 ? `-${team.ties}` : ''}</div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: var(--card-bg); border-radius: 8px; border: 1px solid var(--card-border);">
            <h4 style="margin-top: 0; color: var(--heading-color);">Playoff Format</h4>
            <p style="margin-bottom: 5px;"><strong>Playoff Teams:</strong> Top ${playoffSpots} teams</p>
            <p style="margin-bottom: 5px;"><strong>First Round Byes:</strong> Top ${byeWeeks} seeds</p>
            <p style="margin-bottom: 0;"><strong>Tiebreakers:</strong> 1) Win % 2) Points For</p>
        </div>
    `;
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
        // Ensure data is loaded before proceeding
        let data = globalLeagueData || {};
        
        // If data isn't loaded yet, fetch it
        if (!data.rosters || !data.users || !data.allPlayers) {
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
            
            data = globalLeagueData;
        }
        
        const { league, rosters, users, allPlayers, draftPicks } = data;
        
        // Ensure rosterId is a number for comparison
        const rosterIdNum = parseInt(rosterId);
        
        const roster = rosters.find(r => r.roster_id === rosterIdNum);
        const user = users.find(u => u.user_id === userId);
        
        if (!roster || !user) {
            detailContent.innerHTML = `<p>Team not found.</p>
                <p><small>Debug: Looking for roster ID ${rosterIdNum} and user ID ${userId}</small></p>
                <p><small>Available rosters: ${rosters.map(r => r.roster_id).join(', ')}</small></p>`;
            return;
        }

        const teamName = user.metadata?.team_name || user.display_name || 'Unnamed Team';
        const avatarUrl = user.avatar ? `${SLEEPER_AVATAR_BASE}/${user.avatar}` : '';
        
        // Update title
        detailTitle.textContent = teamName;

        // Get team players
        let teamPlayers = [];
        
        if (league && league.draft_id && draftPicks.length > 0) {
            // Use draft picks (make sure to use the numeric roster ID)
            const teamDraftPicks = draftPicks.filter(pick => pick.roster_id === rosterIdNum);
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

// --- Transactions Functions ---

async function fetchTransactions(week = 1) {
    try {
        const response = await fetch(`${SLEEPER_API_BASE}/league/${LEAGUE_ID}/transactions/${week}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch transactions for week ${week}: ${response.status}`);
        }
        const transactions = await response.json();
        return transactions || [];
    } catch (error) {
        logError('API Error', `Error fetching transactions for week ${week}`, { originalError: error.message });
        return [];
    }
}

async function fetchAllRecentTransactions() {
    try {
        // Fetch transactions from multiple weeks (weeks 0-10 to cover startup and early season)
        const weeks = Array.from({ length: 11 }, (_, i) => i);
        const transactionPromises = weeks.map(week => fetchTransactions(week));
        const allTransactionsByWeek = await Promise.all(transactionPromises);
        
        // Flatten and combine all transactions
        const allTransactions = allTransactionsByWeek.flat();
        
        // Sort by created time (most recent first)
        return allTransactions.sort((a, b) => b.created - a.created);
    } catch (error) {
        logError('Transaction Error', 'Error fetching recent transactions', { originalError: error.message });
        return [];
    }
}

async function displayTransactions() {
    const container = document.getElementById('transactions-container');
    if (!container) return;

    try {
        container.innerHTML = '<p>Loading transactions...</p>';
        
        // Get fresh data including draft picks for player cross-referencing
        const [transactions, users, rosters, allPlayers, league] = await Promise.all([
            fetchAllRecentTransactions(),
            fetchUsers(),
            fetchRosters(),
            fetchAllPlayers(),
            fetchLeagueDetails()
        ]);

        let draftPicks = [];
        if (league && league.draft_id) {
            draftPicks = await fetchDraftPicks(league.draft_id);
        }

        // Update global data to include draft picks for cross-referencing
        globalLeagueData = {
            ...globalLeagueData,
            league,
            rosters,
            users,
            allPlayers,
            draftPicks
        };

        if (transactions.length === 0) {
            container.innerHTML = '<p>No transactions found.</p>';
            return;
        }

        // Create user and roster maps
        const usersMap = users.reduce((map, user) => {
            map[user.user_id] = user;
            return map;
        }, {});

        const rostersByUserId = {};
        rosters.forEach(roster => {
            const owner = users.find(user => user.user_id === roster.owner_id);
            if (owner) {
                rostersByUserId[owner.user_id] = roster;
            }
        });

        // Populate week filter
        setupTransactionFilters(transactions);

        // Display transactions
        renderTransactions(container, transactions, usersMap, rostersByUserId, allPlayers);

        // Setup filter event listeners
        setupTransactionFilterListeners(transactions, usersMap, rostersByUserId, allPlayers);

    } catch (error) {
        container.innerHTML = '<p>Error loading transactions.</p>';
        logError('Transaction Display Error', 'Failed to display transactions', { originalError: error.message });
    }
}

function setupTransactionFilters(transactions) {
    // Setup week filter
    const weekFilter = document.getElementById('week-filter');
    if (!weekFilter) return;

    // Get unique weeks from transactions
    const weeks = [...new Set(transactions.map(t => {
        const date = new Date(t.created);
        const week = Math.ceil((date - new Date(date.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
        return week;
    }))].sort((a, b) => b - a);

    // Clear existing options except "All Weeks"
    weekFilter.innerHTML = '<option value="all">All Weeks</option>';
    
    weeks.forEach(week => {
        const option = document.createElement('option');
        option.value = week;
        option.textContent = `Week ${week}`;
        weekFilter.appendChild(option);
    });
}

function setupTransactionFilterListeners(transactions, usersMap, rostersByUserId, allPlayers) {
    const filters = ['filter-trades', 'filter-waivers', 'filter-free-agents', 'filter-drops'];
    const weekFilter = document.getElementById('week-filter');
    const container = document.getElementById('transactions-container');

    function applyFilters() {
        const activeTypes = [];
        
        if (document.getElementById('filter-trades')?.checked) activeTypes.push('trade');
        if (document.getElementById('filter-waivers')?.checked) activeTypes.push('waiver');
        if (document.getElementById('filter-free-agents')?.checked) activeTypes.push('free_agent');
        if (document.getElementById('filter-drops')?.checked) activeTypes.push('drop');

        const selectedWeek = weekFilter?.value;

        let filteredTransactions = transactions.filter(t => activeTypes.includes(t.type));

        if (selectedWeek && selectedWeek !== 'all') {
            const weekNum = parseInt(selectedWeek);
            filteredTransactions = filteredTransactions.filter(t => {
                const date = new Date(t.created);
                const transactionWeek = Math.ceil((date - new Date(date.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
                return transactionWeek === weekNum;
            });
        }

        renderTransactions(container, filteredTransactions, usersMap, rostersByUserId, allPlayers);
    }

    // Add event listeners
    filters.forEach(filterId => {
        const checkbox = document.getElementById(filterId);
        if (checkbox) {
            checkbox.addEventListener('change', applyFilters);
        }
    });

    if (weekFilter) {
        weekFilter.addEventListener('change', applyFilters);
    }
}

function renderTransactions(container, transactions, usersMap, rostersByUserId, allPlayers) {
    if (transactions.length === 0) {
        container.innerHTML = '<p>No transactions match the selected filters.</p>';
        return;
    }

    container.innerHTML = transactions.map(transaction => {
        const date = new Date(transaction.created);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        
        return `
            <div class="transaction-card">
                <div class="transaction-header">
                    <span class="transaction-type ${transaction.type}">${transaction.type}</span>
                    <span class="transaction-date">${formattedDate}</span>
                </div>
                <div class="transaction-details">
                    ${renderTransactionContent(transaction, usersMap, rostersByUserId, allPlayers)}
                </div>
            </div>
        `;
    }).join('');
}

function renderTransactionContent(transaction, usersMap, rostersByUserId, allPlayers) {
    if (transaction.type === 'trade') {
        return renderTrade(transaction, usersMap, rostersByUserId, allPlayers);
    } else if (transaction.type === 'waiver' || transaction.type === 'free_agent') {
        return renderWaiverOrFreeAgent(transaction, usersMap, rostersByUserId, allPlayers);
    } else if (transaction.type === 'drop') {
        return renderDrop(transaction, usersMap, rostersByUserId, allPlayers);
    }
    return '<p>Unknown transaction type</p>';
}

function renderTrade(transaction, usersMap, rostersByUserId, allPlayers) {
    const rosterIds = transaction.roster_ids || [];
    
    if (rosterIds.length < 2) {
        return '<p>Invalid trade data</p>';
    }

    const teams = rosterIds.map(rosterId => {
        const roster = Object.values(rostersByUserId).find(r => r.roster_id === rosterId);
        const user = roster ? usersMap[roster.owner_id] : null;
        
        const teamName = user?.metadata?.team_name || user?.display_name || 'Unknown Team';
        const avatarUrl = user?.avatar ? `${SLEEPER_AVATAR_BASE}/${user.avatar}` : '';

        // Get what this team received
        const received = [];
        
        // Check for players
        if (transaction.adds) {
            Object.keys(transaction.adds).forEach(playerId => {
                if (transaction.adds[playerId] === rosterId) {
                    const player = allPlayers[playerId];
                    if (player) {
                        received.push({
                            type: 'player',
                            name: player.full_name || 'Unknown Player',
                            details: `${player.position || 'N/A'} - ${player.team || 'FA'}`
                        });
                    }
                }
            });
        }

        // Check for draft picks
        if (transaction.draft_picks) {
            transaction.draft_picks.forEach(pick => {
                if (pick.owner_id === rosterId) {
                    // Try to find which player was drafted with this pick
                    let playerDraftedInfo = '';
                    if (globalLeagueData.draftPicks && pick.season === '2025') {
                        // For current season picks, find the draft pick by round and current owner
                        const draftedPick = globalLeagueData.draftPicks.find(dp => 
                            dp.round === pick.round && 
                            dp.roster_id === pick.owner_id
                        );
                        
                        if (draftedPick && draftedPick.player_id && allPlayers[draftedPick.player_id]) {
                            const player = allPlayers[draftedPick.player_id];
                            playerDraftedInfo = ` (drafted ${player.full_name})`;
                        }
                    }
                    
                    received.push({
                        type: 'pick',
                        name: `${pick.season} Round ${pick.round} Pick${playerDraftedInfo}`,
                        details: pick.previous_owner_id !== rosterId ? 'Acquired' : 'Original'
                    });
                }
            });
        }

        return { teamName, avatarUrl, received, rosterId };
    });

    return `
        ${teams.map((team, index) => `
            <div class="transaction-team">
                <h4>
                    ${team.avatarUrl ? `<img src="${team.avatarUrl}" alt="${team.teamName} Avatar" class="avatar">` : ''}
                    ${team.teamName} Receives:
                </h4>
                <ul class="transaction-players">
                    ${team.received.length > 0 ? team.received.map(item => `
                        <li class="${item.type === 'player' ? 'added' : 'draft-pick-item'}">
                            <div class="${item.type === 'player' ? 'player-name' : 'pick-details'}">${item.name}</div>
                            <div class="${item.type === 'player' ? 'player-details' : 'pick-info'}">${item.details}</div>
                        </li>
                    `).join('') : '<li>Nothing received</li>'}
                </ul>
            </div>
            ${index < teams.length - 1 ? '<div class="trade-arrow">↔</div>' : ''}
        `).join('')}
    `;
}

function renderWaiverOrFreeAgent(transaction, usersMap, rostersByUserId, allPlayers) {
    const rosterId = transaction.roster_ids?.[0];
    const roster = Object.values(rostersByUserId).find(r => r.roster_id === rosterId);
    const user = roster ? usersMap[roster.owner_id] : null;
    
    const teamName = user?.metadata?.team_name || user?.display_name || 'Unknown Team';
    const avatarUrl = user?.avatar ? `${SLEEPER_AVATAR_BASE}/${user.avatar}` : '';

    const adds = [];
    const drops = [];

    if (transaction.adds) {
        Object.keys(transaction.adds).forEach(playerId => {
            const player = allPlayers[playerId];
            if (player) {
                adds.push({
                    name: player.full_name || 'Unknown Player',
                    details: `${player.position || 'N/A'} - ${player.team || 'FA'}`
                });
            }
        });
    }

    if (transaction.drops) {
        Object.keys(transaction.drops).forEach(playerId => {
            const player = allPlayers[playerId];
            if (player) {
                drops.push({
                    name: player.full_name || 'Unknown Player',
                    details: `${player.position || 'N/A'} - ${player.team || 'FA'}`
                });
            }
        });
    }

    return `
        <div class="transaction-team">
            <h4>
                ${avatarUrl ? `<img src="${avatarUrl}" alt="${teamName} Avatar" class="avatar">` : ''}
                ${teamName}
            </h4>
            ${adds.length > 0 ? `
                <ul class="transaction-players">
                    ${adds.map(player => `
                        <li class="added">
                            <div class="player-name">+ ${player.name}</div>
                            <div class="player-details">${player.details}</div>
                        </li>
                    `).join('')}
                </ul>
            ` : ''}
            ${drops.length > 0 ? `
                <ul class="transaction-players">
                    ${drops.map(player => `
                        <li class="dropped">
                            <div class="player-name">- ${player.name}</div>
                            <div class="player-details">${player.details}</div>
                        </li>
                    `).join('')}
                </ul>
            ` : ''}
        </div>
    `;
}

function renderDrop(transaction, usersMap, rostersByUserId, allPlayers) {
    return renderWaiverOrFreeAgent(transaction, usersMap, rostersByUserId, allPlayers);
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