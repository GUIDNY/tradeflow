import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { TrendingUp, Activity } from 'lucide-react';
import TradeTable from '../components/trades/TradeTable';
import StatusFilter from '../components/trades/StatusFilter';
import { useToast } from "@/components/ui/use-toast";

export default function TradeDashboard() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [activatingId, setActivatingId] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all trade ideas
  const { data: trades, isLoading } = useQuery({
    queryKey: ['tradeIdeas'],
    queryFn: async () => {
      const allTrades = await base44.entities.TradeIdea.list('-created_date', 1000);
      return allTrades || [];
    },
    initialData: [],
  });

  // Activate trade mutation
  const activateTradeMutation = useMutation({
    mutationFn: async (tradeId) => {
      const response = await base44.functions.invoke('sendTradeWebhook', { tradeId });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tradeIdeas'] });
      toast({
        title: "הצלחה!",
        description: data.message || "העסקה הופעלה בהצלחה",
        variant: "default",
        className: "bg-green-600 text-white border-green-700"
      });
      setActivatingId(null);
    },
    onError: (error) => {
      toast({
        title: "שגיאה",
        description: error.message || "לא ניתן להפעיל את העסקה",
        variant: "destructive"
      });
      setActivatingId(null);
    },
  });

  const handleActivate = (tradeId) => {
    setActivatingId(tradeId);
    activateTradeMutation.mutate(tradeId);
  };

  // Filter trades by status
  const filteredTrades = statusFilter === 'all'
    ? trades
    : trades.filter(trade => trade.status === statusFilter);

  // Calculate stats
  const stats = {
    total: trades.length,
    ideas: trades.filter(t => t.status === 'idea').length,
    sent: trades.filter(t => t.status === 'sent').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white" dir="rtl">
      <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600/20 rounded-xl border border-blue-500/30">
              <TrendingUp className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-l from-blue-400 to-purple-400 bg-clip-text text-transparent">
                ניהול עסקאות
              </h1>
              <p className="text-gray-400 mt-1">ניהול רעיונות למסחר והפעלה אוטומטית</p>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">סה"כ רעיונות</p>
                <p className="text-3xl font-bold mt-2">{stats.total}</p>
              </div>
              <Activity className="w-10 h-10 text-blue-400 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 border border-blue-700/30 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-300 text-sm font-medium">ממתינים לאישור</p>
                <p className="text-3xl font-bold mt-2 text-blue-400">{stats.ideas}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <span className="text-blue-400 font-bold">!</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-900/20 to-green-800/20 border border-green-700/30 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-300 text-sm font-medium">נשלחו</p>
                <p className="text-3xl font-bold mt-2 text-green-400">{stats.sent}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <span className="text-green-400 font-bold">✓</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatusFilter currentStatus={statusFilter} onStatusChange={setStatusFilter} />
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              <p className="text-gray-400 mt-4">טוען נתונים...</p>
            </div>
          ) : (
            <TradeTable
              trades={filteredTrades}
              onActivate={handleActivate}
              activatingId={activatingId}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}