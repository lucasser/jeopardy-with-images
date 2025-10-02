/* ────────────────────────────────────────────────────────────────
  Jeopardy — game logic
  Created:  2025-06-07

  Copyright (c) 2025 Eric Jones
  Licensed under the MIT License. See LICENSE.md for details.

  Purpose:  Builds a 5×5 Jeopardy board from a plain-text file,
			handles scoring, and persists state in localStorage.
──────────────────────────────────────────────────────────────── */

// Hide stats table and clear board title immediately when the DOM is ready
document.addEventListener('DOMContentLoaded', function () {
	setStatsVisibility(false);
	clearBoardTitle();

	// Check if there's a draft but no active game loaded
	const savedDraft = storage.load('jeopardyFormDraft');
	const savedBoard = loadBoardText();

	if (savedDraft && !savedBoard) {
		// Suggest opening the form to continue working on the draft
		const notificationDiv = document.createElement('div');
		notificationDiv.id = 'draft-notification';
		notificationDiv.className = 'draft-notification';
		notificationDiv.innerHTML = `
            <div>You have an unsaved game board draft.
            <button id="continue-draft-btn">Continue Editing</button>
            <button id="close-notification-btn" class="close-btn">&times;</button></div>
        `;
		document.body.insertBefore(notificationDiv, document.body.firstChild);

		// Set up click handler for the continue button
		document.getElementById('continue-draft-btn').addEventListener('click', function () {
			showCreateFormBtn.click();
			notificationDiv.remove();
		});

		// Set up click handler for the close button
		document.getElementById('close-notification-btn').addEventListener('click', function () {
			notificationDiv.remove();
		});
	}
});

// --- Utility Functions ---
// Generic localStorage helper
const storage = {
	save: (key, data) => localStorage.setItem(key, JSON.stringify(data)),
	load: (key, defaultValue = null) => {
		const saved = localStorage.getItem(key);
		return saved ? JSON.parse(saved) : defaultValue;
	},
	remove: (key) => localStorage.removeItem(key),
	clear: (...keys) => keys.forEach(key => localStorage.removeItem(key))
};

// Utility function to manage stats table visibility
function setStatsVisibility(visible) {
	const statsElement = document.getElementById('stats');
	if (statsElement) {
		statsElement.style.display = visible ? 'block' : 'none';
	}
}

// Board iteration helper
function forEachBoardCell(callback) {
	for (let row = 0; row < 5; row++) {
		for (let col = 0; col < 5; col++) {
			const cell = document.getElementById(`tq${row}${col}`);
			if (cell) callback(cell, row, col);
		}
	}
}

// --- Persistent Storage Helpers ---
function saveBoardState() {
	const used = [];
	forEachBoardCell((cell) => {
		if (cell.classList.contains('used')) {
			used.push(cell.id);
		}
	});
	storage.save('jeopardyUsedCells', used);
}

function loadBoardState() {
	const used = storage.load('jeopardyUsedCells', []);
	used.forEach(id => {
		const cell = document.getElementById(id);
		if (cell) cell.classList.add('used');
	});
}

function saveTeams() {
	storage.save('jeopardyTeams', teams);
}

function loadTeams() {
	teams = storage.load('jeopardyTeams', []);
	renderStats();
}

function saveBoardText(text) {
	storage.save('jeopardyBoard', text);
}

function loadBoardText() {
	return storage.load('jeopardyBoard');
}

function saveTitle(title) {
	storage.save('jeopardyTitle', title);
}

function loadTitle() {
	return storage.load('jeopardyTitle', '');
}

function clearAllStorage() {
	storage.clear('jeopardyBoard', 'jeopardyUsedCells', 'jeopardyTeams', 'jeopardyTitle');
}

// Clear the board title both in the UI and storage
function clearBoardTitle() {
	const boardTitleInput = document.getElementById('board-title');
	if (boardTitleInput && boardTitleInput.value) {
		console.log('Clearing board title value:', boardTitleInput.value);
		boardTitleInput.value = '';
	}
	saveTitle(''); // Also clear from storage
}

// Try to grab a Title: ... line from the uploaded file
function parseTitleFromText(text) {
	const match = text.match(/^[\s\t]*title\s*:(.*)$/im);
	return match ? match[1].trim() : '';
}

// --- File upload and board population ---
// File validation functions
function validateDraftFile(fileContent) {
	// Draft files should either start with [JEOPARDY DRAFT] or be incomplete games
	const lines = fileContent.split(/\r?\n/);

	// Check if it's explicitly marked as a draft
	if (lines[0] && lines[0].trim() === '[JEOPARDY DRAFT]') {
		return { isValid: true, type: 'draft' };
	}

	// Check if it looks like a complete game file (starts with Title:)
	if (lines[0] && lines[0].trim().toLowerCase().startsWith('title:')) {
		// Count categories and questions to see if it's complete
		let categoryCount = 0;
		let hasIncompleteCategory = false;
		let currentCategoryQuestions = 0;

		for (let line of lines) {
			line = line.trim();
			if (line.toLowerCase().startsWith('category:')) {
				if (categoryCount > 0 && currentCategoryQuestions < 5) {
					hasIncompleteCategory = true;
				}
				categoryCount++;
				currentCategoryQuestions = 0;
			} else if (/^\d+\|/.test(line)) {
				const parts = line.split('|');
				if (parts.length >= 3 && parts[1].trim() && parts[2].trim()) {
					currentCategoryQuestions++;
				}
			}
		}

		// Check last category
		if (currentCategoryQuestions < 5) {
			hasIncompleteCategory = true;
		}

		// Whether complete or incomplete, we'll allow it as a draft
		if (categoryCount < 5 || hasIncompleteCategory) {
			return { isValid: true, type: 'draft' };
		} else {
			// Complete games are now allowed as drafts
			return { isValid: true, type: 'draft' };
		}
	}

	// If it doesn't start with Title: or [JEOPARDY DRAFT], accept it as a potential draft
	return { isValid: true, type: 'draft' };
}

function validateGameFile(fileContent) {
	const lines = fileContent.split(/\r?\n/);

	// Check if it's marked as a draft first (before other format checks)
	if (lines.some(line => line.trim() === '[JEOPARDY DRAFT]')) {
		return { isValid: false, message: 'This appears to be a draft file. Please use the "Edit" button instead.' };
	}

	// Game files should start with "Title:" and be complete
	if (!lines[0] || !lines[0].trim().toLowerCase().startsWith('title:')) {
		return { isValid: false, message: 'This does not appear to be a valid game file. Game files should start with "Title: [name]".' };
	}

	// Count categories and questions to ensure completeness
	let categoryCount = 0;
	let hasIncompleteCategory = false;
	let currentCategoryQuestions = 0;

	for (let line of lines) {
		line = line.trim();
		if (line.toLowerCase().startsWith('category:')) {
			if (categoryCount > 0 && currentCategoryQuestions < 5) {
				hasIncompleteCategory = true;
			}
			categoryCount++;
			currentCategoryQuestions = 0;
		} else if (/^\d+\|/.test(line)) {
			const parts = line.split('|');
			if (parts.length >= 3 && parts[1].trim() && parts[2].trim()) {
				currentCategoryQuestions++;
			}
		}
	}

	// Check last category
	if (currentCategoryQuestions < 5) {
		hasIncompleteCategory = true;
	}

	if (categoryCount < 5) {
		return { isValid: false, message: 'This game file is incomplete. It should have 5 categories with 5 questions each. Please use the "Edit" button instead.' };
	}

	if (hasIncompleteCategory) {
		return { isValid: false, message: 'This game file has incomplete categories (missing questions/answers). Please use the "Edit" button instead.' };
	}

	return { isValid: true, type: 'complete' };
}

