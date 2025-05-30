#!/usr/bin/env python3
"""
Fallback Transcription Module for Meeting Recorder
Uses SpeechRecognition with Google's API as a fallback for Whisper
"""
import os
import logging
import tempfile
import base64
from io import BytesIO
import speech_recognition as sr
from pydub import AudioSegment
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get API keys
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("fallback_transcription.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def transcribe_with_google(audio_segment, language="en-US"):
    """
    Transcribe audio using Google Speech Recognition API
    """
    recognizer = sr.Recognizer()
    
    try:
        # Save audio to a temporary file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            audio_segment.export(temp_file.name, format="wav")
            temp_file_path = temp_file.name
        
        # Convert to speech_recognition audio source
        with sr.AudioFile(temp_file_path) as source:
            # Record audio from the file
            audio_data = recognizer.record(source)
            
        # Perform the transcription
        transcript = recognizer.recognize_google(audio_data, language=language)
        
        # Clean up temporary file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
            
        return transcript
    
    except sr.UnknownValueError:
        logger.error("Google Speech Recognition could not understand audio")
        return "Speech recognition could not understand the audio."
    except sr.RequestError as e:
        logger.error(f"Could not request results from Google Speech Recognition service: {e}")
        return f"Error accessing speech recognition service: {str(e)}"
    except Exception as e:
        logger.error(f"Error in Google transcription: {str(e)}")
        return f"Error transcribing audio: {str(e)}"

def process_audio_data(audio_data_base64, audio_format="wav"):
    """
    Process base64 encoded audio data
    """
    try:
        # Decode base64 to binary
        audio_data = base64.b64decode(audio_data_base64)
        audio_buffer = BytesIO(audio_data)
        
        # Convert to AudioSegment
        audio_segment = AudioSegment.from_file(audio_buffer, format=audio_format)
        
        # Normalize audio (adjust volume to a standard level)
        audio_segment = audio_segment.normalize()
        
        return audio_segment
    
    except Exception as e:
        logger.error(f"Error processing audio data: {str(e)}")
        raise

def generate_summary(transcript):
    """
    Generate a summary of the transcript using OpenAI API
    """
    if not OPENAI_API_KEY:
        logger.warning("No OpenAI API key provided for summary generation")
        return {
            "transcript": transcript,
            "summary": "Summary generation failed: No OpenAI API key provided.",
            "key_points": []
        }
    
    try:
        # Create a prompt for OpenAI to generate a meeting summary
        system_prompt = """You are an expert meeting transcription analyst. Your task is to analyze the provided transcript and create a well-structured summary.
        
        This transcript primarily contains speech from participants other than the user who initiated the recording.
        Focus on what OTHERS said in the meeting, not the recording user's own contributions.
        
        Produce a response with these sections:
        1. MEETING SUMMARY: A concise 4-6 sentence overview of what the other participants discussed
        2. KEY POINTS: A bulleted list of the 5-7 most important points mentioned by other participants
        3. ACTION ITEMS: A bulleted list of all tasks, assignments, or follow-ups that others mentioned or were assigned to others
        4. DECISIONS MADE: A bulleted list of any decisions or conclusions reached by other participants
        
        Format these sections clearly with headings. Focus on substance over style.
        Do not include technical formatting symbols. Use plain text only."""
        
        user_prompt = f"""Meeting Transcript:
        {transcript}
        
        Please analyze this meeting transcript and provide a structured summary focusing on the most important information.
        Include only what was actually discussed in the meeting - do not invent or assume additional content."""
        
        # API call to OpenAI
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-3.5-turbo",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "max_tokens": 1000,
                "temperature": 0.7
            },
            timeout=30
        )
        
        if response.status_code != 200:
            logger.error(f"OpenAI API error: {response.status_code} - {response.text}")
            return {
                "transcript": transcript,
                "summary": "Summary generation failed: Error calling OpenAI API.",
                "key_points": []
            }
        
        result = response.json()
        summary_text = result['choices'][0]['message']['content']
        
        # Extract key points from the summary
        key_points = []
        if "KEY POINTS:" in summary_text:
            key_points_section = summary_text.split("KEY POINTS:")[1].split("ACTION ITEMS:")[0].strip()
            key_points = [point.strip().lstrip("•-* ") for point in key_points_section.split("\n") if point.strip() and point.strip()[0] in "•-*"]
        
        return {
            "transcript": transcript,
            "summary": summary_text,
            "key_points": key_points
        }
        
    except Exception as e:
        logger.error(f"Error generating summary: {str(e)}")
        return {
            "transcript": transcript,
            "summary": f"Summary generation failed: {str(e)}",
            "key_points": []
        }

def transcribe_audio_file(file_path):
    """
    Transcribe an audio file
    """
    try:
        # Load audio file
        audio_segment = AudioSegment.from_file(file_path)
        
        # Transcribe
        transcript = transcribe_with_google(audio_segment)
        
        return transcript
    
    except Exception as e:
        logger.error(f"Error transcribing audio file: {str(e)}")
        return f"Error transcribing audio file: {str(e)}"

def main():
    """
    Test function for the fallback transcription module
    """
    test_audio_file = input("Enter path to a test audio file (or press Enter to skip): ")
    
    if test_audio_file and os.path.exists(test_audio_file):
        print(f"Transcribing {test_audio_file}...")
        transcript = transcribe_audio_file(test_audio_file)
        print(f"\nTranscription result:\n{transcript}")
        
        if OPENAI_API_KEY:
            print("\nGenerating summary...")
            summary = generate_summary(transcript)
            print(f"\nSummary:\n{summary['summary']}")
        else:
            print("\nSkipping summary generation (no OpenAI API key)")
    else:
        print("No valid audio file provided for testing")

if __name__ == "__main__":
    main() 