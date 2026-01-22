import React from 'react';
import { Button } from "@/components/ui/button";
import { Trash2, MoveUp, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function BulkActions({ selectedCount, onDelete, onMoveUp, onClearSelection, isProcessing }) {
  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50"
      >
        <div className="bg-gradient-to-r from-blue-900 to-purple-900 border border-blue-500/30 rounded-2xl shadow-2xl p-4 flex items-center gap-4">
          <div className="flex items-center gap-2 px-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
              {selectedCount}
            </div>
            <span className="text-white font-medium">נבחרו</span>
          </div>

          <div className="h-8 w-px bg-gray-600"></div>

          <div className="flex items-center gap-2">
            <Button
              onClick={onMoveUp}
              disabled={isProcessing}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 gap-2"
            >
              <MoveUp className="w-4 h-4" />
              העבר למעלה
            </Button>

            <Button
              onClick={onDelete}
              disabled={isProcessing}
              variant="ghost"
              size="sm"
              className="text-red-400 hover:bg-red-500/10 gap-2"
            >
              <Trash2 className="w-4 h-4" />
              מחק
            </Button>

            <Button
              onClick={onClearSelection}
              disabled={isProcessing}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}