// When a draft file is uploaded, read it and handle appropriately
document.getElementById('jeopardy-draft-upload').addEventListener('change', function (e) {
	const file = e.target.files[0];
	if (!file) return;

	const reader = new FileReader();
	reader.onload = async function (evt) {
		const fileText = evt.target.result;
		const validation = validateDraftFile(fileText);

		if (!validation.isValid) {
			CustomDialog.error(validation.message);
			e.target.value = ''; // Clear the file input
			return;
		}

		// Check if it's a draft that should be imported to the form
		if (fileText.includes('[JEOPARDY DRAFT]')) {
			// Show the create form and import the draft
			document.getElementById('create-form').classList.remove('hide');
			document.getElementById('file-teams-setup').classList.add('hide');

			// Initialize the form first
			reinitializeForm();

			// Use the existing import functionality with a mock file object
			const mockFile = {
				name: file.name,
				size: file.size
			};

			// Create a new reader for the import function
			const importReader = new FileReader();
			importReader.onload = function (importEvt) {
				try {
					const fileContent = importEvt.target.result;

					// Parse the draft file content (same logic as importFormDraft)
					const lines = fileContent.split(/\r?\n/);
					let title = '';
					let teams = [];
					let categories = [];
					let currentCategory = null;
					let currentClues = [];

					for (let line of lines) {
						line = line.trim();
						if (!line || line === '[JEOPARDY DRAFT]') continue;

						if (line.toLowerCase().startsWith('title:')) {
							title = line.substring(6).trim();
						} else if (line.toLowerCase().startsWith('teams:')) {
							const teamNames = line.substring(6).trim();
							if (teamNames) {
								teams = teamNames.split(',').map(name => ({
									name: name.trim(),
									score: 0
								}));
							}
						} else if (line.toLowerCase().startsWith('created:')) {
							// Skip the created timestamp line from exported drafts
							continue;
						} else if (line.toLowerCase().startsWith('category:')) {
							// Save previous category if it exists
							if (currentCategory) {
								categories.push({
									name: currentCategory,
									clues: currentClues
								});
							}
							currentCategory = line.substring(9).trim();
							currentClues = [];
						} else if (/^\d+\|/.test(line)) {
							// Parse value|question|answer line
							const parts = line.split('|');
							if (parts.length >= 3) {
								currentClues.push({
									value: parts[0].trim(),
									question: parts[1].trim(),
									answer: parts.slice(2).join('|').trim()
								});
							}
						}
					}

					// Save last category
					if (currentCategory) {
						categories.push({
							name: currentCategory,
							clues: currentClues
						});
					}

					// If no teams were found in the file, add a default team
					if (teams.length === 0) {
						teams = [{ name: 'Team 1', score: 0 }];
					}

					// Apply the imported data to the form
					try {
						// Set title
						const titleInput = document.getElementById('board-title');
						if (titleInput) {
							titleInput.value = title || '';
							if (title) {
								titleInput.classList.add('has-content');
							} else {
								titleInput.classList.remove('has-content');
							}
						}

						// Clear and rebuild form
						const categoriesContainer = document.getElementById('categories-container');
						categoriesContainer.innerHTML = '';

						// Create 5 categories (pad with empty ones if needed)
						for (let i = 0; i < 5; i++) {
							addCategory();
						}

						// Populate categories with imported data
						const categorySections = document.querySelectorAll('.category-section');
						categories.forEach((category, index) => {
							if (index >= 5) return; // Only handle first 5 categories

							const catSection = categorySections[index];
							if (!catSection) return;

							// Set category name
							const catNameInput = catSection.querySelector('.category-name');
							if (catNameInput) {
								catNameInput.value = category.name || '';
								if (category.name) {
									catNameInput.classList.add('has-content');
								} else {
									catNameInput.classList.remove('has-content');
								}
							}

							// Set questions/answers
							const questionItems = catSection.querySelectorAll('.question-item');
							category.clues.forEach((clue, qIndex) => {
								if (qIndex >= questionItems.length) return;

								const qItem = questionItems[qIndex];
								const answerInput = qItem.querySelector('.question-answer');
								const questionInput = qItem.querySelector('.question-question');

								if (answerInput) {
									answerInput.value = clue.answer || '';
									if (clue.answer) {
										answerInput.classList.add('has-content');
									} else {
										answerInput.classList.remove('has-content');
									}
								}

								if (questionInput) {
									questionInput.value = clue.question || '';
									if (clue.question) {
										questionInput.classList.add('has-content');
									} else {
										questionInput.classList.remove('has-content');
									}
								}
							});
						});

						// Set teams
						formTeams = teams && teams.length > 0 ? [...teams] : [{ name: 'Team 1', score: 0 }];
						renderFormTeams();

						// Save as localStorage draft
						saveFormDraft();

						CustomDialog.success('Draft imported successfully!');

					} catch (error) {
						console.error('Error applying imported draft:', error);
						CustomDialog.error('Error applying imported draft to form.');
					}

				} catch (error) {
					console.error('Error importing draft:', error);
					CustomDialog.error('Error importing draft file. Please check the file format.');
				}
			};
			importReader.readAsText(file);

		} else {
			// For any game file (complete or incomplete), open it in the form for editing
			const parsedTitle = parseTitleFromText(fileText);
			const title = parsedTitle;

			// Show the create form and hide team setup
			document.getElementById('create-form').classList.remove('hide');
			document.getElementById('file-teams-setup').classList.add('hide');

			// Initialize the form first
			reinitializeForm();

			// Create a mock file object for import
			const mockFile = {
				name: file.name,
				size: file.size
			};

			// Create a new reader for parsing the game content
			const importReader = new FileReader();
			importReader.onload = function (importEvt) {
				try {
					const fileContent = importEvt.target.result;

					// Parse the game file content
					const lines = fileContent.split(/\r?\n/);
					let title = '';
					let teams = [];
					let categories = [];
					let currentCategory = null;
					let currentClues = [];

					for (let line of lines) {
						line = line.trim();
						if (!line) continue;

						if (line.toLowerCase().startsWith('title:')) {
							title = line.substring(6).trim();
						} else if (line.toLowerCase().startsWith('category:')) {
							// Save previous category if it exists
							if (currentCategory) {
								categories.push({
									name: currentCategory,
									clues: currentClues
								});
							}
							currentCategory = line.substring(9).trim();
							currentClues = [];
						} else if (/^\d+\|/.test(line)) {
							// Parse value|question|answer line
							const parts = line.split('|');
							if (parts.length >= 3) {
								currentClues.push({
									value: parts[0].trim(),
									question: parts[1].trim(),
									answer: parts.slice(2).join('|').trim()
								});
							}
						}
					}

					// Save last category
					if (currentCategory) {
						categories.push({
							name: currentCategory,
							clues: currentClues
						});
					}

					// Apply the imported data to the form
					try {
						// Set title
						const titleInput = document.getElementById('board-title');
						if (titleInput) {
							titleInput.value = title || '';
							if (title) {
								titleInput.classList.add('has-content');
							} else {
								titleInput.classList.remove('has-content');
							}
						}

						// Clear and rebuild form
						const categoriesContainer = document.getElementById('categories-container');
						categoriesContainer.innerHTML = '';

						// Create 5 categories (pad with empty ones if needed)
						for (let i = 0; i < 5; i++) {
							addCategory();
						}

						// Populate categories with imported data
						const categorySections = document.querySelectorAll('.category-section');
						categories.forEach((category, index) => {
							if (index >= 5) return; // Only handle first 5 categories

							const catSection = categorySections[index];
							if (!catSection) return;

							// Set category name
							const catNameInput = catSection.querySelector('.category-name');
							if (catNameInput) {
								catNameInput.value = category.name || '';
								if (category.name) {
									catNameInput.classList.add('has-content');
								} else {
									catNameInput.classList.remove('has-content');
								}
							}

							// Set questions/answers for this category
							const questionItems = catSection.querySelectorAll('.question-item');
							category.clues.forEach((clue, qIndex) => {
								if (qIndex >= 5) return; // Only handle first 5 questions

								const qItem = questionItems[qIndex];
								const questionInput = qItem.querySelector('.question-question');
								const answerInput = qItem.querySelector('.question-answer');

								if (questionInput) {
									questionInput.value = clue.question || '';
									if (clue.question) {
										questionInput.classList.add('has-content');
									} else {
										questionInput.classList.remove('has-content');
									}
								}

								if (answerInput) {
									answerInput.value = clue.answer || '';
									if (clue.answer) {
										answerInput.classList.add('has-content');
									} else {
										answerInput.classList.remove('has-content');
									}
								}
							});
						});

						// Save as localStorage draft
						saveFormDraft();

						CustomDialog.success('Game file imported for editing!');

					} catch (error) {
						console.error('Error applying game file to form:', error);
						CustomDialog.error('Error applying game file to form.');
					}

				} catch (error) {
					console.error('Error importing game file:', error);
					CustomDialog.error('Error importing game file. Please check the file format.');
				}
			};
			importReader.readAsText(file);
		}
	};
	reader.readAsText(file);

	// Clear the file input
	e.target.value = '';
});

// When a game file is uploaded, read it and handle appropriately
document.getElementById('jeopardy-game-upload').addEventListener('change', function (e) {
	const file = e.target.files[0];
	if (!file) return;

	const reader = new FileReader();
	reader.onload = function (evt) {
		const fileText = evt.target.result;
		const validation = validateGameFile(fileText);

		if (!validation.isValid) {
			CustomDialog.alert(validation.message);
			e.target.value = ''; // Clear the file input
			return;
		}

		// Parse title from file if present
		const parsedTitle = parseTitleFromText(fileText);
		const title = parsedTitle;
		saveTitle(title);
		saveBoardText(fileText);

		// Hide the create form if it's visible and show team setup
		document.getElementById('create-form').classList.add('hide');
		document.getElementById('file-teams-setup').classList.remove('hide');

		// Keep stats table hidden until a game board is actually loaded
		setStatsVisibility(false);

		// Save the file text for later use when continuing to the game
		window.uploadedFileText = fileText;
	};
	reader.readAsText(file);

	// Clear the file input
	e.target.value = '';
});

