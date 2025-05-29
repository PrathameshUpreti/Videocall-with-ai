"use client";

interface CustomTabProps {
  text: string;
  isActive: boolean;
  onClick: () => void;
}

export const CustomTab = ({ text, isActive, onClick }: CustomTabProps) => {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-medium rounded-lg transition-colors
        ${isActive 
          ? 'bg-blue-100 text-blue-600' 
          : 'text-gray-600 hover:bg-gray-100'
        }`}
    >
      {text}
    </button>
  );
}; 