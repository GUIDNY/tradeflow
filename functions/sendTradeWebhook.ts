import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { tradeId } = await req.json();

        if (!tradeId) {
            return Response.json({ error: 'Missing tradeId' }, { status: 400 });
        }

        // Get the trade idea
        const trade = await base44.entities.TradeIdea.get(tradeId);

        if (!trade) {
            return Response.json({ error: 'Trade not found' }, { status: 404 });
        }

        if (trade.status !== 'idea') {
            return Response.json({ error: 'Trade already processed' }, { status: 400 });
        }

        // Update status to approved
        await base44.entities.TradeIdea.update(tradeId, { status: 'approved' });

        // Send to webhook
        const webhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
        
        if (!webhookUrl) {
            await base44.entities.TradeIdea.update(tradeId, { status: 'error' });
            return Response.json({ 
                error: 'Webhook URL not configured',
                message: 'יש להגדיר את N8N_WEBHOOK_URL בהגדרות האפליקציה'
            }, { status: 500 });
        }

        const webhookPayload = {
            tradeId: trade.id,
            symbol: trade.symbol,
            side: trade.side,
            entry_price: trade.entry_price,
            stop_loss: trade.stop_loss,
            take_profit: trade.take_profit,
            qty: trade.qty,
            risk_reward: trade.risk_reward,
            reason: trade.reason
        };

        // Use the hardcoded webhook URL
        const finalWebhookUrl = "https://sayyess.app.n8n.cloud/webhook/bestaction";

        const webhookResponse = await fetch(finalWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookPayload)
        });

        if (!webhookResponse.ok) {
            await base44.entities.TradeIdea.update(tradeId, { status: 'error' });
            return Response.json({ 
                error: 'Failed to send to webhook',
                status: webhookResponse.status
            }, { status: 500 });
        }

        // Update status to sent
        await base44.entities.TradeIdea.update(tradeId, { status: 'sent' });

        return Response.json({ 
            success: true,
            message: 'העסקה נשלחה בהצלחה',
            trade: trade
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});