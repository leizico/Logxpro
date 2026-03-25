const { pool, withTransaction } = require('../../db');

const getDispatchedLoads = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM manifestos_carga');
        res.json(rows.map(r => ({
            loadNumber: r.numero_carga,
            driverId: r.motorista_id ? r.motorista_id.toString() : null,
            dispatchedAt: r.data_expedicao,
            status: r.status,
            totalTasks: r.total_tarefas
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

const createDispatchedLoad = async (req, res) => {
    const { loadNumber, driverId, dispatchedAt, status, totalTasks, taskIds } = req.body;
    try {
        await withTransaction(async (conn) => {
            // 1. Create Manifest
            await conn.query(
                'INSERT INTO manifestos_carga (numero_carga, motorista_id, data_expedicao, status, total_tarefas) VALUES (?, ?, ?, ?, ?)',
                [loadNumber, driverId, dispatchedAt, status, totalTasks]
            );

            // 2. Update Linked Tasks (Bulk Status Update)
            if (taskIds && taskIds.length > 0) {
                const placeholders = taskIds.map(() => '?').join(',');
                await conn.query(
                    `UPDATE tarefas SET status_expedicao = 'DISPATCHED' WHERE id IN (${placeholders})`,
                    taskIds
                );
            }
        });

        res.status(201).json({ message: 'Manifest created and tasks updated' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Load already dispatched' });
        }
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

module.exports = { getDispatchedLoads, createDispatchedLoad };
