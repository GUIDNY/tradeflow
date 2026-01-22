import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { tradeIds } = await req.json();

        if (!tradeIds || !Array.isArray(tradeIds) || tradeIds.length === 0) {
            return Response.json({ error: 'Missing tradeIds array' }, { status: 400 });
        }

        // Delete all trades
        const deletePromises = tradeIds.map(id => 
            base44.entities.TradeIdea.delete(id)
        );

        await Promise.all(deletePromises);

        return Response.json({ 
            success: true,
            message: `נמחקו ${tradeIds.length} רעיונות בהצלחה`,
            deletedCount: tradeIds.length
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});