const { pool } = require('../../db');

const getReports = async (req, res) => {
    try {
        const { startDate, endDate, driverId } = req.query;
        console.log(`[Reports] Request: start=${startDate}, end=${endDate}, driver=${driverId}`);

        let where = "WHERE 1=1";
        const params = [];

        if (startDate && endDate) {
            where += " AND agendado_para >= ? AND agendado_para <= ?";
            params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
        }

        if (driverId && driverId !== 'all') {
            where += " AND motorista_id = ?";
            params.push(driverId);
        }

        // Main Stats Query
        const statsQuery = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status IN ('COMPLETED', 'CONCLUIDO') THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status IN ('PARTIAL', 'PARCIAL') THEN 1 ELSE 0 END) as partial,
                SUM(CASE WHEN status IN ('FAILED', 'FALHOU') THEN 1 ELSE 0 END) as failed,
                SUM(valor_total) as totalValue,
                SUM(CASE WHEN status IN ('COMPLETED', 'CONCLUIDO', 'PARTIAL', 'PARCIAL') THEN valor_total ELSE 0 END) as deliveredValue,
                SUM(CASE WHEN status_expedicao != 'DISPATCHED' AND status NOT IN ('COMPLETED', 'CONCLUIDO', 'FAILED', 'FALHOU') THEN 1 ELSE 0 END) as pendingExpedition,
                SUM(CASE WHEN status_expedicao = 'DISPATCHED' OR status IN ('COMPLETED', 'CONCLUIDO') THEN 1 ELSE 0 END) as dispatchedCount,
                SUM((SELECT COUNT(*) FROM itens_tarefa WHERE tarefa_id = tarefas.id)) as totalItems
            FROM tarefas
            ${where}
        `;

        const [results] = await pool.query(statsQuery, params);
        const stats = results[0] || {};

        // 2. Extra Warehouse Stats
        const dispatchedItemsQuery = `
            SELECT SUM(quantity) as total 
            FROM (
                SELECT (SELECT COUNT(*) FROM itens_tarefa WHERE tarefa_id = t.id) as quantity
                FROM tarefas t
                ${where} AND (status_expedicao = 'DISPATCHED' OR status IN ('COMPLETED', 'CONCLUIDO'))
            ) as sub
        `;
        const [dispatchedItemsResult] = await pool.query(dispatchedItemsQuery, params);
        const dispatchedItemsCount = dispatchedItemsResult[0]?.total || 0;

        // Aging Count (> 24h Pending Expedition)
        const agingQuery = `
            SELECT COUNT(*) as total
            FROM tarefas
            ${where} 
            AND status_expedicao != 'DISPATCHED' 
            AND status NOT IN ('COMPLETED', 'CONCLUIDO', 'FAILED', 'FALHOU')
            AND agendado_para < (NOW() - INTERVAL 24 HOUR)
        `;
        const [agingResult] = await pool.query(agingQuery, params);
        const agingCount = agingResult[0]?.total || 0;


        // 3. Bottlenecks Query (Global Warehouse Risk)
        const bottlenecksQuery = `
            SELECT id, nome_cliente as customerName, agendado_para as scheduledTime, status, status_expedicao as expeditionStatus,
            (SELECT COUNT(*) FROM itens_tarefa WHERE tarefa_id = tarefas.id) as itemCount
            FROM tarefas 
            ${where} 
            AND status_expedicao != 'DISPATCHED' 
            AND status NOT IN ('COMPLETED', 'CONCLUIDO', 'FAILED', 'FALHOU')
            ORDER BY agendado_para ASC 
            LIMIT 5
        `;
        const [bottlenecks] = await pool.query(bottlenecksQuery, params);

        // 4. Drivers Performance Query
        // Note: motorista_id is VARCHAR, usuarios.id is INT
        // Try to match by converting VARCHAR to INT, or match as string
        const driversQuery = `
            SELECT 
                COALESCE(u.nome, 'Sem Motorista') as name,
                t.motorista_id as id,
                COUNT(*) as total,
                SUM(CASE WHEN t.status IN ('COMPLETED', 'CONCLUIDO') THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN t.status IN ('FAILED', 'FALHOU') THEN 1 ELSE 0 END) as failed,
                SUM(t.valor_total) as value
            FROM tarefas t
            LEFT JOIN usuarios u ON (
                (t.motorista_id REGEXP '^[0-9]+$' AND CAST(t.motorista_id AS UNSIGNED) = u.id) 
                OR t.motorista_id = CAST(u.id AS CHAR)
            )
            ${where}
            GROUP BY t.motorista_id, u.nome
        `;
        const [driversData] = await pool.query(driversQuery, params);

        res.json({
            metrics: {
                total: stats.total || 0,
                completed: stats.completed || 0,
                partial: stats.partial || 0,
                failed: stats.failed || 0,
                totalValue: parseFloat(stats.totalValue || 0),
                deliveredValue: parseFloat(stats.deliveredValue || 0),
                totalItems: parseInt(stats.totalItems || 0),
                pendingExpedition: parseInt(stats.pendingExpedition || 0),
                dispatchedCount: parseInt(stats.dispatchedCount || 0),
                dispatchedItems: parseInt(dispatchedItemsCount || 0),
                agingCount: parseInt(agingCount || 0),
                successRate: stats.total > 0 ? ((parseFloat(stats.completed) + parseFloat(stats.partial)) / parseFloat(stats.total)) * 100 : 0
            },
            bottlenecks: bottlenecks.map(b => ({
                id: b.id.toString(),
                customerName: b.customerName,
                scheduledTime: b.scheduledTime,
                status: b.status,
                items: Array(b.itemCount).fill({})
            })),
            drivers: driversData.map(d => {
                const total = parseInt(d.total || 0);
                const completed = parseInt(d.completed || 0);
                const failed = parseInt(d.failed || 0);
                const value = parseFloat(d.value || 0);

                return {
                    id: d.id ? d.id.toString() : 'unassigned',
                    name: d.name || 'Sem Motorista',
                    metrics: {
                        total,
                        completed,
                        failed,
                        value,
                        score: total > 0 ? Math.max(0, Math.min(10, 10 - ((failed / total) * 50))) : 0
                    }
                };
            })
        });

    } catch (err) {
        console.error("Reports Error:", err);
        res.status(500).json({ error: 'Report generation failed' });
    }
};

const registerDispatchedLoad = async (req, res) => {
    const { loadNumber, driverId, dispatchedAt, status, totalTasks } = req.body;
    try {
        await pool.query(
            'INSERT INTO manifestos_carga (numero_carga, motorista_id, data_expedicao, status, total_tarefas) VALUES (?, ?, ?, ?, ?)',
            [loadNumber, driverId, dispatchedAt, status, totalTasks]
        );
        res.status(201).json({ message: 'Load registered' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to register load' });
    }
};

const getDispatchedLoads = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM manifestos_carga ORDER BY data_expedicao DESC');
        res.json(rows.map(r => ({
            id: r.id.toString(),
            loadNumber: r.numero_carga,
            driverId: r.motorista_id ? r.motorista_id.toString() : null,
            dispatchedAt: r.data_expedicao,
            status: r.status,
            totalTasks: r.total_tarefas
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch loads' });
    }
};

module.exports = { getReports, registerDispatchedLoad, getDispatchedLoads };
