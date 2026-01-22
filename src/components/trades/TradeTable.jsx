import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

const statusConfig = {
  idea: { label: 'רעיון', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  approved: { label: 'אושר', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  sent: { label: 'נשלח', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  error: { label: 'שגיאה', color: 'bg-red-500/20 text-red-400 border-red-500/30' }
};

const sideConfig = {
  buy: { label: 'קנייה', color: 'text-green-400' },
  sell: { label: 'מכירה', color: 'text-red-400' }
};

export default function TradeTable({ trades, onActivate, activatingId }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">אין רעיונות למסחר כרגע</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900/50 backdrop-blur-sm">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-800 hover:bg-transparent">
            <TableHead className="text-gray-400 font-semibold text-right">סימול</TableHead>
            <TableHead className="text-gray-400 font-semibold text-right">צד</TableHead>
            <TableHead className="text-gray-400 font-semibold text-right">כניסה</TableHead>
            <TableHead className="text-gray-400 font-semibold text-right">סטופ</TableHead>
            <TableHead className="text-gray-400 font-semibold text-right">יעד</TableHead>
            <TableHead className="text-gray-400 font-semibold text-right">כמות</TableHead>
            <TableHead className="text-gray-400 font-semibold text-right">R:R</TableHead>
            <TableHead className="text-gray-400 font-semibold text-right">סיבה</TableHead>
            <TableHead className="text-gray-400 font-semibold text-right">סטטוס</TableHead>
            <TableHead className="text-gray-400 font-semibold text-right">פעולה</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade, index) => (
            <motion.tr
              key={trade.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="border-gray-800 hover:bg-gray-800/30 transition-colors"
            >
              <TableCell className="font-bold text-white text-right">{trade.symbol}</TableCell>
              <TableCell className="text-right">
                <span className={`font-semibold ${sideConfig[trade.side]?.color}`}>
                  {sideConfig[trade.side]?.label}
                </span>
              </TableCell>
              <TableCell className="text-gray-300 text-right">${trade.entry_price?.toFixed(2)}</TableCell>
              <TableCell className="text-gray-300 text-right">${trade.stop_loss?.toFixed(2)}</TableCell>
              <TableCell className="text-gray-300 text-right">${trade.take_profit?.toFixed(2)}</TableCell>
              <TableCell className="text-gray-300 text-right">{trade.qty}</TableCell>
              <TableCell className="text-gray-300 text-right">
                {trade.risk_reward ? `1:${trade.risk_reward?.toFixed(2)}` : '-'}
              </TableCell>
              <TableCell className="text-gray-400 text-right max-w-xs truncate">
                {trade.reason || '-'}
              </TableCell>
              <TableCell className="text-right">
                <Badge className={`${statusConfig[trade.status]?.color} border`}>
                  {statusConfig[trade.status]?.label}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {trade.status === 'idea' && (
                  <Button
                    onClick={() => onActivate(trade.id)}
                    disabled={activatingId === trade.id}
                    className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    size="sm"
                  >
                    {activatingId === trade.id ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        מפעיל...
                      </>
                    ) : (
                      <>
                        <Play className="ml-2 h-4 w-4" />
                        הפעל
                      </>
                    )}
                  </Button>
                )}
              </TableCell>
            </motion.tr>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}