const { pool, withTransaction } = require('../../db');
const { taskSchema } = require('../../schemas');

const mapTask = (row, items) => ({
    id: row.id.toString(),
    nfeKey: row.chave_nfe,
    nfeNumber: row.numero_nfe,
    type: row.tipo,
    status: row.status,
    customerName: row.nome_cliente,
    address: {
        street: row.rua,
        number: row.numero,
        city: row.cidade,
        state: row.estado,
        zip: row.cep,
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
        neighborhood: row.bairro
    },
    items: items.map(i => ({
        id: i.id.toString(),
        description: i.descricao,
        quantity: parseFloat(i.quantidade),
        weight: parseFloat(i.peso),
        priority: i.prioridade,
        status: i.status,
        unitPrice: i.preco_unitario ? parseFloat(i.preco_unitario) : undefined,
        totalPrice: i.valor_total ? parseFloat(i.valor_total) : undefined
    })),
    scheduledTime: row.agendado_para,
    priority: row.prioridade,
    driverId: row.motorista_id ? row.motorista_id.toString() : null,
    proof: row.comprovante_horario ? {
        timestamp: row.comprovante_horario,
        notes: row.comprovante_notas,
        signature: row.comprovante_assinatura,
        receiverName: row.comprovante_recebedor_nome,
        receiverCpf: row.comprovante_recebedor_cpf
    } : undefined,
    totalValue: row.valor_total ? parseFloat(row.valor_total) : undefined,
    routeOrder: row.ordem_rota || 0,
    deliveryStartTime: row.inicio_entrega || undefined,
    deliveryEndTime: row.fim_entrega || undefined,
    deliveryDurationMinutes: row.tempo_entrega_minutos || undefined,
    loadNumber: row.numero_carga || undefined,
    expeditionStatus: row.status_expedicao || 'PENDING'
});

const getTasks = async (req, res) => {
    try {
        let query = 'SELECT t.*, i.id as item_id, i.descricao, i.quantidade, i.peso, i.prioridade as item_prioridade, i.status as item_status, i.preco_unitario, i.valor_total as item_valor_total, i.conferido, i.quantidade_expedida FROM tarefas t LEFT JOIN itens_tarefa i ON t.id = i.tarefa_id';
        let params = [];

        if (req.user.role === 'DRIVER') {
            query += ' WHERE t.motorista_id = ?';
            params.push(req.user.id);
        }
        
        query += ' ORDER BY t.id DESC, i.id ASC';

        const [rows] = await pool.query(query, params);
        
        const tasksMap = new Map();

        rows.forEach(row => {
            if (!tasksMap.has(row.id)) {
                tasksMap.set(row.id, {
                    id: row.id.toString(),
                    nfeKey: row.chave_nfe,
                    nfeNumber: row.numero_nfe,
                    type: row.tipo,
                    status: row.status,
                    customerName: row.nome_cliente,
                    address: {
                        street: row.rua,
                        number: row.numero,
                        city: row.cidade,
                        state: row.estado,
                        zip: row.cep,
                        lat: parseFloat(row.lat),
                        lng: parseFloat(row.lng),
                        neighborhood: row.bairro
                    },
                    items: [],
                    scheduledTime: row.agendado_para,
                    priority: row.prioridade,
                    driverId: row.motorista_id ? row.motorista_id.toString() : null,
                    proof: row.comprovante_horario ? {
                        timestamp: row.comprovante_horario,
                        notes: row.comprovante_notas,
                        signature: row.comprovante_assinatura,
                        receiverName: row.comprovante_recebedor_nome,
                        receiverCpf: row.comprovante_recebedor_cpf
                    } : undefined,
                    totalValue: row.valor_total ? parseFloat(row.valor_total) : undefined,
                    routeOrder: row.ordem_rota || 0,
                    deliveryStartTime: row.inicio_entrega || undefined,
                    deliveryEndTime: row.fim_entrega || undefined,
                    deliveryDurationMinutes: row.tempo_entrega_minutos || undefined,
                    loadNumber: row.numero_carga || undefined,
                    expeditionStatus: row.status_expedicao || 'PENDING'
                });
            }

            if (row.item_id) {
                tasksMap.get(row.id).items.push({
                    id: row.item_id.toString(),
                    description: row.descricao,
                    quantity: parseFloat(row.quantidade),
                    weight: parseFloat(row.peso),
                    priority: row.item_prioridade,
                    status: row.item_status,
                    unitPrice: row.preco_unitario ? parseFloat(row.preco_unitario) : undefined,
                    totalPrice: row.item_valor_total ? parseFloat(row.item_valor_total) : undefined,
                    checked: !!row.conferido,
                    shippedQuantity: row.quantidade_expedida ? parseFloat(row.quantidade_expedida) : undefined
                });
            }
        });

        res.json(Array.from(tasksMap.values()));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

const createTask = async (req, res) => {
    const validation = taskSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: validation.error.format() });
    }
    const t = validation.data;

    try {
        const result = await withTransaction(async (conn) => {
            const [taskResult] = await conn.query(
                `INSERT INTO tarefas (chave_nfe, numero_nfe, tipo, status, nome_cliente, rua, numero, cidade, estado, cep, lat, lng, agendado_para, prioridade, motorista_id, valor_total, bairro, numero_carga, status_expedicao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    t.nfeKey, t.nfeNumber, t.type, t.status, t.customerName,
                    t.address?.street, t.address?.number, t.address?.city, t.address?.state, t.address?.zip, t.address?.lat, t.address?.lng,
                    t.scheduledTime, t.priority, t.driverId, t.totalValue, t.address?.neighborhood, t.loadNumber, t.expeditionStatus || 'PENDING'
                ]
            );
            const taskId = taskResult.insertId;

            for (const item of t.items) {
                await conn.query(
                    `INSERT INTO itens_tarefa (tarefa_id, descricao, quantidade, peso, prioridade, status, preco_unitario, valor_total, conferido, quantidade_expedida)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        taskId, item.description, item.quantity, item.weight, item.priority, item.status, item.unitPrice, item.totalPrice, item.checked || false, item.shippedQuantity
                    ]
                );
            }
            return taskId;
        });

        res.status(201).json({ message: 'Task created', id: result.toString() });
    } catch (err) {
        console.error('Transaction failed:', err);
        res.status(500).json({ error: 'Failed to save task' });
    }
};