// Parse the uploaded text file and fill the board with categories, questions, and answers
function populateJeopardyBoardFromText(text) {
	// Generate the board structure first
	generateGameBoard();

	const lines = text.split(/\r?\n/);
	let categories = [];
	let questions = [];
	let currentCategory = null;
	let currentQuestions = [];
	for (let line of lines) {
		line = line.trim();
		if (!line) continue;
		// Detect new category
		if (line.toLowerCase().startsWith('category:')) {
			if (currentCategory) {
				categories.push(currentCategory);
				questions.push(currentQuestions);
			}
			currentCategory = line.substring(9).trim();
			currentQuestions = [];
		} else if (/^\d+\|/.test(line)) {
			// Parse value|clue|response line
			const parts = line.split('|');
			if (parts.length >= 3) {
				currentQuestions.push({
					value: parts[0].trim(),
					// File format is: value|clue|response
					// - question: the clue shown first to players
					// - answer: the correct response revealed with "Show Answer" (in question form)
					question: parts[1].trim(), // This is shown first (Jeopardy clue)
					answer: parts.slice(2).join('|').trim() // This is shown after "Show Answer"
				});
			}
		}
	}
	// Push last category/questions
	if (currentCategory) {
		categories.push(currentCategory);
		questions.push(currentQuestions);
	}
	// Populate category headers
	const ths = document.querySelectorAll('#game thead th');
	ths.forEach((th, i) => {
		if (categories[i]) th.textContent = categories[i];
	});
	// Populate each cell with value, question, and answer
	for (let col = 0; col < questions.length; col++) {
		for (let row = 0; row < questions[col].length; row++) {
			const q = questions[col][row];
			const cellId = `tq${row}${col}`;
			const qId = `q${row}${col}`;
			const aId = `aq${row}${col}`;
			const cell = document.getElementById(cellId);
			if (cell) {
				cell.querySelector('h3').textContent = q.value;
				cell.querySelector(`#${qId}`).textContent = q.question;
				cell.querySelector(`#${aId}`).textContent = q.answer;
			}
		}
	}
	document.getElementById('game').classList.remove('hide');
	addCellClickHandlers();
	document.getElementById('upload-controls').style.display = 'none';
	// Show the stats table when board is displayed
	setStatsVisibility(true);
	// Always show reset button container after board is loaded
	const resetContainer = document.getElementById('reset-board-container');
	if (resetContainer) resetContainer.style.display = 'block';
}

// Generate the game board HTML structure
function generateGameBoard() {
	const gameBody = document.getElementById('game-body');
	gameBody.innerHTML = '';

	for (let row = 0; row < 5; row++) {
		const tr = document.createElement('tr');
		for (let col = 0; col < 5; col++) {
			const value = (row + 1) * 100;
			const td = document.createElement('td');
			td.id = `tq${row}${col}`;
			td.innerHTML = `
        <h3>${value}</h3>
        <div class="hide">
            <div id="q${row}${col}"></div>
            <div id="aq${row}${col}"></div>
        </div>
        `;
			tr.appendChild(td);
		}
		gameBody.appendChild(tr);
	}
}

// On page load, try to restore from localStorage if possible
document.addEventListener('DOMContentLoaded', function () {
	// Ensure stats is hidden by default (only show when board is loaded)
	setStatsVisibility(false);

	const saved = loadBoardText();
	// Restore title
	let savedTitle = loadTitle();
	// If no savedTitle, try to parse from saved board text
	if (!savedTitle && saved) {
		savedTitle = parseTitleFromText(saved);
		if (savedTitle) saveTitle(savedTitle);
	}
	const titleElem = document.getElementById('title');
	if (savedTitle) {
		titleElem.textContent = savedTitle;
		titleElem.style.display = 'block';
	} else {
		titleElem.style.display = 'none';
	}
	if (saved) {
		populateJeopardyBoardFromText(saved);
		loadBoardState();
		// Always show reset button container after board is loaded
		const resetContainer = document.getElementById('reset-board-container');
		if (resetContainer) resetContainer.style.display = 'block';
		// Hide initial controls since we're loading from storage
		document.getElementById('upload-controls').style.display = 'none';
		// Show stats table when a saved board is loaded
		setStatsVisibility(true);
	} else {
		// Generate empty board structure even if no saved data
		generateGameBoard();
		// Initially only show the option buttons, not the create form
		createFormDiv.classList.add('hide');
	}
	loadTeams();
});

// Load saved teams or set up an empty array
let fileTeams = []; // Teams for the file upload flow

// --- Scoring Implementation ---
const stats = document.getElementById('stats');
const statsBody = document.getElementById('stats-body');

// Hide stats table initially (if no board is loaded)
if (document.getElementById('game').classList.contains('hide')) {
	setStatsVisibility(false);
}

// Add Team button removed from scoring table
let teams = [];

// Helper function to modify team score
function modifyTeamScore(teamIndex, points) {
	teams[teamIndex].score += points;
	renderStats();
}

// Render the team stats table
function renderStats() {
	statsBody.innerHTML = '';
	teams.forEach((team, idx) => {
		const row = document.createElement('tr');
		row.innerHTML = `
        <td><input type="text" value="${team.name}" class="team-name" data-idx="${idx}" style="width:100px;text-align:center;"></td>
        <td><span id="score-${idx}">${team.score}</span></td>
        <td><button class="add-points" data-idx="${idx}">+</button></td>
        <td><button class="subtract-points" data-idx="${idx}">-</button></td>
    `;
		statsBody.appendChild(row);
	});
	updatePromptTeamSelect();
	saveTeams();
}

// Add a new team (default name if not provided)
function addTeam(name = `Team ${teams.length + 1}`) {
	teams.push({ name, score: 0 });
	renderStats();
}

// Add team button handler removed from scoring table

// Handle add/subtract points button clicks in stats table
statsBody.onclick = function (e) {
	const idx = +e.target.getAttribute('data-idx');
	const pointValue = getCurrentCellValue();

	if (e.target.classList.contains('add-points')) {
		modifyTeamScore(idx, pointValue);
	} else if (e.target.classList.contains('subtract-points')) {
		modifyTeamScore(idx, -pointValue);
	}
};

// Handle team name edits
statsBody.oninput = function (e) {
	if (e.target.classList.contains('team-name')) {
		const idx = +e.target.getAttribute('data-idx');
		teams[idx].name = e.target.value;
		saveTeams();
	}
};

let lastCellValue = 0;
// Get the value of the last clicked cell (for scoring)
function getCurrentCellValue() {
	return lastCellValue;
}

// Add click handlers to all board cells
function addCellClickHandlers() {
	forEachBoardCell((cell, row, col) => {
		cell.onclick = function () {
			lastCellValue = parseInt(cell.querySelector('h3').textContent, 10) || 0;
			showPrompt(row, col, cell);
		};
	});
}

// --- Prompt Team Selector and Scoring ---
// Update the team selector dropdown in the prompt modal
function updatePromptTeamSelect() {
	const select = document.getElementById('prompt-team-select');
	select.innerHTML = '';
	teams.forEach((team, idx) => {
		const option = document.createElement('option');
		option.value = idx;
		option.textContent = team.name;
		select.appendChild(option);
	});
}

// Update team selector whenever teams change
renderStats = function () {
	statsBody.innerHTML = '';
	teams.forEach((team, idx) => {
		const row = document.createElement('tr');
		row.innerHTML = `
        <td><input type="text" value="${team.name}" class="team-name" data-idx="${idx}" style="width:100px;text-align:center;"></td>
        <td><span id="score-${idx}">${team.score}</span></td>
        <td><button class="add-points" data-idx="${idx}">+</button></td>
        <td><button class="subtract-points" data-idx="${idx}">-</button></td>
    `;
		statsBody.appendChild(row);
	});
	updatePromptTeamSelect();
	saveTeams();
};

// Helper to handle scoring from prompt modal
function handlePromptScoring(isAdd) {
	const idx = +document.getElementById('prompt-team-select').value;
	const points = isAdd ? getCurrentCellValue() : -getCurrentCellValue();
	modifyTeamScore(idx, points);
	closePromptAndFadeCell();
}

// Add points to selected team from prompt modal
const promptAddBtn = document.getElementById('prompt-add-points');
promptAddBtn.onclick = () => handlePromptScoring(true);

