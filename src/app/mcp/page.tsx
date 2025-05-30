"use client";

import MCPIntegration from '@/components/MCPIntegration';

export default function MCPDashboard() {
  return (
    <div className="min-h-screen bg-[#101112] p-8">
      <h1 className="text-3xl font-bold text-white mb-8">MCP Dashboard</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <MCPIntegration />
      </div>

        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-bold text-white mb-4">Quick Actions</h2>
          
          <div className="space-y-3">
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              Monitor Active Calls
            </button>
            
            <button className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition-colors flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Create New Room
            </button>
            
            <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded transition-colors flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              View Documentation
            </button>
            
            <button className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded transition-colors flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Terminate All Sessions
            </button>
            </div>
        </div>
        </div>
        
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-3 bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-bold text-white mb-4">Server Logs</h2>
          
          <div className="bg-black rounded p-4 h-64 overflow-y-auto font-mono text-sm text-green-400">
            <div>[2024-05-30 14:22:32] INFO: Server started successfully</div>
            <div>[2024-05-30 14:25:17] INFO: User john_doe joined room ABCDEF</div>
            <div>[2024-05-30 14:26:05] INFO: User jane_smith joined room ABCDEF</div>
            <div>[2024-05-30 14:30:18] INFO: Room ABCDEF activated recording</div>
            <div>[2024-05-30 14:35:42] WARNING: High CPU usage detected (76%)</div>
            <div>[2024-05-30 14:40:11] INFO: User john_doe left room ABCDEF</div>
            <div>[2024-05-30 14:42:30] INFO: User jane_smith left room ABCDEF</div>
            <div>[2024-05-30 14:42:31] INFO: Room ABCDEF closed</div>
            <div>[2024-05-30 14:50:03] INFO: System performing routine cleanup</div>
            <div>[2024-05-30 15:00:00] INFO: Hourly health check: All systems operational</div>
          </div>
        </div>
      </div>
    </div>
  );
} 