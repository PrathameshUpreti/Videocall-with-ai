#!/usr/bin/env python3
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import time
import logging
import uuid
import threading
import queue
import json
import requests
import tempfile
from pydub import AudioSegment
from dotenv import load_dotenv
import speech_recognition as sr
import whisper
import numpy as np
from datetime import datetime
from logging.handlers import RotatingFileHandler

# Load environment variables
load_dotenv()

# Initialize Flask app for recording API
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Get API keys from environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Set port number for the recording service
PORT = 9001

# Configure logging
def setup_logging():
    log_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    log_file = 'meeting_recorder.log'
    
    # Create handlers
    file_handler = RotatingFileHandler(log_file, maxBytes=10485760, backupCount=5)
    file_handler.setFormatter(log_formatter)
    file_handler.setLevel(logging.INFO)
    
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(log_formatter)
    console_handler.setLevel(logging.INFO)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    
    return root_logger

# Initialize logger
logger = setup_logging()

# Global variables for active recordings
active_recordings = {}
audio_chunks = {}
summary_results = {}

# Configure whisper model (OpenAI's speech recognition model)
whisper_model = None

def load_whisper_model():
    global whisper_model
    try:
        # Load the "base" model (smallest)
        logger.info("Loading Whisper model...")
        whisper_model = whisper.load_model("base")
        logger.info("Whisper model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load Whisper model: {str(e)}")
        whisper_model = None

# Load whisper model in a separate thread to avoid blocking server startup
threading.Thread(target=load_whisper_model, daemon=True).start()

@app.route('/healthcheck', methods=['GET'])
def healthcheck():
    """Simple endpoint to check if the service is running"""
    return jsonify({"status": "ok", "whisper_model_loaded": whisper_model is not None})

@app.route('/api/start-recording', methods=['POST'])
def start_recording():
    """
    Start a new recording session
    Expected POST data:
    {
        "room_id": "unique_room_id",
        "username": "username_who_started_recording"
    }
    """
    try:
        data = request.json
        room_id = data.get('room_id')
        username = data.get('username', 'Anonymous')
        
        if not room_id:
            return jsonify({"error": "Room ID is required"}), 400
            
        # Generate a unique recording ID
        recording_id = str(uuid.uuid4())
        
        # Initialize recording session
        active_recordings[recording_id] = {
            "room_id": room_id,
            "started_by": username,
            "start_time": datetime.now().isoformat(),
            "status": "active",
            "chunks_received": 0
        }
        
        # Initialize audio chunks queue for this recording
        audio_chunks[recording_id] = queue.Queue()
        
        # Start processing thread for this recording
        threading.Thread(
            target=process_audio_chunks,
            args=(recording_id,),
            daemon=True
        ).start()
        
        logger.info(f"Started recording session {recording_id} for room {room_id}")
        return jsonify({
            "recording_id": recording_id,
            "status": "recording_started",
            "start_time": active_recordings[recording_id]["start_time"]
        })
        
    except Exception as e:
        logger.error(f"Error starting recording: {str(e)}")
        return jsonify({"error": str(e)}), 500
        
