# NewsBreeze - Your Celebrity-Powered Audio News Reader

NewsBreeze is a news aggregation application that fetches the latest headlines, summarizes them, and reads them aloud in celebrity voices.

## Features

- Fetches latest news headlines from various sources (via RSS feeds).
- Summarizes news articles using Hugging Face summarization models.
- Reads summarized headlines in different voices using voice cloning technology.
- Provides a clean user interface for displaying summaries and playing audio.

## Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Frontend**: (To be decided - likely a simple HTML/CSS/JS or a lightweight framework)
- **News Aggregation**: RSS feeds
- **Summarization**: Hugging Face Inference API (e.g., `Falconsai/text_summarization`)
- **Text-to-Speech**: Voice cloning model (e.g., `coqui/xtts-v2` via API or local setup if feasible)

## Setup

1.  **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd NewsBreeze
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root directory and add any necessary API keys or configurations. (Details to be added later)

4.  **Build the project:**

    ```bash
    npm run build
    ```

5.  **Run the application:**
    - For production:
      ```bash
      npm start
      ```
    - For development (with auto-reload):
      ```bash
      npm run dev
      ```

## Models Used

- **Summarization**: (To be specified, e.g., `Falconsai/text_summarization`)
- **Voice Cloning**: (To be specified, e.g., `coqui/xtts-v2`)

---

This README will be updated as the project progresses.
