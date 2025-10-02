# Jeopardy Web App

An interactive web application for the game of Jeopardy that runs locally on your computer. Build custom game boards through a form or upload existing text files for quick setup.

## Gameplay Screenshots

![Jeopardy Game Board](screenshots/game-board-gameplay.png)

*Main game board with categories and point values*

![Question Modal](screenshots/game-board-question-modal.png)

*Question and answer screen with team selection and scoring controls*

## Getting Started

1. **Open the game**:
    - Download the ZIP folder containing all files (green button at the top of this page)
    - Open `jeopardy.html` in a web browser (the default when double clicking any .html file)

![Main Screen](screenshots/updated-main-page.png)

1. **Create new game, upload a draft in progress, or use an existing game board**:

   **Option A: Create new game**
   - Click 'Create' on the home screen
   - Fill in the form with your game title, five categories, five questions/answers per category and teams
   - To use an image, put <img> in front of image name. (putting "<img>bobby" in question will display image [](images/answers/bobby.png))

  ![Game Board Creation](screenshots/updated-manual-game-creation.png)

- When complete, click either:
  - 'Create' to generate your game
  - 'Save' to save a copy for future use

  ![Game Board Complete Form](screenshots/updated-game-complete-form.png)

   **Option B: Upload a draft or game file to edit**

- Click 'Edit' on the home screen to either upload and edit a draft file or game file.

  ![Draft File Upload](screenshots/updated-import-draft-file.png)

   **Option C: Play using an existing game file**

- Click 'Play' and select your previously saved game file
- Add teams
- Click 'Continue to Game' and the board will be automatically created and displayed

  ![Loading Game File](screenshots/updated-loading-game-file.png)

1. **Play the game**: Click on values to reveal answers, show questions, and award points

![Jeopardy Game Board](screenshots/game-board-gameplay.png)

## Gameplay Features

- **Team Scoring System**: Add multiple teams, track and edit scores in real-time (score editing is automatically mapped to previous cell points)
- **Flexible Creation**: Build boards through forms or upload existing files
- **Save Created Games**: Save boards as text files for future games
- **Persistent Storage**: Game state saves automatically between browser sessions
- **Form Validation**: Form validation ensures all required fields are completed before the game board can be created

## Technical Notes

- **No server required**: Runs entirely in the browser
- **Modern browsers**: Uses ES6+ JavaScript features
- **File uploads**: Processes local text files with FileReader API
- **Responsive**: CSS Grid and Flexbox for layout
- **Modular**: Separated HTML/CSS/JS for maintainability

## Project Structure

### Core Files

- **`jeopardy.html`** - Main HTML structure with game board layout, scoring table, and modal elements
- **`css/jeopardy.css`** - Stylesheet with responsive design for desktop and mobile devices
- **`js/jeopardy.js`** - Game logic handling file uploads, board generation, team management, and persistent storage

## Exported Text File Breakdown

1. **Title Line** (optional): `Title: Your Game Title`
2. **Category Headers**: `Category: Category Name Here`
3. **Questions**: `POINTS|CLUE|RESPONSE`
   - Points: 100, 200, 300, 400, 500
   - Clue: The statement shown to players first
   - Response: The correct answer in question form
4. **Five Categories**: Each with exactly 5 questions (100-500 points)
5. **Blank Lines**: Ignored by the parser

---

Copyright (c) 2025 Eric Jones

Licensed under the MIT License. See LICENSE.md for details.
