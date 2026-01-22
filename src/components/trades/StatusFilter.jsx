import React from 'react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Filter } from "lucide-react";

const statusOptions = [
  { value: 'all', label: 'הכל' },
  { value: 'idea', label: 'רעיונות' },
  { value: 'approved', label: 'אושרו' },
  { value: 'sent', label: 'נשלחו' },
  { value: 'error', label: 'שגיאות' }
];

export default function StatusFilter({ currentStatus, onStatusChange }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 text-gray-400">
        <Filter className="w-5 h-5" />
        <span className="text-sm font-medium">סינון:</span>
      </div>
      <Tabs value={currentStatus} onValueChange={onStatusChange}>
        <TabsList className="bg-gray-900 border border-gray-800">
          {statusOptions.map(option => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className="data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-400"
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}