// Subtract points from selected team from prompt modal
const promptSubBtn = document.getElementById('prompt-subtract-points');
promptSubBtn.onclick = () => handlePromptScoring(false);
// Cancel button in prompt modal (do not fade cell)
const promptCancelBtn = document.getElementById('prompt-cancel');
promptCancelBtn.onclick = function () {
	document.getElementById('prompt').style.display = 'none';
	showPrompt.lastCell = null;
};
// Fade out cell and close prompt after scoring
function closePromptAndFadeCell() {
	document.getElementById('prompt').style.display = 'none';
	if (showPrompt.lastCell) {
		showPrompt.lastCell.classList.add('used');
		saveBoardState();
		showPrompt.lastCell = null;
	}
}
// Show the prompt modal for a cell (with question/answer)
function showPrompt(row, col, cellRef) {
	const q = document.getElementById(`q${row}${col}`).textContent;
	const a = document.getElementById(`aq${row}${col}`).textContent;

	document.getElementById('prompt-answer-img').classList.remove('toShow');
	document.getElementById('prompt-answer-text').classList.remove('toShow');

	document.getElementById('prompt-answer-img').style.display = 'none';
	document.getElementById('prompt-answer-text').style.display = 'none';
	document.getElementById('prompt-question-img').style.display = 'none';
	document.getElementById('prompt-question-text').style.display = 'none';

	document.getElementById('prompt-answer-img').src = '';
	document.getElementById('prompt-question-img').src = '';
	document.getElementById('prompt-answer-text').textContent = '';
	document.getElementById('prompt-question-text').textContent = '';

	document.getElementById('prompt').style.display = 'flex';

	showTextOrImg(q, false).style.display = 'block';
	showTextOrImg(a, true).classList.add('toShow');
	// Store the cell to fade out after closing
	showPrompt.lastCell = cellRef || document.getElementById(`tq${row}${col}`);
	updatePromptTeamSelect();
}

// If the string starts with <img>, show image instead of text. if ans is true, do for answer
function showTextOrImg(string, ans) {
	if (ans) {
		img = document.getElementById('prompt-answer-img');
		text = document.getElementById('prompt-answer-text');
		imgpath = 'images/answers/';
	} else {
		img = document.getElementById('prompt-question-img');
		text = document.getElementById('prompt-question-text');
		imgpath = 'images/questions/';
	}

	console.log('showTextOrImg input:', string.substring(0, 5));

	if (string.substring(0, 5) === "<img>") {
		img.src = imgpath + string.substring(5).trim() + ".png";
		return img;
	} else {
		text.textContent = string;
		return text;
	}
}

// Show the answer in the prompt modal
document.getElementById('show-answer').onclick = function () {
	document.getElementsByClassName('toShow')[0].style.display = 'block';
};

// On reset, clear all storage and reload the page
document.getElementById('reset-board').onclick = function () {
	document.getElementById('upload-controls').style.display = '';
	// Hide create form and team setup
	createFormDiv.classList.add('hide');
	document.getElementById('file-teams-setup').classList.add('hide');

	const resetContainer = document.getElementById('reset-board-container');
	if (resetContainer) resetContainer.style.display = 'none';

	// Hide stats table on reset
	setStatsVisibility(false);

	// Remove the title from localStorage so it doesn't reappear after reload
	localStorage.removeItem('jeopardyTitle');
	localStorage.removeItem('jeopardyFormDraft');  // Clear any saved draft
	document.getElementById('title').style.display = 'none';
	clearAllStorage();

	// Clear any existing categories in the form
	categoriesContainer.innerHTML = '';

	location.reload();
};

// File teams functionality
document.getElementById('file-add-team').addEventListener('click', function () {
	const teamName = `Team ${fileTeams.length + 1}`;
	fileTeams.push({ name: teamName, score: 0 });
	renderFileTeams();
});

// Render the teams in the file teams container
function renderFileTeams() {
	const container = document.getElementById('file-teams-container');
	container.innerHTML = '';

	fileTeams.forEach((team, index) => {
		const teamDiv = document.createElement('div');
		teamDiv.className = 'team-entry';

		const nameInput = document.createElement('input');
		nameInput.type = 'text';
		nameInput.value = team.name;
		nameInput.placeholder = 'Team Name';
		nameInput.addEventListener('change', function () {
			fileTeams[index].name = this.value;
		});

		const removeBtn = document.createElement('button');
		removeBtn.textContent = 'Remove';
		removeBtn.className = 'remove-team';
		removeBtn.addEventListener('click', function () {
			fileTeams.splice(index, 1);
			renderFileTeams();
		});

		teamDiv.appendChild(nameInput);
		teamDiv.appendChild(removeBtn);
		container.appendChild(teamDiv);
	});
}

// Continue to game after setting up teams
document.getElementById('file-teams-continue').addEventListener('click', function () {
	// Make sure there's at least one team
	if (fileTeams.length === 0) {
		CustomDialog.error('Please add at least one team before continuing.');
		return;
	}

	// Update the global teams variable
	teams = fileTeams.map(team => ({ ...team }));
	saveTeams();

	// Now process the board with the saved file text
	const fileText = window.uploadedFileText;
	populateJeopardyBoardFromText(fileText);

	// Set and show the title
	const title = loadTitle();
	const titleElem = document.getElementById('title');
	titleElem.textContent = title;
	titleElem.style.display = title ? 'block' : 'none';

	// Clear used cells for new game
	forEachBoardCell((cell) => cell.classList.remove('used'));
	saveBoardState();

	// Hide upload controls and team setup
	document.getElementById('upload-controls').style.display = 'none';
	document.getElementById('file-teams-setup').classList.add('hide');

	// Show stats table with the new teams
	renderStats();
	setStatsVisibility(true);
});

// Initialize file teams when needed
function initializeFileTeams() {
	if (fileTeams.length === 0) {
		fileTeams.push({ name: 'Team 1', score: 0 });
		renderFileTeams();
	}
}

// --- Board Creation Form Functionality ---
// Initialize form elements
const showUploadBtn = document.getElementById('show-upload');
const showCreateFormBtn = document.getElementById('show-create-form');
const loadGameFileBtn = document.getElementById('load-game-file');
const createFormDiv = document.getElementById('create-form');
const generateBoardBtn = document.getElementById('generate-board');
const generateDownloadBtn = document.getElementById('generate-download');
const categoriesContainer = document.getElementById('categories-container');

// Default values for new categories and questions
const DEFAULT_CATEGORY = "New Category";
const DEFAULT_VALUES = [100, 200, 300, 400, 500];
const DEFAULT_QUESTIONS = Array(5).fill().map(() => ({ value: "", question: "", answer: "" }));

// Trigger the file dialog when Load Draft File button is clicked
showUploadBtn.addEventListener('click', function () {
	// Initialize file teams for the team setup screen
	fileTeams = [];
	initializeFileTeams();

	// Remove draft notification if present
	const draftNotification = document.getElementById('draft-notification');
	if (draftNotification) {
		draftNotification.remove();
	}

	// Programmatically click the draft file input to open file dialog
	document.getElementById('jeopardy-draft-upload').click();
});

// Trigger the file dialog when Load Game File button is clicked
loadGameFileBtn.addEventListener('click', function () {
	// Initialize file teams for the team setup screen
	fileTeams = [];
	initializeFileTeams();

	// Remove draft notification if present
	const draftNotification = document.getElementById('draft-notification');
	if (draftNotification) {
		draftNotification.remove();
	}

	// Programmatically click the game file input to open file dialog
	document.getElementById('jeopardy-game-upload').click();
});

// Show create form option
showCreateFormBtn.addEventListener('click', function () {
	createFormDiv.classList.remove('hide');

	// Hide the file teams setup if it's visible
	document.getElementById('file-teams-setup').classList.add('hide');

	// Hide stats table when form is shown
	setStatsVisibility(false);

	// Add input listener to title field for auto-saving
	const titleField = document.getElementById('board-title');
	if (titleField) {
		titleField.addEventListener('input', function () {
			// Save form state to draft
			const formData = gatherFormData();
			storage.save('jeopardyFormDraft', formData);
		});
	}

	// Remove the draft notification banner if it exists
	const draftNotification = document.getElementById('draft-notification');
	if (draftNotification) {
		draftNotification.remove();
	}

	try {
		// Check if there's a saved draft
		const savedDraft = storage.load('jeopardyFormDraft');

		if (savedDraft) {
			// Ask user if they want to restore their draft
			CustomDialog.confirm('We found a saved draft of your game board. Would you like to restore it?', 'Restore Draft?').then(restoreDraft => {
				if (restoreDraft) {
					// Initialize a clean form first to ensure proper structure
					reinitializeForm();

					// Then try to load the draft data
					if (!loadFormDraft()) {
						// If loading failed, we already have a clean form from reinitializeForm
						console.error("Failed to load draft, using clean form instead");
						CustomDialog.error("There was an issue loading your draft. Starting with a fresh form.");
						discardFormDraft(); // Clear the problematic draft
					}
				} else {
					// User doesn't want to restore, proceed with a new form
					// Clear the draft from storage
					discardFormDraft();

					// Create a fresh form
					reinitializeForm();
				}
			});
		} else {
			// No draft found, set up a new form
			reinitializeForm();
		}
	} catch (error) {
		// If anything goes wrong, create a fresh form
		console.error("Error handling create form:", error);
		reinitializeForm();
	}

	// Set up draft management functionality regardless of path taken
	setupDraftEventListeners();
	updateLastSavedDisplay();

	// Clear any previous validation errors
	document.getElementById('validation-message').style.display = 'none';
	document.querySelectorAll('.validation-error').forEach(field => {
		field.classList.remove('validation-error');
	});
});

