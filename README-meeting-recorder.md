# Meeting Recorder and Summarizer

This feature allows you to record, transcribe, and summarize video calls in real-time. It uses OpenAI's Whisper model for speech recognition and GPT for generating comprehensive meeting summaries.

## Features

- **Real-time audio recording**: Captures all participants' audio during the call
- **Automatic transcription**: Converts speech to text using OpenAI's Whisper model
- **AI-powered summarization**: Generates concise meeting summaries with:
  - Key points
  - Action items
  - Decisions made
- **Intelligent research**: Use the meeting content to automatically generate research queries

## Setup Instructions

1. Make sure you have all the required dependencies installed:

```bash
pip install -r requirements.txt
```

2. Set up your environment variables:
   - Create a `.env` file in the project root
   - Add your OpenAI API key: `OPENAI_API_KEY=your_key_here`

3. Start the meeting recorder server:

```bash
python meeting_recorder.py
```

This will start the server on port 9001.

4. Make sure your main server is also running:

```bash
python server.py
```

5. Start the frontend application:

```bash
npm run dev
```

## How to Use

1. **Start a video call**: Join or create a video call with others
2. **Navigate to the Summary tab**: Click on the "Summary" tab in the right panel
3. **Start recording**: Click the "Start Recording" button
4. **Stop and process**: When you're done, click "Stop Recording" to begin transcription and summarization
5. **View results**: After processing, you'll see:
   - A transcript of the meeting
   - Key points extracted from the discussion
   - Action items identified by AI
   - Suggested research topics

## Technical Details

The meeting recorder uses a client-server architecture:

- Frontend (React/TypeScript):
  - Captures audio streams from all participants
  - Sends audio chunks to the server
  - Displays the processed results

- Backend (Python/Flask):
  - Processes incoming audio chunks
  - Transcribes audio using OpenAI's Whisper model
  - Generates summaries using OpenAI's GPT models
  - Extracts key information like action items and decisions

## Troubleshooting

- **Audio recording issues**: Make sure all participants have granted microphone permissions
- **Transcription accuracy**: Speak clearly and minimize background noise for better results
- **Processing time**: Larger recordings take longer to process, please be patient
- **Server connection**: Check that both servers are running and accessible from the frontend

## Privacy Note

All audio data is processed and deleted after the summary is generated. No permanent records of the audio are kept. 