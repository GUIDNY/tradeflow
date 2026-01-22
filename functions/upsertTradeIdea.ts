import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const payload = await req.json();

        if (!payload.symbol) {
            return Response.json({ error: 'Missing required field: symbol' }, { status: 400 });
        }

        // Check if there's an existing trade idea with the same symbol and status 'idea'
        const existingTrades = await base44.asServiceRole.entities.TradeIdea.filter({
            symbol: payload.symbol,
            status: 'idea'
        });

        let result;

        if (existingTrades && existingTrades.length > 0) {
            // Update the existing trade
            const tradeId = existingTrades[0].id;
            result = await base44.asServiceRole.entities.TradeIdea.update(tradeId, payload);
            
            return Response.json({ 
                success: true,
                action: 'updated',
                trade: result
            });
        } else {
            // Create a new trade idea
            result = await base44.asServiceRole.entities.TradeIdea.create({
                ...payload,
                status: payload.status || 'idea'
            });

            return Response.json({ 
                success: true,
                action: 'created',
                trade: result
            });
        }

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});