// Add a new category to the form
function addCategory() {
	const categoryIndex = document.querySelectorAll('.category-section').length;

	// Only allow up to 5 categories (5x5 game board)
	if (categoryIndex >= 5) return;

	// Create category container
	const categorySection = document.createElement('div');
	categorySection.className = 'category-section';
	categorySection.dataset.index = categoryIndex;

	// Create category header with name input
	const categoryHeader = document.createElement('div');
	categoryHeader.className = 'category-header';

	// Create label element safely
	const label = document.createElement('label');
	label.setAttribute('for', `category-${categoryIndex}`);
	label.textContent = `Category ${categoryIndex + 1}:`;
	categoryHeader.appendChild(label);

	// Create input element safely
	const input = document.createElement('input');
	input.type = 'text';
	input.id = `category-${categoryIndex}`;
	input.placeholder = 'Enter category name';
	input.className = 'category-name required-field';
	input.required = true;
	categoryHeader.appendChild(input);

	// Create questions container
	const questionsContainer = document.createElement('div');
	questionsContainer.className = 'questions-container';

	// Add question inputs for this category
	DEFAULT_VALUES.forEach((value, qIndex) => {
		const questionItem = document.createElement('div');
		questionItem.className = 'question-item';

		// Create value display
		const valueDiv = document.createElement('div');
		valueDiv.className = 'question-value';
		valueDiv.textContent = value;
		questionItem.appendChild(valueDiv);

		// Create question input (what's shown to players first)
		const questionInput = document.createElement('input');
		questionInput.type = 'text';
		questionInput.className = 'question-question required-field';
		questionInput.placeholder = 'Clue (shown to players first)';
		questionInput.setAttribute('data-value', value);
		questionInput.required = true;
		questionItem.appendChild(questionInput);

		// Create answer input (what's shown after clicking "Show Answer")
		const answerInput = document.createElement('input');
		answerInput.type = 'text';
		answerInput.className = 'question-answer required-field';
		answerInput.placeholder = 'Correct Response (in question form)';
		answerInput.setAttribute('data-value', value);
		answerInput.required = true;
		questionItem.appendChild(answerInput);

		questionsContainer.appendChild(questionItem);
	});

	// Assemble and add to form
	categorySection.appendChild(categoryHeader);
	categorySection.appendChild(questionsContainer);
	categoriesContainer.appendChild(categorySection);

	// Add validation listeners to the new fields
	categorySection.querySelectorAll('.required-field').forEach(field => {
		// Initialize validation styling
		if (field.value.trim() !== '') {
			field.classList.add('has-content');
			field.classList.remove('validation-error');
		} else {
			field.classList.remove('has-content');
			// Don't add validation-error on initial creation
		}

		// Add input listener to save draft on changes
		field.addEventListener('input', function () {
			// Save form state to draft
			const formData = gatherFormData();
			storage.save('jeopardyFormDraft', formData);
		});
	});
}

// No longer using addCategoryBtn

// Function to create a game board from form data
function createBoardFromForm(shouldDownload) {
	const boardTitle = document.getElementById('board-title').value.trim();

	// Validate board title
	if (!boardTitle) {
		CustomDialog.alert("Please enter a game title.");
		document.getElementById('board-title').focus();
		return null;
	}

	const categories = [];
	const allQuestions = [];
	let hasEmptyFields = false;
	let firstEmptyField = null;

	// Check if we have exactly 5 categories
	const categoryCount = document.querySelectorAll('.category-section').length;
	if (categoryCount < 5) {
		CustomDialog.alert("Please create all 5 categories for a complete game board.");
		return null;
	}

	// Collect all category data
	document.querySelectorAll('.category-section').forEach((catSection, catIndex) => {
		if (catIndex >= 5) return; // Only use first 5 categories

		const categoryNameInput = catSection.querySelector('.category-name');
		const categoryName = categoryNameInput.value.trim();

		// Validate category name
		if (!categoryName) {
			hasEmptyFields = true;
			if (!firstEmptyField) firstEmptyField = categoryNameInput;
			return;
		}

		categories.push(categoryName);

		const categoryQuestions = [];
		catSection.querySelectorAll('.question-item').forEach((qItem, qIndex) => {
			const value = qItem.querySelector('.question-value').textContent;
			const answerInput = qItem.querySelector('.question-answer');
			const questionInput = qItem.querySelector('.question-question');
			const answer = answerInput.value.trim();
			const question = questionInput.value.trim();

			// Validate answer and question
			if (!answer) {
				hasEmptyFields = true;
				if (!firstEmptyField) firstEmptyField = answerInput;
			}

			if (!question) {
				hasEmptyFields = true;
				if (!firstEmptyField) firstEmptyField = questionInput;
			}

			// Only add to categoryQuestions if this specific item has both answer and question
			// This is a defense in case the validation somehow continues despite empty fields
			if (answer && question) {
				categoryQuestions.push({
					value: value,
					answer: answer,
					question: question
				});
			}
		});

		// Make sure this category has all 5 questions complete
		if (categoryQuestions.length < 5) {
			hasEmptyFields = true;
		}

		allQuestions.push(categoryQuestions);
	});

	// Check for empty fields
	if (hasEmptyFields) {
		const validationMessage = document.getElementById('validation-message');
		validationMessage.textContent = "Please fill out all required fields";
		validationMessage.style.display = 'block';

		// Highlight all empty fields
		document.querySelectorAll('.required-field').forEach(field => {
			if (!field.value.trim()) {
				field.classList.add('validation-error');
				field.classList.remove('has-content');
			} else {
				field.classList.remove('validation-error');
				field.classList.add('has-content');
			}
		});

		// Focus on the first empty field
		if (firstEmptyField) firstEmptyField.focus();
		return null;
	}

	// Clear any validation errors if all fields are filled
	document.getElementById('validation-message').style.display = 'none';
	document.querySelectorAll('.validation-error').forEach(field => {
		field.classList.remove('validation-error');
	});

	// Check that we have exactly 5 categories and all questions
	if (categories.length !== 5 || allQuestions.some(categoryQ => categoryQ.length !== 5)) {
		CustomDialog.alert("Cannot create game board: Missing categories or questions");
		return null;
	}

	// All validation passed, generate text representation of board
	let boardText = `Title: ${boardTitle}\n\n`;

	categories.forEach((category, catIndex) => {
		boardText += `Category: ${category}\n`;

		allQuestions[catIndex].forEach(q => {
			boardText += `${q.value}|${q.question}|${q.answer}\n`;
		});

		boardText += '\n';
	});

	// Save board to localStorage
	saveTitle(boardTitle);
	saveBoardText(boardText);

	// Clear the form draft since we've successfully created a board
	discardFormDraft();

	// Create game board
	populateJeopardyBoardFromText(boardText);

	// Hide form
	document.getElementById('upload-controls').style.display = 'none';

	// Show reset button
	const resetContainer = document.getElementById('reset-board-container');
	if (resetContainer) resetContainer.style.display = 'block';

	// Set and show title
	const titleElem = document.getElementById('title');
	titleElem.textContent = boardTitle;

	// Transfer teams from form to game
	if (formTeams.length > 0) {
		teams = [...formTeams]; // Copy teams from form
		formTeams = []; // Clear form teams
		renderStats(); // Update the stats display
	} else {
		// If no teams were added in the form, add a default team
		if (teams.length === 0) {
			addTeam();
		}
	}
	titleElem.style.display = 'block';

	// Scroll to the top of the page
	window.scrollTo({
		top: 0,
		behavior: 'smooth'
	});

	// Return the board text and title for potential download
	return {
		text: boardText,
		title: boardTitle
	};
}

// Pre-validate form fields before submission
function validateFormBeforeSubmission() {
	let hasEmptyFields = false;
	let firstEmptyField = null;

	// Check all required fields
	document.querySelectorAll('.required-field').forEach(field => {
		if (!field.value.trim()) {
			hasEmptyFields = true;
			field.classList.add('validation-error');
			field.classList.remove('has-content');

			if (!firstEmptyField) {
				firstEmptyField = field;
			}
		}
	});

	if (hasEmptyFields) {
		// Show validation message
		const validationMessage = document.getElementById('validation-message');
		validationMessage.textContent = "Please fill out all required fields";
		validationMessage.style.display = 'block';

		// Focus on the first empty field
		if (firstEmptyField) {
			firstEmptyField.focus();
		}

		return false;
	}

	return true;
}

// Generate jeopardy board from form data (without download)
generateBoardBtn.addEventListener('click', function () {
	// Validate form first, then show confirmation modal
	if (validateFormBeforeSubmission()) {
		showConfirmationModal();
	}
});

// Confirmation modal functionality
function showConfirmationModal() {
	const modal = document.getElementById('confirmation-modal');
	modal.style.display = 'flex';

	// Set up event listeners for the modal buttons
	document.getElementById('confirm-create-board').onclick = function () {
		modal.style.display = 'none';
		createBoardFromForm(false);
	};

	document.getElementById('cancel-create-board').onclick = function () {
		modal.style.display = 'none';
	};

	// Allow clicking outside the modal to close it (clicking on the modal background)
	modal.onclick = function (e) {
		if (e.target === modal) {
			modal.style.display = 'none';
		}
	};
}

