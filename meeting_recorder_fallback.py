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
from datetime import datetime
from logging.handlers import RotatingFileHandler

# Import the fallback transcription module
from fallback_transcription import transcribe_with_google, generate_summary, process_audio_data

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
    log_file = 'meeting_recorder_fallback.log'
    
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

@app.route('/healthcheck', methods=['GET'])
def healthcheck():
    """Simple endpoint to check if the service is running"""
    return jsonify({"status": "ok", "using": "Google Speech Recognition (fallback)"})

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
                audio_segment = process_audio_data(chunk["data"], chunk["format"])
                
                # Append to the full audio
                all_audio += audio_segment
                
            except Exception as e:
                logger.error(f"Error processing audio chunk: {str(e)}")
                continue
                
        # At this point, we have all the audio segments combined
        logger.info(f"Processing completed audio for recording {recording_id} - Duration: {len(all_audio)/1000}s")
        
        # Transcribe the audio
        if len(all_audio) > 0:
            # Using Google Speech Recognition instead of Whisper
            transcript = transcribe_with_google(all_audio)
            logger.info(f"Google transcription completed for recording {recording_id}")
            
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

if __name__ == '__main__':
    # Run the Flask app
    logger.info(f"Starting meeting recorder server (with fallback transcription) on 0.0.0.0:{PORT}")
    logger.info(f"Access from other devices using: http://<your-ip-address>:{PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=True, threaded=True) 