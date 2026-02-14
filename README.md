# AIStudyBuddy

AIStudyBuddy is an intelligent, personalized study assistant designed to help learners organize, practice, and master educational content. The repository offers a suite of features including flashcard generation, quiz creation, note-taking, and seamless integration with AI-powered models. It is ideal for students, educators, and self-learners looking to maximize their study efficiency with automated tools.

## Introduction

AIStudyBuddy leverages advanced AI models to transform the way users approach learning. By automating repetitive tasks such as flashcard creation and quiz generation, it enables users to focus on understanding concepts rather than manual content preparation. The system supports multiple subjects, adapts to learning progress, and provides interactive study tools. The web app uses HTML, CSS, and JavaScript with Express and Node.js for the entire stack.

## Features

- **GCP based note storage system:** Provides Google Drive style file storage for all note types within the web app. Supabase manages user accounts, while MongoDB stores note metadata for efficient organization and retrieval on GCP.
- **Gemini powered study buddy:** Integrates Gemini AI with access to stored notes and metadata to study interactively with the user. Gemini uses this context to answer questions, suggest topics, and adapt sessions like a personalized study companion.

## Usage

1. **Sign Up or Log In:** Create an account or log in to access personalized features.
2. **Upload Study Materials:** Add notes, documents, or textbook excerpts.
3. **Generate Flashcards:** Use AI to extract key points and questions from your materials.
4. **Create Quizzes:** Select topics and let the system generate practice quizzes.
5. **Review with Spaced Repetition:** Study flashcards at optimal intervals for better retention.
6. **Track Progress:** View performance analytics and receive study recommendations.
7. **Access via Web or Mobile:** Use the browser-based interface or access on mobile devices for flexibility.

### Example Workflow

- Upload a PDF of lecture notes.
- Let the system generate flashcards covering important terms.
- Practice with quizzes generated from the uploaded content.
- Review flashcards with spaced repetition scheduling.
- Monitor your progress and revisit weak areas as suggested.

## Installation

Follow these steps to set up AIStudyBuddy locally:

### Prerequisites

- Node.js (version 14 or higher)
- npm
- Git

### Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/ProgrammerDSJ/AIStudyBuddy.git
   cd AIStudyBuddy
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   - Copy the sample environment file and update credentials as needed:
     ```bash
     cp .env.example .env
     ```
   - Fill in all required .env details in the .env file, including any API keys.

4. **Run the Application**
   ```bash
   node server.js
   ```

5. **Access the App**
   - Open your browser and go to `http://localhost:3000` (or the specified port).