// Save form data as either a game file or draft file
generateDownloadBtn.addEventListener('click', function () {
	const boardTitle = document.getElementById('board-title').value.trim();
	const formData = gatherFormData();
	const isComplete = isFormComplete(formData);
	const defaultName = boardTitle.replace(/\s+/g, '-').toLowerCase() || 'jeopardy';

	let content, filename;

	if (isComplete && validateFormBeforeSubmission()) {
		// Save as complete game file
		content = createBoardTextFromForm();
		filename = `${defaultName}.txt`;
	} else {
		// Save as draft file
		content = createDraftFromForm(formData);
		filename = `${defaultName}-draft.txt`;
	}

	if (content) {
		downloadBoardFile(content, filename);
	}
});

// Create board text without generating the visual board
function createBoardTextFromForm() {
	const boardTitle = document.getElementById('board-title').value.trim();

	// Validate board title
	if (!boardTitle) {
		CustomDialog.alert("Please enter a game title.");
		document.getElementById('board-title').focus();
		return null;
	}

	const categories = [];
	const allQuestions = [];
	let hasEmptyFields = false;

	// Check if we have exactly 5 categories
	const categoryCount = document.querySelectorAll('.category-section').length;
	if (categoryCount < 5) {
		CustomDialog.alert("Please create all 5 categories for a complete game board.");
		return null;
	}

	// Collect all category data
	document.querySelectorAll('.category-section').forEach((catSection, catIndex) => {
		if (catIndex >= 5) return; // Only use first 5 categories

		const categoryNameInput = catSection.querySelector('.category-name');
		const categoryName = categoryNameInput.value.trim();

		// Validate category name
		if (!categoryName) {
			hasEmptyFields = true;
			return;
		}

		categories.push(categoryName);

		const categoryQuestions = [];
		catSection.querySelectorAll('.question-item').forEach((qItem, qIndex) => {
			const value = qItem.querySelector('.question-value').textContent;
			const answerInput = qItem.querySelector('.question-answer');
			const questionInput = qItem.querySelector('.question-question');
			const answer = answerInput.value.trim();
			const question = questionInput.value.trim();

			// Validate answer and question
			if (!answer || !question) {
				hasEmptyFields = true;
				return;
			}

			categoryQuestions.push({
				value: value,
				answer: answer,
				question: question
			});
		});

		// Make sure this category has all 5 questions complete
		if (categoryQuestions.length < 5) {
			hasEmptyFields = true;
		}

		allQuestions.push(categoryQuestions);
	});

	// Check for empty fields
	if (hasEmptyFields) {
		CustomDialog.alert("Cannot create complete game file: Some fields are empty. Use the form validation to see which fields need to be filled.");
		return null;
	}

	// Check that we have exactly 5 categories and all questions
	if (categories.length !== 5 || allQuestions.some(categoryQ => categoryQ.length !== 5)) {
		CustomDialog.alert("Cannot create game board: Missing categories or questions");
		return null;
	}

	// All validation passed, generate text representation of board
	let boardText = `Title: ${boardTitle}\n\n`;

	categories.forEach((category, catIndex) => {
		boardText += `Category: ${category}\n`;

		allQuestions[catIndex].forEach(q => {
			boardText += `${q.value}|${q.question}|${q.answer}\n`;
		});

		boardText += '\n';
	});

	return boardText;
}

// Helper function to gather all form data
function gatherFormData() {
	const boardTitle = document.getElementById('board-title').value.trim();
	const categories = [];

	document.querySelectorAll('.category-section').forEach((catSection, catIndex) => {
		const categoryNameInput = catSection.querySelector('.category-name');
		const categoryName = categoryNameInput ? categoryNameInput.value.trim() : '';
		const clues = [];

		catSection.querySelectorAll('.question-item').forEach((qItem) => {
			const valueElement = qItem.querySelector('.question-value');
			const answerInput = qItem.querySelector('.question-answer');
			const questionInput = qItem.querySelector('.question-question');

			const value = valueElement ? valueElement.textContent : '';
			const answer = answerInput ? answerInput.value : '';
			const question = questionInput ? questionInput.value : '';

			clues.push({
				value,
				answer,
				question
			});
		});

		categories.push({
			name: categoryName,
			clues: clues
		});
	});

	return {
		title: boardTitle,
		categories: categories,
		teams: formTeams || []
	};
}

// Helper function to check if form is complete
function isFormComplete(formData) {
	// Check if title exists
	if (!formData.title) return false;

	// Check if we have 5 categories
	if (formData.categories.length < 5) return false;

	// Check if all categories have names and 5 complete questions
	for (let category of formData.categories) {
		if (!category.name) return false;

		if (category.clues.length < 5) return false;

		for (let clue of category.clues) {
			if (!clue.answer || !clue.question) return false;
		}
	}

	return true;
}

// Helper function to create draft file content
function createDraftFromForm(formData) {
	let draftContent = `[JEOPARDY DRAFT]\n`;
	draftContent += `Title: ${formData.title}\n`;
	draftContent += `Created: ${new Date().toISOString()}\n`;
	draftContent += `Teams: ${formData.teams.map(t => t.name).join(', ')}\n\n`;

	// Add categories and clues
	formData.categories.forEach((category) => {
		draftContent += `Category: ${category.name}\n`;
		category.clues.forEach(clue => {
			draftContent += `${clue.value}|${clue.question}|${clue.answer}\n`;
		});
		draftContent += '\n';
	});

	return draftContent;
}

// Download generated board as a text file
function downloadBoardFile(content, filename) {
	const element = document.createElement('a');
	element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
	element.setAttribute('download', filename);
	element.style.display = 'none';
	document.body.appendChild(element);
	element.click();
	document.body.removeChild(element);
}

// Add input event listeners to clear validation styling
function addValidationListeners() {
	document.querySelectorAll('.required-field').forEach(field => {
		// Initially check if field has content and apply styling
		if (field.value.trim() !== '') {
			field.classList.add('has-content');
			field.classList.remove('validation-error');
		} else {
			field.classList.remove('has-content');
			// We'll only add validation-error when field is modified and becomes empty
			// This prevents showing error styling on initial load
		}

		// Add event listener for input changes
		field.addEventListener('input', function () {
			if (this.value.trim() !== '') {
				this.classList.remove('validation-error');
				this.classList.add('has-content');

				// Hide validation message if all fields are filled
				const emptyFields = Array.from(document.querySelectorAll('.required-field')).filter(f => !f.value.trim());
				if (emptyFields.length === 0) {
					document.getElementById('validation-message').style.display = 'none';
				}
			} else {
				// If field is emptied, remove has-content class and mark as invalid
				this.classList.remove('has-content');
				this.classList.add('validation-error');

				// Show validation message when fields are emptied
				document.getElementById('validation-message').textContent = "Please fill out all required fields";
				document.getElementById('validation-message').style.display = 'block';
			}
		});

		// Also add blur (focus lost) event to catch when users tab away from fields
		field.addEventListener('blur', function () {
			if (this.value.trim() === '') {
				this.classList.remove('has-content');
				this.classList.add('validation-error');

				// Show validation message
				document.getElementById('validation-message').textContent = "Please fill out all required fields";
				document.getElementById('validation-message').style.display = 'block';
			}
		});
	});
}

// --- Team Management in Create Form ---
const formTeamsContainer = document.getElementById('form-teams-container');
const formAddTeamBtn = document.getElementById('form-add-team');

// Initialize form teams array
let formTeams = [];

// Add a new team to the form
function addFormTeam(name = `Team ${formTeams.length + 1}`) {
	formTeams.push({ name, score: 0 });
	renderFormTeams();
}

// Render teams in the form
function renderFormTeams() {
	if (!formTeamsContainer) return;

	formTeamsContainer.innerHTML = '';

	if (formTeams.length === 0) {
		const noTeamsMsg = document.createElement('p');
		noTeamsMsg.textContent = 'No teams added yet. Click "Add Team" to create teams.';
		noTeamsMsg.style.fontStyle = 'italic';
		noTeamsMsg.style.color = '#666';
		formTeamsContainer.appendChild(noTeamsMsg);
		return;
	}

	formTeams.forEach((team, idx) => {
		const teamRow = document.createElement('div');
		teamRow.className = 'team-item';
		teamRow.innerHTML = `
            <input type="text" value="${team.name}" class="form-team-name" data-idx="${idx}" placeholder="Team name">
            <button class="remove-team" data-idx="${idx}">Remove</button>
        `;
		formTeamsContainer.appendChild(teamRow);
	});
}

// Add team button handler for form
if (formAddTeamBtn) {
	formAddTeamBtn.onclick = () => addFormTeam();
}

// Handle team removal and name changes in form
if (formTeamsContainer) {
	formTeamsContainer.addEventListener('click', function (e) {
		if (e.target.classList.contains('remove-team')) {
			const idx = +e.target.getAttribute('data-idx');
			formTeams.splice(idx, 1);
			renderFormTeams();
		}
	});

	formTeamsContainer.addEventListener('input', function (e) {
		if (e.target.classList.contains('form-team-name')) {
			const idx = +e.target.getAttribute('data-idx');
			formTeams[idx].name = e.target.value;
		}
	});
}

