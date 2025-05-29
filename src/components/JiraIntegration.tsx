"use client";

import { useState } from 'react';
import axios from 'axios';
import { Card, Title, TextInput, Select, SelectItem, Button } from '@tremor/react';

interface JiraTask {
  summary: string;
  description: string;
  priority: string;
  assignee?: string;
}

export const JiraIntegration = () => {
  const [task, setTask] = useState<JiraTask>({
    summary: '',
    description: '',
    priority: 'Medium',
    assignee: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/api/jira/create-task', task);
      setSuccess(true);
      setTask({
        summary: '',
        description: '',
        priority: 'Medium',
        assignee: '',
      });
    } catch (error) {
      console.error('Error creating Jira task:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <Title>Create Jira Task</Title>
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Summary</label>
          <TextInput
            value={task.summary}
            onChange={(e) => setTask({ ...task, summary: e.target.value })}
            placeholder="Task summary"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={task.description}
            onChange={(e) => setTask({ ...task, description: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            rows={4}
            placeholder="Task description"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Priority</label>
          <Select
            value={task.priority}
            onValueChange={(value) => setTask({ ...task, priority: value })}
          >
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Assignee</label>
          <TextInput
            value={task.assignee}
            onChange={(e) => setTask({ ...task, assignee: e.target.value })}
            placeholder="Assignee username"
          />
        </div>
        <Button
          type="submit"
          loading={loading}
          className="w-full"
        >
          Create Task
        </Button>
        {success && (
          <p className="text-green-600 text-sm mt-2">Task created successfully!</p>
        )}
      </form>
    </Card>
  );
}; 