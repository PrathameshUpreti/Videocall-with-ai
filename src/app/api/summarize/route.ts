import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { transcription } = await request.json();

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that summarizes meeting transcriptions. Extract key points and action items from the transcription."
        },
        {
          role: "user",
          content: `Please analyze this meeting transcription and provide:
          1. A concise summary
          2. Key points discussed
          3. Action items
          
          Transcription: ${transcription}`
        }
      ],
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    
    if (!content) {
      return NextResponse.json(
        { error: 'Failed to generate summary: Empty response' },
        { status: 500 }
      );
    }
    
    // Parse the AI response to extract sections
    const sections = content.split('\n\n');
    const summary = sections[0] || 'No summary available';
    const keyPoints = sections[1]?.split('\n').filter(point => point.trim().startsWith('-')) || [];
    const actionItems = sections[2]?.split('\n').filter(item => item.trim().startsWith('-')) || [];

    return NextResponse.json({
      summary,
      keyPoints: keyPoints.map(point => point.replace('-', '').trim()),
      actionItems: actionItems.map(item => item.replace('-', '').trim()),
    });
  } catch (error) {
    console.error('Error in summarization:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
} 