// --- Form Draft Functionality ---
// Save the current state of the form to localStorage
function saveFormDraft() {
	try {
		const boardTitle = document.getElementById('board-title');
		const formData = {
			title: boardTitle ? boardTitle.value : '',
			categories: [],
			teams: formTeams || [],
			lastModified: new Date().toISOString()
		};

		// Verify categories container exists
		if (!categoriesContainer) {
			console.error('Categories container not found, cannot save draft');
			return false;
		}

		// Gather all category data
		document.querySelectorAll('.category-section').forEach((catSection) => {
			const categoryNameInput = catSection.querySelector('.category-name');
			const categoryName = categoryNameInput ? categoryNameInput.value : '';
			const clues = [];

			// Gather all questions for this category
			catSection.querySelectorAll('.question-item').forEach((qItem) => {
				const valueElement = qItem.querySelector('.question-value');
				const answerInput = qItem.querySelector('.question-answer');
				const questionInput = qItem.querySelector('.question-question');

				const value = valueElement ? valueElement.textContent : '';
				const answer = answerInput ? answerInput.value : '';
				const question = questionInput ? questionInput.value : '';

				clues.push({
					value,
					answer,
					question
				});
			});

			formData.categories.push({
				name: categoryName,
				clues: clues
			});
		});

		// Make sure we have the right number of categories
		if (formData.categories.length === 0) {
			console.warn('No categories found when saving draft');
		}

		// Save to localStorage
		storage.save('jeopardyFormDraft', formData);

		// Update last saved timestamp display
		updateLastSavedDisplay();
		return true;
	} catch (error) {
		console.error('Error saving form draft:', error);
		return false;
	}
}

// Load form draft from localStorage
function loadFormDraft() {
	const savedDraft = storage.load('jeopardyFormDraft');
	if (!savedDraft) return false;

	// Set title
	if (savedDraft.title) {
		document.getElementById('board-title').value = savedDraft.title;
		// Mark as having content for validation
		document.getElementById('board-title').classList.add('has-content');
	}

	// Clear existing categories
	categoriesContainer.innerHTML = '';

	try {
		// Basic safety check
		if (!categoriesContainer) {
			console.error("Categories container not found");
			return false;
		}

		// Make sure we have the right number of categories (5)
		const categoryCount = savedDraft.categories ? Math.min(savedDraft.categories.length, 5) : 0;
		const categoriesToCreate = Math.max(5 - categoryCount, 0);

		// First create empty categories to ensure proper structure
		for (let i = 0; i < 5; i++) {
			addCategory();
		}

		// Then populate with saved data
		if (savedDraft.categories && savedDraft.categories.length > 0) {
			// Get all created category sections
			const categorySections = document.querySelectorAll('.category-section');
			if (categorySections.length !== 5) {
				console.error(`Expected 5 categories, but found ${categorySections.length}`);
			}

			// Update each category with saved data
			savedDraft.categories.forEach((category, index) => {
				if (index >= 5) return; // Only handle the first 5 categories

				const catSection = categorySections[index];
				if (!catSection) {
					console.error(`Category section ${index} not found`);
					return;
				}

				// Set category name
				const catNameInput = catSection.querySelector('.category-name');
				if (catNameInput) {
					catNameInput.value = category.name || '';
					if (category.name) {
						catNameInput.classList.add('has-content');
					}
				} else {
					console.error(`Category ${index} name input not found`);
				}

				// Set question/answer values
				const questionItems = catSection.querySelectorAll('.question-item');
				if (category.clues) {
					category.clues.forEach((clue, qIndex) => {
						if (qIndex >= questionItems.length) return;

						const qItem = questionItems[qIndex];
						const answerInput = qItem.querySelector('.question-answer');
						const questionInput = qItem.querySelector('.question-question');

						if (answerInput) {
							answerInput.value = clue.answer || '';
							if (clue.answer) answerInput.classList.add('has-content');
						}

						if (questionInput) {
							questionInput.value = clue.question || '';
							if (clue.question) questionInput.classList.add('has-content');
						}
					});
				}
			});
		}

		// Apply validation styling to all fields
		document.querySelectorAll('.required-field').forEach(field => {
			if (field.value.trim() !== '') {
				field.classList.add('has-content');
				field.classList.remove('validation-error');
			} else {
				field.classList.remove('has-content');
				field.classList.add('validation-error');
			}
		});

		// Log form structure for debugging
		console.log('Form restored from draft');
		debugFormStructure();
	} catch (error) {
		console.error('Error loading form draft:', error);

		// Emergency reset of form
		reinitializeForm();
		return false;
	}

	// Load teams if any
	if (savedDraft.teams && savedDraft.teams.length > 0) {
		formTeams = [...savedDraft.teams];
		renderFormTeams();
	} else {
		// Ensure at least one default team
		if (formTeams.length === 0) {
			addFormTeam();
		}
	}

	// Update last saved display
	updateLastSavedDisplay();

	return true;
}

// Function to completely reinitialize the form when there are issues
function reinitializeForm() {
	console.log("Reinitializing form due to structure issues");

	// Clear the entire form
	categoriesContainer.innerHTML = '';

	// Add 5 fresh categories
	for (let i = 0; i < 5; i++) {
		addCategory();
	}

	// Reset teams
	formTeams = [];
	addFormTeam();
	renderFormTeams();

	// Clear title
	const titleInput = document.getElementById('board-title');
	if (titleInput) {
		titleInput.value = '';
		titleInput.classList.remove('has-content');
	}

	// Re-add validation listeners
	addValidationListeners();

	// Hide validation messages
	const validationMessage = document.getElementById('validation-message');
	if (validationMessage) {
		validationMessage.style.display = 'none';
	}
}

// Discard the form draft
function discardFormDraft() {
	storage.remove('jeopardyFormDraft');
	updateLastSavedDisplay();
}

// Update the display showing when the form was last saved
// Manual saves occur when the user clicks the "Save Now" button
// Timestamp includes seconds to provide more precise save time feedback
function updateLastSavedDisplay() {
	const savedDraft = storage.load('jeopardyFormDraft');
	const lastSavedDisplay = document.getElementById('last-saved-display');

	if (!lastSavedDisplay) return;

	if (savedDraft && savedDraft.lastModified) {
		const date = new Date(savedDraft.lastModified);

		// Format date in the style: M/D/YYYY, h:MM:SS AM/PM
		const month = date.getMonth() + 1; // getMonth() is 0-indexed
		const day = date.getDate();
		const year = date.getFullYear();

		let hours = date.getHours();
		const minutes = date.getMinutes().toString().padStart(2, '0');
		const seconds = date.getSeconds().toString().padStart(2, '0');
		const ampm = hours >= 12 ? 'PM' : 'AM';
		hours = hours % 12;
		hours = hours ? hours : 12; // Convert 0 to 12 for 12 AM

		const formattedDate = `${month}/${day}/${year}, ${hours}:${minutes}:${seconds} ${ampm}`;

		lastSavedDisplay.textContent = `Last saved: ${formattedDate}`;
		lastSavedDisplay.style.display = 'block';

		// Show discard button when we have a saved draft
		const discardBtn = document.getElementById('discard-draft-btn');
		if (discardBtn) discardBtn.style.display = 'block';
	} else {
		lastSavedDisplay.textContent = 'No draft saved';
		lastSavedDisplay.style.display = 'block';

		// Hide discard button if no draft
		const discardBtn = document.getElementById('discard-draft-btn');
		if (discardBtn) discardBtn.style.display = 'none';
	}
}