@app.route('/api/stop-recording', methods=['POST'])
def stop_recording():
    """
    Stop an ongoing recording session and generate summary
    Expected POST data:
    {
        "recording_id": "unique_recording_id"
    }
    """
    try:
        data = request.json
        recording_id = data.get('recording_id')
        
        if not recording_id or recording_id not in active_recordings:
            return jsonify({"error": "Invalid recording ID"}), 400
            
        # Mark recording as complete
        active_recordings[recording_id]["status"] = "complete"
        active_recordings[recording_id]["end_time"] = datetime.now().isoformat()
        
        # Signal the processing thread to finalize
        audio_chunks[recording_id].put(None)  # Sentinel value to indicate end of recording
        
        logger.info(f"Stopped recording session {recording_id}")
        
        # We'll return immediately and let the processing thread handle the transcription and summary
        return jsonify({
            "recording_id": recording_id,
            "status": "processing",
            "message": "Recording stopped. Processing and generating summary..."
        })
        
    except Exception as e:
        logger.error(f"Error stopping recording: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/add-audio-chunk', methods=['POST'])
def add_audio_chunk():
    """
    Add an audio chunk to an ongoing recording
    Expected POST data:
    {
        "recording_id": "unique_recording_id",
        "audio_data": "base64_encoded_audio_data",
        "format": "wav"
    }
    """
    try:
        data = request.json
        recording_id = data.get('recording_id')
        audio_data = data.get('audio_data')
        audio_format = data.get('format', 'wav')
        
        if not recording_id or recording_id not in active_recordings:
            return jsonify({"error": "Invalid recording ID"}), 400
            
        if not audio_data:
            return jsonify({"error": "No audio data provided"}), 400
            
        if active_recordings[recording_id]["status"] != "active":
            return jsonify({"error": "Recording session is not active"}), 400
            
        # Add audio chunk to the queue for processing
        audio_chunks[recording_id].put({
            "data": audio_data,
            "format": audio_format,
            "timestamp": time.time()
        })
        
        # Update chunk count
        active_recordings[recording_id]["chunks_received"] += 1
        
        return jsonify({
            "status": "success",
            "chunks_received": active_recordings[recording_id]["chunks_received"]
        })
        
    except Exception as e:
        logger.error(f"Error adding audio chunk: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-summary', methods=['GET'])
def get_summary():
    """
    Get the summary of a recording
    Expected query parameters:
    recording_id: unique_recording_id
    """
    try:
        recording_id = request.args.get('recording_id')
        
        if not recording_id:
            return jsonify({"error": "Recording ID is required"}), 400
            
        if recording_id not in active_recordings:
            return jsonify({"error": "Invalid recording ID"}), 400
            
        recording_status = active_recordings[recording_id]["status"]
        
        # If the recording is still processing
        if recording_status == "active":
            return jsonify({
                "status": "in_progress",
                "message": "Recording is still in progress"
            })
            
        # If the summary is still being generated
        if recording_status == "complete" and recording_id not in summary_results:
            return jsonify({
                "status": "processing",
                "message": "Recording completed. Generating summary..."
            })
            
        # If the summary is ready
        if recording_id in summary_results:
            return jsonify({
                "status": "complete",
                "summary": summary_results[recording_id]
            })
            
        return jsonify({
            "status": "unknown",
            "message": "Summary not available"
        })
        
    except Exception as e:
        logger.error(f"Error getting summary: {str(e)}")
        return jsonify({"error": str(e)}), 500

def process_audio_chunks(recording_id):
    """Background worker to process audio chunks and generate transcription"""
    logger.info(f"Started audio processing thread for recording {recording_id}")
    
    all_audio = AudioSegment.silent(duration=0)
    transcript = ""
    
    try:
        while True:
            # Get the next chunk, waiting if necessary
            chunk = audio_chunks[recording_id].get()
            
            # None is our sentinel value indicating the end of the recording
            if chunk is None:
                logger.info(f"Processing end of recording {recording_id}")
                break
                
            try:
                # Process the audio chunk (base64 decode, convert to audio segment)
                import base64
                from io import BytesIO
                
                audio_data = base64.b64decode(chunk["data"])
                audio_buffer = BytesIO(audio_data)
                
                # Assume audio is in WAV format
                audio_segment = AudioSegment.from_wav(audio_buffer)
                
                # Append to the full audio
                all_audio += audio_segment
                
            except Exception as e:
                logger.error(f"Error processing audio chunk: {str(e)}")
                continue
                
        # At this point, we have all the audio segments combined
        logger.info(f"Processing completed audio for recording {recording_id} - Duration: {len(all_audio)/1000}s")
        
        # Transcribe the audio
        if len(all_audio) > 0:
            transcript = transcribe_audio(all_audio)
            logger.info(f"Transcription completed for recording {recording_id}")
            
            # Generate summary from transcript
            summary = generate_summary(transcript)
            summary_results[recording_id] = summary
            logger.info(f"Summary generated for recording {recording_id}")
            
        else:
            logger.warning(f"No audio data collected for recording {recording_id}")
            summary_results[recording_id] = {
                "error": "No audio data collected",
                "transcript": "",
                "summary": "",
                "key_points": []
            }
            
    except Exception as e:
        logger.error(f"Error in audio processing thread: {str(e)}")
        summary_results[recording_id] = {
            "error": str(e),
            "transcript": transcript,
            "summary": "An error occurred while processing the recording.",
            "key_points": []
        }

def transcribe_audio(audio_segment):
    """Transcribe audio using Whisper model"""
    try:
        # Ensure Whisper model is loaded
        if whisper_model is None:
            load_whisper_model()
            if whisper_model is None:
                return "Error: Whisper model could not be loaded."
                
        # Save audio to a temporary file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            audio_segment.export(temp_file.name, format="wav")
            temp_file_path = temp_file.name
            
        # Transcribe using Whisper
        try:
            result = whisper_model.transcribe(temp_file_path)
            transcript = result["text"]
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
                
        return transcript
        
    except Exception as e:
        logger.error(f"Error transcribing audio: {str(e)}")
        return f"Error transcribing audio: {str(e)}"

def generate_summary(transcript):
    """Generate a summary of the meeting transcript using OpenAI"""
    try:
        # Check if we have a valid API key
        if not OPENAI_API_KEY:
            logger.warning("No OpenAI API key provided")
            return {
                "transcript": transcript,
                "summary": "Summary generation failed: No OpenAI API key provided.",
                "key_points": []
            }
            
        # Create a prompt for OpenAI to generate a meeting summary
        system_prompt = """You are an expert meeting transcription analyst specializing in extracting key information from conversations.
        Your task is to analyze the provided meeting transcript and create a well-structured summary.
        
        This transcript primarily contains speech from participants other than the user who initiated the recording.
        Focus on what OTHERS said in the meeting, not the recording user's own contributions.
        
        Produce a response with these sections:
        1. MEETING SUMMARY: A concise 4-6 sentence overview of what the other participants discussed
        2. KEY POINTS: A bulleted list of the 5-7 most important points mentioned by other participants
        3. ACTION ITEMS: A bulleted list of all tasks, assignments, or follow-ups that others mentioned or that were assigned to others
        4. DECISIONS MADE: A bulleted list of any decisions or conclusions reached by other participants
        
        Format these sections clearly with headings. Focus on substance over style.
        Do not include technical formatting symbols. Use plain text only."""
        
        user_prompt = f"""Meeting Transcript:
        {transcript}
        
        Please analyze this meeting transcript and provide a structured summary focusing on the most important information.
        Include only what was actually discussed in the meeting - do not invent or assume additional content."""
        
        # Direct API call using requests
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-3.5-turbo-16k",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "max_tokens": 3000,
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
        
        # Create structured summary response
        summary_response = {
            "transcript": transcript,
            "summary": summary_text,
            "key_points": key_points
        }
        
        return summary_response
        
    except requests.exceptions.Timeout:
        logger.error("OpenAI API request timed out")
        return {
            "transcript": transcript,
            "summary": "Summary generation failed: API request timed out.",
            "key_points": []
        }
    except Exception as e:
        logger.error(f"Error generating summary: {str(e)}")
        return {
            "transcript": transcript,
            "summary": f"Summary generation failed: {str(e)}",
            "key_points": []
        }

if __name__ == '__main__':
    # Run the Flask app
    logger.info(f"Starting meeting recorder server on 0.0.0.0:{PORT}")
    logger.info(f"Access from other devices using: http://<your-ip-address>:{PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=True, threaded=True) 