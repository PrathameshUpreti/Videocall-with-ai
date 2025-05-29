"use client";

import { useState } from 'react';
import axios from 'axios';
import { Card, Title, Text } from '@tremor/react';

interface AISummaryProps {
  transcription: string;
}

export const AISummary = ({ transcription }: AISummaryProps) => {
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [researchMode, setResearchMode] = useState<'summary' | 'deep'>('summary');

  const generateSummary = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/summarize', { transcription });
      const { summary, keyPoints, actionItems } = response.data;
      
      setSummary(summary);
      setKeyPoints(keyPoints);
      setActionItems(actionItems);
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const performResearch = async () => {
    try {
      setLoading(true);
      setSummary('');
      setKeyPoints([]);
      setActionItems([]);
      
      // Use the query from the transcription or a default query
      const query = transcription || "video conferencing technology";
      
      const response = await axios.post('http://localhost:9000/api/research', { 
        query, 
        mode: researchMode 
      });
      
      if (response.data && response.data.results) {
        setSummary(response.data.results);
      }
    } catch (error) {
      console.error('Error performing research:', error);
      setSummary("An error occurred while fetching research data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex justify-between items-center">
          <Title>Meeting Summary & Research</Title>
          <Text className="text-sm text-gray-500">Powered by Marina.ai</Text>
        </div>
        
        <div className="flex justify-between items-center mt-2 mb-4">
          <div className="flex space-x-4">
            <button
              onClick={() => setResearchMode('summary')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                researchMode === 'summary' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Quick Summary
            </button>
            <button
              onClick={() => setResearchMode('deep')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                researchMode === 'deep' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Comprehensive Report
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : (
          <>
            {summary && (
              <div className="mt-4">
                <Text>{summary}</Text>
              </div>
            )}
            {keyPoints.length > 0 && (
              <div className="mt-4">
                <Title className="text-lg">Key Points</Title>
                <ul className="list-disc list-inside mt-2">
                  {keyPoints.map((point, index) => (
                    <li key={index} className="text-gray-600">{point}</li>
                  ))}
                </ul>
              </div>
            )}
            {actionItems.length > 0 && (
              <div className="mt-4">
                <Title className="text-lg">Action Items</Title>
                <ul className="list-disc list-inside mt-2">
                  {actionItems.map((item, index) => (
                    <li key={index} className="text-gray-600">{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Card>
      <div className="flex space-x-3">
        <button
          onClick={generateSummary}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          disabled={loading || !transcription}
        >
          Generate Meeting Summary
        </button>
        <button
          onClick={performResearch}
          className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
          disabled={loading}
        >
          {researchMode === 'summary' ? 'Get Quick Research' : 'Get Comprehensive Research'}
        </button>
      </div>
    </div>
  );
};