// --- Draft Management Event Listeners ---
// Modified setupDraftEventListeners to handle dynamic elements
function setupDraftEventListeners() {
	const discardDraftBtn = document.getElementById('discard-draft-btn');
	const saveDraftBtn = document.getElementById('save-draft-btn');

	// Setup manual save button
	if (saveDraftBtn) {
		// Clone and replace to remove any existing event listeners
		const newSaveBtn = saveDraftBtn.cloneNode(true);
		saveDraftBtn.parentNode.replaceChild(newSaveBtn, saveDraftBtn);

		// Add a single event listener to the new save button
		newSaveBtn.addEventListener('click', function () {
			// Save immediately
			if (saveFormDraft()) {
				// Show brief feedback
				const originalText = this.textContent;
				this.textContent = "Saved!";
				this.disabled = true;

				// Reset button after 1.5 seconds
				setTimeout(() => {
					this.textContent = originalText;
					this.disabled = false;
				}, 1500);
			}
		});
	}

	// Remove any existing event listeners from discard button to prevent duplicates
	if (discardDraftBtn) {
		// Clone and replace to remove all event listeners
		const newDiscardBtn = discardDraftBtn.cloneNode(true);
		discardDraftBtn.parentNode.replaceChild(newDiscardBtn, discardDraftBtn);

		// Add a single event listener to the new button
		newDiscardBtn.addEventListener('click', async function () {
			const confirmed = await CustomDialog.confirm(
				'Are you sure you want to discard this draft? This cannot be undone.',
				'Discard Draft?'
			);

			if (confirmed) {
				discardFormDraft();
				// Reset the form
				document.getElementById('board-title').value = '';
				document.getElementById('board-title').classList.remove('has-content');

				const categoriesContainer = document.getElementById('categories-container');
				categoriesContainer.innerHTML = '';
				for (let i = 0; i < 5; i++) {
					addCategory();
				}
				formTeams = [];
				addFormTeam();
				renderFormTeams();

				await CustomDialog.success('Draft discarded successfully.');
			}
		});
	}

	// Set up validation for the board title (no auto-save)
	const boardTitle = document.getElementById('board-title');

	// Set up delegation for category container to catch all dynamic elements
	categoriesContainer.addEventListener('input', function (e) {
		const target = e.target;

		// Check if the input is from one of our form fields and handle validation
		if (
			target.classList.contains('category-name') ||
			target.classList.contains('question-answer') ||
			target.classList.contains('question-question')
		) {
			// Handle validation styling for required fields
			if (target.classList.contains('required-field')) {
				if (target.value.trim() !== '') {
					target.classList.remove('validation-error');
					target.classList.add('has-content');
				} else {
					target.classList.remove('has-content');
					target.classList.add('validation-error');
				}
			}
		}
	});
}

// Auto-save functionality has been removed in favor of manual save only

// Setup draft event listeners on page load
// Add event listener to fix any potential form rendering issues
document.addEventListener('DOMContentLoaded', function () {
	setupDraftEventListeners();

	// Make sure categories container always exists
	if (!categoriesContainer) {
		console.error('Categories container not found, cannot set up draft functionality');
	}
});

// Debug function to help diagnose form issues
function debugFormStructure() {
	console.log('---- Form Structure Debug ----');
	console.log('Board title:', document.getElementById('board-title') ? 'exists' : 'missing');
	console.log('Categories container:', categoriesContainer ? 'exists' : 'missing');

	const categoryCount = document.querySelectorAll('.category-section').length;
	console.log('Category sections:', categoryCount);

	document.querySelectorAll('.category-section').forEach((cat, i) => {
		console.log(`Category ${i + 1} name input:`, cat.querySelector('.category-name') ? 'exists' : 'missing');
		console.log(`Category ${i + 1} question items:`, cat.querySelectorAll('.question-item').length);
	});
}

// Custom confirmation dialog for discarding drafts
function showDiscardConfirmation() {
	// Create confirmation modal
	const confirmModal = document.createElement('div');
	confirmModal.id = 'discard-confirm-modal';
	confirmModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
    `;

	const confirmDialog = document.createElement('div');
	confirmDialog.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        text-align: center;
        font-family: inherit;
    `;

	confirmDialog.innerHTML = `
        <h3 style="margin-top: 0; color: #333; font-size: 1.2em;">Discard Draft?</h3>
        <p style="color: #666; margin: 15px 0 25px; line-height: 1.4;">Are you sure you want to discard this draft? This cannot be undone.</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
            <button id="confirm-discard" style="background: #e74c3c; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: 500;">Discard Draft</button>
            <button id="cancel-discard" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: 500;">Cancel</button>
        </div>
    `;

	confirmModal.appendChild(confirmDialog);
	document.body.appendChild(confirmModal);

	// Handle confirm button
	document.getElementById('confirm-discard').addEventListener('click', function () {
		discardFormDraft();
		// Reset the form
		document.getElementById('board-title').value = '';
		document.getElementById('board-title').classList.remove('has-content');

		const categoriesContainer = document.getElementById('categories-container');
		categoriesContainer.innerHTML = '';
		for (let i = 0; i < 5; i++) {
			addCategory();
		}
		formTeams = [];
		addFormTeam();
		renderFormTeams();

		// Remove modal
		document.body.removeChild(confirmModal);

		// Show success message
		showSuccessMessage('Draft discarded successfully.');
	});

	// Handle cancel button
	document.getElementById('cancel-discard').addEventListener('click', function () {
		document.body.removeChild(confirmModal);
	});

	// Handle clicking outside the modal
	confirmModal.addEventListener('click', function (e) {
		if (e.target === confirmModal) {
			document.body.removeChild(confirmModal);
		}
	});

	// Handle escape key
	const handleEscape = function (e) {
		if (e.key === 'Escape') {
			document.body.removeChild(confirmModal);
			document.removeEventListener('keydown', handleEscape);
		}
	};
	document.addEventListener('keydown', handleEscape);
}

// Universal Custom Dialog System
const CustomDialog = {
	// Show alert dialog
	alert: function (message, title = 'Error') {
		return new Promise((resolve) => {
			this.createModal({
				title: title,
				message: message,
				buttons: [
					{ text: 'OK', style: 'primary', action: resolve }
				]
			});
		});
	},

	// Show confirm dialog
	confirm: function (message, title = 'Confirm') {
		return new Promise((resolve) => {
			this.createModal({
				title: title,
				message: message,
				buttons: [
					{ text: 'Cancel', style: 'secondary', action: () => resolve(false) },
					{ text: 'OK', style: 'primary', action: () => resolve(true) }
				]
			});
		});
	},

	// Show success message
	success: function (message, title = 'Success') {
		return new Promise((resolve) => {
			this.createModal({
				title: title,
				message: message,
				type: 'success',
				buttons: [
					{ text: 'OK', style: 'success', action: resolve }
				]
			});
		});
	},

	// Show error message
	error: function (message, title = 'Error') {
		return new Promise((resolve) => {
			this.createModal({
				title: title,
				message: message,
				buttons: [
					{ text: 'OK', style: 'primary', action: resolve }
				]
			});
		});
	},

	// Create the modal structure
	createModal: function (options) {
		// Remove any existing modals
		const existingModal = document.getElementById('custom-dialog-modal');
		if (existingModal) {
			document.body.removeChild(existingModal);
		}

		const modal = document.createElement('div');
		modal.id = 'custom-dialog-modal';
		modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            animation: fadeIn 0.2s ease-out;
        `;

		const dialog = document.createElement('div');
		dialog.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            max-width: 450px;
            min-width: 320px;
            text-align: center;
            font-family: inherit;
            animation: slideIn 0.3s ease-out;
        `;

		// Add icon based on type
		let iconHtml = '';
		if (options.type === 'success') {
			iconHtml = '<div style="font-size: 48px; color: #28a745; margin-bottom: 15px;">✓</div>';
		} else if (options.type === 'error') {
			iconHtml = '<div style="font-size: 48px; color: #dc3545; margin-bottom: 15px;">✕</div>';
		}

		dialog.innerHTML = `
            ${iconHtml}
            <h3 style="margin-top: 0; color: #333; font-size: 1.3em; margin-bottom: 15px;">${options.title}</h3>
            <p style="color: #666; margin: 15px 0 25px; line-height: 1.5; font-size: 1em;">${options.message}</p>
            <div id="dialog-buttons" style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;"></div>
        `;

		modal.appendChild(dialog);
		document.body.appendChild(modal);

		// Add buttons
		const buttonContainer = document.getElementById('dialog-buttons');
		options.buttons.forEach((button, index) => {
			const btn = document.createElement('button');
			btn.textContent = button.text;

			let buttonStyle = '';
			switch (button.style) {
				case 'primary':
					buttonStyle = 'background: #007bff; color: white;';
					break;
				case 'secondary':
					buttonStyle = 'background: #6c757d; color: white;';
					break;
				case 'success':
					buttonStyle = 'background: #28a745; color: white;';
					break;
				case 'error':
					buttonStyle = 'background: #dc3545; color: white;';
					break;
				default:
					buttonStyle = 'background: #f8f9fa; color: #333; border: 1px solid #dee2e6;';
			}

			btn.style.cssText = `
                ${buttonStyle}
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
                font-size: 14px;
                min-width: 80px;
                transition: opacity 0.2s;
            `;

			btn.addEventListener('mouseover', () => btn.style.opacity = '0.8');
			btn.addEventListener('mouseout', () => btn.style.opacity = '1');

			btn.addEventListener('click', () => {
				document.body.removeChild(modal);
				button.action();
			});

			buttonContainer.appendChild(btn);

			// Focus the first button
			if (index === options.buttons.length - 1) {
				setTimeout(() => btn.focus(), 100);
			}
		});

		// Handle escape key
		const handleEscape = (e) => {
			if (e.key === 'Escape') {
				document.body.removeChild(modal);
				// Call the last button's action (usually cancel/ok)
				options.buttons[options.buttons.length - 1].action();
				document.removeEventListener('keydown', handleEscape);
			}
		};
		document.addEventListener('keydown', handleEscape);

		// Add CSS animations
		if (!document.getElementById('dialog-animations')) {
			const style = document.createElement('style');
			style.id = 'dialog-animations';
			style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideIn {
                    from {
                        transform: translateY(-20px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            `;
			document.head.appendChild(style);
		}
	}
};