const updateTask = async (req, res) => {
    const { id } = req.params;
    const t = req.body;

    try {
        await withTransaction(async (conn) => {
            let deliveryDurationMinutes = null;
            if (t.deliveryStartTime && t.deliveryEndTime) {
                const startTime = new Date(t.deliveryStartTime);
                const endTime = new Date(t.deliveryEndTime);
                deliveryDurationMinutes = Math.round((endTime - startTime) / 1000 / 60);
            }

            await conn.query(
                `UPDATE tarefas SET status = ?, comprovante_notas = ?, comprovante_assinatura = ?, comprovante_horario = ?, comprovante_recebedor_nome = ?, comprovante_recebedor_cpf = ?, motorista_id = ?, ordem_rota = ?, inicio_entrega = ?, fim_entrega = ?, tempo_entrega_minutos = ?, status_expedicao = ?
         WHERE id = ?`,
                [
                    t.status, t.proof?.notes, t.proof?.signature, t.proof?.timestamp, t.proof?.receiverName, t.proof?.receiverCpf,
                    t.driverId, t.routeOrder, t.deliveryStartTime, t.deliveryEndTime, deliveryDurationMinutes, t.expeditionStatus || 'PENDING',
                    id
                ]
            );

            if (t.items && Array.isArray(t.items)) {
                for (const item of t.items) {
                    await conn.query(
                        `UPDATE itens_tarefa SET status = ?, conferido = ?, quantidade_expedida = ? WHERE id = ?`,
                        [item.status, item.checked || false, item.shippedQuantity, item.id]
                    );
                }
            }

            if ((t.status === 'COMPLETED' || t.status === 'CONCLUIDO') && t.driverId) {
                const title = 'Tarefa Concluída';
                const message = `Entrega para ${t.customerName} finalizada com sucesso.`;
                const now = new Date();

                const notificationPromises = [
                    conn.query(
                        `INSERT INTO notificacoes (usuario_id, titulo, mensagem, horario) VALUES (?, ?, ?, ?)`,
                        [t.driverId, title, message, now]
                    )
                ];

                const [admins] = await conn.query('SELECT id FROM usuarios WHERE funcao = "ADMIN"');
                for (const admin of admins) {
                    notificationPromises.push(
                        conn.query(
                            `INSERT INTO notificacoes (usuario_id, titulo, mensagem, horario) VALUES (?, ?, ?, ?)`,
                            [admin.id, title, message, now]
                        )
                    );
                }
                await Promise.all(notificationPromises);
            }
        });

        res.json({ message: 'Task updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

const importTasks = async (req, res) => {
    const tasks = req.body;
    if (!Array.isArray(tasks)) {
        return res.status(400).json({ error: 'Body must be an array of tasks' });
    }
    const invalid = tasks
        .map((t, index) => ({ index, validation: taskSchema.safeParse(t) }))
        .find(v => !v.validation.success);
    if (invalid) {
        return res.status(400).json({ index: invalid.index, error: invalid.validation.error.format() });
    }

    try {
        await withTransaction(async (conn) => {
            // Optional: Clear existing tasks if it's a full replace import, 
            // but usually imports are additive or update-based. 
            // Assuming additive/upsert for now based on typical "import" behavior.
            
            for (const t of tasks) {
                // Check if task exists by NFe key or ID
                let existingId = null;
                if (t.id && !t.id.startsWith('temp')) {
                    const [rows] = await conn.query('SELECT id FROM tarefas WHERE id = ?', [t.id]);
                    if (rows.length > 0) existingId = rows[0].id;
                }
                if (!existingId && t.nfeKey) {
                    const [rows] = await conn.query('SELECT id FROM tarefas WHERE chave_nfe = ?', [t.nfeKey]);
                    if (rows.length > 0) existingId = rows[0].id;
                }

                if (existingId) {
                    // Update existing
                    let deliveryDurationMinutes = null;
                    if (t.deliveryStartTime && t.deliveryEndTime) {
                         const startTime = new Date(t.deliveryStartTime);
                         const endTime = new Date(t.deliveryEndTime);
                         deliveryDurationMinutes = Math.round((endTime - startTime) / 1000 / 60);
                    }
                    
                    await conn.query(
                        `UPDATE tarefas SET status = ?, motorista_id = ?, prioridade = ?, agendado_para = ?, valor_total = ?, numero_carga = ?, status_expedicao = ?, ordem_rota = ?, inicio_entrega = ?, fim_entrega = ?, tempo_entrega_minutos = ?
                         WHERE id = ?`,
                        [
                            t.status, t.driverId, t.priority, t.scheduledTime, t.totalValue, t.loadNumber, t.expeditionStatus || 'PENDING', t.routeOrder, t.deliveryStartTime, t.deliveryEndTime, deliveryDurationMinutes,
                            existingId
                        ]
                    );
                    
                    // Re-create items (simpler than diffing)
                    await conn.query('DELETE FROM itens_tarefa WHERE tarefa_id = ?', [existingId]);
                    if (t.items && Array.isArray(t.items)) {
                        for (const item of t.items) {
                            await conn.query(
                                `INSERT INTO itens_tarefa (tarefa_id, descricao, quantidade, peso, prioridade, status, preco_unitario, valor_total, conferido, quantidade_expedida)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [existingId, item.description, item.quantity, item.weight, item.priority, item.status, item.unitPrice, item.totalPrice, item.checked || false, item.shippedQuantity]
                            );
                        }
                    }

                } else {
                    // Create new
                    const [taskResult] = await conn.query(
                        `INSERT INTO tarefas (chave_nfe, numero_nfe, tipo, status, nome_cliente, rua, numero, cidade, estado, cep, lat, lng, agendado_para, prioridade, motorista_id, valor_total, bairro, numero_carga, status_expedicao)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            t.nfeKey, t.nfeNumber, t.type, t.status, t.customerName,
                            t.address?.street, t.address?.number, t.address?.city, t.address?.state, t.address?.zip, t.address?.lat, t.address?.lng,
                            t.scheduledTime, t.priority, t.driverId, t.totalValue, t.address?.neighborhood, t.loadNumber, t.expeditionStatus || 'PENDING'
                        ]
                    );
                    const newTaskId = taskResult.insertId;

                    if (t.items && Array.isArray(t.items)) {
                        for (const item of t.items) {
                            await conn.query(
                                `INSERT INTO itens_tarefa (tarefa_id, descricao, quantidade, peso, prioridade, status, preco_unitario, valor_total, conferido, quantidade_expedida)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [newTaskId, item.description, item.quantity, item.weight, item.priority, item.status, item.unitPrice, item.totalPrice, item.checked || false, item.shippedQuantity]
                            );
                        }
                    }
                }
            }
        });
        res.json({ message: `${tasks.length} tasks imported successfully` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error during import' });
    }
};

const bulkUpdateTasks = async (req, res) => {
    const tasks = req.body;
    if (!Array.isArray(tasks)) {
        return res.status(400).json({ error: 'Body must be an array of tasks' });
    }

    try {
        await withTransaction(async (conn) => {
            for (const t of tasks) {
                let deliveryDurationMinutes = null;
                if (t.deliveryStartTime && t.deliveryEndTime) {
                    const startTime = new Date(t.deliveryStartTime);
                    const endTime = new Date(t.deliveryEndTime);
                    deliveryDurationMinutes = Math.round((endTime - startTime) / 1000 / 60);
                }

                await conn.query(
                    `UPDATE tarefas SET status = ?, comprovante_notas = ?, comprovante_assinatura = ?, comprovante_horario = ?, comprovante_recebedor_nome = ?, comprovante_recebedor_cpf = ?, motorista_id = ?, ordem_rota = ?, inicio_entrega = ?, fim_entrega = ?, tempo_entrega_minutos = ?, status_expedicao = ?
             WHERE id = ?`,
                    [
                        t.status, t.proof?.notes, t.proof?.signature, t.proof?.timestamp, t.proof?.receiverName, t.proof?.receiverCpf,
                        t.driverId, t.routeOrder, t.deliveryStartTime, t.deliveryEndTime, deliveryDurationMinutes, t.expeditionStatus || 'PENDING',
                        t.id
                    ]
                );

                if (t.items && Array.isArray(t.items)) {
                    for (const item of t.items) {
                        await conn.query(
                            `UPDATE itens_tarefa SET status = ?, conferido = ?, quantidade_expedida = ? WHERE id = ?`,
                            [item.status, item.checked || false, item.shippedQuantity, item.id]
                        );
                    }
                }
            }
        });
        res.json({ message: `${tasks.length} tasks updated successfully` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error during bulk update' });
    }
};

module.exports = { getTasks, createTask, updateTask, bulkUpdateTasks, importTasks };
